// Absolute origin for the hub, used by robots.txt and the sitemap.
//
// NEXT_PUBLIC_SITE_URL is the source of truth (it is already set per
// environment for Supabase's redirect allowlist). VERCEL_PROJECT_PRODUCTION_URL
// covers preview builds where the variable isn't set, and localhost is the
// last resort so `next build` never emits an empty origin.
export function siteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    'http://localhost:3000';
  return configured.replace(/\/+$/, '');
}
