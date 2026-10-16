/**
 * What each Chalyb tier includes in Chalito, as shown to people. Mirrors picassoglitch/chalito
 * packages/config/plans.yaml (hubTiers → ladder tier). Gratis has no Chalito (owner decision #53,
 * 2026-10-16: Pro and VIP only). The Chalito api enforces these; this copy only labels them.
 * Computers are desktop agents: phones and browsers don't count.
 */
export const HUB_PLAN_LIMITS = {
  free: { devices: 0, rooms: 0, members: 0 },
  pro: { devices: 5, rooms: 5, members: 8 },
  vip: { devices: 10, rooms: 10, members: 20 },
} as const;

export type HubPlan = keyof typeof HUB_PLAN_LIMITS;

export const hubPlanOf = (tier: string | null | undefined): HubPlan | null => {
  const t = tier?.toLowerCase();
  return t && Object.hasOwn(HUB_PLAN_LIMITS, t) ? (t as HubPlan) : null;
};
