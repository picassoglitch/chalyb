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
    What the ENGINE calls its own three secrets — a LIST of names per secret,
    all pointing at the same secret version.

    Names differ per engine and are not the hub's names: ChalybClip reads them
    with no product prefix because settings.py gives each an explicit
    validation_alias. Only the VALUES have to match the hub's CHALYB<SLUG>_*
    vars.

    WHY A LIST. The rename from Nexo AI to Chalyb crosses two repos that do not
    deploy together. If Cloud Run injected only CHALYB_ADMIN_TOKEN, every engine
    image still reading NEXO_AI_ADMIN_TOKEN would come up with no admin token —
    a silent 401 on every hub call, not a startup error. Listing both names
    injects one secret under both, so either build works and the old name can be
    dropped from here once the image no longer reads it.
  EOT
  type = object({
    admin_token  = optional(list(string), ["ADMIN_TOKEN"])
    sso_secret   = optional(list(string), ["SSO_SECRET"])
    database_url = optional(list(string), ["DATABASE_URL"])
  })
  default = {}

  validation {
    condition = alltrue([
      length(var.secret_env_names.admin_token) > 0,
      length(var.secret_env_names.sso_secret) > 0,
      length(var.secret_env_names.database_url) > 0,
    ])
    error_message = "Each secret needs at least one env-var name — an empty list means the engine gets no value at all."
  }
}

variable "worker" {
  description = <<-EOT
    An optional second Cloud Run service running the same image in a worker
    role. Omit (null) for engines that do all their work in-request.

    CPU is always allocated for a worker. Workers here follow the kickoff/poll
    shape: answer the request immediately, do the work in a background task.
    Under Cloud Run's default throttling that background task is frozen the
    moment the response is sent — silently, with no error.

    env               extra environment for the worker, e.g. CHALYBCLIP_ROLE=worker
    endpoint_env_vars the API service gets each of these vars pointing at the
                      worker's URL, which is how the API learns to dispatch.
                      A list for the same reason secret_env_names is one.
    token_env_vars    when non-empty, a random bearer token is generated and
                      injected under every one of these names into BOTH the API
                      and the worker. The worker is reachable on its public URL
                      and this token is what gates it, so leave it empty only
                      for a worker that authenticates some other way.
    public            whether Cloud Run's own IAM lets anyone invoke the worker.
                      TRUE is the default and matches how the app works today:
                      the API presents the app-level bearer token above, not a
                      Google OIDC token, and Cloud Run would reject the call at
                      the platform layer before the app ever saw that header.
                      Set FALSE once the engine signs its worker calls with an
                      OIDC identity token — then Cloud Run checks IAM and only
                      the engine's own service account can reach it.
  EOT
  type = object({
    cpu               = optional(string, "2")
    memory            = optional(string, "4Gi")
    max_instances     = optional(number, 3)
    timeout           = optional(string, "3600s")
    env               = optional(map(string), {})
    endpoint_env_vars = optional(list(string), [])
    token_env_vars    = optional(list(string), [])
    public            = optional(bool, true)
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
