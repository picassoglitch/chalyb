// WS-11 Señales (TOOLS-SPEC §5, §8): banned words, verdicts, the >7-day
// rule, grouping, prefs and the plan-only content.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockSenales } from '@/lib/tools/adapters/mock-tools';
import {
  signalsFor,
  hasBannedSignalText,
  screenSignalText,
  SIGNAL_TEXT_BANNED,
} from '@/lib/guardrails/signals';
import { screenSignal } from '@/lib/tools/signals-screen';
import {
  VERDICT,
  chartGeometry,
  formatRefPrice,
  groupByDay,
  isNewSignal,
  isOldSignal,
  latestPerCoin,
  maskEmail,
  relativeDay,
} from '@/lib/tools/signals-view';
import { mergePrefs, toggleCoin, DEFAULT_PREFS } from '@/lib/tools/signals-prefs';

const NOW = Date.parse('2026-10-03T18:00:00Z');
const DAY = 86_400_000;

test('§8 banned phrases are caught; plain price talk passes', () => {
  for (const bad of [
    'Te conviene comprar ya',
    'Deberías vender',
    'Revisa tu cartera',
    'Ganancia asegurada',
    'Precio objetivo de 1,200,000',
    'Puedes copiar esta señal',
    'Invierte ahora, no te lo pierdas',
    'Es sin riesgo',
    '20% de ganancia',
    'You should buy',
  ])
    assert.ok(hasBannedSignalText(bad), bad);
  assert.equal(
    screenSignalText('Lleva varios días subiendo poco a poco, sin saltos bruscos.'),
    'Lleva varios días subiendo poco a poco, sin saltos bruscos.',
  );
  assert.equal(screenSignalText('Garantizado que sube'), null);
});

test('engine text with a banned phrase is held back before display', () => {
  const s = screenSignal({
    id: 'x',
    coin: 'BTC',
    state: 'buy',
    confidence: 'high',
    explanation: 'Deberías comprar.',
    at: new Date(NOW).toISOString(),
    why: {
      short: 'Te conviene entrar',
      bullets: ['Sube poco a poco.', 'Precio objetivo alto.', 'Sin saltos.'],
    },
  });
  assert.equal(s.explanation, '');
  assert.equal(s.why?.short, '');
  assert.deepEqual(s.why?.bullets, ['Sube poco a poco.', 'Sin saltos.']);
});

test('no Señales message carries a banned phrase (es and en)', () => {
  for (const l of ['es', 'en']) {
    const m = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));
    const text = JSON.stringify([m.signalsTool, m.toolShell.risk, m.toolShell.disclaimer]);
    for (const re of SIGNAL_TEXT_BANNED) assert.doesNotMatch(text, re, `${l}: ${re}`);
    assert.doesNotMatch(text, /pestaña nueva|new tab|próximamente|beta\b/i, l);
  }
});

test('verdicts: buy accent, sell warn, wait gray — never green', () => {
  assert.deepEqual(VERDICT.buy, { key: 'buy', tone: 'acc' });
  assert.deepEqual(VERDICT.sell, { key: 'sell', tone: 'warn' });
  assert.deepEqual(VERDICT.wait, { key: 'wait', tone: 'gray' });
  for (const v of Object.values(VERDICT)) assert.notEqual(v.tone as string, 'ok');
  const es = JSON.parse(readFileSync('messages/es.json', 'utf8')).signalsTool.verdict;
  assert.deepEqual(es, {
    buy: 'Momento de compra',
    sell: 'Momento de venta',
    wait: 'Sin señal clara',
  });
});

test('a signal over 7 days old gets the band; "Nueva" only within 24 h', () => {
  assert.equal(isOldSignal(new Date(NOW - 7 * DAY + 60_000).toISOString(), NOW), false);
  assert.equal(isOldSignal(new Date(NOW - 8 * DAY).toISOString(), NOW), true);
  assert.equal(isNewSignal(new Date(NOW - 2 * 3_600_000).toISOString(), NOW), true);
  assert.equal(isNewSignal(new Date(NOW - 2 * DAY).toISOString(), NOW), false);
});

