-- =====================================================================
-- Chalyb — rebrand the engine rows: slugs, names and hostnames.
--
-- Nexo AI is now Chalyb, and every engine follows: NexoClip → ChalybClip,
-- nexoclip → chalybclip, nexoclip.nexo-ai.world → chalybclip.chalyb.com.
--
-- WHY THIS IS SAFE TO DO NOW, AND ONLY NOW:
--   `slug` is referenced by nothing. All 48 foreign keys into engines use
--   engines.id (uuid), so renaming a slug is a single-row UPDATE, not a
--   data migration. The only other holders of the old slug are (a) this
--   repo's code, updated in the same commit, and (b) the engine backends —
--   which are being rebuilt from empty after the self-hosted machine died,
--   so they have no tenant data keyed to the old values. Once those are
--   live on the new slugs, this rename gets expensive again.
--
-- ORDER MATTERS: slug carries `unique (org_id, slug)`. Every new slug is
-- distinct from every old one, so a single UPDATE can't collide, but the
-- statements are still written one engine at a time and guarded on the old
-- value so a partial re-run can't clobber a row that already moved.
--
-- AFTER THIS RUNS, both sides must be updated or SSO and provisioning fail:
--   - Vercel env: NEXOCLIP_ADMIN_TOKEN → CHALYBCLIP_ADMIN_TOKEN,
--     NEXOCLIP_SSO_SECRET → CHALYBCLIP_SSO_SECRET (same for OBS/CRYPTO).
--   - Engine side: NEXO_AI_SSO_SECRET → CHALYB_SSO_SECRET,
--     NEXO_AI_ADMIN_TOKEN → CHALYB_ADMIN_TOKEN.
--   - DNS: chalybclip/chalybobs/chalybcrypto.chalyb.com must resolve before
--     any engine flips back to status='active'.
--
-- The engines stay 'coming_soon' (set in 0028) — this migration renames
-- them, it does not bring them back online.
--
-- Idempotent: re-runnable, and each statement is a no-op once applied.
-- =====================================================================

-- ---------- live engines (rebuilding on GCP) ----------
update public.engines
set slug           = 'chalybclip',
    name           = 'ChalybClip',
    external_url   = 'https://chalybclip.chalyb.com',
    admin_api_base = 'https://chalybclip.chalyb.com/api/admin'
where slug = 'nexoclip';

update public.engines
set slug           = 'chalybobs',
    name           = 'ChalybOBS',
    external_url   = 'https://chalybobs.chalyb.com',
    admin_api_base = 'https://chalybobs.chalyb.com/api/admin'
where slug = 'nexoobs';

update public.engines
set slug           = 'chalybcrypto',
    name           = 'ChalybCrypto',
    external_url   = 'https://chalybcrypto.chalyb.com',
    admin_api_base = 'https://chalybcrypto.chalyb.com/api/admin'
where slug = 'nexocrypto';

-- ---------- seeded-but-not-built engines ----------
-- No external_url/admin_api_base to move: these were seeded in 0010 as
-- catalogue entries and never got a backend. Slug + display name only.
update public.engines set slug = 'chalybstream',  name = 'ChalybStreamManager'
  where slug = 'nexostream';
update public.engines set slug = 'chalybbot',     name = 'ChalybBot'
  where slug = 'nexobot';
update public.engines set slug = 'chalybpicks',   name = 'ChalybPicks'
  where slug = 'nexopicks';
update public.engines set slug = 'chalybrealtor', name = 'ChalybRealtor'
  where slug = 'nexorealtor';
update public.engines set slug = 'chalybtrade',   name = 'ChalybTrade'
  where slug = 'nexotrade';
