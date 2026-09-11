-- =====================================================================
-- Nexo AI — take the self-hosted engines offline until they're back on GCP.
--
-- WHY: every engine backend (NexoClip's FastAPI + render worker, NexoOBS's
-- web + RTMP relay, NexoCrypto) ran on a single self-hosted machine that
-- died. `nexoclip.nexo-ai.world`, `nexoobs.nexo-ai.world` and
-- `nexocrypto.nexo-ai.world` no longer answer, so with status = 'active':
--
--   - engine cards render as live and the launch button 302s users into a
--     dead host (browser-level connection error, not a handled state),
--   - provisionEngineAccess() POSTs to a dead admin_api_base on every
--     launch and every new signup, adding a hard timeout to those paths,
--   - the NexoClip funnel (/sign-in?next=/auth/launch/nexoclip, linked from
--     every landing CTA) drops new signups straight into the dead host.
--
-- 'coming_soon' is already a first-class state across the UI — cards show
-- "Próximamente" with the launch button disabled (engine-card.tsx,
-- engine-config.ts, app/engines/[slug]/page.tsx, live-engine-selector.tsx)
-- — so this degrades gracefully with no code change. The companion guard in
-- src/app/auth/launch/[slug]/route.ts stops the direct-link funnel too.
--
-- Deliberately NOT touched:
--   - external_url / admin_api_base: the hostnames don't change, only where
--     they're pointed (see docs/infra/gcp-migration.md). Blanking them would
--     force a re-entry later for no gain.
--   - engine_subscriptions: users keep their access rows and their tier.
--     Their external_user_id / external_credentials now reference tenants
--     that no longer exist, which is exactly what the existing force-
--     reprovision path handles — run reconcileEngineLinks(slug) from
--     /dashboard/team once each engine is live on GCP again.
--
-- TO REVERSE, per engine, once it's serving on GCP and reconciled:
--   update public.engines set status = 'active' where slug = 'nexoclip';
--
-- Idempotent: re-runnable.
-- =====================================================================

update public.engines
set status = 'coming_soon'
where slug in ('nexoclip', 'nexoobs', 'nexocrypto')
  and status = 'active';
