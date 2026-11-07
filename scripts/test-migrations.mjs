#!/usr/bin/env node
// pnpm test:migrations — applies every Supabase migration, in order, to an
// in-process Postgres (PGlite), TWICE, and checks the append-only consent log.
// No Docker, no project: the Supabase pieces the migrations lean on (the auth
// schema, auth.uid(), the API roles) are stubbed below.

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../supabase/migrations/', import.meta.url);
// The hub's own migrations only (four-digit versions). The engines' 14-digit
// timestamp files (Chalito, Taquito) share this folder so one repo owns
// nexo-ai's ledger (docs/infra/supabase.md), but they need pg_cron,
// realtime.messages and their own roles, and they're tested in their own
// repos, not in PGlite. New hub migrations are timestamped (pnpm db:new) with
// a `hub_` prefix so they sort after applied versions and are tested here.
const files = readdirSync(DIR)
  .filter((f) => /^(\d{4}|\d{14}_hub)_.*\.sql$/.test(f))
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
    'monthly jobs cap counts a failed job with no output count reported',
    a6.allowed === false && a6.reason === 'jobs_cap' && a6.used === 2,
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

  // An abandoned job (expired, no usage reported) stops counting toward the
  // monthly caps; an expired one that did report usage still counts.
  const wide = caps({ max_concurrent_jobs: 5, minutes_per_month: 100 });
  const e1 = await admit('e1', 1, 0, 85, wide); // j1 10 + j5 10 (expired, unused) + 85
  check('an expired unused reservation frees its minutes', e1.allowed === true, JSON.stringify(e1));
  await db.query(`update public.usage_reservations set status = 'cancelled' where external_job_id = 'e1'`);
  await db.query(
    `insert into public.usage_events (user_id, engine_id, kind, amount, source_id, cost_usd_micros, reservation_id)
       select user_id, engine_id, 'llm.tokens', 0, 'j5e1', 0, id from public.usage_reservations where external_job_id = 'j5'`,
  );
  const e2 = await admit('e2', 1, 0, 85, wide);
  check(
    'an expired reservation that reported usage still counts',
    e2.allowed === false && e2.reason === 'minutes_cap',
    JSON.stringify(e2),
  );
  const e3 = await admit('e3', 1, 0, 10, caps({ max_concurrent_jobs: 5, jobs_per_month: 2 }));
  check(
    'and it counts as a job (j1 + j5 = 2)',
    e3.allowed === false && e3.reason === 'jobs_cap',
    JSON.stringify(e3),
  );

  const un = await admit('j7', 1e9, 0, 1000, caps({ unlimited: true }));
  check('unlimited (admin) is never refused', un.allowed === true, JSON.stringify(un));
}

