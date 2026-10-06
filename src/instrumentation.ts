// Startup checks (Next.js instrumentation hook).
//
// PAID_CHECKOUT_ENABLED (and with it TRIAL_FLOW_ENABLED) is refused — paid
// checkout stays off — while anything it depends on is missing (legal texts,
// seller identity, evidence key, cron secret). TRIAL_FLOW_ENABLED alone does
// nothing. Said loudly here so a misconfigured deploy is obvious in the logs.

export async function register() {
  const { paidCheckoutBlockers, paidCheckoutRequested, trialFlowRequested } =
    await import('@/lib/config/flags');
  if (paidCheckoutRequested() || trialFlowRequested()) {
    const blockers = paidCheckoutBlockers();
    if (blockers.length > 0) {
      console.error(
        `[startup] paid checkout is requested but REFUSED until these are set: ${blockers.join(', ')}`,
      );
    }
    if (trialFlowRequested() && !paidCheckoutRequested()) {
      console.error(
        '[startup] TRIAL_FLOW_ENABLED needs PAID_CHECKOUT_ENABLED as well; the trial stays off',
      );
    }
  }
}
