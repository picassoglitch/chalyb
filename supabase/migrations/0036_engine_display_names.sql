-- =====================================================================
-- Chalyb — the three built engines drop the "b" from their display names.
--
-- ChalybClip → ChalyClip, ChalybOBS → ChalyOBS, ChalybCrypto → ChalyCrypto.
-- Display name only: slug, external_url and admin_api_base are the wire
-- values (SSO, subdomain, env-var prefix) and stay `chalyb*`. The engine
-- repos carry the same rename in their own UI copy.
--
-- The catalogue-only engines (ChalybStreamManager, ChalybBot, …) are not
-- touched: they have no product yet and no decided name.
--
-- Idempotent: each statement is guarded on the current name.
-- =====================================================================

update public.engines set name = 'ChalyClip'   where slug = 'chalybclip'   and name = 'ChalybClip';
update public.engines set name = 'ChalyOBS'    where slug = 'chalybobs'    and name = 'ChalybOBS';
update public.engines set name = 'ChalyCrypto' where slug = 'chalybcrypto' and name = 'ChalybCrypto';
