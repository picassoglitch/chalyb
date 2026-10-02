-- =====================================================================
-- Chalyb — "Proponer una idea" leads (rebuild P4-6).
--
-- WHAT
--   partner_inquiries (0014) already stores every public form lead, tagged by
--   `pane`. The landing's "Proponer una idea" form stores there too, with
--   pane = 'idea', so P5's "Necesita tu atención → Ideas nuevas" reads one
--   inbox. This widens the pane check to allow it.
--
-- Idempotent: the constraint is dropped if present and re-added; re-running
-- is a no-op.
-- =====================================================================

alter table public.partner_inquiries
  drop constraint if exists partner_inquiries_pane_check;

alter table public.partner_inquiries
  add constraint partner_inquiries_pane_check
  check (pane in ('client', 'partner', 'earn', 'idea'));

create index if not exists partner_inquiries_idea_unread_idx
  on public.partner_inquiries (created_at desc)
  where pane = 'idea' and read_at_admin is null;
