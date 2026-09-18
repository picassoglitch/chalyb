-- =====================================================================
-- Chalyb — finish the display-name rename migration 0036 started.
--
-- 0036 dropped the `b` from the three engines that shipped (ChalybClip →
-- ChalyClip, ChalybOBS → ChalyOBS, ChalybCrypto → ChalyCrypto) and left the
-- five catalogue engines alone because they "have no product yet and no
-- decided name". They do have a decided name now: the same one everything
-- else uses. Until this ran, the workspace rendered
--
--     "ChalyClip, ChalybStreamManager y próximos productos"
--
-- — one brand, two spellings, three words apart.
--
-- DISPLAY NAME ONLY. slug, external_url and admin_api_base are the wire
-- values (SSO, subdomain, env-var prefix) and keep their `b`, exactly as
-- 0036 established. Nothing joins on `name`; every foreign key into engines
-- uses engines.id.
--
-- src/lib/engines/display-names.ts carries the same table for the code that
-- cannot query (landing copy, legal pages, email templates).
--
-- Idempotent: each statement is guarded on the current name.
-- =====================================================================

update public.engines set name = 'ChalyStreamManager'
  where slug = 'chalybstream'  and name = 'ChalybStreamManager';
update public.engines set name = 'ChalyBot'
  where slug = 'chalybbot'     and name = 'ChalybBot';
update public.engines set name = 'ChalyPicks'
  where slug = 'chalybpicks'   and name = 'ChalybPicks';
update public.engines set name = 'ChalyRealtor'
  where slug = 'chalybrealtor' and name = 'ChalybRealtor';
update public.engines set name = 'ChalyTrade'
  where slug = 'chalybtrade'   and name = 'ChalybTrade';

-- Re-assert 0036 so a database that somehow missed it converges here too.
update public.engines set name = 'ChalyClip'   where slug = 'chalybclip'   and name = 'ChalybClip';
update public.engines set name = 'ChalyOBS'    where slug = 'chalybobs'    and name = 'ChalybOBS';
update public.engines set name = 'ChalyCrypto' where slug = 'chalybcrypto' and name = 'ChalybCrypto';

comment on column public.engines.name is
  'Display name. Convention: "Chaly" + what it does, no "b" — the "b" belongs to the platform and to the wire values (slug, external_url, admin_api_base, env-var prefixes), which never change. Mirrored in src/lib/engines/display-names.ts.';
