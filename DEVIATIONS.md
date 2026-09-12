# Command Center — Deviations from spec / prototype

Honest engineering log for the Chalyb Command Center build at `/dashboard`. One line per deviation: what changed, why, and whether it needs your decision (`⚠ NEEDS ALDO`).

---

## Spec-level (intentional, agreed before build)

1. **Stack: Next 16 + Supabase + Supabase Auth instead of Next 14 + Prisma + NextAuth.** Per your explicit choice ("Reuse existing"). Same Supabase project as the marketing site → shared session, single Google OAuth, single Postgres. Zero new auth infrastructure. Migration is a SQL file (`supabase/migrations/0002_command_center.sql`) you run in the Supabase SQL editor.

2. **Lives inside the marketing repo at `src/app/[locale]/(dashboard)/dashboard/`** — not a separate repo. Per your explicit choice. Routes shipped: `/dashboard` and `/es/dashboard`, both gated by `requireUser`. Marketing site nav's "Cuenta" CTA now points here when signed in.

3. **No Prisma.** Direct Supabase queries through `@supabase/ssr`. Tradeoff: lose Prisma's typed generated client; gain one fewer dep, no schema-sync step. v1 reads use foreign-table embeds (single round-trip for bots+health+personas).

4. **No NextAuth.** Existing Supabase Auth used. SUPER_ADMIN_EMAILS allowlist enforced in `getSessionUser()` — any email in the env var is forced to `SUPER_ADMIN` on every session read, regardless of stored role (the durable backstop the spec required).

---

## §6 deliberate deviations (called out in the spec text)

5. **Drawer + filter state lives in Zustand, not URL search params.** The spec allowed (and preferred) URL params for shareability. Shipped Zustand only for v1 because the API surface was already large; URL-param hydration is a 30-min follow-up. `⚠ NEEDS ALDO` — confirm Zustand-only is acceptable or I'll wire `?bot=&tab=&cat=&view=` next pass.

6. **Non-`ops`/`bots` nav modules show a toast "Módulo X — cableado en build phase" instead of an inline placeholder route.** The spec asked for a placeholder route render; I used a toast because the nav is already client-side state (no route change happens) and the toast is honest + non-disruptive. The architecture is in place — adding real routes per module is mechanical once any module ships.

---

## §4 RBAC

7. **Per-action policies are stubbed.** `can(role, action)` in `src/lib/auth/session.ts` checks role tiers only (`SUPER_ADMIN=100 > ADMIN=80 > OPERATOR=60 > EDITOR=40 > VIEWER=20 > CLIENT=10`). Action names recognized: `view`, `edit`, `operate`, `restart_worker`, `open_console`, `manage_team`, `invite`, `org_root`, `destroy`. **Replace before any privileged op (restart/destroy/billing) ships** — that's step 06 territory. `⚠ NEEDS ALDO` once we get there.

8. **Role assignment on signup is partial.** The spec said "first user = SUPER_ADMIN, rest = VIEWER pending invite." Today: the `profiles.role` column defaults to `VIEWER` (set by migration), and `SUPER_ADMIN_EMAILS` allowlist runtime-overrides for you. There is no "promote first user to SUPER_ADMIN and auto-create org" code path yet — instead the SQL seed creates one demo org and attaches existing profiles to it. Multi-tenancy + first-user-root logic comes when there's a second user. `⚠ NEEDS ALDO` if you want this hardened now.

---

## §5 Data layer

9. **Telemetry is mocked.** `src/lib/data/telemetry.ts` has `MOCK = true` at top + a comment marking it as the SWAP POINT. Drift functions: `tickStrip()`, `nextActivityEvent()`, `tickRail()`. UI components consume typed interfaces (`StripValue`, `ActivityEvent`, `StreamTick` in `types.ts`) so swapping to real WS/Realtime is a one-file change, no UI edits.

10. **Health drift NOT persisted to DB.** The 9-second drift loop in the prototype was purely visual. I followed that — drift happens server-side in `telemetry.ts` for activity/strip/rail, but health values stay at their seeded snapshot. Bot health UI shows the seeded value. Real production: replace with Supabase Realtime subscription on `bot_health` table changes. `⚠ NEEDS ALDO` if you want the drift visible right now (small change in the SSE handler).

