// Admin → Mensajes, opening ?t= / ?i=. Prod (2026-11-06) crashed with Next's E7: the page
// called a revalidating server action during render. Runs the real data layer inside Next's render store.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Next's server sets this global at boot (node-environment-baseline); its stores need it.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
const require = createRequire(import.meta.url);
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external.js');
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external.js');
const { revalidatePath } = require('next/cache.js');

const { openAdminSelection } = await import('../src/lib/messages/admin-inbox');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PAGE = 'src/app/[locale]/(dashboard)/dashboard/(legacy)/messages/page.tsx';
const ROUTE = '/[locale]/dashboard/messages';

const PRO_USER = '6f1c2a9e-0d4b-4c51-9a3e-2b7f8c1d0e11';
const ADMIN_THREAD_USER = 'b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b';
const ADMIN_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

// Shapes as listAdminThreads builds them: a Pro user with no profile name, and an
// admin-created thread whose only message came from the admin.
const threads = [
  {
    threadUserId: PRO_USER,
    userEmail: 'pro.user@example.com',
    userFullName: null,
    userTier: 'PRO',
    lastMessage: 'Hola, no me cargan los clips',
    lastMessageAt: '2026-11-06T18:02:11.412+00:00',
    lastSenderRole: 'USER' as const,
    unreadForAdmin: 1,
  },
  {
    threadUserId: ADMIN_THREAD_USER,
    userEmail: null,
    userFullName: null,
    userTier: 'FREE',
    lastMessage: 'Bienvenido a Chalyb',
    lastMessageAt: '2026-11-05T10:00:00+00:00',
    lastSenderRole: 'ADMIN' as const,
    unreadForAdmin: 0,
  },
];
const inquiries = [
  {
    id: '7d9e1f20-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
    name: 'Ana',
    email: 'ana@example.com',
    message: 'Quiero ser partner',
    pane: 'partner' as const,
    ip_addr: null,
    user_agent: null,
    promoted_user_id: null,
    read_at_admin: null,
    created_at: '2026-11-04T09:00:00+00:00',
  },
];

const messageRows: Record<string, unknown[]> = {
  [PRO_USER]: [
    {
      id: 'm1', thread_user_id: PRO_USER, sender_user_id: PRO_USER, sender_role: 'USER',
      body: 'Hola, no me cargan los clips', read_at_user: null, read_at_admin: null,
      created_at: '2026-11-06T18:02:11.412+00:00',
    },
  ],
  [ADMIN_THREAD_USER]: [
    {
      id: 'm2', thread_user_id: ADMIN_THREAD_USER, sender_user_id: ADMIN_ID, sender_role: 'ADMIN',
      body: 'Bienvenido a Chalyb', read_at_user: null, read_at_admin: null,
      created_at: '2026-11-05T10:00:00+00:00',
    },
  ],
};

interface Call { method: string; table: string; query: string }

/** Stand-in PostgREST behind supabase-js's fetch; records every call in order. */
function stubSupabase(opts: { failMessagesRead?: boolean } = {}) {
  const calls: Call[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const table = url.pathname.replace('/rest/v1/', '');
    calls.push({ method, table, query: decodeURIComponent(url.search) });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'GET' && table === 'messages') {
      if (opts.failMessagesRead) return json(503, { message: 'upstream timeout', code: '57014' });
      const tid = url.searchParams.get('thread_user_id')?.replace('eq.', '') ?? '';
      return json(200, messageRows[tid] ?? []);
    }
    if (method === 'PATCH') return new Response(null, { status: 204 });
    return json(404, { message: `unexpected ${method} ${table}` });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

/** Run fn the way an RSC page body runs on Vercel: inside a request store in the render phase. */
function inRender<T>(fn: () => Promise<T>): Promise<T> {
  const workStore = { route: ROUTE, page: `${ROUTE}/page`, incrementalCache: {}, isStaticGeneration: false };
  const unitStore = { type: 'request', phase: 'render' };
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(unitStore, fn));
}

test('the harness reproduces the prod failure: revalidatePath during render throws E7', async () => {
  await assert.rejects(
    inRender(async () => revalidatePath(ROUTE, 'page')),
    (err: Error & { __NEXT_ERROR_CODE?: string }) =>
      err.__NEXT_ERROR_CODE === 'E7' && /used "revalidatePath \/\[locale\]\/dashboard\/messages" during render/.test(err.message),
  );
});

test('opening a Pro user thread with no profile name renders its messages, then marks it read', async () => {
  const sb = stubSupabase();
  try {
    const sel = await inRender(() => openAdminSelection({ threadUserId: PRO_USER }, threads, inquiries));
    assert.equal(sel.kind, 'thread');
    assert.ok(sel.kind === 'thread');
    assert.equal(sel.messages.length, 1);
    assert.equal(sel.messages[0]?.body, 'Hola, no me cargan los clips');
    assert.deepEqual(sb.calls.map((c) => `${c.method} ${c.table}`), ['GET messages', 'PATCH messages']);
    const patch = sb.calls[1]?.query ?? '';
    assert.match(patch, new RegExp(`thread_user_id=eq\\.${PRO_USER}`));
    assert.match(patch, /sender_role=eq\.USER/);
    assert.match(patch, /read_at_admin=is\.null/);
  } finally {
    sb.restore();
  }
});

test('an admin-created thread (only an ADMIN message, no email) opens too', async () => {
  const sb = stubSupabase();
  try {
    const sel = await inRender(() => openAdminSelection({ threadUserId: ADMIN_THREAD_USER }, threads, inquiries));
    assert.ok(sel.kind === 'thread');
    assert.equal(sel.messages[0]?.sender_role, 'ADMIN');
    assert.equal(sel.summary.userEmail, null);
  } finally {
    sb.restore();
  }
});

test('if the thread messages fail to load, it is shown as an error and NOT marked read', async () => {
  const sb = stubSupabase({ failMessagesRead: true });
  const logged = console.error;
  console.error = () => {};
  try {
    const sel = await inRender(() => openAdminSelection({ threadUserId: PRO_USER }, threads, inquiries));
    assert.equal(sel.kind, 'thread-error');
    assert.equal(sb.calls.filter((c) => c.method === 'PATCH').length, 0);
  } finally {
    console.error = logged;
    sb.restore();
  }
});

test('an unknown ?t= id selects nothing and writes nothing', async () => {
  const sb = stubSupabase();
  try {
    const sel = await inRender(() => openAdminSelection({ threadUserId: 'not-a-thread' }, threads, inquiries));
    assert.equal(sel.kind, 'none');
    assert.equal(sb.calls.length, 0);
  } finally {
    sb.restore();
  }
});

test('opening an inquiry (?i=) marks only that inquiry, render-safe', async () => {
  const sb = stubSupabase();
  try {
    const inquiryId = inquiries[0]!.id;
    const sel = await inRender(() => openAdminSelection({ inquiryId }, threads, inquiries));
    assert.ok(sel.kind === 'inquiry');
    assert.deepEqual(sb.calls.map((c) => `${c.method} ${c.table}`), ['PATCH partner_inquiries']);
    const patch = sb.calls[0]?.query ?? '';
    assert.match(patch, new RegExp(`id=eq\\.${inquiryId}`));
    assert.match(patch, /read_at_admin=is\.null/);
  } finally {
    sb.restore();
  }
});

test('the admin inbox page no longer calls the revalidating server actions while rendering', () => {
  const page = readFileSync(join(ROOT, PAGE), 'utf8');
  assert.doesNotMatch(page, /messages-actions/);
  assert.match(page, /openAdminSelection\(/);
});