// ── Failed runs (20261107000300): the month's first 3 with no output don't count
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
  const u = (
    await db.query(`insert into auth.users (email) values ('fails@example.com') returning id`)
  ).rows[0].id;
  await db.query(`insert into public.profiles (id) values ($1) on conflict do nothing`, [u]);
  const caps = (o = {}) =>
    JSON.stringify({
      allocation: 1e9,
      unlimited: false,
      jobs_per_month: 100,
      minutes_per_month: 100,
      max_concurrent_jobs: 1,
      active_streams: 1,
      streams_per_month: 100,
      ...o,
    });
  const admit = async (job, minutes, c = caps(), cls = 'job') =>
    (
      await db.query(
        `select public.admit_usage($1,$2,$3,$4,'clips.pipeline','standard',1,0,$5,0,3600,$6::jsonb) as r`,
        [u, engineId, job, cls, minutes, c],
      )
    ).rows[0].r;
  // Engines that report outputs call the 4-argument settle; failures here
  // report 0 unless a test says otherwise.
  const settle = async (res, outcome, outputs = 0) =>
    (
      await db.query(`select public.settle_usage_reservation($1,$2,$3,$4::integer) as r`, [
        res.reservation_id,
        engineId,
        outcome,
        outputs,
      ])
    ).rows[0].r;
  // An older engine: the 3-argument call, named like PostgREST sends it.
  const settleOld = async (res, outcome) =>
    (
      await db.query(
        `select public.settle_usage_reservation(p_reservation_id => $1, p_engine_id => $2, p_outcome => $3) as r`,
        [res.reservation_id, engineId, outcome],
      )
    ).rows[0].r;
  // How much of the month counts right now, as admit_usage reports it.
  const used = async (cls = 'job') => {
    const r = await admit(`probe-${cls}`, 0, caps({ jobs_per_month: 0, streams_per_month: 0, max_concurrent_jobs: 5, active_streams: 5 }), cls);
    return r.used;
  };

  // A real "used" figure first: one succeeded run of 20 minutes.
  await settle(await admit('ok1', 20), 'succeeded');
  check('a succeeded job counts', (await used()) === 1, String(await used()));

  // Three failed 25-minute runs: none of them uses the month.
  for (const n of [1, 2, 3]) {
    const r = await admit(`f${n}`, 25);
    check(`failed run ${n} admitted`, r.allowed === true, JSON.stringify(r));
    await settle(r, 'failed');
  }
  check('the first 3 failed runs do not count as jobs', (await used()) === 1, String(await used()));
  const fits = await admit('m1', 80); // 20 + 80 = 100: fits only if the 75 failed minutes are free
  check('nor as minutes', fits.allowed === true, JSON.stringify(fits));
  await settle(fits, 'cancelled');

  // The 4th failure counts, jobs and minutes (anti-abuse).
  await settle(await admit('f4', 30), 'failed');
  check('the 4th failed run counts as a job', (await used()) === 2, String(await used()));
  const over = await admit('m2', 60); // 20 + 30 + 60 = 110 > 100
  check(
    'and its minutes count',
    over.allowed === false && over.reason === 'minutes_cap' && Number(over.used) === 50,
    JSON.stringify(over),
  );
  const under = await admit('m3', 50); // 20 + 30 + 50 = 100
  check('exactly at the cap still fits', under.allowed === true, JSON.stringify(under));
  await settle(under, 'cancelled');

  // Which failures are free is fixed by order: the earliest 3.
  await db.query(
    `update public.usage_reservations
        set created_at = (select created_at from public.usage_reservations
                           where external_job_id = 'f1' and user_id = $1) - interval '1 millisecond'
      where external_job_id = 'f4' and user_id = $1`,
    [u],
  );
  const moved = await admit('m4', 60); // now f3 (25 min) is the 4th: 20 + 25 + 60 = 105
  check(
    'the free three are the earliest three',
    moved.allowed === false && Number(moved.used) === 45,
    JSON.stringify(moved),
  );

  // Last month's failures don't use this month's free retries.
  await db.query(
    `update public.usage_reservations set created_at = public.usage_period_start() - interval '1 day'
      where external_job_id in ('f1','f2','f3','f4') and user_id = $1`,
    [u],
  );
  await settle(await admit('g1', 5), 'failed');
  check('a new month starts with 3 free retries', (await used()) === 1, String(await used()));

  // Streams are unchanged: a failed stream still counts.
  const s1 = await admit('s1', 0, caps(), 'stream');
  check('stream admitted', s1.allowed === true, JSON.stringify(s1));
  await settle(s1, 'failed');
  check('a failed stream still counts', (await used('stream')) === 1, String(await used('stream')));

  // Codex P2: only an explicit "no output" makes a failure free.
  const before = await used(); // g1 is free: 0
  const old = await admit('o1', 5);
  const oldRes = await settleOld(old, 'failed');
  check('old 3-argument settle still works', oldRes.ok === true && oldRes.status === 'failed', JSON.stringify(oldRes));
  check('a failure settled without outputs counts', (await used()) === before + 1, String(await used()));
  const outs = async (job) =>
    (await db.query(`select outputs from public.usage_reservations where external_job_id = $1 and user_id = $2`, [job, u]))
      .rows[0].outputs;
  check('and stores outputs as not reported', (await outs('o1')) === null, String(await outs('o1')));

  const withClips = await admit('c1', 5);
  await settle(withClips, 'failed', 4);
  check('a failure that made clips counts', (await used()) === before + 2, String(await used()));
  check('its clip count is stored', (await outs('c1')) === 4, String(await outs('c1')));

  // g1 (outputs 0) is free retry 1 of this month; two more are free, then not.
  await settle(await admit('g2', 5), 'failed');
  await settle(await admit('g3', 5), 'failed');
  check('clip-making and unreported failures do not use up the free three', (await used()) === before + 2, String(await used()));
  await settle(await admit('g4', 5), 'failed');
  check('the 4th no-output failure counts', (await used()) === before + 3, String(await used()));

  const bad = await admit('b1', 1);
  const badRes = await settle(bad, 'failed', -1);
  check('negative outputs are refused', badRes.ok === false && badRes.error === 'invalid outputs', JSON.stringify(badRes));
  const st = (await db.query(`select status from public.usage_reservations where id = $1`, [bad.reservation_id])).rows[0].status;
  check('and leave the reservation open', st === 'open', st);
  await settle(bad, 'cancelled');

  // Settling twice is still a no-op: a late "0 outputs" can't turn a counted failure free.
  const again = await settle(old, 'failed', 0);
  check('re-settle is a no-op', again.ok === true && again.already === true, JSON.stringify(again));
  check('and keeps outputs unreported', (await outs('o1')) === null, String(await outs('o1')));

  // A succeeded settle with outputs works and keeps the boost-fee path.
  const okRes = await settle(await admit('ok2', 1), 'succeeded', 3);
  check('succeeded with outputs settles', okRes.ok === true && okRes.status === 'succeeded', JSON.stringify(okRes));

  // Heartbeat with outputs keeps the job open and records nothing.
  const hb = await admit('hb1', 1);
  const hbRes = await settle(hb, 'heartbeat', 0);
  check('heartbeat with outputs keeps it open', hbRes.ok === true && hbRes.status === 'open', JSON.stringify(hbRes));
  check('heartbeat stores no outputs', (await outs('hb1')) === null, String(await outs('hb1')));
  await settle(hb, 'cancelled');

  // Server-only, like the 3-argument settle (0064).
  const priv = (
    await db.query(
      `select has_function_privilege('anon', 'public.settle_usage_reservation(uuid,uuid,text,integer)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.settle_usage_reservation(uuid,uuid,text,integer)', 'execute') as auth,
              has_function_privilege('service_role', 'public.settle_usage_reservation(uuid,uuid,text,integer)', 'execute') as svc`,
    )
  ).rows[0];
  check('4-argument settle is service_role only', !priv.anon && !priv.auth && priv.svc, JSON.stringify(priv));
  const priv3 = (
    await db.query(
      `select has_function_privilege('anon', 'public.settle_usage_reservation(uuid,uuid,text)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.settle_usage_reservation(uuid,uuid,text)', 'execute') as auth,
              has_function_privilege('service_role', 'public.settle_usage_reservation(uuid,uuid,text)', 'execute') as svc`,
    )
  ).rows[0];
  check('3-argument settle stays service_role only', !priv3.anon && !priv3.auth && priv3.svc, JSON.stringify(priv3));

  // outputs can't go negative even written directly.
  let rejected = false;
  try {
    await db.query(`update public.usage_reservations set outputs = -1 where id = $1`, [bad.reservation_id]);
  } catch {
    rejected = true;
  }
  check('outputs column refuses negatives', rejected);
}

