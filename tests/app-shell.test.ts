// P1 shell and Inicio models.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_ITEMS,
  activeNavFor,
  normalizeAppPath,
  shellModeFor,
} from '@/components/app/shell-routes';
import { selectPlanStrip, selectTaskCards } from '@/components/app/home-model';
import { planLabelKey } from '@/lib/billing/plan-label';
import type { ToolAccess } from '@/lib/billing/entitlement-core';

test('exactly three nav items (BUILD-SPEC §5.3)', () => {
  assert.deepEqual(
    NAV_ITEMS.map((n) => [n.key, n.href]),
    [
      ['inicio', '/app'],
      ['resultados', '/app/history'],
      ['cuenta', '/app/settings'],
    ],
  );
});

test('paths map to their nav item, with or without /en', () => {
  assert.equal(normalizeAppPath('/en/app/'), '/app');
  assert.equal(activeNavFor('/app'), 'inicio');
  assert.equal(activeNavFor('/en/app/engines/chalybclip'), 'inicio');
  assert.equal(activeNavFor('/app/history'), 'resultados');
  assert.equal(activeNavFor('/app/herramientas'), 'inicio');
  assert.equal(activeNavFor('/app/senales/avisos'), 'inicio');
  for (const p of [
    '/app/settings',
    '/app/settings/perfil',
    '/app/billing',
    '/app/usage',
    '/app/subscription',
    '/app/messages',
    '/app/help',
  ]) {
    assert.equal(activeNavFor(p), 'cuenta', p);
  }
});

test('wizards hide the nav; rebuilt screens are modern; the rest legacy', () => {
  assert.equal(shellModeFor('/app/clips'), 'wizard');
  assert.equal(shellModeFor('/en/app/clips/job_1'), 'wizard');
  assert.equal(shellModeFor('/app'), 'modern');
  assert.equal(shellModeFor('/app/settings'), 'modern');
  assert.equal(shellModeFor('/app/settings/perfil'), 'legacy');
  assert.equal(shellModeFor('/app/billing'), 'modern', 'Mi plan since P2');
  assert.equal(shellModeFor('/app/subscription'), 'modern', 'FIX-3 A');
  assert.equal(shellModeFor('/en/app/subscription'), 'modern');
  assert.equal(shellModeFor('/app/usage'), 'legacy');
  assert.equal(shellModeFor('/app/prueba/pago'), 'wizard');
  assert.equal(shellModeFor('/app/engines/chalybclip'), 'modern', 'tool pages');
  assert.equal(shellModeFor('/app/herramientas'), 'modern', 'Más herramientas since P3');
  for (const p of [
    '/app/senales',
    '/app/senales/listo',
    '/app/en-vivo',
    '/app/herramientas/asistente',
    '/en/app/herramientas/inversiones',
  ])
    assert.equal(shellModeFor(p), 'wizard', p);
  assert.equal(shellModeFor('/app/billing/cambiar'), 'wizard');
});

test('plan labels', () => {
  assert.equal(planLabelKey('FREE'), 'gratis');
  assert.equal(planLabelKey('PRO'), 'pro');
  assert.equal(planLabelKey('PARTNER'), 'pro');
  assert.equal(planLabelKey('VIP'), 'vip');
});

test('task cards: only visible headline tools, and Más only with extra tools', () => {
  const three = selectTaskCards(['chalybclip', 'chalybcrypto', 'chalybobs'], () => false);
  assert.deepEqual(
    three.cards.map((c) => [c.key, c.href]),
    [
      ['clips', '/app/engines/chalybclip'],
      ['senales', '/app/engines/chalybcrypto'],
      ['envivo', '/app/engines/chalybobs'],
    ],
  );
  assert.deepEqual(three.extraSlugs, []);

  const more = selectTaskCards(
    ['chalybclip', 'chalybcrypto', 'chalybobs', 'chalybbot'],
    (s) => s !== 'chalybobs',
  );
  assert.deepEqual(
    more.cards.map((c) => c.href),
    ['/app/clips', '/app/senales', '/app/engines/chalybobs', '/app/herramientas'],
    'each tool goes in-hub only when the hub runs it',
  );
  assert.equal(more.cards.at(-1)!.key, 'mas');
  assert.deepEqual(more.extraSlugs, ['chalybbot']);

  assert.deepEqual(
    selectTaskCards(['chalybclip'], () => false).cards.map((c) => c.key),
    ['clips'],
  );
});

const NAMES = {
  chalybclip: 'Clips',
  chalybcrypto: 'Señales',
  chalybobs: 'En vivo',
  chalybbot: 'Asistente',
  chalybpicks: 'Pronósticos',
};
const tools = (states: Record<string, ToolAccess['state']>) =>
  Object.fromEntries(Object.entries(states).map(([s, state]) => [s, { state } as ToolAccess]));
const OFF = { proIncludesAllTools: false, trialFlow: false };
const ON = { proIncludesAllTools: true, trialFlow: true };

test('Free: "see plans" until the trial exists and Pro really is all tools', () => {
  const e = {
    plan: 'FREE' as const,
    trialUsed: false,
    tools: tools({ chalybclip: 'included', chalybcrypto: 'trial_offer' }),
  };
  assert.deepEqual(selectPlanStrip(e, NAMES, OFF), { kind: 'offer', cta: 'plans' });
  assert.deepEqual(selectPlanStrip(e, NAMES, { proIncludesAllTools: false, trialFlow: true }), {
    kind: 'offer',
    cta: 'plans',
  });
  assert.deepEqual(selectPlanStrip(e, NAMES, ON), { kind: 'offer', cta: 'trial' });
  assert.deepEqual(selectPlanStrip({ ...e, trialUsed: true }, NAMES, ON), {
    kind: 'offer',
    cta: 'return',
  });
});

test('VIP / admin: everything included, chips of four + "y N más"', () => {
  const e = {
    plan: 'VIP' as const,
    trialUsed: false,
    tools: tools({
      chalybclip: 'included',
      chalybcrypto: 'included',
      chalybobs: 'included',
      chalybbot: 'included',
      chalybpicks: 'included',
    }),
  };
  assert.deepEqual(selectPlanStrip(e, NAMES, OFF), {
    kind: 'included',
    plan: 'VIP',
    chips: ['Clips', 'Señales', 'En vivo', 'Asistente'],
    more: 1,
  });
});

test('Pro on one tool (Q7 off) names what it includes; with all tools it is "todo incluido"', () => {
  const one = {
    plan: 'PRO' as const,
    trialUsed: false,
    tools: tools({ chalybclip: 'included', chalybcrypto: 'included', chalybobs: 'trial_offer' }),
  };
  assert.deepEqual(selectPlanStrip(one, NAMES, OFF), {
    kind: 'single',
    tools: ['Clips', 'Señales'],
  });
  const all = {
    ...one,
    tools: tools({ chalybclip: 'included', chalybcrypto: 'included', chalybobs: 'included' }),
  };
  assert.deepEqual(selectPlanStrip(all, NAMES, ON), {
    kind: 'included',
    plan: 'Pro',
    chips: ['Clips', 'Señales', 'En vivo'],
    more: 0,
  });
});
