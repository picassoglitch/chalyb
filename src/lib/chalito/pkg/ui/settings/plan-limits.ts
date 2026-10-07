/**
 * What each Chalyb tier includes in Chalito, as shown to people. Mirrors picassoglitch/chalito
 * packages/config/plans.yaml (hubTiers → ladder tier, with Gratis capped to 1 computer; owner
 * decision 2026-10-06). The Chalito api enforces these; this copy only labels them.
 * Computers are desktop agents: phones and browsers don't count.
 */
export const HUB_PLAN_LIMITS = {
  free: { devices: 1, rooms: 1, members: 4 },
  pro: { devices: 5, rooms: 5, members: 8 },
  vip: { devices: 10, rooms: 10, members: 20 },
} as const;

export type HubPlan = keyof typeof HUB_PLAN_LIMITS;

export const hubPlanOf = (tier: string | null | undefined): HubPlan | null => {
  const t = tier?.toLowerCase();
  return t && Object.hasOwn(HUB_PLAN_LIMITS, t) ? (t as HubPlan) : null;
};
