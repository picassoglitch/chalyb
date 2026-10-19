import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  RESET_CODE_TTL_MS,
  cleanResetCode,
  confirmReset,
  hashResetCode,
  startReset,
  type ResetStore,
} from '@/lib/chalito/reset';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const USER = '00000000-0000-4000-8000-000000000001';
const SECRET = 'reset-secret';
const NOW = 1_790_000_000_000;

// ---- the database side: the migration's functions, in PGlite ----

const MIGRATION = readFileSync(
  new URL('../supabase/migrations/0069_chalito_reset_codes.sql', import.meta.url),
  'utf8',
);

const db = async () => {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
    insert into auth.users values ('${USER}');
  `);
  await pg.exec(MIGRATION);
  return pg;
};

/** The store the routes use, over the migration's two functions. */
const pgStore = (pg: PGlite): ResetStore => ({
  async issue(userId, hash, expiresAt, now) {
    const r = await pg.query<{ r: string }>(
      'select public.chalito_reset_issue($1, $2, $3, $4) as r',
      [userId, hash, new Date(expiresAt).toISOString(), new Date(now).toISOString()],
    );
    return r.rows[0]!.r as 'ok' | 'rate_limited';
  },
  async consume(userId, hash, now) {
    const r = await pg.query<{ r: string }>(
      'select public.chalito_reset_consume($1, $2, $3) as r',
      [userId, hash, new Date(now).toISOString()],
    );
    return r.rows[0]!.r as Awaited<ReturnType<ResetStore['consume']>>;
  },
});

test('reset sql: a code works once, and only before it expires', async () => {
  const s = pgStore(await db());
  const h = hashResetCode(SECRET, USER, '123456');
  assert.equal(await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW), 'ok');
  assert.equal(await s.consume(USER, hashResetCode(SECRET, USER, '000000'), NOW + 1), 'bad_code');
  assert.equal(await s.consume(USER, h, NOW + 2), 'ok');
  assert.equal(await s.consume(USER, h, NOW + 3), 'none');
  assert.equal(await s.issue(USER, h, NOW + 10, NOW + 4), 'ok');
  assert.equal(await s.consume(USER, h, NOW + 10), 'expired');
  assert.equal(await s.consume(USER, h, NOW + 11), 'none');
});

test('reset sql: five wrong tries lock the code, even the right one after', async () => {
  const s = pgStore(await db());
  const h = hashResetCode(SECRET, USER, '123456');
  await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW);
  for (let i = 0; i < 5; i++)
    assert.equal(
      await s.consume(USER, hashResetCode(SECRET, USER, `00000${i}`), NOW + i),
      'bad_code',
    );
  assert.equal(await s.consume(USER, h, NOW + 6), 'too_many');
  // A new code starts the tries again.
  await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW + 7);
  assert.equal(await s.consume(USER, h, NOW + 8), 'ok');
});

test('reset sql: at most three codes an hour', async () => {
  const s = pgStore(await db());
  const h = hashResetCode(SECRET, USER, '123456');
  for (let i = 0; i < 3; i++)
    assert.equal(await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW + i), 'ok');
  assert.equal(await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW + 10), 'rate_limited');
  assert.equal(await s.issue(USER, h, NOW + RESET_CODE_TTL_MS, NOW + 60 * 60_000 + 1), 'ok');
});

test('reset sql: browsers and the public api cannot touch the codes', async () => {
  const pg = await db();
  for (const role of ['anon', 'authenticated']) {
    const r = await pg.query<{ t: boolean; i: boolean; c: boolean }>(
      `select has_table_privilege($1, 'public.chalito_reset_codes', 'select') as t,
              has_function_privilege($1, 'public.chalito_reset_issue(uuid,text,timestamptz,timestamptz)', 'execute') as i,
              has_function_privilege($1, 'public.chalito_reset_consume(uuid,text,timestamptz)', 'execute') as c`,
      [role],
    );
    assert.deepEqual(r.rows[0], { t: false, i: false, c: false }, role);
  }
});

// ---- the flow ----

const memoryStore = () => {
  const rows = new Map<string, { hash: string | null; expiresAt: number; attempts: number }>();
  const store: ResetStore = {
    async issue(userId, hash, expiresAt) {
      rows.set(userId, { hash, expiresAt, attempts: 0 });
      return 'ok';
    },
    async consume(userId, hash, now) {
      const r = rows.get(userId);
      if (!r?.hash) return 'none';
      if (r.expiresAt <= now) return ((r.hash = null), 'expired');
      if (r.attempts >= 5) return 'too_many';
      if (r.hash === hash) return ((r.hash = null), 'ok');
      r.attempts++;
      return 'bad_code';
    },
  };
  return { store, rows };
};

test('start: emails a fresh 6-digit code to the account and keeps only its hash', async () => {
  const { store, rows } = memoryStore();
  const sent: { to: string; code: string }[] = [];
  const r = await startReset({
    userId: USER,
    email: 'ana@example.mx',
    store,
    secret: SECRET,
    now: () => NOW,
    send: async (to, code) => (sent.push({ to, code }), true),
  });
  assert.deepEqual(r, { ok: true });
  assert.equal(sent.length, 1);
  assert.match(sent[0]!.code, /^\d{6}$/);
  assert.equal(sent[0]!.to, 'ana@example.mx');
  const row = rows.get(USER)!;
  assert.equal(row.hash, hashResetCode(SECRET, USER, sent[0]!.code));
  assert.equal(row.expiresAt, NOW + RESET_CODE_TTL_MS);
});

test('start: no email on the account, rate limit and a failed send are told apart', async () => {
  const { store } = memoryStore();
  const base = { userId: USER, store, secret: SECRET, now: () => NOW, send: async () => true };
  assert.deepEqual(await startReset({ ...base, email: null }), { ok: false, reason: 'no_email' });
  assert.deepEqual(
    await startReset({
      ...base,
      email: 'a@b.mx',
      store: { ...store, issue: async () => 'rate_limited' },
    }),
    { ok: false, reason: 'rate_limited' },
  );
  assert.deepEqual(await startReset({ ...base, email: 'a@b.mx', send: async () => false }), {
    ok: false,
    reason: 'send_failed',
  });
});

test('confirm: the right code retires every device right away; anything else does not', async () => {
  const { store } = memoryStore();
  let code = '';
  await startReset({
    userId: USER,
    email: 'a@b.mx',
    store,
    secret: SECRET,
    now: () => NOW,
    send: async (_to, c) => ((code = c), true),
  });
  const resets: string[] = [];
  const deps = {
    userId: USER,
    store,
    secret: SECRET,
    now: () => NOW + 1000,
    resetDevices: async (u: string) => (resets.push(u), true),
  };
  assert.deepEqual(await confirmReset({ ...deps, raw: '12' }), { ok: false, reason: 'format' });
  const wrong = code === '000000' ? '000001' : '000000';
  assert.deepEqual(await confirmReset({ ...deps, raw: wrong }), { ok: false, reason: 'bad_code' });
  assert.equal(resets.length, 0);
  // Typed with a space in the middle, as people read codes out.
  assert.deepEqual(await confirmReset({ ...deps, raw: `${code.slice(0, 3)} ${code.slice(3)}` }), {
    ok: true,
  });
  assert.deepEqual(resets, [USER]);
  // Single use.
  assert.deepEqual(await confirmReset({ ...deps, raw: code }), { ok: false, reason: 'none' });
});

test('confirm: Chalito refusing the reset is a failure the person can retry with a new code', async () => {
  const { store } = memoryStore();
  let code = '';
  await startReset({
    userId: USER,
    email: 'a@b.mx',
    store,
    secret: SECRET,
    now: () => NOW,
    send: async (_to, c) => ((code = c), true),
  });
  assert.deepEqual(
    await confirmReset({
      userId: USER,
      raw: code,
      store,
      secret: SECRET,
      now: () => NOW,
      resetDevices: async () => false,
    }),
    { ok: false, reason: 'failed' },
  );
});

test('cleanResetCode: six digits, spaces and dashes ignored', () => {
  assert.equal(cleanResetCode(' 123-456 '), '123456');
  assert.equal(cleanResetCode('12345'), null);
  assert.equal(cleanResetCode('12345a'), null);
});

test('reset copy exists in both languages', () => {
  for (const m of [es, en] as unknown as {
    endorse: {
      reset: Record<string, unknown> & { error: Record<string, unknown> };
      wait: Record<string, unknown>;
    };
  }[]) {
    const r = m.endorse.reset;
    for (const k of ['title', 'body', 'warning', 'send', 'sent', 'label', 'confirm', 'done'])
      assert.equal(typeof r[k], 'string', k);
    for (const k of [
      'format',
      'bad_code',
      'expired',
      'too_many',
      'none',
      'rate_limited',
      'no_email',
      'send_failed',
      'failed',
    ])
      assert.equal(typeof r.error[k], 'string', k);
    assert.equal(typeof m.endorse.wait.noDevice, 'string');
  }
});
