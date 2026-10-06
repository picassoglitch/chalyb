// P3 legal guardrails (BUILD-SPEC §11.4–11.6). Deploy-blocking.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockSenales, createMockInversiones } from '@/lib/tools/adapters/mock-tools';
import { signalsFor, SIGNAL_FORBIDDEN, PERSONAL_FINANCE_FIELDS } from '@/lib/guardrails/signals';
import { decideKey, validateRule, INVEST_FORBIDDEN } from '@/lib/guardrails/invest';
import { FORECAST_FORBIDDEN, BETTING_DOMAIN_DENYLIST } from '@/lib/guardrails/forecasts';
import { assistantGreeting, withSelfIdentification } from '@/lib/guardrails/assistant';
import {
  assertLikenessConsent,
  ungatedLikenessOptions,
  GATED_LIKENESS_OPTIONS,
} from '@/lib/guardrails/likeness';
import * as mocks from '@/lib/tools/adapters/mock-tools';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
function* files(dir: string, ext: RegExp): Generator<string> {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return;
  for (const n of readdirSync(abs)) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) yield* files(p, ext);
    else if (ext.test(n)) yield p;
  }
}

// ── Señales ──────────────────────────────────────────────────────────
test('signal content takes no user: the contract has only { plan, coins }', () => {
  const src = read('src/lib/tools/adapters/tools.ts');
  // The whole parameter list: the input object, then only the BFF timeout
  // signal. No user anywhere.
  const sig = src.match(/getSignals\(\s*input: \{([^}]*)\},?\s*(signal\?: AbortSignal,?)?\s*\)/);
  assert.ok(sig, 'getSignals signature found (input, then at most the AbortSignal)');
  assert.doesNotMatch(sig![0]!, /user/i);
  assert.match(sig![1]!, /plan/);
});

test('two users on the same plan get byte-identical signals', async () => {
  const a = createMockSenales(() => 1_790_000_000_000);
  await a.savePrefs('u1', {
    coins: ['BTC'],
    channels: ['app'],
    timeframe: 'day',
    quietHours: false,
  });
  await a.savePrefs('u2', {
    coins: ['ETH', 'SOL'],
    channels: ['email'],
    timeframe: 'week',
    quietHours: true,
  });
  const all1 = await signalsFor(a, 'PRO', []);
  const all2 = await signalsFor(a, 'PRO', []);
  assert.equal(JSON.stringify(all1), JSON.stringify(all2));
  // A coin choice only filters; the BTC signal itself is the same object.
  const btc1 = (await signalsFor(a, 'PRO', ['BTC']))[0];
  const btc2 = (await signalsFor(a, 'PRO', ['BTC', 'ETH'])).find((s) => s.coin === 'BTC');
  assert.deepEqual(btc1, btc2);
});

test('Señales never reads balances, positions or a risk profile', () => {
  for (const f of [
    ...files('src/lib/tools', /\.ts$/),
    ...files('src/app/[locale]/(dashboard)/app/senales', /\.tsx?$/),
    'src/lib/guardrails/signals.ts',
  ]) {
    const src = read(f).replace(/export const PERSONAL_FINANCE_FIELDS[^\n]*\n/, '');
    if (f.endsWith('signals.ts')) continue;
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), PERSONAL_FINANCE_FIELDS, f);
  }
  for (const sql of files('supabase/migrations', /^004\d.*\.sql$/)) {
    assert.doesNotMatch(read(sql).replace(/--.*$/gm, ''), /risk_profile|investor_profile/i, sql);
  }
});

// ── Inversiones ──────────────────────────────────────────────────────
test('withdrawal keys are refused; read-only and read+trade are accepted', async () => {
  const inv = createMockInversiones();
  const check = async (apiKey: string) =>
    decideKey(await inv.checkPermissions({ exchange: 'Bitso', apiKey, apiSecret: 's' }));
  assert.deepEqual(await check('key-withdraw'), { ok: false, reason: 'withdraw' });
  assert.deepEqual(await check('key-read'), { ok: true });
  assert.deepEqual(await check('key-trade'), { ok: true });
});

test('a rule can only come from the user', () => {
  const good = {
    asset: 'btc',
    side: 'buy',
    condition: 'si BTC baja de 60,000',
    maxAmount: 500,
    schedule: 'todos los días',
  };
  const ok = validateRule(good);
  assert.ok(ok.ok && ok.rule.source === 'user' && ok.rule.asset === 'BTC');
  assert.deepEqual(validateRule({ ...good, source: 'signal' }), { ok: false, errors: ['source'] });
  assert.equal(validateRule({ ...good, maxAmount: 0 }).ok, false);
  assert.equal(validateRule({ ...good, condition: '' }).ok, false);
});

