# Deploying the infrastructure to GCP

Zero to running, in order. Everything here is safe to stop and resume — the
engines stay `coming_soon` in the database until the very last step, so
nothing you do before then is visible to a user.

Budget about an hour for the first run. Most of it is waiting on API
enablement and the first container build.

## Where things live, and why

| Piece                   | Where              | Why not elsewhere                                                     |
| ----------------------- | ------------------ | --------------------------------------------------------------------- |
| The hub (this repo)     | **Vercel**         | See [Why the hub stays on Vercel](#why-the-hub-stays-on-vercel)       |
| Database + auth         | **Supabase**       | Three Cloud SQL instances would cost more than everything on GCP here |
| Engine APIs and workers | **Cloud Run**      | Scales to zero, so an idle engine costs nothing                       |
| Batch work (Drive poll) | **Cloud Run Jobs** | CLI entrypoint, no HTTP route                                         |
| Clips and VODs          | **Cloud Storage**  | Cloud Run has no persistent disk at all                               |
| RTMP relay (ChalyOBS)   | **Not GCP**        | Cloud Run cannot accept RTMP, and GCP egress on video is brutal       |

## 0. The repo, tools, and login

Every path in this runbook is relative to the repo root, so clone it first and
work from there:

```sh
cd ~
git clone https://github.com/picassoglitch/chalyb.git
cd chalyb
```

If you are already set up, `cd` to wherever you cloned it. Every later `cd
infra/terraform` means `<repo>/infra/terraform` — running it from your home
directory is the "No such file or directory" you get otherwise.

```sh
# gcloud: https://cloud.google.com/sdk/docs/install
gcloud version
# terraform: https://developer.hashicorp.com/terraform/install
terraform version   # >= 1.9
```

Two logins, and the second is the one people forget:

```sh
gcloud auth login                      # you, for gcloud commands
gcloud auth application-default login  # for Terraform
```

Terraform does not use your `gcloud auth login` session. It looks for
Application Default Credentials. Skip the second command and every
`terraform plan` fails with `could not find default credentials`, which looks
like a Terraform bug and is not.

## 1. Project and billing

The project already exists: **`chalyb`** (number `536423097690`). Point
gcloud at it and confirm billing is linked:

```sh
gcloud config set project chalyb
gcloud billing projects describe chalyb
```

If that last command reports `billingEnabled: false`, link it before going
further:

```sh
gcloud billing accounts list          # note the ACCOUNT_ID
gcloud billing projects link chalyb --billing-account=0X0X0X-0X0X0X-0X0X0X
```

Billing has to be linked first. Most APIs refuse to enable on an unlinked
project, and the error says the API is unavailable rather than that billing is
missing — which sends you looking in the wrong place.

## 2. State bucket

Terraform records what it created in a state file. That file must not live on
your laptop — that is the exact failure this whole migration is recovering
from.

```sh
gcloud storage buckets create gs://chalyb-tfstate \
  --project=chalyb --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://chalyb-tfstate --versioning
```

Versioning matters: state is the one file where a bad overwrite is expensive,
and a previous version is the fix.

Then uncomment the `backend "gcs"` block in `infra/terraform/versions.tf`. If
the bucket name differs, change it there too.

## 3. Terraform

From the repo root:

```sh
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Fill in three values: `project_id`, and `billing_account` +
`budget_alert_emails` for the budget alert. Set the budget — nothing in GCP
caps spend, and the alert is the only thing standing between a runaway egress
bill and finding out at the end of the month.

```sh
terraform init
terraform plan
```

Read the plan. It should create roughly 60 resources and **destroy nothing**.
If it wants to destroy something on a first run, stop and work out why.

```sh
terraform apply
```

The first apply is slow because it enables ten APIs and everything else waits
on them. Two failures are normal-ish and worth recognising:

- **`Error 403: ... API has not been used in project ... before or it is
disabled`** — enablement had not propagated when a dependent resource was
  created. Just run `terraform apply` again; it is idempotent.
- **`409` on `google_storage_bucket.media`** — the bucket name is taken.
  Cloud Storage names are global across all of GCS, and `chalyb-media` is
  short. Set `media_bucket_name = "chalyb-media-<something>"` in
  `terraform.tfvars` and apply again.
- **`allUsers` rejected on a Cloud Run service** — your organization has a
  domain-restricted-sharing policy. (The `chalyb` project has no
  organization, so this one should not happen here.) The engines need public invoke because
  users are redirected into them. Either get an exception for this project, or
  set `public = false` on the engines and front them with something that can
  authenticate.

Then look at what you got:

```sh
terraform output
```

## 4. Secrets

`terraform apply` leaves every secret holding a value, so the services can
deploy in that same run — Cloud Run refuses to create a revision whose secret
is empty, and that used to make a first apply impossible to finish.

There are two kinds, and only one needs you.

First confirm the apply reached the end — sixteen secrets, each with a version:

```sh
gcloud secrets list --project=chalyb | tail -n +2 | wc -l   # 16
```

Fewer means the apply stopped early: read its error, then run `terraform
apply` again. It is idempotent and creates only what is missing.

**Generated by Terraform (ten).** The six per-engine tokens, ChalyClip's
worker bearer token, ChalyOBS's session-cookie secret, the Drive encryption
key and the HMAC secret that lets ChalyClip's boto3 client reach the media
bucket: nothing outside decides
these values, so Terraform makes them random and 48 characters (the HMAC
secret comes from Cloud Storage itself). They live in state,
which is why state lives in a private, versioned bucket and not on a laptop.
You never type these — but you do need to **copy the hub's pair into Vercel**:

```sh
for e in chalybclip chalybobs chalybcrypto; do
  for s in sso-secret admin-token; do
    printf '%s  ' "$e-$s"; gcloud secrets versions access latest --secret="$e-$s" --project=chalyb; echo
  done
done
```

| GCP secret                 | Vercel env var             |
| -------------------------- | -------------------------- |
| `chalybclip-sso-secret`    | `CHALYBCLIP_SSO_SECRET`    |
| `chalybclip-admin-token`   | `CHALYBCLIP_ADMIN_TOKEN`   |
| `chalybobs-sso-secret`     | `CHALYBOBS_SSO_SECRET`     |
| `chalybobs-admin-token`    | `CHALYBOBS_ADMIN_TOKEN`    |
| `chalybcrypto-sso-secret`  | `CHALYBCRYPTO_SSO_SECRET`  |
| `chalybcrypto-admin-token` | `CHALYBCRYPTO_ADMIN_TOKEN` |

The hub derives the variable name from the slug uppercased
(`src/lib/engines/integrations/factory.ts`), so any `NEXOCLIP_*` leftovers
from before the rename are dead and should go. The hub signs the launch
token with its copy and the engine verifies with its own; if they differ,
every SSO launch fails signature verification with a generic error.

**Placeholders you replace (six).** Created holding the string `REPLACE_ME`
so deploys work; the real value comes from somewhere else:

```sh
terraform output secrets_needing_values
```

The three database URLs are all the same Supabase connection string — the
engines share that Postgres. Get it from the **Connect** button at the top
of the Supabase dashboard, and pick the **Session pooler** (port 5432 on
`aws-0-<region>.pooler.supabase.com`). Not the other two: the direct host is
IPv6-only, which Cloud Run cannot reach, and the transaction pooler on 6543
breaks ChalyClip's asyncpg prepared statements.

```sh
read -rs DSN   # paste the DSN; -s keeps it off the screen
for s in chalybclip-database-url chalybobs-database-url chalybcrypto-database-url; do
  printf '%s' "$DSN" | gcloud secrets versions add "$s" --data-file=- --project=chalyb
done
unset DSN
```

The three API keys are issued by their vendors. Zernio publishes clips;
AssemblyAI transcribes them and Anthropic writes the hooks and scores the
frames — the two metered services that replaced the dead GPU box (see
[`compute-costs.md`](compute-costs.md) for why those two and what they cost):

```sh
printf '%s' "sk_..." | gcloud secrets versions add zernio-api-key --data-file=- --project=chalyb
printf '%s' "..."    | gcloud secrets versions add assemblyai-api-key --data-file=- --project=chalyb
printf '%s' "sk-ant-..." | gcloud secrets versions add anthropic-api-key --data-file=- --project=chalyb
```

`printf` rather than `echo` throughout: `echo` appends a newline, and a
trailing newline in a connection string or token is a mismatch that is
genuinely painful to debug.

**Then redeploy.** Cloud Run pins `latest` to a specific version when a
revision is created. The revision Terraform made is holding `REPLACE_ME`, and
it will keep holding it until a new revision is deployed — which only the
`gcloud builds submit` in step 5 does. So in practice: fill the placeholders
before your first build, not after.

## 5. Build and deploy an engine

Nothing deploys on push. There is no Cloud Build trigger and no GitHub
workflow that deploys — every deploy is this command, run by you, from the
engine's own repo (for example `picassoglitch/ChalyClip`):

```sh
gcloud builds submit --config=cloudbuild.yaml --project=chalyb \
  --service-account=projects/chalyb/serviceAccounts/chalyb-deployer@chalyb.iam.gserviceaccount.com \
  --gcs-source-staging-dir=gs://chalyb-build-source/source \
  --substitutions=SHORT_SHA=$(git rev-parse --short=7 HEAD)
```

The two values come from this repo — `terraform output
cloud_build_service_account` and `terraform output build_source_bucket` —
and `_PROJECT`, `_SERVICE` and `_HAS_WORKER` are already set in each engine's
`cloudbuild.yaml`, so nothing else needs passing.

Two flags are load-bearing, and dropping either fails the build:

- **`--gcs-source-staging-dir`.** Without it gcloud stages the tarball in
  an auto-created `<project>_cloudbuild` bucket the deployer cannot read,
  and the build dies before its first step with `could not resolve source:
  ... storage.objects.get denied`. Terraform owns the bucket named here and
  grants the deployer read on it and nothing else (`deployer.tf`).
- **`SHORT_SHA`.** Cloud Build only fills it in for trigger-based builds.
  From `gcloud builds submit` it is empty, the image tag becomes
  `chalybclip:` and Docker refuses with `invalid reference format`.

Terraform created that service account and granted it exactly four project
roles: push images, deploy Cloud Run, act as the runtime service account,
write logs. See `infra/terraform/deployer.tf` for why each one is there.

ChalyClip's image is large — ffmpeg, a JS runtime for yt-dlp, and the
Python stack — so the first build takes a while and the config already
raises the timeout to 2400s on a bigger machine. Cloud Build's 10-minute
default kills it mid-install. ChalyOBS (a Next.js standalone build) and
ChalyCrypto are quick.

Before flipping an engine live, check it is actually up:

```sh
curl -s https://chalybclip.chalyb.com/healthz; echo
gcloud run services logs read chalybclip --project=chalyb --region=us-central1 --limit=30
```

A health response and no connection errors in the logs means the engine
booted and reached Postgres.

## 6. DNS

**The hub**: add `chalyb.com` in Vercel → Project → Domains and follow its
records.

**The engines**: a plain CNAME at the `*.run.app` URL does **not** work,
and it fails in a way that looks like DNS is fine. Cloud Run routes on the
`Host` header and only holds a certificate for `*.run.app`, so a browser
that resolves `chalybclip.chalyb.com` straight to Google's IPs gets a
certificate error, and a request that got past that would get a 404. Two
things do work:

1. **Cloud Run domain mapping** (the default — no other service involved).
   Verify `chalyb.com` in [Google Search Console](https://search.google.com/search-console)
   as the account that runs Terraform (Add property → Domain → the TXT
   record it gives you goes at the apex). Then:

   ```sh
   # infra/terraform/terraform.tfvars
   enable_domain_mappings = true
   ```

   ```sh
   terraform apply     # three google_cloud_run_domain_mapping resources
   ```

   and point each hostname at Google's mapping frontend, not at run.app:

   ```
   chalybclip     CNAME  ghs.googlehosted.com.
   chalybobs      CNAME  ghs.googlehosted.com.
   chalybcrypto   CNAME  ghs.googlehosted.com.
   ```

   Google provisions the certificate once the record is visible; that
   takes anywhere from fifteen minutes to an hour. Watch it:

   ```sh
   gcloud beta run domain-mappings describe --domain=chalybclip.chalyb.com \
     --region=us-central1 --project=chalyb --format='value(status.conditions)'
   ```

   `CertificateProvisioned: True` and `Ready: True` means done. An apply
   that fails with "caller is not authorized to administer the domain"
   means the Search Console verification is missing or was done by a
   different Google account.

2. **Cloudflare in front**, only if `chalyb.com` is on Cloudflare
   nameservers: a *proxied* CNAME at the `*.run.app` URL plus an Origin
   Rule that overrides the `Host` header to that same `run.app` hostname.
   Without the override you get the 404 above; without the proxy you get
   the certificate error.

Either way the hostname must serve the engine over HTTPS **before** you
flip it to `active`:

```sh
curl -s https://chalybclip.chalyb.com/healthz; echo
```

## 7. Go live, one engine at a time

```sql
update public.engines set status = 'active' where slug = 'chalybclip';
```

Then run `reconcileEngineLinks('chalybclip')` from `/dashboard/team` —
dry-run first. Because the engine databases were rebuilt from empty, every
user's stored `external_user_id` points at a tenant that no longer exists;
that sweep force-reprovisions them.

Each flip is independently reversible with a one-line update. Do not do all
three at once.

## Why the hub stays on Vercel

Keep it. Three reasons, in order of weight:

1. **The code is already shaped for it.** `src/app/api/stream/route.ts` sets
   `maxDuration = 300` and recycles the SSE connection at 270s specifically to
   land inside Vercel's function timeout. `vercel.json` carries the legal-page
   redirects and cache headers. Moving to Cloud Run means re-solving all of
   that for no gain.
2. **It is not the expensive part.** Vercel Pro is $20/month flat. The thing
   that can actually run away here is video egress, and that is on GCP no
   matter where the hub lives.
3. **Hobby will not do.** Vercel's Hobby plan is free but its terms exclude
   commercial use, and this app takes payments through Mercado Pago. Budget
   the $20.

### The VM option, honestly

One VM running the hub and the engines is about $15/month plus egress, which
looks cheaper than $20 Vercel + $10–25 GCP. It is not worth it:

- No scale to zero. You pay the same at 3am with no traffic.
- You own the OS, the TLS certificates, the reverse proxy, the restarts and
  the backups.
- **It is one box.** That is precisely the architecture that just died and
  cost you every engine database. Rebuilding it to save five dollars a month
  is buying the same outage again.

A VM is the right answer for exactly one thing here: the ChalyOBS RTMP relay,
which Cloud Run genuinely cannot host. Put that on a flat-rate host with
bandwidth included, not on GCE where egress is metered.

## Running cost

|                                               | Per month             |
| --------------------------------------------- | --------------------- |
| Vercel Pro                                    | $20                   |
| Supabase                                      | free tier, or $25 Pro |
| Cloud Run (3 engines + worker, scale to zero) | $0–10                 |
| Cloud Run Jobs, Scheduler, Secret Manager     | ~$1                   |
| Cloud Storage (~100 GB, pruned)               | ~$2–3                 |
| Artifact Registry                             | ~$1                   |
| **GCP subtotal**                              | **~$10–25**           |
| RTMP relay, if and when ChalyOBS ships        | ~€4 flat elsewhere    |

Everything on GCP except storage and egress is at or near free-tier at this
volume. The two lines to watch are **video egress** and **buckets nobody
prunes** — which is why `media_retention_days` and the budget alert both
exist.

## Tearing it down

```sh
terraform destroy
```

Every resource here is `deletion_protection = false` on purpose, so this
works. It does not touch Supabase, Vercel, or the state bucket — those were
created outside Terraform and survive.
