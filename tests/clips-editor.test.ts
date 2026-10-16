// Clips editor (/app/clips/[clipId], engine mode): the rules ported from
// the engine's old editor (presets, URL format, prefs diff), the BFF's
// request cleaners, the engine paths the editor calls, the ClipDetail
// mapping and the media redirect guard.

import test from 'node:test';
import assert from 'node:assert/strict';
import { clipsEngine, type ClipsEngineDeps } from '@/lib/tools/adapters/clips/client';
import { editorApi } from '@/lib/tools/adapters/clips/editor-api';
import { clipDetailFromEditor, editorMethods } from '@/lib/tools/adapters/clips/editor';
import {
  parseHooksBody,
  parseOverlayBody,
  parsePref,
  parseQuality,
  CLIP_ID_RE,
  type EditorForm,
  type EditorPayload,
} from '@/lib/tools/adapters/clips/editor-types';
import {
  applyClipStyle,
  applyTarget,
  changedPrefs,
  formatKickUrl,
  operatorHandle,
  PREF_FIELDS,
  simPlatform,
  activeLine,
} from '@/components/tools/clips/editor/presets';

import { PREF_FIELD_NAMES } from '@/lib/tools/adapters/clips/editor-types';

const FORM: EditorForm = {
  target_platform: 'all',
  clip_style: 'repost_page_viral',
  title_text: '',
  captions_enabled: true,
  captions_preset: '',
  captions_highlight_color: '#FFD700',
  captions_position: 'upper_third',
  captions_font_size: 'medium',
  captions_animation: 'pop',
  captions_lead_ms: 120,
  banner_enabled: false,
  banner_platform: 'kick',
  banner_url: '',
  banner_color: '#53FC18',
  banner_show_context: false,
  banner_show_safezones: false,
  banner_variant: 'kick_repost_page',
  banner_live_badge: false,
  platform_overlay_preview: 'clean',
  safe_zone_platform: 'tiktok',
  preview_mode: 'edited',
  fit_mode: 'smart_crop',
  top_hook_enabled: false,
  top_hook_text: '',
  top_hook_style: 'white_rounded',
  comments_show: false,
  comments_fake_likes: 8,
};

// ── presets (parity with the old editor JS) ───────────────────────────

test('picking Kick applies its bundle on top of the clip style', () => {
  const f = applyTarget(FORM, 'kick');
  assert.equal(f.target_platform, 'kick');
  assert.equal(f.clip_style, 'repost_page_viral');
  assert.equal(f.captions_position, 'bottom'); // platform override beats the style
  assert.equal(f.captions_preset, 'karaoke_pop'); // from the style
  assert.equal(f.banner_live_badge, true);
  assert.equal(f.top_hook_enabled, false);
  assert.equal(f.fit_mode, 'letterbox');
  assert.equal(f.safe_zone_platform, 'kick');
  assert.equal(f.captions_lead_ms, 120);
  assert.equal(f.title_text, FORM.title_text); // never touches the hook text
});

test('Shorts and Reels keep their own lead times and animation', () => {
  assert.equal(applyTarget(FORM, 'shorts').captions_lead_ms, 80);
  assert.equal(applyTarget(FORM, 'shorts').captions_animation, 'slide');
  assert.equal(applyTarget(FORM, 'reels').captions_lead_ms, 100);
  assert.equal(applyTarget(FORM, 'all').safe_zone_platform, 'tiktok');
});

test('a clip style flips only its bundle', () => {
  const f = applyClipStyle({ ...FORM, banner_url: 'kick.com/x' }, 'gaming_chaos');
  assert.equal(f.clip_style, 'gaming_chaos');
  assert.equal(f.banner_variant, 'kick_green_block');
  assert.equal(f.captions_preset, 'bold_block');
  assert.equal(f.captions_position, 'centered');
  assert.equal(f.captions_font_size, 'large');
  assert.equal(f.banner_url, 'kick.com/x');
  assert.equal(applyClipStyle(FORM, 'minimal_native').banner_enabled, false);
});

