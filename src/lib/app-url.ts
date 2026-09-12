// The hub's public origin. One name, one reader, everywhere.
//
// This used to be two variables: `NEXT_PUBLIC_APP_URL` (Mercado Pago back_urls
// and notification_url) and `NEXT_PUBLIC_SITE_URL` (.env.local.example, robots,
// sitemap, email links). Setting only the documented one left MP building
// back_urls against http://localhost:3000 in production — checkout redirects
// and the webhook URL both pointed at nothing.
//
// CANONICAL: NEXT_PUBLIC_APP_URL.
// NEXT_PUBLIC_SITE_URL is still read as a deprecated alias so a deployment that
// only has the old name keeps working; set the canonical one and drop it.

/** Absolute origin, no trailing slash, e.g. `https://chalyb.com`. */
export function appUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    // Deprecated alias — remove once every environment sets NEXT_PUBLIC_APP_URL.
    process.env.NEXT_PUBLIC_SITE_URL ||
    // Vercel preview/production builds that set neither.
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    'http://localhost:3000';
  return configured.replace(/\/+$/, '');
}
