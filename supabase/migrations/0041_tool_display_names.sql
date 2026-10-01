-- =====================================================================
-- Chalyb — customer tool names (rebuild P0-8, BUILD-SPEC §0.2).
--
-- Customers see each tool by what it does: Clips, Señales, En vivo,
-- Asistente, Pronósticos, Inmuebles, Inversiones. The "Chaly" + thing names
-- that 0036/0040 settled on (ChalyClip, ChalyOBS, …) leave customer UI.
--
-- DISPLAY NAME ONLY. slug, external_url, admin_api_base and every env-var
-- prefix are wire values and do not change. Nothing joins on `name`; every
-- foreign key into engines uses engines.id.
--
-- chalybstream has no customer name yet (owner question Q32); it keeps an
-- internal label and the app hides it from customer lists.
--
-- src/lib/engines/display-names.ts carries the same table and wins over a
-- database that has not run this yet.
--
-- Idempotent: each update is guarded on the name differing, so re-running is
-- a no-op. The unique (user_id, engine_id) key on engine_subscriptions that
-- inline provisioning relies on already exists (0011), so it is not re-added.
-- =====================================================================

update public.engines set name = 'Clips'        where slug = 'chalybclip'    and name is distinct from 'Clips';
update public.engines set name = 'Señales'      where slug = 'chalybcrypto'  and name is distinct from 'Señales';
update public.engines set name = 'En vivo'      where slug = 'chalybobs'     and name is distinct from 'En vivo';
update public.engines set name = 'Asistente'    where slug = 'chalybbot'     and name is distinct from 'Asistente';
update public.engines set name = 'Pronósticos'  where slug = 'chalybpicks'   and name is distinct from 'Pronósticos';
update public.engines set name = 'Inmuebles'    where slug = 'chalybrealtor' and name is distinct from 'Inmuebles';
update public.engines set name = 'Inversiones'  where slug = 'chalybtrade'   and name is distinct from 'Inversiones';
update public.engines set name = 'Stream Manager' where slug = 'chalybstream' and name is distinct from 'Stream Manager';

comment on column public.engines.name is
  'Customer-facing tool name (Clips, Señales, En vivo, …). Never "Chaly"-prefixed. slug, external_url, admin_api_base and env-var prefixes are wire values and never change. Mirrored in src/lib/engines/display-names.ts.';
