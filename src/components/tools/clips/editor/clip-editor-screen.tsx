'use client';

// The clip editor (/app/clips/[clipId], engine mode): the hub's rebuild of
// the Clips engine's /dashboard/clips/{id}. Same behaviour, Chalyb design:
//   - live 9:16 preview of what the export burns in, waveform, AI timeline
//   - AI verdict + Growth Score, automatic-trim undo
//   - target app, clip style, hook (with AI ideas), captions, brand
//   - every brand setting auto-saves to the person's brand kit (next clips
//     open with it); "Guardar borrador" saves this clip
//   - Aprobar y seguir (with the "todavía no está al cien" check), Descartar
//   - Descargar at 1080p/2K/4K (the engine renders, we wait)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { CircleCheck, RotateCcw, Save, Trash2, Play, Pause } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import type {
  CaptionsFeed,
  EditorForm,
  EditorPayload,
  ExportQuality,
  FinalizeResult,
  GrowthFeed,
  HookIdeas,
  IntelligenceFeed,
} from '@/lib/tools/adapters/clips/editor-types';
import { call, clipPath, EditorCallError } from './api';
import { Analysis } from './analysis';
import { Controls, TargetPicker, type Section } from './controls';
import { ErrorLine } from './error-line';
import { ExportPanel } from './export-panel';
import {
  applyClipStyle,
  applyTarget,
  changedPrefs,
  FIT_MODES,
  PLATFORM_COLORS,
  PREVIEW_MODES,
  type ClipStyleId,
  type HookTone,
  type TargetId,
} from './presets';
import { Preview, type Playback } from './preview';
import { Scrubber } from './scrubber';
import { GrowthCard, IssuesSheetBody, Verdict } from './verdict';
import './editor.css';

const LS = {
  fit: 'chalyb.clips.editor.fit',
  mode: 'chalyb.clips.editor.mode',
  sim: 'chalyb.clips.editor.sim',
  zone: 'chalyb.clips.editor.zone',
};
const lsGet = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {}
};

/** Whether this form differs from what the clip has saved. */
function sameForm(a: EditorForm, b: EditorForm): boolean {
  return (Object.keys(a) as (keyof EditorForm)[]).every((k) => a[k] === b[k]);
}

type Busy = null | 'save' | 'approve' | 'reject' | 'revert';

