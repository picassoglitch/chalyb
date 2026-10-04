-- =====================================================================
-- Chalyb — evidence on copyright notices (7a review of #49, MED 6).
--
-- The notice form at /derechos-de-autor is public. Each notice now keeps a
-- sha256 of the sender's IP (never the IP itself) and their user agent, so a
-- bad-faith or abusive notice can be tied to the request that filed it.
-- Old notices keep NULL.
--
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.takedown_notices
  add column if not exists claimant_ip_hash text
    check (claimant_ip_hash is null or claimant_ip_hash ~ '^[0-9a-f]{64}$');

alter table public.takedown_notices
  add column if not exists claimant_user_agent text
    check (char_length(claimant_user_agent) <= 500);

comment on column public.takedown_notices.claimant_ip_hash is
  'sha256 of "takedown-evidence:" || the sender''s IP (src/lib/legal/takedown-http.ts). Never the IP.';
comment on column public.takedown_notices.claimant_user_agent is
  'The sender''s user agent, first 500 characters.';
