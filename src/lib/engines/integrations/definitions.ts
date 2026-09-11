// Every engine, as data.
//
// ADDING AN AGENT: append one entry here. That is the whole hub-side code
// change — provisioning, SSO, pause and resume all come from the factory.
// The remaining steps (a migration for the engines row, a Terraform entry)
// are in docs/infra/adding-an-engine.md.
//
// An engine whose backend cannot meet the factory's contract (see factory.ts)
// writes its own module implementing EngineIntegration and is registered
// directly in registry.ts instead.

import 'server-only';
import { createEngineIntegration } from './factory';
import type { EngineIntegration } from './types';

export const ENGINE_INTEGRATIONS: EngineIntegration[] = [
  createEngineIntegration({
    slug: 'chalybclip',
    displayName: 'ChalybClip',
    // The landing CTAs funnel straight here via /sign-in?next=/auth/launch/
    // chalybclip, so a fresh SSO login should land on the start screen rather
    // than ChalybClip's generic root.
    postSsoPath: '/dashboard/start',
  }),

  createEngineIntegration({
    slug: 'chalybobs',
    displayName: 'ChalybOBS',
    // No postSsoPath: ChalybOBS's own /auth/sso picks the landing route.
  }),

  createEngineIntegration({
    slug: 'chalybcrypto',
    displayName: 'ChalybCrypto',
  }),

  // Next agent goes here. Env vars follow from the slug:
  //   <SLUG>_ADMIN_TOKEN and <SLUG>_SSO_SECRET, both uppercase.
];