export function ClipEditorScreen({
  initial,
  jobHref,
  exportOnLoad,
}: {
  initial: EditorPayload;
  /** The job (stream) this clip came from. */
  jobHref: string;
  exportOnLoad: ExportQuality | null;
}) {
  const t = useTranslations('clipsEditor');
  const router = useRouter();
  const id = initial.clip.id;
  const [payload, setPayload] = useState(initial);
  // The signed video link, kept stable so a reload doesn't restart playback;
  // swapped for a fresh one if it stops working (expired).
  const [mediaSrc, setMediaSrc] = useState(initial.media.preview);
  const [form, setForm] = useState<EditorForm>(initial.form);
  const [saved, setSaved] = useState<EditorForm>(initial.form);
  // The latest form, so an update can diff against it without side
  // effects inside a state updater. Every write goes through it.
  const formRef = useRef(form);
  const [fitMode, setFitMode] = useState(initial.form.fit_mode || 'smart_crop');
  const [previewMode, setPreviewMode] = useState(initial.form.preview_mode || 'edited');
  const [open, setOpen] = useState<Section | null>('hook');
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<EditorCallError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [trimFlash, setTrimFlash] = useState<'reverted' | 'noop' | 'error' | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [captions, setCaptions] = useState<CaptionsFeed | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [intel, setIntel] = useState<IntelligenceFeed | null>(null);
  const [growth, setGrowth] = useState<GrowthFeed | null>(null);
  const [tone, setTone] = useState<HookTone>('default');
  const [hookState, setHookState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [hookResult, setHookResult] = useState<HookIdeas | null>(null);
  const colorTouched = useRef(false);
  const prefTimers = useRef(new Map<string, number>());

  // ── playback ────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pb, setPb] = useState<Playback>({
    t: 0,
    duration: initial.clip.duration_s,
    paused: true,
    muted: true,
  });
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () =>
      setPb({
        t: v.currentTime,
        duration:
          Number.isFinite(v.duration) && v.duration > 0 ? v.duration : initial.clip.duration_s,
        paused: v.paused,
        muted: v.muted,
      });
    const events = [
      'timeupdate',
      'loadedmetadata',
      'play',
      'pause',
      'ended',
      'seeked',
      'volumechange',
    ];
    events.forEach((e) => v.addEventListener(e, sync));
    // An expired signed link: get a fresh one and carry on where we were.
    let retried = false;
    const onError = () => {
      if (retried) return;
      retried = true;
      const at = v.currentTime;
      void call<EditorPayload>(clipPath(initial.clip.id, 'editor'))
        .then((p) => {
          if (!p.media.preview) return;
          setMediaSrc(p.media.preview);
          v.addEventListener('loadedmetadata', () => (v.currentTime = at), { once: true });
        })
        .catch(() => {});
    };
    v.addEventListener('error', onError);
    // timeupdate is ~4/s: too coarse for word-level captions.
    const tick = window.setInterval(() => {
      if (!v.paused) sync();
    }, 60);
    return () => {
      events.forEach((e) => v.removeEventListener(e, sync));
      v.removeEventListener('error', onError);
      window.clearInterval(tick);
    };
  }, [initial.clip.duration_s, initial.clip.id]);
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.paused) void v.play().catch(() => {});
  }, []);
  const seek = useCallback((s: number) => {
    const v = videoRef.current;
    if (v && Number.isFinite(s)) v.currentTime = Math.max(0, s);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName) ||
          el.isContentEditable ||
          el.getAttribute('role') === 'slider')
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute]);

  // ── feeds (async, like the old editor) ──────────────────────────────
  useEffect(() => {
    const ctl = new AbortController();
    const get = <T,>(what: string, set: (v: T) => void, fallback: T) =>
      call<T>(clipPath(id, what), { signal: ctl.signal })
        .then(set)
        .catch((err: unknown) => {
          if (!(err instanceof Error && err.name === 'AbortError')) set(fallback);
        });
    void get<CaptionsFeed>('captions', setCaptions, {
      lines: [],
      duration_s: 0,
      diagnostics: null,
    });
    void get<number[]>('waveform', (p) => setPeaks(Array.isArray(p) ? p : []), []);
    void get<IntelligenceFeed>('intelligence', setIntel, { markers: [], duration_s: 0 });
    void get<GrowthFeed>('growth', setGrowth, { scored: false });
    return () => ctl.abort();
  }, [id]);

  // ── brand-kit auto-save (debounced per field, best effort) ──────────
  const savePref = useCallback((field: string, value: unknown) => {
    const timers = prefTimers.current;
    const prev = timers.get(field);
    if (prev) window.clearTimeout(prev);
    timers.set(
      field,
      window.setTimeout(() => {
        timers.delete(field);
        void call('prefs', { method: 'POST', body: { field, value } }).catch(() => {});
      }, 250),
    );
  }, []);
  useEffect(() => {
    const timers = prefTimers.current;
    return () => timers.forEach((h) => window.clearTimeout(h));
  }, []);

  const update = useCallback(
    (next: (f: EditorForm) => EditorForm) => {
      const prev = formRef.current;
      const n = next(prev);
      formRef.current = n;
      setForm(n);
      for (const c of changedPrefs(prev, n)) savePref(c.field, c.value);
      setNotice(null);
      return n;
    },
    [savePref],
  );
  const set = useCallback(
    (patch: Partial<EditorForm>) => {
      if (patch.banner_color !== undefined) colorTouched.current = true;
      if (patch.platform_overlay_preview !== undefined)
        lsSet(LS.sim, patch.platform_overlay_preview);
      if (patch.safe_zone_platform !== undefined) lsSet(LS.zone, patch.safe_zone_platform);
      update((f) => ({ ...f, ...patch }));
    },
    [update],
  );
  const pickTarget = useCallback(
    (target: TargetId) => {
      const n = update((f) => applyTarget(f, target));
      setFitMode(n.fit_mode);
      lsSet(LS.fit, n.fit_mode);
      setFlash((x) => x + 1);
    },
    [update],
  );
  const pickStyle = useCallback((s: ClipStyleId) => update((f) => applyClipStyle(f, s)), [update]);
  const pickBannerPlatform = useCallback(
    (p: string) =>
      update((f) => ({
        ...f,
        banner_platform: p,
        banner_color: colorTouched.current ? f.banner_color : (PLATFORM_COLORS[p] ?? '#53FC18'),
      })),
    [update],
  );

  // On mount (after hydration): the editor-only view state remembered in
  // this browser, then — for a clip nobody edited yet — its target app's
  // bundle, applied and saved as the person's setup, like the old editor.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const h = window.requestAnimationFrame(() => {
      const fit = lsGet(LS.fit);
      if (fit && (FIT_MODES as readonly string[]).includes(fit)) setFitMode(fit);
      const mode = lsGet(LS.mode);
      if (mode && (PREVIEW_MODES as readonly string[]).includes(mode)) setPreviewMode(mode);
      const sim = lsGet(LS.sim);
      const zone = lsGet(LS.zone);
      const sims = initial.choices.platform_sims;
      const f = formRef.current;
      const n = {
        ...f,
        ...(sim && sims.includes(sim) ? { platform_overlay_preview: sim } : {}),
        ...(zone && sims.includes(zone) && zone !== 'clean' ? { safe_zone_platform: zone } : {}),
      };
      formRef.current = n;
      setForm(n);
      if (!initial.clip.has_overlay) {
        const target = initial.form.target_platform as TargetId;
        setFitMode(update((x) => applyTarget(x, target)).fit_mode);
      }
    });
    return () => window.cancelAnimationFrame(h);
  }, [initial, update]);

  // ── server actions ──────────────────────────────────────────────────
  const reload = useCallback(async () => {
    const p = await call<EditorPayload>(clipPath(id, 'editor'));
    setPayload(p);
    return p;
  }, [id]);

  const overlayBody = useMemo(
    () => ({ ...form, fit_mode: fitMode, preview_mode: previewMode }),
    [form, fitMode, previewMode],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    setBusy('save');
    setError(null);
    try {
      await call(clipPath(id, 'overlay'), { method: 'PUT', body: overlayBody });
      setSaved(form);
      await reload().catch(() => {});
      setNotice(t('draftSaved'));
      return true;
    } catch (err) {
      setError(err instanceof EditorCallError ? err : new EditorCallError(0, null));
      return false;
    } finally {
      setBusy(null);
    }
  }, [form, id, overlayBody, reload, t]);

  const dirty = !sameForm(form, saved) || !payload.clip.has_overlay;
  const beforeRender = useCallback(async () => {
    if (!dirty || payload.clip.status === 'published') return true;
    const ok = await saveDraft();
    if (ok) setNotice(t('export.savedFirst'));
    return ok;
  }, [dirty, payload.clip.status, saveDraft, t]);

  const finalize = useCallback(async () => {
    setIssuesOpen(false);
    setBusy('approve');
    setError(null);
    try {
      const r = await call<FinalizeResult>(clipPath(id, 'finalize'), {
        method: 'POST',
        body: overlayBody,
      });
      setSaved(form);
      if (r.next_clip_id) {
        router.push(`/app/clips/${encodeURIComponent(r.next_clip_id)}` as Route);
        return;
      }
      await reload().catch(() => {});
      setNotice(t('queueDone'));
    } catch (err) {
      // Approving can outlive the request (auto-publish waits for the
      // render). If the clip did get approved, carry on.
      const p = await reload().catch(() => null);
      if (p && p.clip.status === 'approved') {
        setSaved(form);
        if (p.next_clip_id) {
          router.push(`/app/clips/${encodeURIComponent(p.next_clip_id)}` as Route);
          return;
        }
        setNotice(t('queueDone'));
      } else setError(err instanceof EditorCallError ? err : new EditorCallError(0, null));
    } finally {
      setBusy(null);
    }
  }, [form, id, overlayBody, reload, router, t]);

  const approve = () => {
    const pub = payload.publishability;
    const issues = pub.blocking.length + pub.warnings.length > 0;
    if (pub.status === 'publish_ready' || !issues) void finalize();
    else setIssuesOpen(true);
  };

  const reject = async () => {
    setBusy('reject');
    setError(null);
    try {
      await call(clipPath(id, 'reject'), { method: 'POST' });
      router.push(jobHref as Route);
    } catch (err) {
      setError(err instanceof EditorCallError ? err : new EditorCallError(0, null));
      setBusy(null);
    }
  };

  const revertTrim = async () => {
    setBusy('revert');
    setTrimFlash(null);
    try {
      const r = await call<{ outcome: 'reverted' | 'noop' | 'error' }>(
        clipPath(id, 'revert-trim'),
        {
          method: 'POST',
        },
      );
      setTrimFlash(r.outcome);
      await reload().catch(() => {});
      // The cut changed: reload the media and its feeds.
      videoRef.current?.load();
      setPeaks(null);
      void call<number[]>(clipPath(id, 'waveform'))
        .then(setPeaks)
        .catch(() => setPeaks([]));
      void call<CaptionsFeed>(clipPath(id, 'captions'))
        .then(setCaptions)
        .catch(() => {});
      void call<IntelligenceFeed>(clipPath(id, 'intelligence'))
        .then(setIntel)
        .catch(() => {});
    } catch {
      setTrimFlash('error');
    } finally {
      setBusy(null);
    }
  };

  const runHooks = async () => {
    setHookState('busy');
    try {
      const r = await call<HookIdeas>(clipPath(id, 'hooks'), {
        method: 'POST',
        body: { tone, n: 5 },
      });
      setHookResult(r);
      setHookState('idle');
    } catch {
      setHookState('error');
    }
  };

  // ── render ──────────────────────────────────────────────────────────
  const status = payload.clip.status;
  const editable = status !== 'published';
  const approveBtn = (extra: string) =>
    editable && payload.can_finalize ? (
      <button
        type="button"
        className={`ch-btn ch-btn--primary ch-ce__approve ch-ce__approve--${payload.publishability.status} ${extra}`}
        onClick={approve}
        disabled={busy !== null}
      >
        <CircleCheck aria-hidden="true" />
        {busy === 'approve' ? t('approving') : t('approve')}
      </button>
    ) : null;

  return (
    <div className="ch-ce">
      <header className="ch-ce__head">
        <div>
          <h1 className="ch-h2">{t('title')}</h1>
          <p className="ch-ce__meta">
            <span className={`ch-pill ch-ce__status ch-ce__status--${status}`}>
              {t.has(`status.${status}`) ? t(`status.${status}`) : status}
            </span>
            <span className="ch-muted">
              {t('seconds', { n: payload.clip.duration_s.toFixed(1) })}
            </span>
            {payload.clip.stream_title ? (
              <span className="ch-muted ch-ce__stream">{payload.clip.stream_title}</span>
            ) : null}
          </p>
        </div>
      </header>

      {status === 'rejected' ? (
        <p className="ch-ce__flash ch-ce__flash--gray">{t('rejectedNote')}</p>
      ) : status === 'approved' ? (
        <p className="ch-ce__flash ch-ce__flash--ok">{t('approvedNote')}</p>
      ) : status === 'published' ? (
        <p className="ch-ce__flash ch-ce__flash--gray">{t('publishedNote')}</p>
      ) : null}

      <div className="ch-ce__grid">
        <div className="ch-ce__left">
          <section className="ch-card ch-ce__pv" aria-labelledby="ce-preview">
            <header className="ch-ce__pv-head">
              <h2 id="ce-preview" className="ch-ce__h3">
                {t('preview.title')}
              </h2>
              <span className="ch-muted">{t('preview.sub')}</span>
            </header>
            <div className="ch-ce__toggles">
              <fieldset>
                <legend className="ch-sr">{t('preview.fitLegend')}</legend>
                <div className="ch-ce__seg">
                  {FIT_MODES.map((m) => (
                    <label key={m} title={t(`preview.fitHint.${m}`)}>
                      <input
                        type="radio"
                        name="ce-fit"
                        value={m}
                        checked={fitMode === m}
                        onChange={() => {
                          setFitMode(m);
                          lsSet(LS.fit, m);
                        }}
                      />
                      <span>{t(`preview.fit.${m}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="ch-sr">{t('preview.modeLegend')}</legend>
                <div className="ch-ce__seg">
                  {PREVIEW_MODES.map((m) => (
                    <label key={m} title={t(`preview.modeHint.${m}`)}>
                      <input
                        type="radio"
                        name="ce-mode"
                        value={m}
                        checked={previewMode === m}
                        onChange={() => {
                          setPreviewMode(m);
                          lsSet(LS.mode, m);
                        }}
                      />
                      <span>{t(`preview.mode.${m}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <Preview
              src={mediaSrc}
              form={form}
              fitMode={fitMode}
              previewMode={previewMode}
              faceZone={payload.face_zone}
              defaultHandle={payload.default_handle}
              captions={captions}
              zoneSpecs={payload.choices.zone_specs}
              videoRef={videoRef}
              playback={pb}
              onTogglePlay={togglePlay}
              onToggleMute={toggleMute}
            />
            <Scrubber
              t={pb.t}
              duration={pb.duration}
              peaks={peaks}
              markers={intel?.markers ?? []}
              markersLoaded={intel !== null}
              onSeek={seek}
            />
            <div className="ch-ce__pbtns">
              <button
                type="button"
                className="ch-btn ch-btn--secondary ch-btn--compact"
                onClick={togglePlay}
              >
                {pb.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                {pb.paused ? t('preview.play') : t('preview.pause')}
              </button>
              <button
                type="button"
                className="ch-btn ch-btn--secondary ch-btn--compact"
                onClick={() => {
                  seek(0);
                  void videoRef.current?.play().catch(() => {});
                }}
              >
                <RotateCcw aria-hidden="true" />
                {t('preview.restart')}
              </button>
            </div>
            <p className="ch-muted ch-ce__note-sm">{t('preview.note')}</p>
          </section>
        </div>

        <div className="ch-ce__right">
          <Verdict
            payload={payload}
            target={form.target_platform}
            onRevertTrim={revertTrim}
            reverting={busy === 'revert'}
            trimFlash={trimFlash}
            approveButton={approveBtn('ch-ce__approve--hero')}
          />
          <GrowthCard growth={growth} />

          {editable ? (
            <>
              <TargetPicker value={form.target_platform} onPick={pickTarget} flash={flash} />
              <Controls
                form={form}
                set={set}
                payload={payload}
                open={open}
                onToggle={(s) => setOpen((o) => (o === s ? null : s))}
                onStyle={pickStyle}
                onBannerPlatform={pickBannerPlatform}
                hooks={{ tone, setTone, run: runHooks, state: hookState, result: hookResult }}
              />
            </>
          ) : null}

          <ExportPanel
            clipId={id}
            allowed={payload.choices.export_qualities}
            beforeRender={beforeRender}
            autoStart={exportOnLoad}
          />

          {editable || payload.can_reject ? (
            <div className="ch-ce__actions">
              {approveBtn('ch-btn--xl')}
              {editable ? (
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary"
                  onClick={() => void saveDraft()}
                  disabled={busy !== null}
                >
                  <Save aria-hidden="true" />
                  {busy === 'save' ? t('savingDraft') : t('saveDraft')}
                </button>
              ) : null}
              {payload.can_reject ? (
                <button
                  type="button"
                  className="ch-btn ch-btn--danger"
                  onClick={reject}
                  disabled={busy !== null}
                >
                  <Trash2 aria-hidden="true" />
                  {busy === 'reject' ? t('rejecting') : t('reject')}
                </button>
              ) : null}
            </div>
          ) : null}
          <div aria-live="polite">
            {error ? <ErrorLine error={error} /> : null}
            {notice ? (
              <p className="ch-ce__flash ch-ce__flash--ok" role="status">
                {notice}
              </p>
            ) : null}
            {editable && !sameForm(form, saved) ? (
              <p className="ch-muted ch-ce__note-sm">{t('unsaved')}</p>
            ) : null}
            <p className="ch-muted ch-ce__note-sm">{t('autosave')}</p>
          </div>
        </div>
      </div>

      <Analysis payload={payload} />

      <Sheet
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        title={t('modal.title')}
        closeLabel={t('modal.close')}
      >
        <IssuesSheetBody
          payload={payload}
          onKeepEditing={() => setIssuesOpen(false)}
          onForce={() => void finalize()}
        />
      </Sheet>
    </div>
  );
}
