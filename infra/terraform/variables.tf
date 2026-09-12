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

    # What the engine calls its own three secrets. A LIST per secret: every
    # name gets the same secret injected, which is how an engine mid-rename
    # can answer to both its old and new var names. Defaults are the
    # convention; override for engines that read different names.
    secret_env_names = optional(object({
      admin_token  = optional(list(string), ["ADMIN_TOKEN"])
      sso_secret   = optional(list(string), ["SSO_SECRET"])
      database_url = optional(list(string), ["DATABASE_URL"])
    }), {})

    worker = optional(object({
      cpu               = optional(string, "2")
      memory            = optional(string, "4Gi")
      max_instances     = optional(number, 3)
      timeout           = optional(string, "3600s")
      env               = optional(map(string), {})
      endpoint_env_vars = optional(list(string), [])
      token_env_vars    = optional(list(string), [])
      # allUsers invoke. See the module's variables.tf for why this is the
      # default and what has to change in the engine before locking it.
      public = optional(bool, true)
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
      display_name = "ChalybClip"
      memory       = "2Gi"

      # EVERY VAR IS SET UNDER BOTH NAMES, on purpose.
      #
      # The hub is Chalyb; the engine image is still built from the nexoclip
      # package and its pydantic settings still carry the NEXOCLIP_ prefix and
      # the NEXO_AI_ aliases. The two repos do not deploy together, so picking
      # one set of names breaks whichever side is behind — and it breaks it
      # SILENTLY: an unread env var is not a startup error, it is a default
      # value and a 401 later.
      #
      # Setting both costs nothing (same value, same secret) and makes the
      # cutover ordered instead of simultaneous: rename in the engine, deploy
      # it, then delete the NEXO* lines here.
      env = {
        # Cloud Run's filesystem is tmpfs and counts against memory. Scratch
        # only — durable artifacts go to the media bucket.
        CHALYBCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out"
        NEXOCLIP_DEFAULT_OUTPUT_DIR   = "/tmp/out"
        # The dispatcher DEFAULTS to in_process, which runs the pipeline
        # inside the API request and never touches the worker. This is what
        # makes it dispatch.
        CHALYBCLIP_JOB_DISPATCHER = "modal"
        NEXOCLIP_JOB_DISPATCHER   = "modal"
      }

      # ChalybClip reads all three WITHOUT its usual product prefix:
      # settings.py gives each an explicit validation_alias. Only the values
      # need to match the hub's CHALYBCLIP_* vars.
      secret_env_names = {
        admin_token  = ["CHALYB_ADMIN_TOKEN", "NEXO_AI_ADMIN_TOKEN"]
        sso_secret   = ["CHALYB_SSO_SECRET", "NEXO_AI_SSO_SECRET"]
        database_url = ["DATABASE_URL"]
      }

      shared_secrets = {
        CHALYBCLIP_ZERNIO_API_KEY = "zernio-api-key"
        NEXOCLIP_ZERNIO_API_KEY   = "zernio-api-key"
      }

      # The kickoff/poll pipeline service.
      worker = {
        env = {
          CHALYBCLIP_ROLE = "worker"
          NEXOCLIP_ROLE   = "worker"
        }
        endpoint_env_vars = [
          "CHALYBCLIP_MODAL_PIPELINE_ENDPOINT_URL",
          "NEXOCLIP_MODAL_PIPELINE_ENDPOINT_URL",
        ]
        # The API sends settings.modal_token as its bearer; the worker accepts
        # either the WORKER_TOKEN or the MODAL_TOKEN name.
        token_env_vars = ["CHALYBCLIP_MODAL_TOKEN", "NEXOCLIP_MODAL_TOKEN"]
      }

      jobs = {
        # `drive poll` is a Typer command, not an HTTP route. Scheduled every
        # minute per the ingest SLA, but PAUSED: without --source-dir the
        # command builds the real GoogleDriveClient, which is not implemented
        # yet and exits 1. Un-pause when it ships.
        #
        # `command` is the CLI entrypoint baked into the IMAGE, so it follows
        # the engine repo's package name, not the hub's brand. It changes when
        # the image is rebuilt under a new name, not before.
        drive-poll = {
          command  = ["nexoclip"]
          args     = ["drive", "poll"]
          schedule = "* * * * *"
          paused   = true
          env = {
            CHALYBCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out"
            NEXOCLIP_DEFAULT_OUTPUT_DIR   = "/tmp/out"
          }
        }
      }
    }

    chalybobs    = { display_name = "ChalybOBS" }
    chalybcrypto = { display_name = "ChalybCrypto" }
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
