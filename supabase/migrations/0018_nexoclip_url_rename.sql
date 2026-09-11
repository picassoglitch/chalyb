-- =====================================================================
-- Nexo AI — Rename NexoClip's public URL.
-- The NexoClip engine moves under the nexo-ai.world umbrella. Original
-- placeholder URL in migration 0012 was `nexoclip.app` (a domain we don't
-- own); replace with the canonical `nexoclip.nexo-ai.world` subdomain.
--
-- Migration 0012 has already been applied to production, so editing 0012
-- alone doesn't move the live row — this migration UPDATEs in place.
-- Idempotent: re-runnable.
-- =====================================================================

update public.engines
set
  external_url   = 'https://nexoclip.nexo-ai.world',
  admin_api_base = 'https://nexoclip.nexo-ai.world/api/admin'
where slug = 'nexoclip'
  and (
    external_url   in ('https://nexoclip.app', 'https://nexoclip-production.up.railway.app')
    or admin_api_base in (
         'https://nexoclip.app/api/admin',
         'https://nexoclip-production.up.railway.app/api/admin'
       )
  );
