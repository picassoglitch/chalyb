variable "project_id" {
  description = "GCP project id, e.g. chalyb-prod."
  type        = string
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

    # What the engine calls its own three secrets. Defaults are the
    # convention; override for engines that read different names.
    secret_env_names = optional(object({
      admin_token  = optional(string, "ADMIN_TOKEN")
      sso_secret   = optional(string, "SSO_SECRET")
      database_url = optional(string, "DATABASE_URL")
    }), {})

    worker = optional(object({
      cpu              = optional(string, "2")
      memory           = optional(string, "4Gi")
      max_instances    = optional(number, 3)
      timeout          = optional(string, "3600s")
      env              = optional(map(string), {})
      endpoint_env_var = optional(string)
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

      env = {
        # Cloud Run's filesystem is tmpfs and counts against memory. Scratch
        # only — durable artifacts go to the media bucket.
        NEXOCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out"
      }

      # ChalybClip reads all three WITHOUT its usual NEXOCLIP_ prefix:
      # settings.py gives each an explicit validation_alias. Only the values
      # need to match the hub's CHALYBCLIP_* vars.
      secret_env_names = {
        admin_token  = "NEXO_AI_ADMIN_TOKEN"
        sso_secret   = "NEXO_AI_SSO_SECRET"
        database_url = "DATABASE_URL"
      }

      shared_secrets = {
        NEXOCLIP_ZERNIO_API_KEY = "zernio-api-key"
      }

      # `nexoclip worker` — the kickoff/poll pipeline service.
      worker = {
        env              = { NEXOCLIP_ROLE = "worker" }
        endpoint_env_var = "NEXOCLIP_MODAL_PIPELINE_ENDPOINT_URL"
      }

      jobs = {
        # `nexoclip drive poll` is a Typer command, not an HTTP route.
        # Scheduled every minute per the ingest SLA, but PAUSED: without
        # --source-dir the command builds the real GoogleDriveClient, which is
        # not implemented yet and exits 1. Un-pause when it ships.
        drive-poll = {
          command  = ["nexoclip"]
          args     = ["drive", "poll"]
          schedule = "* * * * *"
          paused   = true
          env      = { NEXOCLIP_DEFAULT_OUTPUT_DIR = "/tmp/out" }
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

