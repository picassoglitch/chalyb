-- Profiles that read 'en' only because 0001's default was 'en' go back to
-- Spanish (owner, 2026-11-07). 0054 moved the default to 'es' but left
-- existing rows alone (D-F3-10), so emails and Avisos could not follow the
-- account's language.
--
-- Reset only rows with no recorded choice:
--   preferred_locale = 'en'   the old default.
--   timezone is null          Mi perfil (0054+) always saves a timezone with the
--                             language, so a non-null timezone means the user
--                             submitted the language field: kept as chosen.
--   created_at < 2026-11-07   sign-ups from the English form (#174) store 'en'
--                             on purpose; none can exist before that day.
-- Known gap: the pre-0054 settings form (2026-09-12 to 10-03) saved the
-- language without a timezone, so an English pick made there and never
-- re-saved in Mi perfil is indistinguishable from the default and is reset.
-- Apply before #174's in-app toggle is live: a toggle to English writes only
-- preferred_locale (no timezone), so after that it can't be told apart here.
-- Idempotent: a second run finds no 'en' row left that matches.

update public.profiles
set preferred_locale = 'es'
where preferred_locale = 'en'
  and timezone is null
  and created_at < timestamptz '2026-11-07 00:00:00-06';
