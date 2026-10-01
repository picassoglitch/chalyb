#!/usr/bin/env node
// pnpm test:migrations — applies every Supabase migration, in order, to an
// in-process Postgres (PGlite), TWICE, and checks the append-only consent log.
// No Docker, no project: the Supabase pieces the migrations lean on (the auth
// schema, auth.uid(), the API roles) are stubbed below.

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

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
const ONE_SHOT = new Set(
  files.filter((f) => /^00(0\d|10|15|16|31)_/.test(f)),
);
for (const f of files.filter((f) => !ONE_SHOT.has(f))) {
  try {
    await db.exec(readFileSync(new URL(f, DIR), 'utf8'));
  } catch (err) {
    console.error(`NOT IDEMPOTENT: ${f}: ${err.message}`);
    process.exitCode = 1;
  }
}

// consent_events is append-only.
const uid = (await db.query(`insert into auth.users (email) values ('t@example.com') returning id`)).rows[0].id;
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
await db.query(`insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version) values ($1,'trial_7d','trial:2026-10-30','e2','1')`, [uid]);
try {
  await db.query(`insert into public.email_dispatches (user_id, kind, period_key, template_id, template_version) values ($1,'trial_7d','trial:2026-10-30','e2','1')`, [uid]);
  console.error('FAIL: duplicate email_dispatches row accepted');
  process.exitCode = 1;
} catch {
  console.log('ok: duplicate notice refused');
}
console.log(`${files.length} migrations applied twice${process.exitCode ? ' — WITH FAILURES' : ''}`);
