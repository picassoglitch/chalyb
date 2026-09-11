# Chalyb infrastructure

Terraform for the GCP side of the engine rebuild. The architecture and the
reasoning behind it are in [`../../docs/infra/gcp-migration.md`](../../docs/infra/gcp-migration.md);
this is the executable half.

**What this does not cover, deliberately:**

- **The hub** (`chalyb.com` itself) stays on Vercel, and Supabase stays as the
  database for both the hub and the engines. Three Cloud SQL instances would
  cost more than everything in this config combined.
- **The RTMP relay** for ChalybOBS. Cloud Run cannot accept RTMP on :1935, and
  GCP egress makes multistreaming from a GCE VM cost more than the rest of the
  stack — roughly $1.30 per streaming hour. It belongs on a flat-rate host. See
  the RTMP section of the migration doc.

## What it creates

|                              |                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Cloud Run service per engine | `chalybclip`, `chalybobs`, `chalybcrypto` — scale to zero, so idle cost is $0      |
| Cloud Run service            | `chalybclip-worker` — the pipeline worker, internal-only, **CPU always allocated** |
| Cloud Run Job                | `drive-poll`, running `nexoclip drive poll`                                        |
| Cloud Scheduler              | triggers the poll job every minute — **paused by default**, see below              |
| Cloud Storage                | one media bucket, private, with lifecycle pruning                                  |
| Artifact Registry            | one Docker repo with a cleanup policy                                              |
| Secret Manager               | empty secret containers — **values are never in Terraform**                        |
| Service accounts             | one per engine plus one each for the worker and scheduler                          |
| Budget alert                 | at 50 / 90 / 100% of the monthly budget                                            |

Each engine gets its own service account, granted accessor on only its own
secrets, so a compromise of one engine does not expose another's.

## Shapes verified against the application

`worker.tf` was corrected after reading picassoglitch/nexoclip. Both halves
were originally inverted, and both would have failed silently rather than
loudly:

- **The pipeline worker is a service, not a job.** `nexoclip worker` serves
  the kickoff/poll HTTP contract `ModalJobDispatcher` already speaks. It runs
  with `cpu_idle = false`, which is load-bearing: the worker answers the
  kickoff POST immediately and does the work in an asyncio task, so with
  Cloud Run's default throttling CPU is withdrawn the instant that response is
  sent and the pipeline freezes mid-job with no error at all.
- **The Drive poll is a job, not an endpoint.** `nexoclip drive poll` is a
  Typer command with no route in front of it.

The poll's **schedule is paused** (`enable_drive_poll = false`). Without
`--source-dir` that command builds the real `GoogleDriveClient`, which is not
implemented yet and exits 1 — a one-minute schedule would produce 1,440
failures a day and bury real alerts. Flip the variable once the client ships.

Engine secret env vars are named for what the engine reads, not what the hub
calls them: `DATABASE_URL`, `NEXO_AI_ADMIN_TOKEN` and `NEXO_AI_SSO_SECRET` all
carry an explicit `validation_alias` in `nexoclip/settings.py`, so they take
**no** `NEXOCLIP_` prefix. Only the values need to match the hub's
`CHALYBCLIP_*` vars.

## Adding an agent

One entry in the `engines` map. The module creates the service account, the
three secrets, the Cloud Run service, and — if the entry asks — a worker
service and scheduled jobs. Nothing else in this directory changes.

```hcl
chalybscribe = { display_name = "ChalybScribe" }
```

`node scripts/new-engine.mjs <slug> "<Name>"` (from the repo root) writes the
Supabase migration and prints the blocks to paste. The end-to-end path,
including the new repo, is in
[`../../docs/infra/adding-an-engine.md`](../../docs/infra/adding-an-engine.md).

## Bootstrap

State must not live on a laptop — that is the failure mode that caused this
migration. Create the state bucket first, then uncomment the `backend "gcs"`
block in `versions.tf`:

```sh
gcloud storage buckets create gs://chalyb-tfstate \
  --project=chalyb-prod --location=us-central1 \
  --uniform-bucket-level-access
gcloud storage buckets update gs://chalyb-tfstate --versioning
```

Then:

```sh
cp terraform.tfvars.example terraform.tfvars   # fill it in
terraform init
terraform plan
terraform apply
```

The first apply enables the APIs and creates everything else in one pass.
Expect it to take several minutes — API enablement is the slow part.

## After the first apply

1. **Add the secret values.** Terraform creates the containers empty; the
   engines will not start without versions. `terraform output
secrets_needing_values` lists them.

   ```sh
   printf '%s' "$VALUE" | gcloud secrets versions add chalybclip-sso-secret \
     --data-file=- --project=chalyb-prod
   ```

   `chalybclip-sso-secret` must equal `CHALYBCLIP_SSO_SECRET` in Vercel — the
   two sides of the same HMAC. Same for the admin tokens. If they differ,
   every SSO launch fails signature verification.

2. **Push real images** to the Artifact Registry path in
   `terraform output artifact_registry`, then deploy. Terraform ignores changes
   to the image field afterwards, so ordinary deploys are not reverted by the
   next `apply`.

3. **Point DNS** at the URLs in `terraform output engine_urls`, or set
   `enable_domain_mappings = true` once the domain is verified.

4. **Only then** flip each engine to `active` in Supabase and run
   `reconcileEngineLinks(slug)` from `/dashboard/team`. The launch guard in
   `src/app/auth/launch/[slug]/route.ts` keeps users out until you do, so
   there is no rush — but an engine set live against a hostname that does not
   resolve puts users straight back into a dead host.

## Validation status

`terraform init`, `validate` and `fmt` all pass against the real provider
schema (`hashicorp/google` 6.50.0). The three attributes previously flagged as
unverified — `cleanup_policies` on Artifact Registry, `deletion_protection` on
the Cloud Run v2 resources, and `all_updates_rule` on the billing budget — are
all correct as written.

`registry.terraform.io` is blocked by the egress policy of the environment this
was written in, so the provider was installed from `releases.hashicorp.com`
through a filesystem mirror. That does not affect anything here: the same
package, the same schema, and `.terraform.lock.hcl` is committed so a normal
`terraform init` resolves the identical version.

The lock carries hashes for `linux_amd64`, `darwin_arm64` and `darwin_amd64`.
On another platform, add it once:

```sh
terraform providers lock -platform=linux_arm64
```

**`terraform plan` has still not been run**, because that needs real GCP
credentials. Validation checks schema and types; it cannot check anything that
is only decided at apply time — whether an org policy rejects the `allUsers`
binding on the Cloud Run services, whether API enablement finishes before the
resources that depend on it, or IAM propagation delays. Expect to iterate once
on the first apply.

## Cost

Roughly **$10–25/month** at low volume: Cloud Run idles at zero, and storage,
registry, secrets and scheduler are all within or near their free tiers. The
two things that actually move the bill are **video egress** and **buckets that
are never pruned** — which is why `media_retention_days` and the budget alert
both exist.
