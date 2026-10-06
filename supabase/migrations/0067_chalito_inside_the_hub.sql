-- Chalito lives inside the hub (owner decision 2026-10-05): its screens are /app/chalito on
-- www.chalyb.com, and its api is the engine's Cloud Run service (no chalito.chalyb.com, no
-- api.chalito.chalyb.com). The launch token is still minted against external_url, but nothing
-- redirects there: /api/tools/chalito/sso hands the token to the in-app screen.
update public.engines
   set external_url   = 'https://www.chalyb.com/app/chalito',
       admin_api_base = 'https://chalito-znilbomw3q-uc.a.run.app'
 where slug = 'chalito';