// ── Credit packs (0065): spend once, oldest first; per-pack refund/hold ───
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const engineId = (await db.query(`select id from public.engines where slug = 'chalybclip'`))
    .rows[0].id;
  const u = (
    await db.query(`insert into auth.users (email) values ('packs@example.com') returning id`)
  ).rows[0].id;
  await db.query(`insert into public.profiles (id) values ($1) on conflict do nothing`, [u]);
  await db.query(
    `insert into public.app_settings (key, value) values ('usage_margin_percent', '0'::jsonb)
     on conflict (key) do update set value = excluded.value`,
  );
  const q1 = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const rpc = async (sql, params) => (await q1(`select ${sql} as r`, params)).r;
  const packs = async () =>
    Object.fromEntries(
      (
        await db.query(
          `select coalesce(mp_payment_id, source) k, tokens_remaining::int rem, status from public.token_pack_purchases where user_id = $1`,
          [u],
        )
      ).rows.map((r) => [r.k, `${r.rem}:${r.status}`]),
    );
  const mirror = async () =>
    Number((await q1(`select token_bonus_balance b from public.profiles where id = $1`, [u])).b);
  let n = 0;
  const spend = async (...amounts) => {
    const values = amounts
      .map((_, i) => `($1,$2,'llm.tokens',$${i + 3},'pk${n}_${i}')`)
      .join(',');
    n += 1;
    await db.query(
      `insert into public.usage_events (user_id, engine_id, kind, amount, source_id) values ${values}`,
      [u, engineId, ...amounts],
    );
  };
  const caps = JSON.stringify({
    allocation: 1000, unlimited: false, jobs_per_month: -1, minutes_per_month: -1,
    max_concurrent_jobs: -1, active_streams: 0, streams_per_month: 0,
  });
  const admit = (job, est) =>
    rpc(`public.admit_usage($1,$2,$3,'job','x','standard',$4,0,0,0,600,$5::jsonb)`, [
      u, engineId, job, est, caps,
    ]);

  await rpc(`public.set_usage_allocation($1, 1000)`, [u]);
  await rpc(`public.grant_token_pack($1, 500, 'mp_payment', 'pA')`, [u]);
  await rpc(`public.grant_token_pack($1, 300, 'mp_payment', 'pB')`, [u]);
  await db.query(
    `update public.token_pack_purchases set created_at = now() - interval '2 days' where mp_payment_id = 'pA'`,
  );
  const dup = await rpc(`public.grant_token_pack($1, 500, 'mp_payment', 'pA')`, [u]);
  check('a pack is granted once per payment', dup.already_granted === true);

  await spend(800);
  const p0 = await packs();
  check('usage inside the plan draws no pack credits', p0.pA === '500:active' && p0.pB === '300:active', JSON.stringify(p0));
  await spend(400);
  check('usage above the plan draws the oldest pack', (await packs()).pA === '300:active', JSON.stringify(await packs()));
  await spend(200, 200);
  const p1 = await packs();
  check('one statement, several events: each draws once, oldest first', p1.pA === '0:active' && p1.pB === '200:active', JSON.stringify(p1));
  check('the profile mirror follows the packs', (await mirror()) === 200);
  const drawn = Number((await q1(`select sum(tokens) s from public.token_pack_draws where user_id = $1`, [u])).s);
  check('draws ledger = usage above the allocation', drawn === 600, String(drawn));

  const bal = await rpc(`public.usage_balance($1)`, [u]);
  check('balance reports unused active pack credits', Number(bal.bonus) === 200 && Number(bal.held) === 0, JSON.stringify(bal));
  const no = await admit('pk-j1', 250);
  check('admission: plan spent, only the packs are left', no.allowed === false && no.reason === 'no_tokens' && Number(no.remaining) === 200, JSON.stringify(no));
  const yes = await admit('pk-j2', 150);
  check('admission within the pack credits', yes.allowed === true, JSON.stringify(yes));
  await db.query(`update public.usage_reservations set status = 'cancelled' where id = $1`, [yes.reservation_id]);

  const h = await rpc(`public.hold_token_pack('pB')`);
  check('a dispute holds that pack', h.status === 'held' && Number(h.tokens_held) === 200, JSON.stringify(h));
  const bh = await rpc(`public.usage_balance($1)`, [u]);
  check('held credits are not spendable', Number(bh.bonus) === 0 && Number(bh.held) === 200, JSON.stringify(bh));
  await spend(100);
  check('usage never draws a held pack', (await packs()).pB === '200:held');
  await rpc(`public.release_token_pack('pB')`);
  check('Chalyb wins: the credits come back', (await packs()).pB === '200:active');

  await rpc(`public.grant_token_pack($1, 1000, 'mp_payment', 'pC')`, [u]);
  const rA = await rpc(`public.clawback_token_pack('pA', 'refunded')`);
  check('refunding a spent pack removes nothing', rA.ok && Number(rA.tokens_removed) === 0, JSON.stringify(rA));
  const rC = await rpc(`public.clawback_token_pack('pC', 'refunded')`);
  const p2 = await packs();
  check('a refund removes only that pack', Number(rC.tokens_removed) === 1000 && p2.pB === '200:active' && p2.pC === '0:removed', JSON.stringify({ rC, p2 }));
  const rC2 = await rpc(`public.clawback_token_pack('pC', 'refunded')`);
  check('a refund is applied once', rC2.already_clawed_back === true);

  await rpc(`public.hold_token_pack('pB')`);
  const lost = await rpc(`public.clawback_token_pack('pB', 'charged_back')`);
  check('a lost dispute removes the held credits', Number(lost.tokens_removed) === 200 && (await packs()).pB === '0:removed' && (await mirror()) === 0, JSON.stringify(lost));
  const late = await rpc(`public.release_token_pack('pB')`);
  check('a removed pack cannot be released', late.already === true && (await packs()).pB === '0:removed');

  // Bought before 0065: its credits sit in the legacy row.
  await db.query(
    `insert into public.token_pack_purchases (user_id, tokens_granted, source, tokens_remaining, status, created_at)
     values ($1, 500, 'legacy', 500, 'active', now() - interval '1 year')`,
    [u],
  );
  await db.query(
    `insert into public.token_pack_purchases (user_id, tokens_granted, source, mp_payment_id, tokens_remaining, status)
     values ($1, 300, 'mp_payment', 'pM', 0, 'merged')`,
    [u],
  );
  const rM = await rpc(`public.clawback_token_pack('pM', 'refunded')`);
  const p3 = await packs();
  check('refunding a pre-0065 pack takes its share from the legacy row', Number(rM.tokens_removed) === 300 && p3.legacy === '200:active' && p3.pM === '0:removed', JSON.stringify({ rM, p3 }));

  const exposed = (await db.query(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any($1)
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`,
    [['grant_token_pack', 'clawback_token_pack', 'hold_token_pack', 'release_token_pack', 'adjust_token_bonus_balance',
      'claim_legacy_credits', 'refresh_token_bonus_balance', 'set_usage_allocation', 'admit_usage', 'usage_balance']],
  )).rows.map((r) => r.proname);
  check('no pack/usage function is callable by anon or signed-in clients', exposed.length === 0, exposed.join(', '));

  const g = await rpc(`public.adjust_token_bonus_balance($1, 100)`, [u]);
  const r = await rpc(`public.adjust_token_bonus_balance($1, -1000)`, [u]);
  check('admin grant adds a pack; revoke clamps at what is left', Number(g.effective_delta) === 100 && Number(r.effective_delta) === -300 && (await mirror()) === 0, JSON.stringify({ g, r }));

  const none = (await db.query(`insert into auth.users (email) values ('noalloc@example.com') returning id`)).rows[0].id;
  await db.query(`insert into public.profiles (id) values ($1) on conflict do nothing`, [none]);
  await rpc(`public.grant_token_pack($1, 100, 'promo', null)`, [none]);
  await db.query(
    `insert into public.usage_events (user_id, engine_id, kind, amount, source_id) values ($1,$2,'llm.tokens',50,'na1')`,
    [none, engineId],
  );
  const kept = Number((await q1(`select token_bonus_balance b from public.profiles where id = $1`, [none])).b);
  check('no allocation on file: usage draws nothing', kept === 100, String(kept));
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

// ── 0058: who is still owed a change notice ───────────────────────────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const mk = async (email) => {
    const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [email]))
      .rows[0].id;
    await db.query(
      `insert into public.profiles (id, email) values ($1, $2) on conflict (id) do update set email = excluded.email`,
      [id, email],
    );
    return id;
  };
  const key = 'terminos:9.9';
  const d = async (uid, status, ageMin = 0) =>
    db.query(
      `insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version, delivery_status, sent_at)
              values ($1, 'terms_change', $2, 'terms_change', '1', $3, now() - ($4 || ' minutes')::interval)`,
      [uid, key, status, String(ageMin)],
    );
  const sent = await mk('n-sent@example.com');
  await d(sent, 'sent');
  const delivered = await mk('n-deliv@example.com');
  await d(delivered, 'delivered');
  const bounced = await mk('n-bounce@example.com');
  await d(bounced, 'bounced');
  const fresh = await mk('n-fresh@example.com');
  await d(fresh, 'pending', 2);
  const stale = await mk('n-stale@example.com');
  await d(stale, 'pending', 30);
  const failed = await mk('n-failed@example.com');
  await d(failed, 'failed');
  const never = await mk('n-never@example.com');
  const accepted = await mk('n-acc@example.com');
  await db.query(
    `insert into public.consent_events (consent_id, event_type, user_id, timestamp_utc, locale, surface, ui_version, event_hash, documents)
                  values (gen_random_uuid(), 'plan_changed', $1, now(), 'es-MX', 't', 't', 'h', '[{"doc":"terminos","version":"9.9"}]'::jsonb)`,
    [accepted],
  );
  const ids = new Set(
    (
      await db.query(
        `select id from public.legal_change_notice_recipients('terminos', '9.9', $1, null, 1000)`,
        [key],
      )
    ).rows.map((r) => r.id),
  );
  check(
    'owed: never sent, failed, stale pending',
    ids.has(never) && ids.has(failed) && ids.has(stale),
  );
  check(
    'not owed: sent, delivered, bounced, in-flight pending, already accepted',
    ![sent, delivered, bounced, fresh, accepted].some((u) => ids.has(u)),
  );
  const page1 = (
    await db.query(
      `select id from public.legal_change_notice_recipients('terminos', '9.9', $1, null, 1)`,
      [key],
    )
  ).rows;
  const page2 = (
    await db.query(
      `select id from public.legal_change_notice_recipients('terminos', '9.9', $1, $2, 1)`,
      [key, page1[0].id],
    )
  ).rows;
  check(
    'keyset pagination moves forward',
    page1.length === 1 && page2.length === 1 && page2[0].id > page1[0].id,
  );
}

// ── 0060: retention counts from the chargeback, dry run, audit ────────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const u = (
    await db.query(`insert into auth.users (email) values ('ret2@example.com') returning id`)
  ).rows[0].id;
  // Disputed in Sept 2020, closed in 2025: the incident is the dispute.
  const cb = (
    await db.query(
      `insert into public.chargebacks (user_id, mp_payment_id, amount_cents, mp_status, opened_at, closed_at)
     values ($1, 'p-2020', 99700, 'closed', '2020-09-01T00:00:00Z', '2025-06-01T00:00:00Z') returning id`,
      [u],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.account_restrictions (user_id, kind, chargeback_id) values ($1, 'restricted', $2)`,
    [u, cb],
  );
  const dry = (
    await db.query(`select public.legal_retention_purge('2026-10-03T00:00:00Z', true) as r`)
  ).rows[0].r;
  const still = (
    await db.query(`select count(*)::int n from public.chargebacks where id = $1`, [cb])
  ).rows[0].n;
  check(
    'dry run counts and deletes nothing',
    dry.dry_run === true && dry.chargebacks >= 1 && still === 1,
    JSON.stringify(dry),
  );
  const r = (await db.query(`select public.legal_retention_purge('2026-10-03T00:00:00Z') as r`))
    .rows[0].r;
  const gone = (
    await db.query(`select count(*)::int n from public.chargebacks where id = $1`, [cb])
  ).rows[0].n;
  check(
    'measured from opened_at, not the later close date',
    gone === 0 && r.chargebacks >= 1,
    JSON.stringify(r),
  );
  const audit = (
    await db.query(
      `select count(*)::int n from public.audit_events where action = 'legal.retention' and target_user_id = $1`,
      [u],
    )
  ).rows[0].n;
  check(
    'lifting an active restriction is audited',
    audit === 1 && r.active_restrictions_lifted >= 1,
    JSON.stringify(r),
  );
}

