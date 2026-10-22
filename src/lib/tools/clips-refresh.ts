// When AutoRefresh re-reads a Clips page next. Pure (timers only) and
// unit-tested; the component only wires it to router.refresh().

/** A pending refresh is retried after this long, or twice the interval. */
export const STUCK_MS = 10_000;

/** Arms the next refresh, returns its cancel: one after everyMs (0 when the
 *  tab came back), or while pending a retry every stuckMs until cancelled. */
export function armRefresh(
  o: { pending: boolean; cameBack: boolean; everyMs: number },
  fire: () => void,
): () => void {
  if (!o.pending) {
    const id = setTimeout(fire, o.cameBack ? 0 : o.everyMs);
    return () => clearTimeout(id);
  }
  // router.refresh()'s transition can stay pending for good (e2e: the job
  // page sat on "creating"); a new refresh restarts it.
  const stuckMs = Math.max(STUCK_MS, o.everyMs * 2);
  let id: ReturnType<typeof setTimeout>;
  const retry = () => {
    fire();
    id = setTimeout(retry, stuckMs);
  };
  id = setTimeout(retry, o.cameBack ? 0 : stuckMs);
  return () => clearTimeout(id);
}