test('two users of the same plan get the same body; a coin choice only filters', async () => {
  const a = createMockSenales(() => NOW);
  await a.savePrefs('u1', { ...DEFAULT_PREFS, coins: ['BTC'] });
  await a.savePrefs('u2', { ...DEFAULT_PREFS, coins: ['ETH', 'SOL'] });
  const body = async () => JSON.stringify(await signalsFor(a, 'PRO', []));
  assert.equal(await body(), await body());
  const d1 = await a.getSignal({ plan: 'PRO', id: 'PRO-BTC', range: '7d' });
  const d2 = await a.getSignal({ plan: 'PRO', id: 'PRO-BTC', range: '7d' });
  assert.equal(JSON.stringify(d1), JSON.stringify(d2));
  assert.equal(await a.getSignal({ plan: 'PRO', id: 'nope', range: '7d' }), null);
});

test('home shows the newest signal per coin; Historial groups by day, newest first', async () => {
  const a = createMockSenales(() => NOW);
  const all = await signalsFor(a, 'PRO', ['BTC', 'ETH']);
  const latest = latestPerCoin(all);
  assert.deepEqual(latest.map((s) => s.coin).sort(), ['BTC', 'ETH']);
  assert.ok(latest.every((s) => !s.id.includes('-d')));
  const days = groupByDay(all);
  assert.ok(days.length >= 3, 'today, yesterday and the 9-day-old BTC');
  for (let i = 1; i < days.length; i++) assert.ok(days[i - 1]!.day > days[i]!.day);
  assert.equal(relativeDay(all[0]!.at, NOW), 'today');
});

test('the chart is the past only: it ends at the last real point, marker inside the range', async () => {
  const a = createMockSenales(() => NOW);
  const d = (await a.getSignal({ plan: 'PRO', id: 'PRO-BTC', range: '7d' }))!;
  assert.ok(Date.parse(d.series.at(-1)!.at) <= NOW);
  const g = chartGeometry(d.series, 640, 220, d.signal.at)!;
  assert.equal(g.ticks.length, 3);
  assert.ok(g.marker && g.marker.x >= 0 && g.marker.x <= 640);
  assert.ok(!/NaN/.test(g.line));
  const old = (await a.getSignal({ plan: 'PRO', id: 'PRO-BTC-d9', range: '1d' }))!;
  assert.equal(chartGeometry(old.series, 640, 220, old.signal.at)!.marker, null);
});

test('prefs: unknown coins/channels dropped, never empty coins, no extra fields', () => {
  const known = { coins: new Set(['BTC', 'ETH']), channels: new Set(['email', 'app']) };
  const prev = { ...DEFAULT_PREFS, coins: ['BTC'] };
  const next = mergePrefs(
    prev,
    {
      coins: ['ETH', 'XXX'],
      channels: ['whatsapp', 'email'],
      from: '25:00',
      to: '21:00',
      balance: 10,
    },
    known,
  );
  assert.deepEqual(next.coins, ['ETH']);
  assert.deepEqual(next.channels, ['email']);
  assert.equal(next.from, '08:00');
  assert.equal(next.to, '21:00');
  assert.ok(!('balance' in next));
  assert.deepEqual(mergePrefs(prev, { coins: [] }, known).coins, ['BTC']);
  assert.deepEqual(toggleCoin(prev, 'ETH', true), ['BTC', 'ETH']);
  assert.deepEqual(toggleCoin(prev, 'BTC', false), []);
});

test('money and email shown as the screen prints them', () => {
  assert.equal(formatRefPrice(1_186_400, 'es'), '$1,186,400 MXN');
  assert.equal(formatRefPrice(11.6, 'es'), '$11.60 MXN');
  assert.equal(maskEmail('maria@example.com'), 'ma•••@example.com');
  assert.equal(maskEmail(null), '');
});
