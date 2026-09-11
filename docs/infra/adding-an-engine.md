# Adding an agent

What it takes to stand up a new engine, end to end. The design goal is that
none of it is bespoke: the hub side is one config entry, the infrastructure is
one map entry, and the new repo copies a template.

Run the scaffold first — it writes the migration and prints the two snippets
to paste:

```sh
node scripts/new-engine.mjs chalybscribe "ChalybScribe" --icon 📝 --tier PRO
```

## 1. The hub — one entry

Append to `src/lib/engines/integrations/definitions.ts`:

```ts
createEngineIntegration({
  slug: 'chalybscribe',
  displayName: 'ChalybScribe',
}),
```

That is the whole hub-side code change. Provisioning, SSO signing, pause and
resume all come from `factory.ts`, and `registry.ts` builds itself from the
definitions list so an engine cannot be defined-but-unregistered.

Env vars follow from the slug: `CHALYBSCRIBE_ADMIN_TOKEN` and
`CHALYBSCRIBE_SSO_SECRET`, set in Vercel.

An engine whose backend cannot meet the factory's contract writes its own
module implementing `EngineIntegration` and is registered directly. The
factory is the common case, not a straitjacket.

## 2. The database — generated

The scaffold writes `supabase/migrations/00NN_register_<slug>_engine.sql`. It
ships the engine as `coming_soon`, which is deliberate: the launch guard in
`src/app/auth/launch/[slug]/route.ts` refuses to send users to a non-active
engine, so nobody can reach a backend that is not serving yet.

Edit the `description` — it is what users read on the engine card.

## 3. Infrastructure — one map entry

Add to the `engines` map in `infra/terraform/terraform.tfvars`:

```hcl
chalybscribe = {
  display_name = "ChalybScribe"
}
```

`terraform apply` then creates: a service account, three secrets, a public
Cloud Run service that scales to zero, bucket access, and a domain mapping.

Two optional blocks cover most of what an agent needs beyond that:

```hcl
chalybscribe = {
  display_name = "ChalybScribe"

  # A second service for background work. CPU is always allocated for
  # workers — see the note below, it is load-bearing.
  worker = {
    env              = { ROLE = "worker" }
    endpoint_env_var = "WORKER_URL"   # the API is told where to dispatch
  }

  # Batch work with a CLI entrypoint.
  jobs = {
    nightly-sync = {
      command  = ["myengine"]
      args     = ["sync", "--all"]
      schedule = "0 3 * * *"
      paused   = false
    }
  }
}
```

**Workers get CPU always allocated, and that is not tuning.** The pattern
these engines use is to answer a request immediately and do the work in a
background task. Under Cloud Run's default throttling, CPU is withdrawn the
moment that response is sent, and the background task freezes with no error
and no traceback — the job simply never progresses. The module sets
`cpu_idle = false` for every worker for that reason.

**Scheduled jobs default to `paused = true`**, because a schedule pointed at
a command that is not finished yet fails on every tick and buries real alerts.
Opt in when the work is ready.

## 4. The new repo

Copy `infra/engine-template/` into it: `cloudbuild.yaml` and
`docker-entrypoint.sh`. Set `_SERVICE` to the slug, and `_HAS_WORKER=true` if
it has a worker.

Then implement the three endpoints the factory calls — the full contract,
including status codes, is documented at the top of
`src/lib/engines/integrations/factory.ts`:

```
POST {admin_api_base}/tenants                     → { tenant_id, api_token }
POST {admin_api_base}/tenants/{tenant_id}/status  → 200 / 204
GET  {external_url}/auth/sso?token=<hmac>&next=<relative path>
```

Three things that are easy to get wrong:

- **`/auth/sso` must reject an absolute or off-origin `next`**, or it is an
  open redirect.
- **A 409 from `POST /tenants` is success.** Admin re-grants and provisioning
  retries both land there; the response still carries the ids.
- **Bind `$PORT`.** Cloud Run assigns it and health-checks it. A container
  listening on a hardcoded port fails to start with an error that does not
  mention the port.

## 5. Going live

1. `terraform apply`.
2. Give each secret a value — `terraform output secrets_needing_values` lists
   them. `<slug>-sso-secret` must equal `<SLUG>_SSO_SECRET` in Vercel, or
   every launch fails signature verification.
3. Build and push: `gcloud builds submit --config=cloudbuild.yaml`.
4. Point `<slug>.chalyb.com` at the Cloud Run URL.
5. Flip the engine row to `active`, then run `reconcileEngineLinks('<slug>')`
   from `/dashboard/team` — dry-run first.

Steps 1–4 are all reversible and invisible to users; the engine stays
`coming_soon` until step 5.
