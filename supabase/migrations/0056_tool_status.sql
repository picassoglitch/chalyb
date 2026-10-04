-- 0056 · Tool health (all-pending WS-11; TOOLS-SPEC §1.2, F10).
--
-- One row per tool slug, written by the health check (/api/cron/tools-health)
-- and by the app's BFF when a tool call fails:
--
--   state            ok | slow | down
--   down_since       first failed check of the current outage (null when ok)
--   incident_active  true ONLY once a person was alerted (alert delivered) or
--                    the owner marked it from /dashboard/herramientas. It is
--                    what allows "Ya nos avisaron, lo estamos arreglando".
--   incident_since   when incident_active turned true
--   alerted_at       when the owner alert went out (down > 5 min)
--   last_check_at    last health check, last_reason its normalized reason
--
-- Service role only (the app reads it on the server). Idempotent.

create table if not exists public.tool_status (
  slug text primary key,
  state text not null default 'ok',
  down_since timestamptz,
  incident_active boolean not null default false,
  incident_since timestamptz,
  alerted_at timestamptz,
  last_check_at timestamptz,
  last_reason text,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tool_status_state_check') then
    alter table public.tool_status
      add constraint tool_status_state_check check (state in ('ok', 'slow', 'down'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tool_status_slug_len') then
    alter table public.tool_status
      add constraint tool_status_slug_len check (length(slug) between 1 and 64);
  end if;
end $$;

alter table public.tool_status enable row level security;
-- No policies: anon and authenticated read nothing; the service role
-- bypasses RLS.

insert into public.tool_status (slug)
values ('chalybclip'), ('chalybcrypto'), ('chalybobs')
on conflict (slug) do nothing;
