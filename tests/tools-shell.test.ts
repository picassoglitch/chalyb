// WS-11 (TOOLS-SPEC): the tool registry, the BFF's pure core, the health
// decision, the Tus herramientas status lines, the no-new-tab rule and the
// banned words in the tools' copy.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS, activeTabFor, toolBySlug, toolForPath } from '@/config/tools';
import {
  BREAKER_COOLDOWN_MS,
  BREAKER_THRESHOLD,
  OWNER_ALERT_AFTER_MS,
  afterOwnerAlert,
  breakerAfter,
  breakerAllows,
  closedBreaker,
  countsAsOutage,
  isSupportCode,
  nextToolStatus,
  normalizeToolError,
  okStatus,
  statusForReason,
  supportCode,
} from '@/lib/tools/bff-core';
import { clipsLine, liveLine, relativeDay, signalsLine } from '@/lib/tools/status-lines-core';

test('registry: the 3 live tools, each with ≤ 3 tabs that route inside the tool', () => {
  assert.deepEqual(
    TOOLS.map((t) => [t.slug, t.route, t.name]),
    [
      ['chalybclip', '/app/clips', 'Clips'],
      ['chalybcrypto', '/app/senales', 'Señales'],
      ['chalybobs', '/app/en-vivo', 'En vivo'],
    ],
  );
  for (const tool of TOOLS) {
    assert.ok(tool.live);
    assert.ok(tool.tabs.length <= 3, tool.slug);
    assert.equal(tool.tabs[0]!.href, tool.route);
    for (const tab of tool.tabs) assert.ok(tab.href.startsWith(tool.route), tab.href);
  }
  assert.deepEqual(
    TOOLS.map((t) => t.color),
    ['#5B4BFF', '#FF9F0A', '#FF375F'],
    'F9: each tool has its own color',
  );
  assert.equal(toolBySlug('chalybcrypto')?.needsRiskAck, true);
  assert.equal(toolBySlug('chalybbot'), undefined, 'Q9: no other tool is live');
});

test('registry: path → tool → tab', () => {
  assert.equal(toolForPath('/app/clips/ajustes')?.slug, 'chalybclip');
  assert.equal(toolForPath('/app/clipsx'), undefined);
  const clips = toolBySlug('chalybclip')!;
  assert.equal(activeTabFor(clips, '/app/clips'), 'main');
  assert.equal(activeTabFor(clips, '/app/clips/mis-clips'), 'history');
  assert.equal(activeTabFor(clips, '/app/clips/ajustes'), 'settings');
  assert.equal(activeTabFor(clips, '/app/clips/clip_1'), 'main');
});

test('support codes: prefix + 4 digits', () => {
  assert.equal(supportCode('CLP', 0), 'CLP-0000');
  assert.equal(supportCode('SEN', 0.0427), 'SEN-0427');
  assert.equal(supportCode('VIV', 0.99999), 'VIV-9999');
  assert.ok(isSupportCode('VIV-0001'));
  assert.ok(!isSupportCode('XYZ-0001'));
  assert.ok(!isSupportCode('CLP-12'));
});

test('BFF errors: normalized reasons, never the engine message', () => {
  assert.deepEqual(normalizeToolError({ code: 'TOOL_TIMEOUT' }), { reason: 'timeout', retryable: true });
  assert.deepEqual(normalizeToolError({ code: 'NOT_IMPLEMENTED' }), {
    reason: 'not_implemented',
    retryable: false,
  });
  assert.deepEqual(normalizeToolError(new Error('ECONNRESET 10.0.0.3:443')), {
    reason: 'unknown',
    retryable: true,
  });
  assert.equal(statusForReason('not_found'), 404);
  assert.equal(statusForReason('risk_ack_required'), 403);
  assert.equal(statusForReason('unavailable'), 503);
  assert.equal(statusForReason('timeout'), 504);
  assert.ok(countsAsOutage('timeout'));
  assert.ok(!countsAsOutage('not_found'));
  assert.ok(!countsAsOutage('risk_ack_required'));
});

test('circuit breaker: opens after the threshold, half-opens after the cooldown', () => {
  let b = closedBreaker();
  for (let i = 0; i < BREAKER_THRESHOLD - 1; i++) b = breakerAfter(b, false, 1000);
  assert.ok(breakerAllows(b, 1000));
  b = breakerAfter(b, false, 1000);
  assert.ok(!breakerAllows(b, 1000 + BREAKER_COOLDOWN_MS - 1));
  assert.ok(breakerAllows(b, 1000 + BREAKER_COOLDOWN_MS));
  assert.deepEqual(breakerAfter(b, true, 99_999), closedBreaker());
});

test('tool_status: down → owner alert once after 5 min → incident only after delivery', () => {
  const t0 = '2026-10-03T12:00:00.000Z';
  const at = (ms: number) => new Date(Date.parse(t0) + ms).toISOString();
  let r = nextToolStatus(okStatus(), { ok: false, latencyMs: 8000 }, t0);
  assert.equal(r.next.state, 'down');
  assert.equal(r.next.downSince, t0);
  assert.equal(r.alertOwner, false);
  assert.equal(r.next.incidentActive, false);
  r = nextToolStatus(r.next, { ok: false, latencyMs: 8000 }, at(OWNER_ALERT_AFTER_MS - 1));
  assert.equal(r.alertOwner, false);
  r = nextToolStatus(r.next, { ok: false, latencyMs: 8000 }, at(OWNER_ALERT_AFTER_MS));
  assert.equal(r.alertOwner, true);
  assert.equal(r.next.incidentActive, false, 'not before the alert is delivered');
  const alerted = afterOwnerAlert(r.next, at(OWNER_ALERT_AFTER_MS));
  assert.equal(alerted.incidentActive, true);
  r = nextToolStatus(alerted, { ok: false, latencyMs: 8000 }, at(OWNER_ALERT_AFTER_MS * 2));
  assert.equal(r.alertOwner, false, 'once per outage');
  r = nextToolStatus(r.next, { ok: true, latencyMs: 200 }, at(OWNER_ALERT_AFTER_MS * 3));
  assert.equal(r.next.state, 'ok');
  assert.equal(r.next.incidentActive, false, 'recovery closes the alerted incident');
  assert.equal(nextToolStatus(okStatus(), { ok: true, latencyMs: 5000 }, t0).next.state, 'slow');
  // An incident the owner opened by hand stays until the owner closes it.
  const manual = { ...okStatus(), incidentActive: true, incidentSince: t0 };
  assert.equal(nextToolStatus(manual, { ok: true, latencyMs: 100 }, at(1)).next.incidentActive, true);
});

