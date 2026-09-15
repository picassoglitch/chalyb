# Rebuilding the engine backends on GCP

Every engine backend ran on one self-hosted machine. That machine died and its
disk is unrecoverable, so this is a **rebuild from empty**, not a data
migration. This doc is the target architecture, the rebuild order, and the
cost model.

## What survived vs. what's gone

**Survived** — everything hosted elsewhere:

- `chalyb` on Vercel: site, dashboard, admin, `/api/engines/*`.
- Supabase: auth, `profiles`, `engines`, `engine_subscriptions`, payments,
  usage, audit.
- Mercado Pago, Resend and Zernio (external SaaS).
- The engine source repos on GitHub (`ChalyClip`, `ChalyOBS`, `chalybcrypto`).

**Gone with the disk:**

- ChalyClip's Postgres: `tenants`, `drive_watches`, `drive_oauth_credentials`,
  `drive_ingested_files`, and all job history.
- ChalyOBS's database and the RTMP relay config.
- ChalyCrypto's database.
- Every rendered clip and cached VOD that lived on local disk.

Two consequences worth being explicit about:

1. **Users must reconnect Google Drive and their social accounts.** OAuth
   refresh tokens were encrypted at rest on that disk. They are not
   recoverable, and they can't be re-minted without the user re-consenting.
   Plan a "reconnect your accounts" email for affected users at relaunch.
2. **Zernio profiles are orphaned, not lost.** `tenants.zernio_profile_id`
   lived on the dead disk, but the profiles still exist on Zernio's side and
   are still billing. `GET /profiles` to list them, then either re-map them to
   rebuilt tenants by name or delete the dead ones before relaunch.

## Interim state (shipped alongside this doc)

- `supabase/migrations/0028_engines_offline_pending_gcp.sql` flips `chalybclip`,
  `chalybobs` and `chalybcrypto` to `coming_soon`. The whole UI already honours
  that state — "Próximamente" badge, launch button disabled.
- `src/app/auth/launch/[slug]/route.ts` now refuses to launch a non-`active`
  engine. That route is the landing funnel target
  (`/sign-in?next=/auth/launch/chalybclip`) and was the one path that bypassed
  the disabled buttons.

Nothing else in `chalyb` needs to change to survive the outage.

## Target architecture

Split by workload shape, because the pricing models differ enormously.

- **ChalyClip FastAPI, ChalyOBS web, ChalyCrypto** → **Cloud Run**,
  `--min-instances=0`. Scales to zero, so idle cost is $0. The default
  concurrency of 80 is fine here.
- **ffmpeg render worker** → a second **Cloud Run service** running
  `chalybclip worker`, with CPU always allocated. Corrected after reading the
  application: the worker speaks a kickoff/poll HTTP contract, so it is a
  service, not a batch job. CPU-always is not tuning — the work happens in an
  asyncio task after the kickoff response, which Cloud Run's default
  throttling would freeze. Renders still do not run in the API service.
- **Drive change poll (~60 s)** → **Cloud Scheduler** triggering a **Cloud Run
  Job** that runs `chalybclip drive poll`. It is a CLI command, not an endpoint.
  One-minute granularity is exactly the SLA in
  `docs/chalybclip_drive_ingest.md`. Shipped paused: the real
  `GoogleDriveClient` is not implemented yet and the command exits 1.
- **VODs and rendered clips** → **Cloud Storage** with a lifecycle rule.
  Replaces local disk. Delete rendered clips after N days — they're
  re-derivable, and storage you never prune is the cost that creeps.
- **Secrets** (`CHALYBCLIP_ADMIN_TOKEN`, `*_SSO_SECRET`, Zernio key, Drive token
  encryption key) → **Secret Manager**, mounted into Cloud Run. Satisfies the
  encrypted-at-rest requirement for Drive refresh tokens.
- **Container images** → **Artifact Registry**. First 0.5 GB free; prune old
  images.
- **Engine databases** → **stay on Supabase**, a schema or project per engine.
  Deliberate: the smallest Cloud SQL instance is ~$10-25/mo _each_, and three of
  them would cost more than the rest of this architecture combined. Revisit only
  if an engine needs something Supabase can't do.

### DNS

The hostnames moved with the rebrand: `chalybclip.chalyb.com`,
`chalybobs.chalyb.com`, `chalybcrypto.chalyb.com`. Migration `0030` writes
those into `engines.external_url` / `admin_api_base`, replacing the
pre-rebrand hostnames seeded in `0018`, `0019` and `0022`.

**Each subdomain must resolve before its engine flips back to `active`.** The
launch guard in `src/app/auth/launch/[slug]/route.ts` keeps users out while an
engine is `coming_soon`, so there's no rush — but an engine set live against a
hostname that doesn't resolve puts users straight back into a dead host.

