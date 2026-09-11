'use server';

// Manual re-provisioning trigger — exposed as a button on the engine workspace
// page when the user has an access row but the external integration didn't
// complete (external_user_id is NULL). Common when:
//   - Migration 0011 backfilled admin rows BEFORE the integration secrets
//     were configured.
//   - ChalybClip was down the first time the user activated.
//   - Env vars changed and the auto-retry hasn't run yet.
//
// Returns the fresh row state so the client can re-render without a full
// page refresh.

import { getSessionUser } from '@/lib/auth/session';
import { retryEngineProvisioning } from './subscriptions';

interface ReprovisionResult {
  ok: boolean;
  externalUserId?: string | null;
  error?: string;
}

export async function reprovisionEngine(engineId: string): Promise<ReprovisionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  // Anyone with a subscription row can retry their own. Admins can retry
  // anyone's via a different route in the future — for now, self-only.
  const result = await retryEngineProvisioning(session.user.id, engineId);
  return result.ok
    ? { ok: true, externalUserId: result.externalUserId }
    : {
        ok: false,
        externalUserId: null,
        error:
          'Provisioning falló. Revisa el log del dev server — busca líneas con [engine_subs] para el error exacto.',
      };
}
