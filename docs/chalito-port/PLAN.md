# Chalito inside the hub: port plan (4 sessions, ~1 hour)

Owner decision 2026-10-05: Chalito's screens live **inside the hub app**, like Clips (`/app/clips`),
Señales (`/app/senales`) and En vivo (`/app/en-vivo`). No `chalito.chalyb.com` web, no separate
Vercel project. The backend stays on Cloud Run (`chalito` api engine + notifier, orchestrator,
mcp-gateway).

Source of the screens: `picassoglitch/chalito` `main`, `apps/web` (checked out at
`~/chalito-golive`). Integration branch here: **`chalito-in-hub`** (off `claude/rebuild-p6-final`,
the live branch). Each session works on its own branch off `chalito-in-hub` and opens a PR **into
`chalito-in-hub`**. Small, frequent PRs; rebase on `chalito-in-hub` after S1's foundation lands.

## The contract (everyone codes against this)

| Thing | Where | Owner |
|---|---|---|
| Chalito packages (browser side) | `src/lib/chalito/pkg/<name>/` (copied from `chalito/packages/<name>/src`, unchanged) | S1 |
| Import path | `@chalito/<name>` (tsconfig `paths` → `src/lib/chalito/pkg/<name>`) — same imports as Chalito's web, so copied components keep their imports | S1 |
| Provider | `src/lib/chalito/provider.tsx`: `ChalitoProvider` + `useChalito()` — same shape as Chalito's `apps/web/src/components/ChalitoProvider.tsx` | S1 |
| Sign-in | hub session → `POST /api/tools/chalito/sso` (server, mints the hub→Chalito SSO token the way `/auth/launch/chalito` does) → the client exchanges it at the Chalito api (`/sso/exchange`) for the device session. No `chalito_next` cookie, no redirect hop. | S1 |
| Routes | `src/app/[locale]/(dashboard)/app/chalito/**` — one folder per Chalito screen, same names (`bandeja`, `sesiones`, `dispositivos`, `salas`, `r/[id]`, `m`, `m/[id]`, `a/[id]`, `n/[nid]`, `tienda`, `uso`, `creditos`, `descargar`, `ajustes`, `conexiones`, `vincular`, `bienvenida`, `oauth/consent`) | S2, S3 |
| Layout | `src/app/[locale]/(dashboard)/app/chalito/layout.tsx`: hub `ToolShell` + `ChalitoProvider` + Chalito sub-nav | S1 |
| Components | `src/components/tools/chalito/<Name>.tsx` (copied from `apps/web/src/components`, `Link`/router from the hub's `@/i18n/navigation`, hrefs prefixed `/app/chalito`) | S2, S3 |
| Copy (i18n) | Chalito's `packages/ui/messages/{es,en}.json` merged under the top-level key **`chalito`** in the hub's messages; `useTranslations('chalito.<ns>')` | S1 (merge), S2/S3 (call sites) |
| Env (hub Vercel) | `NEXT_PUBLIC_CHALITO_API_BASE`, `NEXT_PUBLIC_CHALITO_ORCHESTRATOR_BASE`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the hub already has the Supabase URL/key) | S4 |
| Registry | `TOOL_ROUTES.chalito = '/app/chalito'`, tool card, engine status `coming_soon` → live at the end | S1 (route), S4 (status flip) |

Rules: don't change crypto, passkey, sealing or approval logic while copying — copy, re-path, re-skin
only. Chalito's own tests come along for packages (S1) and for screens where they exist. Hub
checks must pass: `npm run typecheck`, `npm test`, `npm run lint`.

## Sessions

### S1 — foundation (Claude, this session) — lands first, ~20 min
Packages into `src/lib/chalito/pkg`, tsconfig paths, npm deps (`libsodium-wrappers`,
`@simplewebauthn/browser`, `three`, `libphonenumber-js`, `yaml`), messages merge, provider, SSO
route, `/app/chalito` layout + home, `TOOL_ROUTES`. Then reviews/merges S2–S4 PRs.

### S2 — screens A (approvals, sessions, devices, settings)
`bandeja` (Approvals, StepUpHost), `a/[id]`, `n/[nid]` (NotificationRedirect), `sesiones` (Sessions,
NewSession), `dispositivos` (Devices, AddDevice, EndorseWait, Glyph), `vincular`, `bienvenida`
(Onboarding, PasskeyEnroll), `ajustes` (Settings, PushOptIn, SharingToggle, AccountDeletion,
BrainKeys, DevModeBanner), `conexiones` (Connectors). Service worker: register Chalito's push
handler from the hub's (or add `public/chalito-sw.js` scoped to `/app/chalito`).

### S3 — screens B (rooms, mesa, store, usage, downloads, oauth)
`salas` (Rooms), `r/[id]` (Room, RoomStage + `@chalito/scene`), `m` (Mesas), `m/[id]` (Mesa),
`tienda` (Store), `uso` (Usage), `creditos` (Credits), `descargar` (Download), `oauth/consent`
(OAuthConsent).

### S4 — backend + infra (no hub UI)
1. Cloud Build images (`us-central1-docker.pkg.dev/chalyb/chalito/*:65294d9`, building now) →
   deploy `chalito-notifier`, `chalito-orchestrator`, `chalito-mcp-gateway`
   (`gcloud run deploy … --image …`), and the `chalito` api engine (Chalyb Terraform
   `engine_extra_env`/`engine_extra_secret_env` for chalito — see `infra/terraform/terraform.tfvars.example`).
2. CORS/origins: the web origin is now **`https://www.chalyb.com`** (`CHALITO_WEB_ORIGIN` and the
   api's allowed origins); WebAuthn RP ID becomes `chalyb.com`.
3. Remove the leftovers: the `chalito.chalyb.com` Cloud Run domain mapping (Chalyb TF engine
   module) and the separate Vercel project `chalito` (picassoglitch) with its domain.
4. Hub Vercel env (table above), Cloud Scheduler jobs (Chalito GO_LIVE 3.6), notifier/orchestrator
   public URLs into Chalito Terraform (GO_LIVE 4.6).
5. At the end: engine `chalito` status `coming_soon` → live (a hub migration), after S2/S3 merge.

Secrets already filled (Secret Manager, project `chalyb`): gateway/voice/notify tokens, VAPID private
key, Supabase secret key, Anthropic key, owner uid, both database URLs. Not available (features stay
off): OpenAI, xAI, Twilio, Meta/WhatsApp. Database: all 41 Chalito migrations applied on nexo-ai.
