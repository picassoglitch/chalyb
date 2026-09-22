variable "project_id" {
  description = <<-EOT
    GCP project id. Not the project NUMBER (536423097690) — that is derived
    where it is needed, for the billing budget filter.
  EOT
  type        = string
  default     = "chalyb"
}

variable "region" {
  description = <<-EOT
    Region for Cloud Run, the job and the media bucket. us-central1 is the
    default because it is among the cheapest and carries every service used
    here. If a Mexico region is available to the account it may be worth it
    for latency to the userbase — check service availability for Cloud Run,
    Cloud Run Jobs and Cloud Scheduler there before switching, as not every
    region carries all three.
  EOT
  type        = string
  default     = "us-central1"
}

variable "domain" {
  description = "Apex domain. Engines are served at <slug>.<domain>."
  type        = string
  default     = "chalyb.com"
}

variable "billing_account" {
  description = <<-EOT
    Billing account id for the budget alert. Leave empty to skip creating the
    budget — useful if the caller lacks billing permissions, which are separate
    from project permissions. Strongly recommended to set: an unnoticed egress
    bill is the main cost risk in this architecture.
  EOT
  type        = string
  default     = ""
}

variable "budget_amount_usd" {
  description = "Monthly budget in USD. Alerts fire at 50/90/100% of this."
  type        = number
  default     = 50
}

variable "budget_alert_emails" {
  description = <<-EOT
    Addresses that receive budget alerts, as monitoring notification channels.
    Empty means alerts go only to the billing account's default recipients
    (Billing Administrators and Billing Account Users).
  EOT
  type        = list(string)
  default     = []
}

variable "media_retention_days" {
  description = <<-EOT
    Days before rendered clips and cached VODs are deleted. They are
    re-derivable from the source, and storage that is never pruned is the cost
    that creeps. Raise deliberately.
  EOT
  type        = number
  default     = 30
}