// ── 0060: claim, retry and give up on a notice ───────────────────────────
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const u = (
    await db.query(`insert into auth.users (email) values ('claim@example.com') returning id`)
  ).rows[0].id;
  const claim = async (period) =>
    (
      await db.query(
        `select public.claim_notice_dispatch($1, 'terms_change', $2, 'terms_change', '1') as id`,
        [u, period],
      )
    ).rows[0].id;
  const row = async (period) =>
    (
      await db.query(
        `select delivery_status, attempts from public.email_dispatches where user_id = $1 and period_key = $2`,
        [u, period],
      )
    ).rows[0];
  const a = await claim('t:1');
  check('a new notice is claimed pending', !!a && (await row('t:1')).delivery_status === 'pending');
  check('an in-flight claim is not taken twice', (await claim('t:1')) === null);
  await db.query(`update public.email_dispatches set delivery_status = 'failed' where id = $1`, [
    a,
  ]);
  const b = await claim('t:1');
  const r1 = await row('t:1');
  check(
    'a failed notice is retaken, attempts + 1',
    b === a && r1.delivery_status === 'pending' && r1.attempts === 2,
    JSON.stringify(r1),
  );
  await db.query(
    `update public.email_dispatches set delivery_status = 'failed', attempts = 5 where id = $1`,
    [a],
  );
  const c = await claim('t:1');
  check(
    'after 5 attempts it is undeliverable, not retaken',
    c === null && (await row('t:1')).delivery_status === 'undeliverable',
  );
  const d = await claim('t:2');
  await db.query(
    `update public.email_dispatches set delivery_status = 'failed', first_attempt_at = now() - interval '73 hours' where id = $1`,
    [d],
  );
  check(
    'after 72 hours it is undeliverable',
    (await claim('t:2')) === null && (await row('t:2')).delivery_status === 'undeliverable',
  );
  await db.query(
    `insert into public.profiles (id, email) values ($1, 'claim@example.com') on conflict (id) do update set email = excluded.email`,
    [u],
  );
  // A provider outage gives the attempt back: no count, no 72 h clock.
  const e = await claim('t:3');
  await db.query(`select public.release_notice_attempt($1)`, [e]);
  const r3 = (
    await db.query(
      `select delivery_status, attempts, first_attempt_at from public.email_dispatches where id = $1`,
      [e],
    )
  ).rows[0];
  check(
    'a provider failure is not an attempt',
    r3.delivery_status === 'failed' && r3.attempts === 0 && r3.first_attempt_at === null,
    JSON.stringify(r3),
  );
  await db.query(
    `update public.email_dispatches set sent_at = now() - interval '100 hours' where id = $1`,
    [e],
  );
  const again = await claim('t:3');
  const r4 = (
    await db.query(`select delivery_status, attempts from public.email_dispatches where id = $1`, [
      e,
    ])
  ).rows[0];
  check(
    'after an outage the notice is retried, not given up',
    again === e && r4.delivery_status === 'pending' && r4.attempts === 1,
    JSON.stringify(r4),
  );
  const owed = (
    await db.query(
      `select id from public.legal_change_notice_recipients('terminos', '9.8', 't:1', null, 1000)`,
    )
  ).rows.map((r) => r.id);
  check('undeliverable counts as done for completion', !owed.includes(u));
}

