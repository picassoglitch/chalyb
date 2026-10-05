// P3 hub logic: results mapping, Avisos, autopublish, Más herramientas,
// Opciones avanzadas, and the Clips adapter contract.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockClipsAdapter } from '@/lib/tools/adapters/mock';
import { createMockInmuebles } from '@/lib/tools/adapters/mock-tools';
import { chipsFor, clipItem, filterResults, mergeResults, propertyItem } from '@/lib/results/core';
import {
  canDeleteNotice,
  groupNotices,
  inAppBillingNotice,
  type UserNotice,
} from '@/lib/notifications/core';
import { AUTOPUBLISH_DEFAULT, decideAutopublish } from '@/lib/tools/autopublish';
import { toolCardAction } from '@/lib/tools/matrix';
import { extraLinks, MAX_EXTRA_LINKS, parseClipOptions } from '@/lib/tools/clips-options';
import { toolHref, TOOL_ROUTES } from '@/lib/tools/routes';

const HOUR = 3_600_000;

test('results: clip jobs and property cards map to one newest-first list', async () => {
  let t = Date.parse('2026-10-01T15:00:00Z');
  const clips = createMockClipsAdapter({ now: () => t, stepMs: 1000 });
  const a = await clips.createJob({
    userId: 'u1',
    sourceUrl: 'https://youtube.com/watch?v=a',
    format: 'vertical',
    count: 6,
  });
  t += 10;
  const b = await clips.createJob({
    userId: 'u1',
    sourceUrl: 'https://twitch.tv/videos/b',
    format: 'square',
    count: 3,
  });
  await clips.createJob({
    userId: 'u2',
    sourceUrl: 'https://youtube.com/watch?v=other',
    format: 'vertical',
    count: 3,
  });
  assert.ok(a.ok && b.ok);

  t += 1500; // a and b are both "finding moments"
  const working = (await clips.listJobs('u1')).map(clipItem);
  assert.deepEqual(
    working.map((i) => i.id),
    [b.ok && b.jobId, a.ok && a.jobId],
    'own jobs only, newest first',
  );
  assert.equal(working[0]!.state, 'working');
  assert.equal(working[0]!.kind === 'clips' && working[0]!.pct, 40, '"Creando… 40%"');

  t += 10_000;
  const ready = (await clips.listJobs('u1')).map(clipItem);
  assert.ok(ready.every((i) => i.state === 'ready'));
  assert.equal(ready[1]!.kind === 'clips' && ready[1]!.count, 6);

  const homes = createMockInmuebles(() => t + HOUR);
  const card = await homes.create('u1', {
    title: 'Casa con jardín',
    details: '3 recámaras',
    photos: [],
  });
  const all = mergeResults(ready, [propertyItem(card)]);
  assert.equal(all[0]!.kind, 'property', 'the newest result leads');
  assert.deepEqual(chipsFor(all), ['all', 'ready', 'chalybrealtor', 'chalybclip']);
  assert.deepEqual(filterResults(all, 'chalybclip', '').length, 2);
  assert.deepEqual(
    filterResults(all, 'all', 'jardín').map((i) => i.id),
    [card.id],
    'search by title',
  );
  assert.deepEqual(filterResults(all, 'all', 'nada-que-ver'), [], 'no match');
});

test('results: a failed job shows as failed, not as a result to download', async () => {
  let t = 0;
  const clips = createMockClipsAdapter({ now: () => t, stepMs: 1000 });
  await clips.createJob({
    userId: 'u',
    sourceUrl: 'https://youtube.com/watch?v=private',
    format: 'vertical',
    count: 6,
  });
  t += 5000;
  const [item] = (await clips.listJobs('u')).map(clipItem);
  assert.equal(item!.state, 'failed');
  assert.deepEqual(filterResults([item!], 'ready', ''), []);
});

test('Avisos: today / this week / earlier in Mexico City time', () => {
  const now = Date.parse('2026-10-01T18:00:00Z'); // 12:00 in CDMX
  const n = (id: string, at: string): UserNotice => ({
    id,
    kind: 'clipsReady',
    title: id,
    body: null,
    href: null,
    keep_until: null,
    read_at: null,
    created_at: at,
  });
  const groups = groupNotices(
    [
      n('a', '2026-10-01T07:00:00Z'),
      n('b', '2026-10-01T05:00:00Z'),
      n('c', '2026-09-27T12:00:00Z'),
      n('d', '2026-09-01T12:00:00Z'),
    ],
    now,
  );
  assert.deepEqual(
    groups.map((g) => [g.group, g.items.map((i) => i.id)]),
    [
      ['today', ['a']],
      ['week', ['b', 'c']],
      ['earlier', ['d']],
    ],
    '05:00Z is still yesterday in CDMX',
  );
});

test('Avisos: the trial7 producer, and billing notices stay until the charge date', () => {
  const notice = inAppBillingNotice('trial_7d', {
    nextChargeAt: '2026-10-31T15:00:00Z',
    fechaCobro: '31 de octubre de 2026',
    monto: '$8,688.40',
    periodKey: 'trial7:sub_1',
  });
  assert.deepEqual(notice, {
    kind: 'trial7',
    vars: { fecha_cobro: '31 de octubre de 2026', monto: '$8,688.40' },
    href: '/app/billing',
    dedupeKey: 'trial7:sub_1',
    keepUntil: '2026-10-31T15:00:00Z',
  });
  assert.equal(
    inAppBillingNotice('renew_7d', { nextChargeAt: 'x', fechaCobro: '', monto: '', periodKey: 'k' })
      ?.kind,
    'renew',
  );
  assert.equal(
    inAppBillingNotice('renew_30d', {
      nextChargeAt: 'x',
      fechaCobro: '',
      monto: '',
      periodKey: 'k',
    }),
    null,
  );
  assert.equal(
    inAppBillingNotice('trial_7d', {
      nextChargeAt: null,
      fechaCobro: '',
      monto: '',
      periodKey: 'k',
    }),
    null,
  );

  const charge = Date.parse(notice!.keepUntil);
  assert.equal(
    canDeleteNotice({ keep_until: notice!.keepUntil }, charge - HOUR),
    false,
    'not before the charge',
  );
  assert.equal(canDeleteNotice({ keep_until: notice!.keepUntil }, charge), true);
  assert.equal(canDeleteNotice({ keep_until: null }, 0), true, 'other notices can go any time');
});

