import { SETUP_RESYNC_MS } from './setup';

/**
 * First Run D: one timer re-reads the computers while a setup checklist is on screen (a computer's
 * setup report is presence-only, so it doesn't fan out). Every checklist on the page shares it,
 * it stops while the tab is hidden, and it re-reads once when the tab comes back.
 */
export interface PollEnv {
  setInterval: (run: () => void, ms: number) => unknown;
  clearInterval: (timer: unknown) => void;
  isHidden: () => boolean;
  /** Subscribes to visibility changes; returns the unsubscribe. */
  onVisibility: (run: () => void) => () => void;
}

type Resync = () => Promise<void>;

export const createSetupPoller = (env: PollEnv, ms = SETUP_RESYNC_MS) => {
  /** By live store: its resync and how many checklists use it. */
  const subs = new Map<object, { resync: Resync; n: number }>();
  let timer: unknown = null;
  let offVisibility: (() => void) | null = null;

  const tick = () => {
    for (const { resync } of subs.values()) void resync().catch(() => undefined);
  };
  const start = () => {
    if (timer === null && subs.size > 0 && !env.isHidden()) timer = env.setInterval(tick, ms);
  };
  const stop = () => {
    if (timer === null) return;
    env.clearInterval(timer);
    timer = null;
  };
  const onVisibility = () => {
    if (env.isHidden()) return stop();
    tick();
    start();
  };

  /** Starts (or joins) polling `key`'s store; returns the release. */
  return (key: object, resync: Resync): (() => void) => {
    const s = subs.get(key);
    if (s) s.n += 1;
    else subs.set(key, { resync, n: 1 });
    offVisibility ??= env.onVisibility(onVisibility);
    start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const cur = subs.get(key);
      if (cur && --cur.n <= 0) subs.delete(key);
      if (subs.size > 0) return;
      stop();
      offVisibility?.();
      offVisibility = null;
    };
  };
};

let browserPoller: ReturnType<typeof createSetupPoller> | null = null;

/** The page's shared poller (a no-op outside a browser). */
export const pollSetup = (key: object, resync: Resync): (() => void) => {
  if (typeof document === 'undefined') return () => undefined;
  browserPoller ??= createSetupPoller({
    setInterval: (run, ms) => window.setInterval(run, ms),
    clearInterval: (t) => window.clearInterval(t as number),
    isHidden: () => document.visibilityState === 'hidden',
    onVisibility: (run) => {
      document.addEventListener('visibilitychange', run);
      return () => document.removeEventListener('visibilitychange', run);
    },
  });
  return browserPoller(key, resync);
};
