// Startup checks (Next.js instrumentation hook).
//
// TRIAL_FLOW_ENABLED is refused — the flow stays off — while anything it
// depends on is missing (legal texts, seller identity, evidence key, cron
// secret). Said loudly here so a misconfigured deploy is obvious in the logs.

export async function register() {
  const { trialFlowBlockers, trialFlowRequested } = await import('@/lib/config/flags');
  if (trialFlowRequested()) {
    const blockers = trialFlowBlockers();
    if (blockers.length > 0) {
      console.error(
        `[startup] TRIAL_FLOW_ENABLED is set but REFUSED until these are set: ${blockers.join(', ')}`,
      );
    }
  }
}
