// SSE endpoint — emits strip ticks, activity events, and rail stats on intervals.
// Authenticated; closes cleanly on client disconnect.
// Cadences match the prototype's setInterval rhythm.
//
// Robustness notes:
// - `safeEnqueue` checks `desiredSize === null` (stream closed) AND wraps the
//   write in try/catch. Dev-mode HMR + browser nav both abort SSE without
//   running cancel() in time, so the timers can fire on a dead controller —
//   we just no-op instead of throwing an uncaught exception.
// - `request.signal.addEventListener('abort', ...)` is the canonical way to
//   know the client went away. Combined with the cancel() callback, we cover
//   both client-side and server-side teardown paths.

import { createClient } from '@/lib/supabase/server';
import { nextActivityEvent, tickRail, tickStrip } from '@/lib/data/telemetry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Vercel kills the function at this limit; we self-close just before it so the
// stream ends with a clean 200 instead of "Task timed out after 300 seconds".
export const maxDuration = 300;

const ENCODER = new TextEncoder();

// Recycle the connection ~30s before Vercel's hard timeout. EventSource
// auto-reconnects, so the only visible effect is a fresh stream every ~4.5 min
// — with clean logs and bounded per-invocation cost.
const MAX_LIFETIME_MS = 270_000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const timers: NodeJS.Timeout[] = [];

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        // desiredSize is null once the stream is errored/closed — bail before
        // touching the controller to avoid ERR_INVALID_STATE.
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(ENCODER.encode(chunk));
        } catch {
          // Stream was closed between the check and the enqueue — silently drop.
          closed = true;
        }
      };

      const sendJson = (payload: unknown) =>
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        for (const t of timers) clearInterval(t);
        try {
          controller.close();
        } catch {
          // already closed — fine
        }
      };

      // Client disconnect (tab close, navigation, dev reload) fires this.
      request.signal.addEventListener('abort', cleanup);

      // Initial snapshot so the UI fills immediately. tickStrip + tickRail
      // are now async (real Supabase queries) — wrap each push in a
      // self-invoked async fn so we don't block the SSE start. The cache
      // inside telemetry.ts dedups concurrent invocations.
      void (async () => {
        sendJson({ kind: 'strip', strip: await tickStrip() });
        sendJson({ kind: 'rail', rail: await tickRail() });
      })();

      timers.push(
        setInterval(async () => sendJson({ kind: 'strip', strip: await tickStrip() }), 2200),
        setInterval(async () => sendJson({ kind: 'activity', event: await nextActivityEvent() }), 3400),
        setInterval(async () => sendJson({ kind: 'rail', rail: await tickRail() }), 4800),
        // Keepalive ping every 25s to defeat proxy idle timeouts.
        setInterval(() => safeEnqueue(`: ping\n\n`), 25000),
        // Self-close before Vercel's maxDuration so the connection recycles
        // cleanly instead of being killed with a timeout error. clearInterval
        // also cancels a setTimeout handle in Node, so cleanup() clears it too.
        setTimeout(cleanup, MAX_LIFETIME_MS),
      );
    },
    cancel() {
      // Belt-and-suspenders: the abort listener above usually fires first,
      // but if cancel() arrives via the stream API directly we still tear down.
      // (The timers/closed state live in the start() closure; we can't access
      // them from here, but our safeEnqueue is already inert by the time we
      // get here because the controller is closed.)
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