test('KICK.COM/<HANDLE> from whatever was typed', () => {
  for (const raw of [
    'aldo',
    '@aldo',
    'kick.com/aldo',
    'https://kick.com/aldo',
    'https://www.kick.com/aldo/',
  ])
    assert.equal(formatKickUrl(raw), 'KICK.COM/ALDO', raw);
  assert.equal(formatKickUrl(''), 'KICK.COM/YOURHANDLE');
  assert.equal(formatKickUrl('   '), 'KICK.COM/YOURHANDLE');
  assert.equal(operatorHandle('kick.com/AldoV'), '@aldov');
  assert.equal(operatorHandle(''), '@yourhandle');
});

test('simulated chrome: the explicit pick wins, else the target', () => {
  assert.equal(
    simPlatform({ platform_overlay_preview: 'clean', target_platform: 'tiktok' }),
    'clean',
  );
  assert.equal(
    simPlatform({ platform_overlay_preview: 'reels', target_platform: 'kick' }),
    'reels',
  );
  assert.equal(simPlatform({ platform_overlay_preview: '', target_platform: 'all' }), 'tiktok');
  assert.equal(simPlatform({ platform_overlay_preview: '', target_platform: 'shorts' }), 'shorts');
  assert.equal(simPlatform({ platform_overlay_preview: '', target_platform: 'x' }), 'clean');
});

test('only brand-kit fields auto-save, and only when they change', () => {
  const next = { ...applyTarget(FORM, 'kick'), title_text: 'hola', banner_url: ' kick.com/a ' };
  const changes = changedPrefs(FORM, next);
  const fields = changes.map((c) => c.field);
  assert.ok(fields.includes('target_platform'));
  assert.ok(fields.includes('captions_position'));
  assert.ok(!fields.includes('title_text' as never)); // per clip, not a brand setting
  assert.ok(!fields.includes('fit_mode' as never)); // editor-only
  assert.equal(changes.find((c) => c.field === 'banner_url')?.value, 'kick.com/a');
  assert.deepEqual(changedPrefs(FORM, { ...FORM }), []);
  // The client list and the BFF whitelist are the same set (engine's too).
  assert.deepEqual([...PREF_FIELDS].sort(), [...PREF_FIELD_NAMES].sort());
});

test('the caption line on screen follows the clock', () => {
  const lines = [
    { ts: 0.5, end_ts: 1.5, text: 'a', words: [] },
    { ts: 2, end_ts: 3, text: 'b', words: [] },
  ];
  assert.equal(activeLine(lines, 0.2), -1);
  assert.equal(activeLine(lines, 0.5), 0);
  assert.equal(activeLine(lines, 1.5), -1);
  assert.equal(activeLine(lines, 2.9), 1);
});

// ── BFF request cleaners ──────────────────────────────────────────────

test('overlay body: known fields, right types, bounded', () => {
  const out = parseOverlayBody({
    title_text: 'x'.repeat(900),
    banner_enabled: 'yes',
    captions_enabled: false,
    captions_lead_ms: 9000.7,
    comments_fake_likes: -5,
    top_hook_text: 'y'.repeat(300),
    is_admin: true,
    tenant_id: 'ten_other',
    banner_variant: 42,
  });
  assert.equal(out.title_text?.length, 500);
  assert.equal(out.top_hook_text?.length, 120);
  assert.equal(out.captions_enabled, false);
  assert.equal('banner_enabled' in out, false);
  assert.equal(out.captions_lead_ms, 500);
  assert.equal(out.comments_fake_likes, 0);
  assert.equal('is_admin' in out, false);
  assert.equal('tenant_id' in out, false);
  assert.equal('banner_variant' in out, false);
  assert.deepEqual(parseOverlayBody(null), {});
  assert.deepEqual(parseOverlayBody([1, 2]), {});
});

