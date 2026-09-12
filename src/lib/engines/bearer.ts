// Engine → admin bearer token, in one place.
//
// Both /api/engines/[slug]/usage and .../usage/balance authenticate the same
// way: the engine presents its own admin token, and the slug in the URL has
// to be the slug that token belongs to (so a leaked ChalybClip token cannot
// post usage as ChalybOBS). The two routes each carried their own copy of the
// map and the comparison, and the copies had already drifted out of the
// rebrand: only `chalybclip` was listed, so ChalybOBS and ChalybCrypto —
// both registered engines with their own secrets in .env.local.example and in
// Terraform — got a flat 404 from the usage API and could not report anything.
//
// The map derives the env-var name from the slug instead of listing it, so
// adding an engine is adding a slug, and forgetting to update "the other
// copy" is no longer possible.

/** Slugs allowed to call the usage API. Must match engines.slug in Supabase
 *  and the engine keys in infra/terraform/variables.tf. */
export const USAGE_API_ENGINE_SLUGS = ['chalybclip', 'chalybobs', 'chalybcrypto'] as const;

export type UsageApiEngineSlug = (typeof USAGE_API_ENGINE_SLUGS)[number];

/** `chalybclip` → `CHALYBCLIP_ADMIN_TOKEN`. The same convention the engine
 *  side uses, and the same one documented in .env.local.example. */
export function adminTokenEnvName(slug: string): string {
  return `${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_ADMIN_TOKEN`;
}

export type BearerCheck = { ok: true } | { ok: false; status: number; error: string };

/** Length-safe, content-constant comparison. Returns early only on a length
 *  difference, which a bearer token's length does not keep secret. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Authenticate an inbound engine request.
 *
 * 404 unknown slug · 503 that engine's token is not configured on this
 * deployment · 401 no bearer presented · 403 wrong bearer.
 */
export function checkEngineBearer(req: Request, slug: string): BearerCheck {
  if (!(USAGE_API_ENGINE_SLUGS as readonly string[]).includes(slug)) {
    return { ok: false, status: 404, error: `unknown engine: ${slug}` };
  }
  const envName = adminTokenEnvName(slug);
  const expected = process.env[envName];
  if (!expected) {
    return { ok: false, status: 503, error: `${envName} not configured` };
  }
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' };
  }
  const presented = header.slice('bearer '.length).trim();
  if (!constantTimeEqual(presented, expected)) {
    return { ok: false, status: 403, error: 'invalid bearer token' };
  }
  return { ok: true };
}