test('Tus herramientas status lines', () => {
  const now = new Date('2026-10-03T18:00:00.000Z');
  const tz = 'America/Mexico_City';
  assert.equal(relativeDay('2026-10-03T15:00:00.000Z', now, 'es', tz), 'hoy');
  assert.equal(relativeDay('2026-10-02T15:00:00.000Z', now, 'es', tz), 'ayer');
  assert.match(relativeDay('2026-09-20T15:00:00.000Z', now, 'es', tz), /^el 20 sept?\.?$/);
  assert.deepEqual(clipsLine({ inProgress: 1, ready: 6, latestReadyAt: '2026-10-02T15:00:00.000Z' }, now, 'es', tz), {
    key: 'clipsBoth',
    values: { n: 1, m: 6, cuando: 'ayer' },
  });
  assert.equal(clipsLine({ inProgress: 0, ready: 0, latestReadyAt: null }, now, 'es', tz).key, 'clipsNone');
  assert.deepEqual(signalsLine(['2026-10-03T13:00:00.000Z', '2026-10-01T13:00:00.000Z'], now, tz), {
    key: 'signalsToday',
    values: { n: 1 },
  });
  assert.equal(signalsLine([], now, tz).key, 'signalsNone');
  assert.deepEqual(liveLine({ connected: false, live: false }), { key: 'liveSetup', values: {}, warn: true });
  assert.equal(liveLine({ connected: true, live: false }).key, 'liveReady');
  assert.equal(liveLine({ connected: true, live: true }).key, 'liveOn');
});

// ── Static rules over the source ────────────────────────────────────────
const ROOT = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('F3: nothing inside the app opens a tab or a window', () => {
  const files = [
    ...walk(join(ROOT, 'src/app/[locale]/(dashboard)/app')),
    ...['app', 'tools', 'workspace'].flatMap((d) => walk(join(ROOT, 'src/components', d))),
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /window\.open\s*\(/, f);
    assert.doesNotMatch(src, /target=["']_blank["']/, f);
  }
});

const messages = (l: string) => JSON.parse(readFileSync(join(ROOT, `messages/${l}.json`), 'utf8'));

/** Every string under the given namespaces. */
function strings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === 'string') out.push(obj);
  else if (obj && typeof obj === 'object') for (const v of Object.values(obj)) strings(v, out);
  return out;
}

// TOOLS-SPEC §10 + the advice words of §8.
const BANNED = [
  /pr[oó]ximamente/i,
  /\bbeta\b/i,
  /\bDisponible\b/,
  /Requiere Pro/i,
  /pesta[ñn]a nueva/i,
  /new tab/i,
  /\bengines?\b/i,
  /\bmotor(es)?\b/i,
  /ChalyClip/,
  /chalybcrypto|chalybobs|chalybclip/,
  /OBS controller/i,
  /te conviene/i,
  /deber[ií]as/i,
  /tu cartera/i,
  /tus ganancias/i,
  /si ya ganaste/i,
  /garantizad[oa]/i,
  /seguro que/i,
  /sin riesgo/i,
  /ganancia asegurada/i,
  /rendimiento de/i,
  /% de ganancia/i,
  /(objetivo de precio|precio objetivo)/i,
  /\bcopiar\b/i,
  /invierte ahora/i,
  /no te lo pierdas/i,
];

const TOOL_NAMESPACES = ['toolShell', 'tools', 'clipsTool', 'signalsTool', 'liveTool'];

test('§10/§8: no banned word in the tools copy (es + en)', () => {
  for (const l of ['es', 'en']) {
    const m = messages(l);
    for (const ns of TOOL_NAMESPACES) {
      for (const s of strings(m[ns])) {
        // "No garantizamos resultados" is the Law's own negation (aceptacion-ux §6).
        const text = s.replace(/No garantizamos|We don't guarantee/g, '');
        for (const re of BANNED) assert.doesNotMatch(text, re, `${l}.${ns}: "${s}"`);
      }
    }
  }
});

test('F4: the "opens in a new tab" copy is gone everywhere', () => {
  for (const l of ['es', 'en']) {
    const all = strings(messages(l)).join('\n');
    assert.doesNotMatch(all, /se abre en una pesta[ñn]a nueva|opens in a new tab/i);
  }
});

test('the risk notice is aceptacion-ux §6 word for word', () => {
  const body = messages('es').consents.risk.body.replace(/<\/?b>/g, '**');
  const law = readFileSync(join(ROOT, 'docs/design/app-reimagine/legal/aceptacion-ux.md'), 'utf8');
  const quoted = body.replace('{herramienta}', '{Herramienta}');
  assert.ok(law.includes(quoted), 'consents.risk.body drifted from aceptacion-ux §6');
  assert.equal(messages('es').consents.risk.check, 'Entiendo y acepto que las decisiones y los riesgos son míos.');
});