// ── Client writes on messages / user_notifications (hub_lock_client_writes) ──
{
  const check = (label, cond, extra = '') => {
    if (cond) console.log(`ok: ${label}`);
    else {
      console.error(`FAIL: ${label} ${extra}`);
      process.exitCode = 1;
    }
  };
  const LOCK = files.find((f) => /_hub_lock_client_writes_messages_notices\.sql$/.test(f));
  // Act as a signed-in user the way PostgREST does: role + JWT sub.
  await db.exec(`
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    alter role service_role bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  const asUser = async (id, sql, params = []) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
    try {
      return { rows: (await db.query(sql, params)).rows, error: null };
    } catch (err) {
      return { rows: [], error: err.message };
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };
  const asService = async (sql, params = []) => {
    await db.exec(`set role service_role`);
    try {
      return (await db.query(sql, params)).rows;
    } finally {
      await db.exec(`reset role`);
    }
  };
  const [subA, subB, staff] = (
    await db.query(
      `insert into auth.users (email) values ('a@example.com'), ('b@example.com'), ('staff@example.com') returning id`,
    )
  ).rows.map((r) => r.id);
  const seed = async () => {
    await db.exec(`delete from public.messages; delete from public.user_notifications;`);
    await db.query(
      `insert into public.messages (thread_user_id, sender_user_id, sender_role, body) values
         ($1, $2, 'ADMIN', 'Hola, ¿en qué te ayudo?'), ($1, $1, 'USER', 'No me llegó el cobro')`,
      [subA, staff],
    );
    await db.query(
      `insert into public.user_notifications (user_id, kind, title, keep_until, dedupe_key) values
         ($1, 'renewalReminder', 'Tu plan se renueva el 1 nov', now() + interval '10 days', 'renew:1'),
         ($1, 'clipsReady', '3 clips listos', null, 'clips:1')`,
      [subA],
    );
  };
  // Pre-fix state, as prod has it today: Supabase's default ALL grants plus the
  // two policies from 0014 / 0043.
  const prefix = async () => {
    await db.exec(`
      grant all on public.messages, public.user_notifications to anon, authenticated, service_role;
      drop policy if exists "messages_user_mark_read" on public.messages;
      create policy "messages_user_mark_read" on public.messages for update
        using (thread_user_id = (select auth.uid())) with check (thread_user_id = (select auth.uid()));
      drop policy if exists "messages_insert_own_thread" on public.messages;
      create policy "messages_insert_own_thread" on public.messages for insert
        with check (thread_user_id = (select auth.uid()) and sender_role = 'USER'
          and sender_user_id = (select auth.uid()));
      drop policy if exists "user_notifications_update_own" on public.user_notifications;
      create policy "user_notifications_update_own" on public.user_notifications for update
        using (auth.uid() = user_id);
    `);
    await seed();
  };
  const forge = `update public.messages set sender_role = 'ADMIN', body = 'Reembolso aprobado' where sender_role = 'USER' returning id`;
  const unpin = `update public.user_notifications set keep_until = null where kind = 'renewalReminder' returning id`;
  const hidden = `insert into public.messages (thread_user_id, sender_user_id, sender_role, body, read_at_admin, created_at)
     values ($1, $1, 'USER', 'Mensaje escondido', now(), now() - interval '90 days') returning id`;

  await prefix();
  check('pre-fix: a subscriber can forge a staff reply', (await asUser(subA, forge)).rows.length === 1);
  check('pre-fix: a subscriber can unpin a billing notice', (await asUser(subA, unpin)).rows.length === 1);
  check(
    'pre-fix: a subscriber can insert a message hidden from the admin badge and backdated',
    (await asUser(subA, hidden, [subA])).rows.length === 1,
  );

  await prefix();
  await db.exec(readFileSync(new URL(LOCK, DIR), 'utf8'));
  await db.exec(readFileSync(new URL(LOCK, DIR), 'utf8')); // idempotent
  const policies = (
    await db.query(
      `select policyname from pg_policies where schemaname = 'public'
         and policyname in ('messages_user_mark_read', 'messages_insert_own_thread', 'user_notifications_update_own')`,
    )
  ).rows;
  check('client write policies on messages / notices are gone', policies.length === 0);
  const f = await asUser(subA, forge);
  check('a subscriber can no longer rewrite a message', /permission denied/.test(f.error ?? ''), f.error);
  const d = await asUser(subA, `delete from public.messages returning id`);
  check('a subscriber can no longer delete messages', /permission denied/.test(d.error ?? ''), d.error);
  const u = await asUser(subA, unpin);
  check('a subscriber can no longer unpin a billing notice', /permission denied/.test(u.error ?? ''), u.error);
  const ins = await asUser(
    subA,
    `insert into public.user_notifications (user_id, kind, title) values ($1, 'x', 'fake') returning id`,
    [subA],
  );
  check('a subscriber cannot plant a notice', /permission denied/.test(ins.error ?? ''), ins.error);

  const h = await asUser(subA, hidden, [subA]);
  check('a subscriber can no longer insert a hidden or backdated message', /permission denied/.test(h.error ?? ''), h.error);
  const direct = await asUser(
    subA,
    `insert into public.messages (thread_user_id, sender_user_id, sender_role, body) values ($1, $1, 'USER', 'Gracias') returning id`,
    [subA],
  );
  check('a subscriber can no longer insert even a plain message directly', /permission denied/.test(direct.error ?? ''), direct.error);

  // What stays: reading your thread, the guarded delete, and sending through the server.
  const mine = await asUser(subA, `select id from public.messages`);
  check('a subscriber still reads their own thread', mine.rows.length === 2, mine.error);
  const other = await asUser(subB, `select id from public.messages`);
  check('another subscriber still sees nothing', other.rows.length === 0, other.error);
  // sendMessageFromUser: service-role insert, server-set columns only.
  const send = await asService(
    `insert into public.messages (thread_user_id, sender_user_id, sender_role, body) values ($1, $1, 'USER', 'Gracias') returning read_at_admin`,
    [subA],
  );
  check('server send still works and arrives unread', send.length === 1 && send[0].read_at_admin === null);
  const del = await asUser(
    subA,
    `delete from public.user_notifications where kind in ('clipsReady', 'renewalReminder') returning kind`,
  );
  check(
    'the guarded delete still removes a plain notice and keeps the billing one',
    del.rows.length === 1 && del.rows[0].kind === 'clipsReady',
    JSON.stringify(del),
  );

  // The server actions' writes (service-role client) still work:
  // markThreadReadAsUser, markThreadReadAsAdmin, markAllNoticesRead.
  const readUser = await asService(
    `update public.messages set read_at_user = now()
       where thread_user_id = $1 and sender_role = 'ADMIN' and read_at_user is null returning id`,
    [subA],
  );
  check('server mark-read (subscriber side) still works', readUser.length === 1);
  const readAdmin = await asService(
    `update public.messages set read_at_admin = now()
       where thread_user_id = $1 and sender_role = 'USER' and read_at_admin is null returning id`,
    [subA],
  );
  check('server mark-read (admin side) still works', readAdmin.length === 2);
  const readNotices = await asService(
    `update public.user_notifications set read_at = now() where user_id = $1 and read_at is null returning id`,
    [subA],
  );
  check('server mark-all-notices-read still works', readNotices.length === 1);
  await db.exec(
    `create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`,
  );
}

console.log(
  `${files.length} migrations applied twice${process.exitCode ? ' — WITH FAILURES' : ''}`,
);
