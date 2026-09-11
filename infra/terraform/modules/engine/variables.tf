variable "slug" {
  description = "Engine slug — must match engines.slug in Supabase. Also the subdomain and the env-var prefix on the hub side."
  type        = string
}

variable "display_name" {
  description = "Human name, for resource descriptions."
  type        = string
}

variable "project_id" { type = string }
variable "region" { type = string }
variable "domain" { type = string }

variable "image" { type = string }
variable "cpu" { type = string }
variable "memory" { type = string }
variable "max_instances" { type = number }
variable "public" { type = bool }

variable "media_bucket" {
  description = "Shared media bucket; this engine's service account gets object access."
  type        = string
}

variable "env" {
  description = "Plain (non-secret) environment variables for the API service."
  type        = map(string)
  default     = {}
}

variable "shared_secret_env" {
  description = <<-EOT
    Project-wide secrets to inject, as VAR_NAME => secret_id (e.g. the Zernio
    key). The engine's own admin-token / sso-secret / database-url secrets are
    created by this module and do not go here.
  EOT
  type        = map(string)
  default     = {}
}

variable "secret_env_names" {
  description = <<-EOT
    What the ENGINE calls its own three secrets. Names differ per engine and
    are not always the hub's names — ChalybClip reads DATABASE_URL,
    NEXO_AI_ADMIN_TOKEN and NEXO_AI_SSO_SECRET with no prefix, because
    settings.py gives them an explicit validation_alias. Only the VALUES have
    to match the hub's CHALYB<SLUG>_* vars.
  EOT
  type = object({
    admin_token  = optional(string, "ADMIN_TOKEN")
    sso_secret   = optional(string, "SSO_SECRET")
    database_url = optional(string, "DATABASE_URL")
  })
  default = {}
}

variable "worker" {
  description = <<-EOT
    An optional second Cloud Run service running the same image in a worker
    role. Omit (null) for engines that do all their work in-request.

    CPU is always allocated for a worker. Workers here follow the kickoff/poll
    shape: answer the request immediately, do the work in a background task.
    Under Cloud Run's default throttling that background task is frozen the
    moment the response is sent — silently, with no error.

    env             extra environment for the worker, e.g. NEXOCLIP_ROLE=worker
    endpoint_env_var if set, the API service gets this var pointing at the
                    worker's URL, which is how the API learns to dispatch.
  EOT
  type = object({
    cpu              = optional(string, "2")
    memory           = optional(string, "4Gi")
    max_instances    = optional(number, 3)
    timeout          = optional(string, "3600s")
    env              = optional(map(string), {})
    endpoint_env_var = optional(string)
  })
  default = null
}

variable "jobs" {
  description = <<-EOT
    Cloud Run Jobs for this engine, keyed by name — batch work with a CLI
    entrypoint rather than an HTTP route.

    schedule  cron for a Cloud Scheduler trigger. Omit for a job that is only
              ever run on demand.
    paused    whether that schedule starts paused. Defaults TRUE on purpose: a
              schedule pointed at a command that is not finished yet fails on
              every tick and buries real alerts. Opt in when the work is ready.
  EOT
  type = map(object({
    command  = optional(list(string))
    args     = optional(list(string), [])
    cpu      = optional(string, "1")
    memory   = optional(string, "2Gi")
    timeout  = optional(string, "600s")
    env      = optional(map(string), {})
    schedule = optional(string)
    paused   = optional(bool, true)
  }))
  default = {}
}