// ── Pronósticos / Asistente / likeness ───────────────────────────────
test('the Asistente always introduces itself as automatic', () => {
  assert.equal(
    assistantGreeting('Tacos Lupe', 'es'),
    'Hola, soy el asistente automático de Tacos Lupe.',
  );
  assert.ok(
    withSelfIdentification('Abrimos a las 9.', 'Tacos Lupe', 'es').startsWith(
      'Hola, soy el asistente automático',
    ),
  );
  const once = withSelfIdentification('x', 'A', 'es');
  assert.equal(withSelfIdentification(once, 'A', 'es'), once);
});

test('the likeness guard refuses without consent; no ungated likeness option exists', () => {
  assert.throws(() => assertLikenessConsent(false, 'voice'), /consent required/);
  assert.doesNotThrow(() => assertLikenessConsent(true, 'voice'));
  for (const make of Object.values(mocks)) {
    const adapter = (
      make as () => {
        capabilities(): {
          likenessOptions: { id: string; usesLikeness: true }[];
          supportsConnect: boolean;
        };
      }
    )();
    assert.deepEqual(ungatedLikenessOptions(adapter.capabilities(), GATED_LIKENESS_OPTIONS), []);
  }
  assert.deepEqual(
    ungatedLikenessOptions(
      { supportsConnect: false, likenessOptions: [{ id: 'dub', usesLikeness: true }] },
      new Set(),
    ),
    ['dub'],
  );
});

// ── Forbidden words across messages, emails and the built bundle ────
const DISCLAIMER_KEYS = new Set([
  'forecasts.footer',
  'landing.tools.legalBets',
  'landing.publicFooter.disclaimer',
]);

/** Message values, minus the legally required disclaimers. */
function customerMessages(locale: string): string {
  const out: string[] = [];
  const walk = (node: unknown, key: string) => {
    if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) walk(v, key ? `${key}.${k}` : k);
    // The required disclaimers negate the words on purpose ("no es asesoría
    // de apuestas"): aceptacion-ux §6, the Pronósticos footer (P3-9) and the
    // landing's exact notices (LANDING-SPEC §1.5, §3.3, §3.11).
    else if (!key.startsWith('consents.') && !DISCLAIMER_KEYS.has(key)) out.push(String(node));
  };
  walk(JSON.parse(read(`messages/${locale}.json`)), '');
  return out.join('\n');
}

test('no advice, copy-trading or betting words anywhere customers can read', () => {
  const msgHits = [
    ...SIGNAL_FORBIDDEN,
    ...INVEST_FORBIDDEN,
    FORECAST_FORBIDDEN,
    /Requiere Pro/,
  ].flatMap((re) =>
    ['es', 'en'].flatMap((l) =>
      re.test(customerMessages(l)) ? [`messages/${l}.json: ${re}`] : [],
    ),
  );
  assert.deepEqual(msgHits, []);
  const sources = [...files('src/lib/email', /\.ts$/), ...files('.next/static', /\.js$/)];
  const patterns = [...SIGNAL_FORBIDDEN, ...INVEST_FORBIDDEN, FORECAST_FORBIDDEN, /Requiere Pro/];
  const hits: string[] = [];
  for (const f of sources) {
    const text = read(f).replace(/SIGNAL_FORBIDDEN|FORECAST_FORBIDDEN|INVEST_FORBIDDEN/g, '');
    for (const re of patterns) {
      const m = text.match(re);
      // The guardrail modules themselves ship the patterns as regex source.
      if (m && !f.startsWith('.next')) hits.push(`${f}: ${m[0]}`);
      if (m && f.startsWith('.next') && !text.includes(re.source)) hits.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('no betting domain is linked from the code', () => {
  for (const f of [...files('src', /\.tsx?$/), 'messages/es.json', 'messages/en.json']) {
    if (f.includes('guardrails/forecasts')) continue;
    const text = read(f);
    for (const d of BETTING_DOMAIN_DENYLIST) assert.ok(!text.includes(d), `${f} mentions ${d}`);
  }
});

test('no mockup demo data in production code', () => {
  const DEMO = /María López|Noche de preguntas|Coyoacán|4821|@MariaEnVivo/;
  for (const f of files('src', /\.tsx?$/)) {
    if (/mock|fixture/i.test(f)) continue;
    assert.doesNotMatch(read(f).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ''), DEMO, f);
  }
});
