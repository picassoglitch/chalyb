/** Public configuration (inlined at build). Only the publishable Supabase key ever reaches the browser. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBase: (process.env.NEXT_PUBLIC_CHALITO_API_BASE ?? "").replace(/\/+$/, ""),
  /** apps/orchestrator (Mesa, BYO keys, usage). Falls back to the api's host when unset. */
  orchestratorBase: (
    process.env.NEXT_PUBLIC_CHALITO_ORCHESTRATOR_BASE ||
    process.env.NEXT_PUBLIC_CHALITO_API_BASE ||
    ""
  ).replace(/\/+$/, ""),
  /** The hub's www host (the apex drops auth): https://www.chalyb.com */
  hubUrl: (process.env.NEXT_PUBLIC_HUB_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
  /** The notifier's VAPID public key (apps/notifier VAPID_PUBLIC_KEY), for Web Push. */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

/** Chalito's in-browser mock backend is not part of the hub. */
export const DEV_BACKEND = false;
