// The Publish Center's BFF allowlist (/api/tools/chalybclip/publish/**).
//
// The browser asks for `/api/tools/chalybclip/publish/<path>`; only the
// operations listed here reach the engine's `/api/hub/v1/publish/<path>`
// (ChalyClip chalybclip/api/routers/hub_publish.py — keep in sync). Anything
// else is a 404 before the engine is called. Ids from the URL must look like
// ids, and GET query keys are allowlisted per operation.
//
// Pure: no imports, unit-tested (tests/clips-publish.test.ts).

export interface PublishOp {
  method: 'GET' | 'POST';
  /** Path under /publish with `:id` placeholders (one URL segment each). */
  pattern: string;
  /** GET query keys passed through; everything else is dropped. */
  query?: readonly string[];
  /** Connects or publishes to a social account: plans with
   *  clipConnectSocials only (the engine enforces it too). */
  socials?: boolean;
  /** Sends content out under the person's name: needs the current Terms
   *  accepted (same rule as "Publicar en TikTok"). */
  publishes?: boolean;
  /** May render the clip first or work through a backlog: minutes, not
   *  seconds (see PUBLISH_LONG_TIMEOUT_MS). */
  long?: boolean;
}

export const PUBLISH_OPS: readonly PublishOp[] = [
  { method: 'GET', pattern: 'overview' },
  // profile + accounts
  { method: 'POST', pattern: 'profile', socials: true },
  { method: 'POST', pattern: 'connect', socials: true },
  { method: 'GET', pattern: 'accounts.json' },
  { method: 'POST', pattern: 'accounts/:id/disconnect' },
  { method: 'POST', pattern: 'accounts/claim', socials: true },
  { method: 'POST', pattern: 'unlink' },
  { method: 'POST', pattern: 'fb-pages', socials: true },
  { method: 'POST', pattern: 'fb-page/select', socials: true },
  // publish
  { method: 'POST', pattern: 'post/:id', socials: true, publishes: true, long: true },
  { method: 'POST', pattern: 'bulk-post', socials: true, publishes: true, long: true },
  { method: 'POST', pattern: 'compose/:id', long: true },
  { method: 'POST', pattern: 'draft/:id/publish', socials: true, publishes: true, long: true },
  { method: 'POST', pattern: 'draft/:id/delete' },
  { method: 'POST', pattern: 'clip/:id/mark-published' },
  { method: 'POST', pattern: 'clip/:id/reopen' },
  { method: 'POST', pattern: 'reopen-all' },
  { method: 'GET', pattern: 'clips/:id/growth.json' },
  // history / status / failures
  { method: 'GET', pattern: 'feed.json', query: ['limit'] },
  { method: 'GET', pattern: 'status/:id.json' },
  { method: 'GET', pattern: 'failed.json' },
  { method: 'POST', pattern: 'retry/:id', socials: true },
  { method: 'POST', pattern: 'retry-all', socials: true, long: true },
  { method: 'POST', pattern: 'reprocess-failed', socials: true, publishes: true, long: true },
  { method: 'POST', pattern: 'reprocess/:id', socials: true, publishes: true, long: true },
  // schedule
  { method: 'GET', pattern: 'schedule.json' },
  { method: 'POST', pattern: 'schedule/slots' },
  { method: 'POST', pattern: 'schedule/queue/:id/delete' },
  { method: 'POST', pattern: 'schedule/cancel/:id' },
  { method: 'POST', pattern: 'schedule/auto', socials: true, publishes: true },
  { method: 'GET', pattern: 'schedule/auto/progress' },
  { method: 'GET', pattern: 'schedule/next-best.json', query: ['platform'] },
  { method: 'GET', pattern: 'best-time.json', query: ['platform'] },
  { method: 'GET', pattern: 'calendar.json', query: ['date_from', 'date_to'] },
  { method: 'GET', pattern: 'rendimiento.json', query: ['days'] },
  // autopilot
  { method: 'GET', pattern: 'autopublish.json' },
  { method: 'POST', pattern: 'autopublish/save' },
  { method: 'GET', pattern: 'autopublish/rules.json' },
  { method: 'POST', pattern: 'autopublish/rules/save' },
  // community
  { method: 'GET', pattern: 'community/settings.json' },
  { method: 'POST', pattern: 'community/settings' },
  // inbox
  { method: 'GET', pattern: 'inbox/comments.json', query: ['platform_post_id'] },
  { method: 'POST', pattern: 'inbox/comments/reply', publishes: true },
  { method: 'POST', pattern: 'inbox/comments/like' },
  { method: 'POST', pattern: 'inbox/comments/hide' },
  { method: 'GET', pattern: 'inbox/conversations.json', query: ['status'] },
  { method: 'GET', pattern: 'inbox/messages.json', query: ['conversation_id'] },
  { method: 'POST', pattern: 'inbox/conversations/reply', publishes: true },
  { method: 'POST', pattern: 'inbox/conversations/archive' },
  // growth
  { method: 'GET', pattern: 'growth/contacts.json', query: ['tag', 'q'] },
  { method: 'GET', pattern: 'growth/automations.json' },
  { method: 'POST', pattern: 'growth/automations', publishes: true },
  { method: 'POST', pattern: 'growth/automations/:id/toggle' },
  { method: 'GET', pattern: 'growth/sequences.json' },
  { method: 'POST', pattern: 'growth/sequences', publishes: true },
  { method: 'POST', pattern: 'growth/sequences/:id/toggle' },
  { method: 'POST', pattern: 'growth/sequences/:id/enroll', publishes: true },
  { method: 'POST', pattern: 'growth/broadcasts/send', publishes: true },
  // feature-flagged on the engine (404 while off)
  { method: 'GET', pattern: 'ads/campaigns.json' },
  { method: 'POST', pattern: 'ads/boost', publishes: true },
  { method: 'GET', pattern: 'whatsapp/status.json' },
];

/** An id as it may appear in one URL segment (Zernio ids, clp_…, acc_…). */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

/** Engine responses for these can take minutes (render, backlog). */
export const PUBLISH_LONG_TIMEOUT_MS = 280_000;

export interface MatchedOp {
  op: PublishOp;
  /** Engine path, starting with /publish/ (ids URL-encoded). */
  enginePath: string;
}

function matchSegments(pattern: string, segs: readonly string[]): string[] | null {
  const parts = pattern.split('/');
  if (parts.length !== segs.length) return null;
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const s = segs[i]!;
    if (p.startsWith(':id')) {
      const suffix = p.slice(3); // e.g. ".json" in "status/:id.json"
      if (suffix && !s.endsWith(suffix)) return null;
      const id = suffix ? s.slice(0, -suffix.length) : s;
      if (!ID_RE.test(id)) return null;
      out.push(encodeURIComponent(id) + suffix);
    } else if (p === s) {
      out.push(s);
    } else {
      return null;
    }
  }
  return out;
}

/** The allowed operation for `method` + the path segments after /publish/,
 *  or null (→ 404). Segments arrive already URL-decoded (Next's catch-all). */
export function matchPublishOp(method: string, segs: readonly string[]): MatchedOp | null {
  for (const op of PUBLISH_OPS) {
    if (op.method !== method) continue;
    const parts = matchSegments(op.pattern, segs);
    if (parts) return { op, enginePath: `/publish/${parts.join('/')}` };
  }
  return null;
}

/** GET query params the operation allows, trimmed to a sane length. */
export function pickQuery(op: PublishOp, params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of op.query ?? []) {
    const v = params.get(key);
    if (v !== null) out[key] = v.slice(0, 200);
  }
  return out;
}
