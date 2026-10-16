// Zernio publishing methods over the engine's hub API (ChalyClip
// chalybclip/api/routers/hub_publish.py).
//
// OWNED BY THE PUBLISHING WORKSTREAM. Placeholder from the foundation PR:
// replace these methods (and add publish*.ts files next to this one for
// anything beyond the ClipsAdapter contract). Call the engine only through
// `engine(userId)` (client.ts) so auth, errors and the breaker stay shared.
//
// Until then: no accounts and no connect URL (screens hide those rows, as
// capabilities.supportsConnect is false), and publishing is not implemented.

import 'server-only';
import { NotImplementedError } from '../tools';
import type { ClipsAdapter } from '../types';
import type { ClipsEngine } from './client';

export type PublishMethods = Pick<ClipsAdapter, 'accounts' | 'connectUrl' | 'publishClip'>;

export function publishMethods(_engine: (userId: string) => ClipsEngine): PublishMethods {
  return {
    accounts: async () => [],
    connectUrl: async () => null,
    publishClip: () => {
      throw new NotImplementedError('ClipsEngineAdapter.publishClip');
    },
  };
}
