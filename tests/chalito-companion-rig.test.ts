import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { creaturePose } from '../src/lib/chalito/pkg/avatar/gestures';
import { ActivityTracker, activityActions } from '../src/lib/chalito/pkg/avatar/activity';
import { parseRig, rigFiles, rigPose } from '../src/lib/chalito/pkg/avatar/rig';

const dir = new URL('../public/roster/assets/chalito/', import.meta.url);

test('the companion only breathes at rest: no hopping (owner decision 2026-10-19)', () => {
  for (let t = 0; t < 10_000; t += 13) assert.ok(creaturePose({ tag: 'excited', intensity: 1 }, t).offsetY < 0.005);
});

test('the Chalito card ships a rig whose every part image is served', () => {
  const card = JSON.parse(readFileSync(new URL('card.json', dir), 'utf8'));
  const rig = parseRig(card.rig);
  assert.ok(rig, 'rig parses');
  for (const f of rigFiles(rig)) assert.ok(existsSync(new URL(f, dir)), `${f} exists`);
});

test('sessions drive it: busy, an answer waiting, a hop on a finish', () => {
  const tr = new ActivityTracker();
  const a = tr.update([{ sid: 's', state: 'running' }], 0);
  assert.equal(a.mode, 'working');
  const b = tr.update([{ sid: 's', state: 'completed' }], 1);
  assert.equal(b.mode, 'needs_you');
  assert.deepEqual(activityActions(a, b), ['hop']);
  const wave = rigPose({ tMs: 0, mode: 'rest', action: { name: 'wave', elapsedMs: 1000 }, blink: 0, mouth: 0, gaze: { yaw: 0, pitch: 0 }, sleepy: false });
  assert.ok(wave.armR > 90);
});
