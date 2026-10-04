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
  assert.equal(activeNavFor('/en/app/clips/ajustes'), 'inicio');
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
  // WS-11: a tool's own screens keep the sidebar (ToolShell); its
  // step-by-step flows stay in the focus layout.
  for (const p of [
    '/app/clips',
    '/en/app/clips/mis-clips',
    '/app/clips/clip_1',
    '/app/clips/ajustes',
    '/app/senales',
    '/app/senales/historial',
    '/app/senales/ajustes',
    '/app/en-vivo',
    '/app/en-vivo/conectar',
    '/app/en-vivo/ajustes',
  ])
    assert.equal(shellModeFor(p), 'modern', p);
  for (const p of [
    '/app/clips/nuevo',
    '/app/clips/nuevo/formato',
    '/en/app/clips/trabajo/job_1',
    '/app/senales/empezar',
    '/app/senales/empezar/listo',
    '/app/prueba/pago',
    '/app/herramientas/asistente',
    '/en/app/herramientas/inversiones',
    '/app/billing/cambiar',
  ])
    assert.equal(shellModeFor(p), 'wizard', p);
  assert.equal(shellModeFor('/app'), 'modern');
  assert.equal(shellModeFor('/app/settings'), 'modern');
  assert.equal(shellModeFor('/app/settings/perfil'), 'modern', 'FIX-3 C');
  assert.equal(shellModeFor('/en/app/settings/perfil'), 'modern');
  assert.equal(shellModeFor('/app/billing'), 'modern', 'Mi plan since P2');
  assert.equal(shellModeFor('/app/subscription'), 'modern', 'FIX-3 A');
  assert.equal(shellModeFor('/en/app/subscription'), 'modern');
  assert.equal(shellModeFor('/app/usage'), 'modern', 'FIX-3 B');
  assert.equal(shellModeFor('/en/app/usage'), 'modern');
  assert.equal(shellModeFor('/app/herramientas'), 'modern', 'Tus herramientas');
});

test('plan labels', () => {
  assert.equal(planLabelKey('FREE'), 'gratis');
  assert.equal(planLabelKey('PRO'), 'pro');
  assert.equal(planLabelKey('PARTNER'), 'pro');
  assert.equal(planLabelKey('VIP'), 'vip');
});

test('task cards: only visible headline tools, and Más only with extra live tools', () => {
  const three = selectTaskCards(['chalybclip', 'chalybcrypto', 'chalybobs']);
  assert.deepEqual(
    three.cards.map((c) => [c.key, c.href]),
    [
      ['clips', '/app/clips'],
      ['senales', '/app/senales'],
      ['envivo', '/app/en-vivo'],
    ],
  );
  assert.deepEqual(three.extraSlugs, []);

  // F7 / Q9: a visible tool that isn't live yet adds no 4th card.
  const notLive = selectTaskCards(['chalybclip', 'chalybcrypto', 'chalybobs', 'chalybbot']);
  assert.deepEqual(
    notLive.cards.map((c) => c.key),
    ['clips', 'senales', 'envivo'],
  );
  assert.deepEqual(notLive.extraSlugs, []);

  assert.deepEqual(
    selectTaskCards(['chalybclip']).cards.map((c) => c.key),
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
