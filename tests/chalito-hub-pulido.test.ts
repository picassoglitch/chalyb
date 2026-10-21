import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const PAGES = 'src/app/[locale]/(dashboard)/app/chalito';
const C = 'src/components/tools/chalito';
const src = (p: string) => readFileSync(p, 'utf8');
const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === 'page.tsx' ? [p] : [];
  });

test('every Chalito page has its own tab title in es and en (not the marketing tagline)', () => {
  const all = pages(PAGES);
  assert.ok(all.length > 20);
  for (const p of all) {
    const m = src(p).match(/chalitoMetadata\('([A-Za-z]+)'/);
    assert.ok(m, `${p} has no chalitoMetadata title`);
    const key = m[1] as keyof typeof es.meta;
    assert.ok(es.meta[key] && en.meta[key], `${p}: meta.${key} in es and en`);
  }
});

test('lists and deep links wait for the first live pull before saying "empty" or "not found"', () => {
  for (const f of ['Sessions.tsx', 'Approvals.tsx', 'NewSession.tsx']) {
    const s = src(join(C, f));
    assert.match(s, /useLiveSynced\(\)/, f);
    assert.doesNotMatch(s, /status === "live" \?/, `${f} still trusts "live" alone`);
  }
});

test('token numbers use the hub locale formatter on every Chalito screen', () => {
  for (const f of readdirSync(C).filter((f) => f.endsWith('.tsx')))
    assert.doesNotMatch(src(join(C, f)), /new Intl\.NumberFormat\(locale\b/, f);
});

test('plans links go to /app/planes, never the hub home or "#"', () => {
  for (const f of ['Settings.tsx', 'Onboarding.tsx']) {
    const s = src(join(C, f));
    assert.doesNotMatch(s, /env\.hubUrl \|\| "#"/, f);
    assert.match(s, /\/app\/planes/, f);
  }
  assert.doesNotMatch(src(join(C, 'Mesa.tsx')), /Link=\{NextLinkLike\}/, 'Mesa recharge chip resolved under /app/chalito');
});

test('screen fixes have their copy in both languages', () => {
  for (const m of [es, en]) {
    assert.ok(m.live.devices.thisDevice);
    assert.ok(m.mcp.connectors.revokeFailed);
    assert.ok(m.onboarding.finishFailed);
    assert.ok(m.settings.rooms.error.failed);
    assert.ok(m.live.account.back);
    for (const k of ['launch_failed', 'unsupported_platform', 'install_unavailable', 'recipe_disabled'] as const)
      assert.ok(m.connect.errors[k], k);
  }
  // Typo: "Sesion 1" in Mesas' session names.
  assert.doesNotMatch(src(join(C, 'Mesas.tsx')), /`Sesion /);
});

test('screen fixes: the owner has no "Salir", the stage gets members that arrived while loading, same photo re-picks', () => {
  assert.match(src(join(C, 'Room.tsx')), /!ended && !owner/);
  assert.match(src(join(C, 'RoomStage.tsx')), /s\.setMembers\(\[\.\.\.latest\.current\.members\]\)/);
  assert.match(src(join(C, 'CreateCharacter.tsx')), /e\.currentTarget\.value = ""/);
  // The confirm's onCancel is stable, so its focus effect doesn't rerun on every render.
  assert.match(src(join(C, 'Store.tsx')), /onCancel=\{cancelConfirm\}/);
});
