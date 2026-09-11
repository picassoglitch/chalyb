-- =====================================================================
-- Nexo AI — Engine integration fields.
-- Adds the metadata needed to actually CONNECT engines (NexoClip first)
-- to the Nexo AI workspace. Without this, engines were just catalog rows.
--
-- WHAT EACH FIELD MEANS:
--
--   external_url:
--     Public URL where the engine's UI lives. NULL when the engine has no
--     external surface (internal_placeholder mode). Example for NexoClip:
--     "https://nexoclip.nexo-ai.world" (or wherever it ends up deployed).
--
--   integration_mode:
--     How "Abrir engine →" actually opens the thing.
--       - internal_placeholder: shows the "Build phase" message inline.
--         The default until we know where the engine lives.
--       - external_sso_redirect: opens external_url in a new tab with a
--         signed token query param. Engine validates the token and creates
--         its own session. Best for v1 — each engine stays independently
--         deployed.
--       - iframe_embed: renders the engine inside an <iframe> on
--         /app/engines/[slug]. Requires the engine to allow embedding
--         (relaxed X-Frame-Options or CSP frame-ancestors).
--
--   admin_api_base:
--     Where Nexo AI calls the engine's admin/provisioning API. Often the
--     same as external_url + "/api/admin" — separate column so we can
--     route admin traffic through an internal network later.
--
--   requires_provisioning:
--     When TRUE, Nexo AI calls the engine's tenant-provisioning API the
--     first time a user activates the engine. Stores returned tenant_id
--     into engine_subscriptions.external_user_id. NexoClip = TRUE.
--
-- ENV VARS PER ENGINE (configured outside this table, in .env.local):
--   NEXOCLIP_ADMIN_TOKEN — bearer token Nexo AI uses to hit NexoClip's
--                          admin API. NEVER exposed to clients.
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.engines
  add column if not exists external_url text,
  add column if not exists integration_mode text not null default 'internal_placeholder'
    check (integration_mode in ('internal_placeholder', 'external_sso_redirect', 'iframe_embed')),
  add column if not exists admin_api_base text,
  add column if not exists requires_provisioning boolean not null default false;

-- Mark NexoClip as a real external engine. URL is a placeholder for now —
-- update once it's deployed to a real domain.
update public.engines
set
  integration_mode = 'external_sso_redirect',
  external_url = 'https://nexoclip.nexo-ai.world',
  admin_api_base = 'https://nexoclip.nexo-ai.world/api/admin',
  requires_provisioning = true
where slug = 'nexoclip';

-- NexoStreamManager — same model when it ships. Leaving URL NULL until
-- there's a real deploy. Status stays 'active' so the workspace still
-- renders the simulation placeholder; the "Open" button falls back to
-- internal_placeholder when external_url is NULL even if mode says external.
update public.engines
set
  integration_mode = 'external_sso_redirect',
  requires_provisioning = true
where slug = 'nexostream';