variable "engines" {
  description = <<-EOT
    Every agent, keyed by slug. The slug must match engines.slug in Supabase —
    it is the SSO wire value, the subdomain, and the hub's env-var prefix.

    ADDING AN AGENT IS ONE ENTRY HERE. The minimum is `{}`: that gives a
    public Cloud Run service, a service account, three secrets and a domain
    mapping. Add `worker` for an engine that does background work, and `jobs`
    for CLI-entrypoint batch work.

    image: leave at the placeholder until a real image is pushed. Terraform
    ignores changes to it afterwards, so Cloud Build deploys are not reverted
    by the next apply.
  EOT

  type = map(object({
    display_name = optional(string)
    image        = optional(string, "us-docker.pkg.dev/cloudrun/container/hello")
    cpu          = optional(string, "1")
    # Engines that ship ffmpeg, OpenCV or a headless browser need room;
    # undersizing shows up as OOM kills rather than a clear error.
    memory        = optional(string, "2Gi")
    max_instances = optional(number, 4)
    # Public because engines serve a web UI users are redirected into from the
    # hub's /auth/launch/<slug>.
    public = optional(bool, true)

    env = optional(map(string), {})

    # Project-wide secrets to inject: VAR_NAME => key in local.shared_secrets.
    shared_secrets = optional(map(string), {})

    # Env-var prefix for S3-API access to the media bucket (HMAC key), for
    # engines whose storage client is boto3. See modules/engine/variables.tf.
    object_storage_env_prefix = optional(string)

    # What the engine calls its own three secrets. Defaults are the
    # convention; override for engines that read different names.
    secret_env_names = optional(object({
      admin_token  = optional(string, "ADMIN_TOKEN")
      sso_secret   = optional(string, "SSO_SECRET")
      database_url = optional(string, "DATABASE_URL")
    }), {})

    # Engine-specific secrets Terraform should generate, VAR_NAME => suffix.
    # See modules/engine/variables.tf.
    extra_generated_secrets = optional(map(string), {})
    # Engine-specific secrets filled by hand after apply, VAR_NAME => suffix.
    extra_placeholder_secrets = optional(map(string), {})

    worker = optional(object({
      cpu              = optional(string, "2")
      memory           = optional(string, "4Gi")
      max_instances    = optional(number, 3)
      timeout          = optional(string, "3600s")
      env              = optional(map(string), {})
      endpoint_env_var = optional(string)
      token_env_var    = optional(string)
      # Defaults to false: only the engine's service account may invoke the
      # worker. See modules/engine/variables.tf for what the API has to send.
      allow_unauthenticated = optional(bool, false)
    }))

    jobs = optional(map(object({
      command  = optional(list(string))
      args     = optional(list(string), [])
      cpu      = optional(string, "1")
      memory   = optional(string, "2Gi")
      timeout  = optional(string, "600s")
      env      = optional(map(string), {})
      schedule = optional(string)
      paused   = optional(bool, true)
    })), {})
  }))

  default = {
    chalybclip = {
      display_name = "ChalyClip"
      memory       = "2Gi"

      env = {
        # Cloud Run's filesystem is tmpfs and counts against memory. Scratch
        # only — durable artifacts go to the media bucket.
        CHALYBCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out"
        # The dispatcher DEFAULTS to in_process, which runs the pipeline
        # inside the API request and never touches the worker. This is what
        # makes it dispatch.
        CHALYBCLIP_JOB_DISPATCHER = "modal"
        # Transcription is a metered API, not a GPU: the cheapest option at
        # this volume (docs/infra/compute-costs.md). The provider name is the
        # engine's; the key comes from the shared secret below.
        CHALYBCLIP_TRANSCRIBE_PROVIDER = "assemblyai"
      }

      # ChalyClip reads all three WITHOUT its usual CHALYBCLIP_ prefix:
      # settings.py gives each an explicit validation_alias. These are the
      # names the rebranded engine image reads (the contract the hub
      # documents in .env.local.example).
      secret_env_names = {
        admin_token  = "CHALYB_ADMIN_TOKEN"
        sso_secret   = "CHALYB_SSO_SECRET"
        database_url = "DATABASE_URL"
      }

      shared_secrets = {
        CHALYBCLIP_ZERNIO_API_KEY     = "zernio-api-key"
        CHALYBCLIP_ASSEMBLYAI_API_KEY = "assemblyai-api-key"
        # The LLM router (config/llm.yaml in the engine) routes every purpose
        # to Anthropic; the key is read by name from the environment.
        ANTHROPIC_API_KEY = "anthropic-api-key"
      }

      # ChalyClip's pipeline refuses to run without an S3-API bucket (clip
      # artifacts must outlive the worker's disk). boto3 against GCS's S3
      # interop endpoint, credentials from an HMAC key on the service account.
      object_storage_env_prefix = "CHALYBCLIP_OBJECT_STORAGE"

      # `chalybclip worker` — the kickoff/poll pipeline service. Scene
      # detection (OpenCV) and ffmpeg cuts are CPU-bound; 4 vCPU halves the
      # wall time of a run for the same vCPU-seconds, so the same money buys
      # a faster turnaround.
      worker = {
        cpu              = "4"
        memory           = "8Gi"
        env              = { CHALYBCLIP_ROLE = "worker" }
        endpoint_env_var = "CHALYBCLIP_MODAL_PIPELINE_ENDPOINT_URL"
        # The API sends settings.modal_token as its bearer; the worker accepts
        # CHALYBCLIP_WORKER_TOKEN or CHALYBCLIP_MODAL_TOKEN. One name satisfies both.
        token_env_var = "CHALYBCLIP_MODAL_TOKEN"
      }

      jobs = {
        # `drive poll` is a Typer command, not an HTTP route. `command` is the
        # image's console-script name (pyproject [project.scripts] in the
        # engine repo), not an env var.
        # Scheduled every minute per the ingest SLA, but PAUSED: without
        # --source-dir the command builds the real GoogleDriveClient, which is
        # not implemented yet and exits 1. Un-pause when it ships.
        drive-poll = {
          command  = ["chalybclip"]
          args     = ["drive", "poll"]
          schedule = "* * * * *"
          paused   = true
          env      = { CHALYBCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out" }
        }
      }
    }

    # ChalyOBS's web app (web/src/lib/env.ts) reads its own prefixed pair.
    chalybobs = {
      display_name = "ChalyOBS"

      env = {
        # env.ts reads its own prefixed URL, not PUBLIC_URL, and falls back
        # to localhost:3000 — which is where every post-login redirect went
        # until this was set.
        CHALYBOBS_PUBLIC_URL = "https://chalybobs.chalyb.com"
        # Where unauthenticated visitors are sent. The engine's default is
        # /login; the hub's route is /sign-in.
        CHALYB_LOGIN_URL = "https://chalyb.com/sign-in"
      }

      secret_env_names = {
        admin_token  = "CHALYBOBS_ADMIN_TOKEN"
        sso_secret   = "CHALYBOBS_SSO_SECRET"
        database_url = "DATABASE_URL"
      }

      # Signs ChalyOBS's own session cookie. Independent of the SSO secret
      # and never shared with the hub; the login page refuses to start
      # without it ("Servicio no configurado").
      extra_generated_secrets = {
        CHALYBOBS_SESSION_SECRET = "session-secret"
      }

      # ChalyOBS does not read DATABASE_URL. web/src/lib/supabase.ts talks to
      # the shared Supabase project through supabase-js with the project URL
      # and an sb_secret_ key (bypasses RLS; every query filters by tenant).
      extra_placeholder_secrets = {
        CHALYBOBS_SUPABASE_URL        = "supabase-url"
        CHALYBOBS_SUPABASE_SECRET_KEY = "supabase-secret-key"
      }
    }

    # ChalyCrypto's API (services/api sso.py) reads the unprefixed pair,
    # same as ChalyClip.
    chalybcrypto = {
      display_name = "ChalyCrypto"
      secret_env_names = {
        admin_token  = "CHALYB_ADMIN_TOKEN"
        sso_secret   = "CHALYB_SSO_SECRET"
        database_url = "DATABASE_URL"
      }
    }
  }
}

variable "enable_domain_mappings" {
  description = <<-EOT
    Create Cloud Run domain mappings for <slug>.<domain>. Requires the domain
    to be verified in Google Search Console for the calling account first, and
    domain mapping is not available in every region. Leave false when putting
    Cloudflare in front of the run.app URLs instead, which is the simpler path.
  EOT
  type        = bool
  default     = false
}


variable "media_bucket_name" {
  description = <<-EOT
    Name for the media bucket. Cloud Storage names are globally unique across
    all of GCS, not per project, so the default "<project>-media" can collide
    with a bucket someone else already owns — more likely with a short project
    id like "chalyb". If apply fails with 409 / "bucket already exists", set
    this to something distinctive and re-apply.
  EOT
  type        = string
  default     = ""
}

variable "build_source_bucket_name" {
  description = <<-EOT
    Name for the Cloud Build source-staging bucket. Same global-uniqueness
    caveat as media_bucket_name: if apply fails with 409 on
    google_storage_bucket.build_source, set this to something distinctive.
  EOT
  type        = string
  default     = ""
}
