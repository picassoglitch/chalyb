# Launch ops findings (2026-11-04/05)

Read-only audit of launch readiness against `origin/main` at `6e5de88`. Ranked by impact. No secret values appear here.

| # | Finding | Rank | Status |
|---|---|---|---|
| 1 | Mercado Pago: no recorded end-to-end test-user sign-off | Blocker | Done |
| 2 | Conversions: only trial conversions are tracked | Blocker | Done |
| 3 | Media retention shorter than the plan cards promise | Blocker | Done |
| 4 | Database: no backups, no PITR, no restore runbook | Blocker | Accepted risk |
| 5 | Terraform state is local only | Should fix | Done |
| 6 | Clips and En vivo: mock e2e only; relay disk has no snapshots | Should fix | Open |
| 7 | Monitoring: readiness check, cron secret and schedulers | Should fix | Won't do |

## Blockers

### 1. Mercado Pago: end-to-end sign-off

**Status: Done (2026-11-06).** The owner showed the Mercado Pago dashboard:

- Checkout Pro integration 100% complete: create order, notifications, test, go to production.
- Integration quality score 96/100.
- The owner tested the flow with Mercado Pago test accounts.

The audit found no recorded sign-off in the repo: the Results table in `docs/infra/launch-runbook.md` §5 was empty, and no automated test calls the real Mercado Pago API. The dashboard evidence above is the sign-off.

### 2. Conversions: only trial conversions are tracked

- `src/lib/payments/subscription-sync.ts` (around line 529) emits `conversion` only when a subscription that had a trial is charged for the first time.
- Direct paid starts and credit packs emit nothing.
- There is no ad pixel and no Conversions API (CAPI).

**Status: Done (2026-11-06).** PR #146 counts every first payment as a conversion. The owner deferred ad attribution.

### 3. Media retention shorter than promised

- `infra/terraform/storage.tf` (lines 15–22) deletes every object in the media bucket after `media_retention_days`. Prod uses 30 (per the audit; the prod value is not in the repo). The default in `infra/terraform/variables.tf` is also 30.
- The plans promise longer, in `src/lib/billing/tiers.ts`:
  - `historyDays`: PRO 90, VIP 365. The plan cards show it through `src/lib/billing/plan-features.ts`.
  - `clipVodRetentionDays` (the ChalyClip VOD promise): PRO 90, PARTNER 90, VIP 365.

**Status: Done (2026-11-06).** The owner chose to change the promise to 30 days. PR #145 made that change.

### 4. Database: no backups (accepted risk)

- One Supabase Free project holds everything: the hub, the Clips/OBS/crypto engine databases, and the Chalito and Taquito tables.
- No backups, no point-in-time recovery (PITR), and no restore runbook.

**Owner decision (2026-11-05):** not now. Recorded as an accepted risk. A lost or corrupted project cannot be restored.

## Should fix

### 5. Terraform state is local only

**Status: Done (2026-11-06).** State migrated to `gs://chalyb-tfstate/prod` (145 entries), with public-access prevention on. The local copies were removed from `infra/terraform/`, and a backup is kept outside the repo. PR #149 enables the `backend "gcs"` block. The audit notes below are kept as the record.

- State for 81 resources (per the audit) lives on one machine, with secrets in plaintext.
- The `backend "gcs"` block in `infra/terraform/versions.tf` (lines 20–23) is commented out.
- `gs://chalyb-tfstate` already exists, is versioned, and is empty (per the audit).
- An untracked, secret-bearing tfvars backup was in `infra/terraform/`. This PR adds `.gitignore` coverage for tfvars backups. The owner should still move that file out of the repo.

**Migration (owner runs it, from `infra/terraform/`):**

1. Copy the local state files to a safe place outside the repo.
2. Enable public-access prevention on the bucket:
   `gcloud storage buckets update gs://chalyb-tfstate --public-access-prevention`
3. Uncomment the `backend "gcs"` block in `versions.tf`.
4. With `gcloud auth application-default login` done, run `terraform init -migrate-state` and answer yes to copy the state.
5. Verify: `gcloud storage ls gs://chalyb-tfstate/prod/` shows `default.tfstate`, and `terraform state list | wc -l` prints 81.
6. Run `terraform plan`. Do not apply. Expect no changes.
7. Archive the local `terraform.tfstate*` files outside the repo, then delete them from `infra/terraform/`.

### 6. Clips and En vivo: mock e2e only

- CI covers Clips and En vivo only through the mock e2e run (`scripts/e2e-mock.sh`).
- The real smoke spec `e2e/smoke/clips.smoke.spec.ts` (Playwright project `smoke`) is not run by any workflow.
- The relay VM (`google_compute_instance.relay`, `infra/terraform/relay.tf`) has no disk snapshot policy.

### 7. Monitoring

**Status: Won't do. Owner decision (2026-11-06):** monitoring comes from the providers' own tools. The site gets no new health or readiness endpoints for it. PR #142 (`/api/ready`) was closed without merging.

## Fine

- Vercel Pro plan.
- Production environment variables are present.
- Legal and seller pages are live.
- `/api/diag/mp` answers 403 in production.
- The Mercado Pago webhook (`src/app/api/mp/webhook/route.ts`) is idempotent and checks signatures. An unsigned call is accepted only in IPN form, and then acts only on data fetched back from Mercado Pago.