test('prefs, hooks and quality cleaners', () => {
  assert.deepEqual(parsePref({ field: 'captions_lead_ms', value: 150.4 }), {
    field: 'captions_lead_ms',
    value: 150,
  });
  assert.equal(parsePref({ field: 'is_default', value: true }), null);
  assert.equal(parsePref({ field: 'banner_url', value: { x: 1 } }), null);
  assert.equal(
    parsePref({ field: 'banner_url', value: 'k'.repeat(999) })?.value.toString().length,
    300,
  );
  assert.deepEqual(parseHooksBody({ tone: 'gen_z', n: 3 }), { tone: 'gen_z', n: 3 });
  assert.deepEqual(parseHooksBody({ tone: 'evil', n: 99 }), { tone: 'default', n: 10 });
  assert.deepEqual(parseHooksBody({}), { tone: 'default', n: 5 });
  assert.equal(parseQuality('4k'), '4k');
  assert.equal(parseQuality('8k'), '1080');
  assert.equal(parseQuality(null), '1080');
});

test('clip ids are checked', () => {
  assert.ok(CLIP_ID_RE.test('clp_01JABCDEF'));
  for (const bad of ['', '../x', 'a/b', 'clp x', 'a'.repeat(81), '%2e%2e'])
    assert.equal(CLIP_ID_RE.test(bad), false, bad);
});

// ── engine calls ──────────────────────────────────────────────────────

const ID = {
  userId: 'u1',
  email: 'ana@example.com',
  tenantId: 'ten_1',
  tier: 'pro',
  baseUrl: 'https://clips.example',
};