Point them at Cloud Run with domain mappings, or put Cloudflare in front (which
also gets you caching and DDoS cover for free). The apex `chalyb.com` still
needs its own DNS for Vercel, and Resend needs the new domain verified before
any mail sends from `noreply@chalyb.com`.

### The RTMP problem — read before putting ChalyOBS on GCP

Cloud Run speaks HTTP, gRPC and WebSocket only. It **cannot accept RTMP on
:1935**, so ChalyOBS's ingest relay needs a real VM with a static IP — and that
is where GCP gets expensive:

> One 6 Mbps input fanned out to 4 platforms is ~24 Mbps outbound ≈ **11 GB per
> hour**. At GCP's internet egress rates (roughly $0.08–0.12/GB depending on
> destination and volume) that's **~$1.30 per streaming hour**. 100 hours/month
> is well north of $100 — more than everything else here combined.

Options, best first:

1. **Put the relay on a fixed-price host.** Hetzner CX22 (~€4/mo, 20 TB
   traffic) or similar. Bandwidth is the product; buy it from someone who
   sells it flat-rate. Keep the API and workers on GCP.
2. **Use a managed multistream service** and drop the self-hosted relay.
3. **Defer ChalyOBS** until it has paying users. It's the most expensive engine
   to run and the least finished.

Do not run the relay on Cloud Run — it won't work — and don't put it on a GCE
VM without modelling your egress bill first.

### Transcription, LLM and the GPU that is gone

The dead machine's GPU did three jobs for ChalyClip: Whisper, and Ollama
serving a text model and a vision model for every LLM purpose. None of it is
replaced by a GPU: at this volume a metered API is cheaper than an idle L4
by an order of magnitude, and scales to $0. Transcription goes to AssemblyAI
and the LLM router to Anthropic; Terraform injects both keys. The evaluation,
the alternatives and the per-VOD numbers are in [`compute-costs.md`](compute-costs.md).
Modal, which ChalyClip once used for both, is not needed at all — the
`CHALYBCLIP_MODAL_*` names that remain are the worker protocol, now pointed
at the Cloud Run worker.

## Rebuild order

1. **Project + guardrails.** One project (`chalyb`), billing account
   attached, **budget alert at $50/mo** on day one. This is the single most
   valuable ten minutes in the whole migration.
2. **Artifact Registry + Secret Manager.** Push images, load secrets. The SSO
   secrets must match what's set in Vercel — `CHALYBCLIP_SSO_SECRET` here has to
   equal ChalyClip's `CHALYB_SSO_SECRET`, or every SSO launch fails.
3. **Supabase schemas for the engines.** Re-run each engine's migrations
   against an empty database. Schemas are in the engine repos; the Drive
   tables are also reproduced in `docs/chalybclip_drive_ingest.md` §3.
4. **ChalyClip API on Cloud Run.** Verify `POST /api/admin/tenants` and
   `GET /auth/sso` respond before touching anything else — those two endpoints
   are the entire contract with `chalyb`
   (`src/lib/engines/integrations/chalybclip.ts`).
5. **GCS bucket + render worker as a Cloud Run Job.** Then Cloud Scheduler for
   the Drive poll.
6. **Relaunch ChalyClip:** flip `status` back to `active`, then run
   **`reconcileEngineLinks('chalybclip')`** from `/dashboard/team` — dry-run
   first. This force-reprovisions every user against the rebuilt engine and
   backfills `external_user_id`. It exists precisely for "the engine side lost
   its state" (see `src/lib/engines/reconcile-actions.ts`) so no new recovery
   tooling is needed.
7. **Email users to reconnect Drive and socials.**
8. **ChalyCrypto**, same pattern.
9. **ChalyOBS last**, after deciding where the relay lives.

Relaunch one engine at a time. Each flip to `active` is independently
reversible with a one-line update.

## Cost model

Steady-state, low volume, on top of the existing Vercel + Supabase bills:

| Item                                               | Approx/month                          |
| -------------------------------------------------- | ------------------------------------- |
| Cloud Run — 3 services, scale-to-zero, low traffic | $0–10                                 |
| Cloud Run Jobs — render worker, per-second         | $0–5 at low volume                    |
| Cloud Storage — ~100 GB with lifecycle pruning     | ~$2–3                                 |
| Artifact Registry                                  | ~$1                                   |
| Secret Manager + Scheduler + Tasks                 | ~$1                                   |
| Non-video egress                                   | a few $                               |
| **Total, no live streaming**                       | **~$10–25**                           |
| RTMP relay, if self-hosted off GCP                 | +~€4 flat                             |
| RTMP relay, if on GCE                              | +$15 VM +$3 IP + **egress, uncapped** |

Figures are ballpark — confirm against the GCP pricing calculator for your
region before committing. The shape of the bill matters more than the exact
numbers: everything above except egress and storage is effectively free at low
volume, so **the two things to watch are video egress and unpruned buckets.**
