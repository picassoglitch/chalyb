// Bearer auth for the engine-facing API routes.
//
// Every engine calls back into the hub (usage reporting, balance lookups)
// with its own admin token. This used to be a two-entry lookup table copied
// into each route file, listing only chalybclip — so ChalyOBS and
// ChalyCrypto got a 404 "unknown engine" from endpoints they are supposed to
// use, and the copy in one file could drift from the copy in the other.
//
// The env var name follows from the slug, the same rule the rest of the hub
// uses (see definitions.ts and .env.local.example): <SLUG>_ADMIN_TOKEN.

import 'server-only';
import { ENGINE_INTEGRATIONS } from './integrations/definitions';

/** `chalybclip` → `CHALYBCLIP_ADMIN_TOKEN`. */
export function engineAdminTokenEnv(slug: string): string {
  return `${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_ADMIN_TOKEN`;
}

/** Engines the hub knows about — the same list the SSO/provisioning factory
 *  is built from, so adding an engine there is enough. */
function isKnownEngine(slug: string): boolean {
  return ENGINE_INTEGRATIONS.some((engine) => engine.slug === slug);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export type BearerCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * Fail-closed: an engine we don't know is a 404, a configured-but-missing
 * token is a 503 (our problem, and never "allow"), a wrong token is a 403.
 */
export function checkEngineBearer(req: Request, slug: string): BearerCheck {
  if (!isKnownEngine(slug)) {
    return { ok: false, status: 404, error: `unknown engine: ${slug}` };
  }
  const envName = engineAdminTokenEnv(slug);
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