function engineWith(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const deps: ClipsEngineDeps = {
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    }) as unknown as typeof fetch,
    identity: async () => ID,
    mint: () => 'tok',
    forget: () => {},
  };
  return { engine: clipsEngine('u1', deps), calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('editor API hits the engine routes with the right verbs', async () => {
  const { engine, calls } = engineWith(() => json(200, {}));
  const api = editorApi(engine);
  await api.load('clp_1');
  await api.saveOverlay('clp_1', { title_text: 'x' });
  await api.finalize('clp_1', {});
  await api.reject('clp_1');
  await api.revertTrim('clp_1');
  await api.hooks('clp_1', { tone: 'default', n: 5 });
  await api.pref({ field: 'banner_url', value: 'a' });
  await api.captions('clp_1');
  await api.render('clp_1', '2k');
  await api.renderStatus('clp_1', '1080');
  await api.renderRetry('clp_1', '4k');
  const seen = calls.map((c) => `${c.init.method} ${c.url.replace('https://clips.example', '')}`);
  assert.deepEqual(seen, [
    'GET /api/hub/v1/clips/clp_1/editor',
    'PUT /api/hub/v1/clips/clp_1/overlay',
    'POST /api/hub/v1/clips/clp_1/finalize',
    'POST /api/hub/v1/clips/clp_1/reject',
    'POST /api/hub/v1/clips/clp_1/revert-trim',
    'POST /api/hub/v1/clips/clp_1/hooks',
    'POST /api/hub/v1/brand-kit/prefs',
    'GET /api/hub/v1/clips/clp_1/captions',
    'POST /api/hub/v1/clips/clp_1/render?quality=2k',
    'GET /api/hub/v1/clips/clp_1/render-status?quality=1080',
    'POST /api/hub/v1/clips/clp_1/render-retry?quality=4k',
  ]);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer tok');
});

test('media paths from the engine become absolute links, nothing else does', async () => {
  const { engine } = engineWith(() =>
    json(200, {
      clip: { id: 'clp_1' },
      media: {
        preview: '/api/hub/media/clip/clp_1?t=ten_1&exp=9&sig=a',
        thumbnail: 'https://evil.example/x.jpg',
      },
    }),
  );
  const api = editorApi(engine);
  const p = await api.loadAbsolute('clp_1');
  assert.equal(
    p.media.preview,
    'https://clips.example/api/hub/media/clip/clp_1?t=ten_1&exp=9&sig=a',
  );
  assert.equal(p.media.thumbnail, null);
  const s = await api.absolute({
    state: 'ready',
    progress_pct: 100,
    error: null,
    quality: '1080',
    download: '/api/hub/media/render/clp_1?q=1080&t=ten_1&exp=9&sig=b',
  });
  assert.equal(
    s.download,
    'https://clips.example/api/hub/media/render/clp_1?q=1080&t=ten_1&exp=9&sig=b',
  );
  assert.equal(
    (
      await api.absolute({
        state: 'idle',
        progress_pct: 0,
        error: null,
        quality: '1080',
        download: null,
      })
    ).download,
    null,
  );
});

test('ids are encoded into one path segment', async () => {
  const { engine, calls } = engineWith(() => json(200, {}));
  await editorApi(engine).load('a?b#c');
  assert.ok(calls[0]!.url.includes('/clips/a%3Fb%23c/editor'));
});

const PAYLOAD = {
  clip: {
    id: 'clp_1',
    stream_id: 'str_9',
    stream_title: 'Mi stream',
    status: 'cut',
    duration_s: 31.5,
    start_s: 0,
    end_s: 31.5,
    original_start_s: null,
    original_end_s: null,
    has_overlay: true,
    has_thumbnail: true,
    render_state: 'idle',
    created_at: '2026-10-15T00:00:00Z',
  },
  form: { ...FORM, title_text: 'Hook', captions_enabled: false },
} as unknown as EditorPayload;

test('the editor payload maps onto the generic clip shape', () => {
  const d = clipDetailFromEditor(PAYLOAD);
  assert.equal(d.id, 'clp_1');
  assert.equal(d.jobId, 'str_9');
  assert.equal(d.title, 'Hook');
  assert.equal(d.captionsOn, false);
  assert.equal(d.format, 'vertical');
  assert.deepEqual(d.trim, { startS: 0, endS: 31.5 });
  assert.equal(d.previewUrl, '/api/tools/chalybclip/clips/clp_1/media');
  assert.equal(d.thumbUrl, '/api/tools/chalybclip/clips/clp_1/thumbnail');
  assert.equal(d.downloadUrl, '/api/tools/chalybclip/clips/clp_1/download?quality=1080');
  assert.equal(
    clipDetailFromEditor({ ...PAYLOAD, form: { ...PAYLOAD.form, title_text: '' } }).title,
    'Mi stream',
  );
});

test('getClip: 404 from the engine is null, other errors throw', async () => {
  const notFound = engineWith(() =>
    json(404, { ok: false, error: { code: 'not_found', message: 'x', reason: 'clip_not_found' } }),
  );
  const m = editorMethods(() => notFound.engine);
  assert.equal(await m.getClip('u1', 'clp_x'), null);
  const down = engineWith(() => json(503, { ok: false, error: { code: 'unavailable' } }));
  await assert.rejects(editorMethods(() => down.engine).getClip('u1', 'clp_x'));
});

test('patchClip saves title and captions onto the overlay', async () => {
  const bodies: unknown[] = [];
  const { engine } = engineWith((url, init) => {
    if (init.method === 'PUT') bodies.push(JSON.parse(String(init.body)));
    return json(200, url.endsWith('/editor') ? PAYLOAD : { ok: true, status: 'cut' });
  });
  const d = await editorMethods(() => engine).patchClip('u1', 'clp_1', {
    title: 'Nuevo',
    captionsOn: true,
    format: 'square',
  });
  assert.ok(d);
  const sent = bodies[0] as EditorForm;
  assert.equal(sent.title_text, 'Nuevo');
  assert.equal(sent.captions_enabled, true);
  assert.equal(sent.banner_variant, FORM.banner_variant); // the rest unchanged
});
