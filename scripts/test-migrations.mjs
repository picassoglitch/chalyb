#!/usr/bin/env node
// pnpm test:migrations — applies every Supabase migration, in order, to an
// in-process Postgres (PGlite), TWICE, and checks the append-only consent log.
// No Docker, no project: the Supabase pieces the migrations lean on (the auth
// schema, auth.uid(), the API roles) are stubbed below.

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const STUBS = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  create schema if not exists extensions;
  do $$ begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
  end $$;
`;

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(STUBS);

async function applyAll(round) {
  for (const f of files) {
    try {
      await db.exec(readFileSync(new URL(f, DIR), 'utf8'));
    } catch (err) {
      throw new Error(`round ${round}: ${f} failed: ${err.message}`);
    }
  }
}

await applyAll(1);
// Re-running must be a no-op for the migrations that promise idempotency.
// Older one-shot migrations are excluded from round 2: 0001–0010 (0010 says
// so itself), and 0015/0016/0031, whose plain ADD COLUMN / RENAME fail on a
// second run. They predate the idempotency rule; every migration from 0032 on
// must re-run cleanly.
const ONE_SHOT = new Set(files.filter((f) => /^00(0\d|10|15|16|31)_/.test(f)));
for (const f of files.filter((f) => !ONE_SHOT.has(f))) {
  try {
    await db.exec(readFileSync(new URL(f, DIR), 'utf8'));
  } catch (err) {
    console.error(`NOT IDEMPOTENT: ${f}: ${err.message}`);
    process.exitCode = 1;
  }
}

// consent_events is append-only.
const uid = (await db.query(`insert into auth.users (email) values ('t@example.com') returning id`))
  .rows[0].id;
await db.query(
  `insert into public.consent_events (consent_id, event_type, user_id, timestamp_utc, locale, surface, ui_version, event_hash)
   values (gen_random_uuid(), 'trial_started', $1, now(), 'es-MX', 'test', 'test', 'h1')`,
  [uid],
);
for (const [label, sql] of [
  ['UPDATE', `update public.consent_events set surface = 'x'`],
  ['DELETE', `delete from public.consent_events`],
  ['TRUNCATE', `truncate public.consent_events`],
]) {
  try {
    await db.exec(sql);
    console.error(`FAIL: ${label} on consent_events succeeded`);
    process.exitCode = 1;
  } catch {
    console.log(`ok: ${label} on consent_events refused`);
  }
}
// One notice per (user, kind, period).
await db.query(
  `insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version) values ($1,'trial_7d','trial:2026-10-30','e2','1')`,
  [uid],
);
try {
  await db.query(
    `insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version) values ($1,'trial_7d','trial:2026-10-30','e2','1')`,
    [uid],
  );
  console.error('FAIL: duplicate email_dispatches row accepted');
  process.exitCode = 1;
} catch {
  console.log('ok: duplicate notice refused');
}

// ── Consumption caps (0046): billing unit, admission, settlement ──────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const engineId = (await db.query(`select id from public.engines where slug = 'chalybclip'`))
    .rows[0]?.id;
  check('chalybclip engine is seeded', !!engineId);
  const u2 = (
    await db.query(`insert into auth.users (email) values ('caps@example.com') returning id`)
  ).rows[0].id;
  await db.query(`insert into public.profiles (id) values ($1) on conflict do nothing`, [u2]);

  // billable_tokens: cost wins, llm.tokens falls back to amount, floor 1.
  await db.query(
    `insert into public.usage_events (user_id, engine_id, kind, amount, source_id, cost_usd_micros) values
       ($1,$2,'llm.tokens',1000,'b1',null), ($1,$2,'llm.tokens',1000,'b2',8000),
       ($1,$2,'transcription.seconds',60,'b3',0), ($1,$2,'storage.mb',5,'b4',null)`,
    [u2, engineId],
  );
  const bt = Object.fromEntries(
    (
      await db.query(
        `select source_id, billable_tokens from public.usage_events where user_id = $1`,
        [u2],
      )
    ).rows.map((r) => [r.source_id, Number(r.billable_tokens)]),
  );
  check(
    'billable_tokens = cost or tokens plus the 160% default margin, floor 1',
    bt.b1 === 2600 && bt.b2 === 5200 && bt.b3 === 1 && bt.b4 === 1,
    JSON.stringify(bt),
  );

  // The margin is frozen per row: re-pricing a row means changing its own
  // margin_percent, never the setting. Run the admission math at 0%.
  await db.query(`insert into public.app_settings (key, value) values ('usage_margin_percent', '0'::jsonb)
                  on conflict (key) do update set value = excluded.value`);
  await db.query(`update public.usage_events set margin_percent = 0 where user_id = $1`, [u2]);
  const b0 = (
    await db.query(
      `select sum(billable_tokens)::int t from public.usage_events where user_id = $1`,
      [u2],
    )
  ).rows[0].t;
  check('margin setting applies, per row', b0 === 3002, String(b0));

  const caps = (o = {}) =>
    JSON.stringify({
      allocation: 10000,
      unlimited: false,
      jobs_per_month: 3,
      minutes_per_month: 100,
      max_concurrent_jobs: 1,
      active_streams: 0,
      streams_per_month: 0,
      ...o,
    });
  const admit = async (job, est, fee = 0, minutes = 10, c = caps(), cls = 'job') =>
    (
      await db.query(
        `select public.admit_usage($1,$2,$3,$4,'clips.pipeline','standard',$5,$6,$7,0,3600,$8::jsonb) as r`,
        [u2, engineId, job, cls, est, fee, minutes, c],
      )
    ).rows[0].r;
  const balance = async () =>
    (await db.query(`select public.usage_balance($1) as r`, [u2])).rows[0].r;

  // used so far: 1000+2000+1+1 = 3002 → 6998 left of 10000.
  const a1 = await admit('j1', 5000, 1000);
  check('admit within balance', a1.allowed === true, JSON.stringify(a1));
  const again = await admit('j1', 5000, 1000);
  check(
    're-admit same job returns the same reservation',
    again.reservation_id === a1.reservation_id,
  );
  const a2 = await admit('j2', 10);
  check(
    'second concurrent job refused',
    a2.allowed === false && a2.reason === 'concurrency',
    JSON.stringify(a2),
  );
  const a3 = await admit('j3', 9000, 0, 10, caps({ max_concurrent_jobs: 5 }));
  check(
    'no_tokens when estimate exceeds what is left',
    a3.allowed === false && a3.reason === 'no_tokens',
    JSON.stringify(a3),
  );

  // j1 reports 2000 of its 5000 estimate: reserved = 3000 + fee 1000.
  await db.query(
    `insert into public.usage_events (user_id, engine_id, kind, amount, source_id, cost_usd_micros, reservation_id)
                  values ($1,$2,'llm.tokens',0,'j1e1',8000,$3)`,
    [u2, engineId, a1.reservation_id],
  );
  const b1 = await balance();
  check(
    'reservation holds estimate minus what it reported',
    Number(b1.reserved) === 4000 && Number(b1.used) === 5002,
    JSON.stringify(b1),
  );

  // The boost fee is a price already: no margin even when one is set.
  await db.query(
    `update public.app_settings set value = '50'::jsonb where key = 'usage_margin_percent'`,
  );
  const s1 = (
    await db.query(`select public.settle_usage_reservation($1,$2,'succeeded') as r`, [
      a1.reservation_id,
      engineId,
    ])
  ).rows[0].r;
  const s2 = (
    await db.query(`select public.settle_usage_reservation($1,$2,'succeeded') as r`, [
      a1.reservation_id,
      engineId,
    ])
  ).rows[0].r;
  const fee = (
    await db.query(
      `select count(*)::int n, sum(billable_tokens)::int t from public.usage_events where kind = 'boost.fee' and user_id = $1`,
      [u2],
    )
  ).rows[0];
  check(
    'settle charges the boost fee exactly once',
    s1.ok && s2.already && fee.n === 1 && fee.t === 1000,
    JSON.stringify({ s1, s2, fee }),
  );
  const b2 = await balance();
  check(
    'settled reservation no longer holds tokens',
    Number(b2.reserved) === 0 && Number(b2.used) === 6002,
    JSON.stringify(b2),
  );
  await db.query(
    `update public.app_settings set value = '0'::jsonb where key = 'usage_margin_percent'`,
  );
  const late = await admit('j1', 1);
  check(
    'a settled job cannot be re-admitted',
    late.allowed === false && late.reason === 'already_settled',
  );

  const a4 = await admit('j4', 10, 0, 95);
  check(
    'monthly minutes cap',
    a4.allowed === false && a4.reason === 'minutes_cap',
    JSON.stringify(a4),
  );
  await admit('j5', 10);
  await db.query(
    `update public.usage_reservations set status = 'failed' where external_job_id = 'j5'`,
  );
  const a6 = await admit('j6', 10, 0, 10, caps({ jobs_per_month: 2 })); // j1 succeeded + j5 failed
  check(
    'monthly jobs cap counts failed jobs',
    a6.allowed === false && a6.reason === 'jobs_cap',
    JSON.stringify(a6),
  );

  const s = await admit('live1', 0, 0, 0, caps(), 'stream');
  check(
    'streams refused when the tier has none',
    s.allowed === false && s.reason === 'streams_cap',
    JSON.stringify(s),
  );

  await db.query(
    `update public.usage_reservations set status = 'open', expires_at = now() - interval '1 minute' where external_job_id = 'j5'`,
  );
  await balance();
  const st = (
    await db.query(`select status from public.usage_reservations where external_job_id = 'j5'`)
  ).rows[0].status;
  check('unsettled reservations expire', st === 'expired', st);

  const mx = (
    await db.query(
      `select public.engine_usage_metrics($1, public.usage_period_start(), now() - interval '7 days') as r`,
      [engineId],
    )
  ).rows[0].r;
  check(
    'engine metrics sum billable tokens and real cost',
    Number(mx.month.billable) === 6002 &&
      Number(mx.month.cost_usd_micros) === 20000 &&
      mx.top_users.length === 1,
    JSON.stringify(mx.month),
  );

  const un = await admit('j7', 1e9, 0, 1000, caps({ unlimited: true }));
  check('unlimited (admin) is never refused', un.allowed === true, JSON.stringify(un));
}

// ── Legal P6 (0055): retention purge, ARCO, takedowns ─────────────────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const u = (
    await db.query(`insert into auth.users (email) values ('ret@example.com') returning id`)
  ).rows[0].id;
  const cb = async (id, closed) =>
    (
      await db.query(
        `insert into public.chargebacks (user_id, mp_payment_id, amount_cents, mp_status, opened_at, closed_at)
       values ($1, $2, 99700, 'closed', $3::timestamptz - interval '30 days', $3) returning id`,
        [u, id, closed],
      )
    ).rows[0].id;
  const oldCb = await cb('p-old', '2019-01-01T00:00:00Z');
  const newCb = await cb('p-new', '2024-01-01T00:00:00Z');
  await db.query(
    `insert into public.account_restrictions (user_id, kind, chargeback_id, lifted_at) values ($1,'restricted',$2, now())`,
    [u, oldCb],
  );
  await db.query(
    `insert into public.account_restrictions (user_id, kind, chargeback_id) values ($1,'restricted',$2)`,
    [u, newCb],
  );
  await db.query(
    `insert into public.payment_method_fingerprints (hash, user_id, created_at) values ('fp-old',$1,'2019-06-01'), ('fp-new',$1,'2025-06-01')`,
    [u],
  );
  const r = (await db.query(`select public.legal_retention_purge('2026-10-03T00:00:00Z') as r`))
    .rows[0].r;
  check(
    'retention purges marks older than 72 months',
    r.chargebacks === 1 && r.account_restrictions === 1 && r.payment_method_fingerprints === 1,
    JSON.stringify(r),
  );
  const left = (
    await db.query(
      `select (select count(*)::int from public.chargebacks where user_id=$1) c, (select count(*)::int from public.account_restrictions where user_id=$1) a, (select count(*)::int from public.payment_method_fingerprints where user_id=$1) f`,
      [u],
    )
  ).rows[0];
  check(
    'retention keeps marks inside 72 months',
    left.c === 1 && left.a === 1 && left.f === 1,
    JSON.stringify(left),
  );
  const again = (await db.query(`select public.legal_retention_purge('2026-10-03T00:00:00Z') as r`))
    .rows[0].r;
  check(
    'retention is idempotent',
    again.chargebacks === 0 && again.payment_method_fingerprints === 0,
    JSON.stringify(again),
  );
  const ce = (await db.query(`select count(*)::int n from public.consent_events`)).rows[0].n;
  check('retention never touches consent_events', ce >= 1, String(ce));
  try {
    await db.query(
      `insert into public.takedown_notices (claimant_name, claimant_contact, content_identification, right_statement, content_location) values ('', 'x', 'x', 'x', 'x')`,
    );
    check('a takedown without the minimum fields is refused', false);
  } catch {
    check('a takedown without the minimum fields is refused', true);
  }
  try {
    await db.query(
      `insert into public.arco_requests (user_id, right_kind, description, contact_email, respond_by) values ($1, 'delete-all', 'x', 'a@b.c', now())`,
      [u],
    );
    check('an unknown ARCO right is refused', false);
  } catch {
    check('an unknown ARCO right is refused', true);
  }
}

// ── 0056: who is still owed a change notice ───────────────────────────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else { console.error(`FAIL: ${label} ${extra}`); process.exitCode = 1; }
  };
  const mk = async (email) => {
    const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;
    await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do update set email = excluded.email`, [id, email]);
    return id;
  };
  const key = 'terminos:9.9';
  const d = async (uid, status, ageMin = 0) =>
    db.query(`insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version, delivery_status, sent_at)
              values ($1, 'terms_change', $2, 'terms_change', '1', $3, now() - ($4 || ' minutes')::interval)`, [uid, key, status, String(ageMin)]);
  const sent = await mk('n-sent@example.com'); await d(sent, 'sent');
  const delivered = await mk('n-deliv@example.com'); await d(delivered, 'delivered');
  const bounced = await mk('n-bounce@example.com'); await d(bounced, 'bounced');
  const fresh = await mk('n-fresh@example.com'); await d(fresh, 'pending', 2);
  const stale = await mk('n-stale@example.com'); await d(stale, 'pending', 30);
  const failed = await mk('n-failed@example.com'); await d(failed, 'failed');
  const never = await mk('n-never@example.com');
  const accepted = await mk('n-acc@example.com');
  await db.query(`insert into public.consent_events (consent_id, event_type, user_id, timestamp_utc, locale, surface, ui_version, event_hash, documents)
                  values (gen_random_uuid(), 'plan_changed', $1, now(), 'es-MX', 't', 't', 'h', '[{"doc":"terminos","version":"9.9"}]'::jsonb)`, [accepted]);
  const ids = new Set((await db.query(`select id from public.legal_change_notice_recipients('terminos', '9.9', $1, null, 1000)`, [key])).rows.map((r) => r.id));
  check('owed: never sent, failed, stale pending', ids.has(never) && ids.has(failed) && ids.has(stale));
  check('not owed: sent, delivered, bounced, in-flight pending, already accepted',
    ![sent, delivered, bounced, fresh, accepted].some((u) => ids.has(u)));
  const page1 = (await db.query(`select id from public.legal_change_notice_recipients('terminos', '9.9', $1, null, 1)`, [key])).rows;
  const page2 = (await db.query(`select id from public.legal_change_notice_recipients('terminos', '9.9', $1, $2, 1)`, [key, page1[0].id])).rows;
  check('keyset pagination moves forward', page1.length === 1 && page2.length === 1 && page2[0].id > page1[0].id);
}

console.log(
  `${files.length} migrations applied twice${process.exitCode ? ' — WITH FAILURES' : ''}`,
);