test('autopublish is off by default and needs account, cap and the checkbox', () => {
  assert.equal(AUTOPUBLISH_DEFAULT, false);
  const ok = { supportsConnect: true, account: '@canal', capAllows: true, checked: true };
  assert.deepEqual(decideAutopublish(ok), { ok: true });
  assert.deepEqual(decideAutopublish({ ...ok, checked: false }), {
    ok: false,
    reason: 'consent_required',
  });
  assert.deepEqual(
    decideAutopublish({ ...ok, checked: 'true' }),
    { ok: false, reason: 'consent_required' },
    'only a real true',
  );
  assert.deepEqual(decideAutopublish({ ...ok, account: ' ' }), { ok: false, reason: 'no_account' });
  assert.deepEqual(decideAutopublish({ ...ok, capAllows: false }), {
    ok: false,
    reason: 'needs_vip',
  });
  assert.deepEqual(decideAutopublish({ ...ok, supportsConnect: false }), {
    ok: false,
    reason: 'not_supported',
  });
});

test('Más herramientas matrix (P3-7): one action per state, never a lock', () => {
  const free = { plan: 'FREE', trialUsed: false, trialFlow: true, proIncludesAllTools: true };
  assert.deepEqual(toolCardAction('included', free), { pill: 'included', button: 'open' });
  assert.deepEqual(toolCardAction('setup_needed', free), { pill: 'setup', button: 'connect' });
  assert.deepEqual(toolCardAction('trial_offer', free), {
    pill: 'inPro',
    button: 'try',
    href: '/app/prueba',
  });
  assert.deepEqual(toolCardAction('trial_offer', { ...free, trialUsed: true }), {
    pill: 'inPro',
    button: 'return',
    href: '/app/prueba',
  });
  assert.deepEqual(toolCardAction('trial_offer', { ...free, trialFlow: false }), {
    pill: 'inPro',
    button: 'plans',
    href: '/app/planes',
  });
  assert.deepEqual(toolCardAction('trial_offer', { ...free, plan: 'PRO' }), {
    pill: 'inPro',
    button: 'plans',
    href: '/app/planes',
  });
});

test('tool routes: every tool opens inside the app (TOOLS-SPEC §0.1)', () => {
  for (const [slug, route] of Object.entries(TOOL_ROUTES)) assert.equal(toolHref(slug), route);
  assert.equal(toolHref('unknown'), '/app/herramientas', 'never a 404 or the old launch page');
});

test('Opciones avanzadas: untouched means engine defaults; out-of-range is dropped', () => {
  const form = (o: Record<string, string>) => (k: string) => o[k];
  assert.deepEqual(parseClipOptions(form({})), {});
  assert.deepEqual(
    parseClipOptions(
      form({ captionStyle: 'grande', captionLang: 'en', minSec: '20', maxSec: '45' }),
    ),
    { captionStyle: 'grande', captionLang: 'en', minSec: 20, maxSec: 45 },
  );
  assert.deepEqual(
    parseClipOptions(form({ captionStyle: 'comic', minSec: '5', maxSec: '90' })),
    {},
  );
  assert.deepEqual(
    parseClipOptions(form({ minSec: '50', maxSec: '20' })),
    {},
    'min above max: neither',
  );
  const main = 'https://youtube.com/watch?v=a';
  const more = [
    main,
    'https://youtube.com/watch?v=b',
    'https://youtube.com/watch?v=b',
    ...'cdefg'.split('').map((x) => `https://kick.com/${x}`),
  ].join('\n');
  const links = extraLinks(more, main);
  assert.equal(links.length, MAX_EXTRA_LINKS);
  assert.equal(new Set(links).size, links.length);
  assert.ok(!links.includes(main));
});

test('Clips adapter contract: capabilities drive every optional row and button', () => {
  const caps = createMockClipsAdapter().capabilities();
  assert.deepEqual(caps.sources, ['YouTube', 'Twitch', 'Kick', 'Facebook']);
  assert.equal(caps.supportsConnect, false, 'no connect button or autopublish row without an API');
  assert.equal(caps.fileUpload, false, 'no "Subir un video" without an API');
  assert.equal(caps.bulkUpload, true);
});

test('SSO hand-off keeps the screen locale; redirects back are localized', async () => {
  const { hubLaunchHref, localizedPath } = await import('@/lib/tools/routes');
  assert.equal(hubLaunchHref('chalybcrypto', 'es'), '/auth/launch/chalybcrypto?via=hub');
  assert.equal(hubLaunchHref('chalybcrypto', 'en'), '/auth/launch/chalybcrypto?via=hub&lang=en');
  assert.equal(hubLaunchHref('chalybcrypto', 'xx'), '/auth/launch/chalybcrypto?via=hub');
  assert.equal(localizedPath('/app/senales', 'en'), '/en/app/senales');
  assert.equal(localizedPath('/app/senales', 'es'), '/app/senales');
  assert.equal(localizedPath('/app/senales', null), '/app/senales');
  assert.equal(localizedPath('/app/senales', '//evil.com'), '/app/senales');
});