11. **SSE chosen over WebSocket.** Per spec. `/api/stream` is a `nodejs` runtime route with a `ReadableStream` controller, cadences match the prototype (strip 2.2s, activity 3.4s, rail 4.8s). Keepalive ping every 25s. Authenticated via `supabase.auth.getUser()`. Works on Vercel up to the function timeout (10s Hobby / 60s Pro / unlimited Edge) — on Hobby the connection will drop + reconnect every 10s, which the browser does automatically. Edge runtime upgrade is one config line if needed.

---

## §6 component port

12. **Components match the prototype's DOM structure and class intent.** Class names prefixed `cc-` to scope under `.cc-shell` and avoid collision with marketing-site CSS. CSS ported verbatim (1:1 with prototype's `<style>` block) other than the prefix.

13. **Operator row click + favorite toggle: optimistic UI + Supabase write fired asynchronously.** No spinner on the star. If the Supabase write fails (e.g. RLS), the row reverts on next page load. `⚠ NEEDS ALDO` — if you want pessimistic UI with error toast, flag it.

14. **The mobile floating activity button (`cc-mrail`) currently just shows a toast saying "abre en pantalla completa en build phase".** Prototype's behavior was identical — a stub. Real implementation would slide the activity rail in as a sheet. Not in v1 scope.

15. **Drawer "Logs" tab uses synthetic log lines.** Same as prototype. Wires to real worker logs in build phase (out of scope §7).

16. **Drawer "Consola" tab is a styled placeholder** — explicitly out of scope per spec §7.

---

## §0 / staging

17. **`reference-prototype-userdashboard.html` moved into `.chalyb-reference/`** per spec §0. That directory is gitignored, the file stays local. `.chalyb-reference/` already contains the marketing prototype + locale JSON files from earlier steps.

---

## Quality gates

- `pnpm build` ✅ clean (15 routes, including `/[locale]/dashboard` and `/api/stream`)
- `pnpm lint` ✅ 0 errors, 1 warning (Google Fonts `<link>` in marketing-site layout — pre-existing, not introduced here)
- `pnpm typecheck` (implicit in build) ✅
- No raw hex in `src/components/dashboard/` except the brand-mark stroke (`#9eea3a`, `#42d9e8` in `fusion-mark.tsx`, kept verbatim because that's the prototype-locked SVG); state-code → CSS-var maps in `operator-rows.tsx` and `activity-feed.tsx` reference `var(--cc-*)` not raw hex; the dashboard CSS file is the only place hex literals live (tokens themselves).
- Unauthenticated `/api/stream` → 401. ✅ (verified in code, manual test recommended)
- Cross-org isolation test → **not implemented**: only one org exists in v1 (the demo org). Test becomes meaningful when multi-tenancy lands. `⚠ NEEDS ALDO` when 2nd org joins.
- Lighthouse perf on `/dashboard` → not measured in this pass. v1 is dev-mode-tuned; production build's first paint should be fast (server-renders bot list, hydrates from SSE only after mount). `⚠ NEEDS ALDO` when launch is real — I'll run Lighthouse and tune.
- Side-by-side with `.chalyb-reference/reference-prototype-userdashboard.html` → you do this. Acceptance bar is your eyes.

---

## What you need to do before testing

1. Run `supabase/migrations/0002_command_center.sql` in your Supabase dashboard → SQL Editor → New query → paste → Run.
2. Confirm `SUPER_ADMIN_EMAILS=<your address>` is in `.env.local` (the committed example ships a placeholder).
3. Restart `pnpm dev`.
4. Visit `/dashboard` (you should already be signed in from earlier session).

## Items to revisit before any privileged ops launch

- §7 `can()` per-action policies (gate restart/console/destroy properly)
- §8 cross-org integration test once multi-tenancy exists
- §10/11 swap telemetry mock for real Supabase Realtime
- §13 URL search params for drawer/tab/filter state
