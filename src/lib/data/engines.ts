// Engine data reads against Supabase Postgres for the command center.
// The UI imports from here; it never touches the Supabase client directly.
//
// Was named bots.ts before migration 0010 — see types.ts for naming rationale.

import { createClient } from '@/lib/supabase/server';
import {
  type Engine,
  type EngineCategory,
  type EngineEnv,
  type EngineIntegrationMode,
  type EngineState,
  type EngineStatus,
  STATE_TO_CODE,
} from './types';
import type { SubscriptionTier } from '@/lib/auth/session';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

interface EngineRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  category: EngineCategory;
  type: string;
  env: EngineEnv;
  region: string;
  node: string | null;
  description: string | null;
  featured: boolean;
  status: EngineStatus;
  tier_required: SubscriptionTier;
  external_url: string | null;
  integration_mode: EngineIntegrationMode;
  admin_api_base: string | null;
  requires_provisioning: boolean;
  owner_user_id: string | null;
  partner_royalty_per_million_tokens_cents: number | null;
  cost_per_million_tokens_cents: number | null;
  fixed_monthly_cost_cents: number | null;
  engine_health: Array<{
    state: EngineState;
    health: number;
    latency_ms: number;
    revenue_cents: number;
  }> | null;
  engine_personas: Array<{
    persona: string | null;
    tone: string | null;
    goals: string | null;
    focus: string | null;
    learning_state: string | null;
    engagement_score: number;
  }> | null;
}

interface OwnerProfile {
  email: string | null;
  full_name: string | null;
}

function rowToEngine(
  row: EngineRow,
  favoriteIds: Set<string>,
  ownersById: Map<string, OwnerProfile>,
): Engine {
  const owner = row.owner_user_id ? (ownersById.get(row.owner_user_id) ?? null) : null;
  const health = row.engine_health?.[0];
  const persona = row.engine_personas?.[0];
  const state: EngineState = health?.state ?? 'OFFLINE';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon ?? '◆',
    category: row.category,
    type: row.type,
    env: row.env,
    region: row.region,
    node: row.node ?? '—',
    description: row.description ?? '',
    featured: row.featured,
    status: row.status,
    tierRequired: row.tier_required,
    externalUrl: row.external_url,
    integrationMode: row.integration_mode,
    adminApiBase: row.admin_api_base,
    requiresProvisioning: row.requires_provisioning,
    ownerUserId: row.owner_user_id,
    ownerDisplayName: owner?.full_name ?? null,
    ownerEmail: owner?.email ?? null,
    partnerRoyaltyPerMillionTokensCents: row.partner_royalty_per_million_tokens_cents ?? 0,
    costPerMillionTokensCents: row.cost_per_million_tokens_cents ?? 0,
    fixedMonthlyCostCents: row.fixed_monthly_cost_cents ?? 0,
    state,
    stateCode: STATE_TO_CODE[state],
    health: health?.health ?? 0,
    latencyMs: health?.latency_ms ?? 0,
    revenueCents: health?.revenue_cents ?? 0,
    favorite: favoriteIds.has(row.id),
    persona: persona
      ? {
          persona: persona.persona ?? '',
          tone: persona.tone ?? '',
          goals: persona.goals ?? '',
          focus: persona.focus ?? '',
          learningState: persona.learning_state ?? '',
          engagementScore: persona.engagement_score,
        }
      : undefined,
  };
}

export async function listEngines(): Promise<Engine[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Engines + their 1:1 health + 1:1 persona via foreign-table embed.
  // `owner_user_id` joins to profiles below (one extra round-trip — keeps
  // this query schema-flat instead of doing a cross-schema FK embed against
  // auth.users which PostgREST won't follow).
  const { data, error } = await supabase
    .from('engines')
    .select(
      'id, slug, name, icon, category, type, env, region, node, description, featured, status, tier_required, external_url, integration_mode, admin_api_base, requires_provisioning, owner_user_id, partner_royalty_per_million_tokens_cents, cost_per_million_tokens_cents, fixed_monthly_cost_cents, engine_health(state, health, latency_ms, revenue_cents), engine_personas(persona, tone, goals, focus, learning_state, engagement_score)',
    )
    .eq('org_id', DEMO_ORG_ID)
    // Active engines first, then coming-soon, then deprecated.
    .order('status', { ascending: true })
    .order('featured', { ascending: false })
    .order('name');

  if (error) {
    // Friendly hint when migration 0010 hasn't run yet.
    const missingTable =
      error.code === '42P01' ||
      /could not find the table|relation .* does not exist|schema cache/i.test(error.message);
    if (missingTable) {
      console.warn(
        '[engines.listEngines] tables not provisioned yet — run supabase/migrations/0010_rename_bots_to_engines.sql in your Supabase SQL editor, then refresh.',
      );
    } else {
      console.error('[engines.listEngines]', error.message);
    }
    return [];
  }

  const { data: favRows } = await supabase
    .from('favorites')
    .select('engine_id')
    .eq('user_id', user.id);
  const favIds = new Set((favRows ?? []).map((r) => r.engine_id as string));

  // Hydrate owner display data for any engines that have an owner_user_id.
  // Skip the round-trip when no engine has one (the common case until
  // partners start landing).
  const ownerIds = (data as EngineRow[])
    .map((r) => r.owner_user_id)
    .filter((x): x is string => x !== null);
  let ownersById = new Map<string, OwnerProfile>();
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', ownerIds);
    ownersById = new Map(
      (owners ?? []).map((o) => [
        o.id as string,
        {
          email: (o.email as string | null) ?? null,
          full_name: (o.full_name as string | null) ?? null,
        },
      ]),
    );
  }

  return (data as EngineRow[]).map((r) => rowToEngine(r, favIds, ownersById));
}

export async function getEngine(engineId: string): Promise<Engine | null> {
  const all = await listEngines();
  return all.find((e) => e.id === engineId) ?? null;
}

// ── Back-compat aliases ──────────────────────────────────────────────────
// Old call sites still import { listBots } from this path; re-export under
// the new module so the migration is incremental. Remove once all imports
// are updated.
export { listEngines as listBots };
export { getEngine as getBot };
