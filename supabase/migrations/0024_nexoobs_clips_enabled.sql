-- =====================================================================
-- NexoOBS — per-tenant "Get Clips" flag.
--
-- When true, NexoOBS forwards the stream's started/ended lifecycle to
-- NexoClip so the recording gets auto-clipped (the tested NexoClip
-- pipeline). Toggled by the "Get Clips" control in the NexoOBS header.
--
-- Idempotent.
-- =====================================================================

alter table public.nexoobs_sessions
  add column if not exists clips_enabled boolean not null default true;
