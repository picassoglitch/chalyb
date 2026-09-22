# One agent, end to end.
#
# Everything an engine needs lives here so that adding one is a single entry
# in var.engines: service account, its secrets, the API service, an optional
# worker service, optional scheduled jobs, and the domain mapping.
#
# Per-agent service account rather than one shared identity — a compromised
# engine cannot read another's secrets. The worker shares the API's account:
# same trust domain, same engine, and one fewer thing to reason about.

locals {
  worker_enabled       = var.worker != null
  worker_token_enabled = local.worker_enabled && var.worker.token_env_var != null

  # Secrets Terraform GENERATES. Nothing outside decides these values, so a
  # random one is as good as any. They land in state — the state bucket is
  # the trust boundary for this whole estate anyway — and this is what lets a
  # single apply finish: Cloud Run refuses to create a revision whose secret
  # has no version, so every referenced secret must hold something first.
  generated = merge(
    {
      admin_token = "${var.slug}-admin-token"
      sso_secret  = "${var.slug}-sso-secret"
    },
    local.worker_token_enabled ? { worker_token = "${var.slug}-worker-token" } : {},
    { for name, suffix in var.extra_generated_secrets : name => "${var.slug}-${suffix}" },
  )

  # Secrets whose real value comes from elsewhere. Created with a placeholder
  # version so the services can deploy; the runbook has you add the real one.
  placeholders = merge(
    { database_url = "${var.slug}-database-url" },
    { for name, suffix in var.extra_placeholder_secrets : name => "${var.slug}-${suffix}" },
  )

  secrets = merge(local.generated, local.placeholders)

  # Wire the API to its worker, if the engine wants to know the URL.
  worker_endpoint_env = (
    local.worker_enabled && var.worker.endpoint_env_var != null
    ? { (var.worker.endpoint_env_var) = google_cloud_run_v2_service.worker[0].uri }
    : {}
  )

  # The shared bearer token the API presents to the worker, injected under the
  # same name on both sides.
  worker_token_env = (
    local.worker_token_enabled
    ? { (var.worker.token_env_var) = google_secret_manager_secret.own["worker_token"].secret_id }
    : {}
  )

  # Engine-specific secrets, keyed by the env var the engine reads.
  extra_secret_env = {
    for name, _ in merge(var.extra_generated_secrets, var.extra_placeholder_secrets) :
    name => google_secret_manager_secret.own[name].secret_id
  }

  api_secret_env = merge(
    {
      (var.secret_env_names.admin_token)  = google_secret_manager_secret.own["admin_token"].secret_id
      (var.secret_env_names.sso_secret)   = google_secret_manager_secret.own["sso_secret"].secret_id
      (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
    },
    local.extra_secret_env,
    local.worker_token_env,
    var.shared_secret_env,
    local.object_storage_secret_env,
  )

  worker_secret_env = merge(
    {
      (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
    },
    local.worker_token_env,
    var.shared_secret_env,
    local.object_storage_secret_env,
  )

  # S3-API access to the media bucket (see var.object_storage_env_prefix).
  # The map keys are interpolated BEFORE the `if` filter runs, so a null
  # prefix has to be substituted first; `one()` likewise keeps the values
  # valid when the HMAC key is not created.
  object_storage_enabled = var.object_storage_env_prefix != null
  object_storage_prefix  = coalesce(var.object_storage_env_prefix, "UNUSED")
  object_storage_env = {
    for k, v in {
      "${local.object_storage_prefix}_BUCKET"        = var.media_bucket
      "${local.object_storage_prefix}_ENDPOINT"      = "https://storage.googleapis.com"
      "${local.object_storage_prefix}_REGION"        = var.region
      "${local.object_storage_prefix}_ACCESS_KEY_ID" = one(google_storage_hmac_key.media[*].access_id)
    } : k => v if local.object_storage_enabled
  }
  object_storage_secret_env = {
    for k, v in {
      "${local.object_storage_prefix}_SECRET_ACCESS_KEY" = one(google_secret_manager_secret.media_hmac[*].secret_id)
    } : k => v if local.object_storage_enabled
  }
  job_secret_env = merge(
    {
      (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
    },
    local.object_storage_secret_env,
  )
}

resource "google_service_account" "engine" {
  account_id   = var.slug
  display_name = "${var.display_name} (Cloud Run)"
}

resource "google_storage_bucket_iam_member" "media" {
  bucket = var.media_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.engine.email}"
}

# S3-interoperability credentials for engines whose storage client is boto3.
# The key is bound to the engine's service account, so it can reach exactly
# what the IAM grant above allows and nothing else. The secret half goes to
# Secret Manager like every other credential; the access id is not secret.
resource "google_storage_hmac_key" "media" {
  count = local.object_storage_enabled ? 1 : 0

  service_account_email = google_service_account.engine.email
}

resource "google_secret_manager_secret" "media_hmac" {
  count = local.object_storage_enabled ? 1 : 0

  secret_id = "${var.slug}-media-hmac-secret"

  labels = {
    engine = var.slug
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "media_hmac" {
  count = local.object_storage_enabled ? 1 : 0

  secret      = google_secret_manager_secret.media_hmac[0].id
  secret_data = google_storage_hmac_key.media[0].secret
}

resource "google_secret_manager_secret_iam_member" "media_hmac" {
  count = local.object_storage_enabled ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.media_hmac[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.engine.email}"
}

# ---------------------------------------------------------------------------
# Secrets.
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret" "own" {
  for_each = local.secrets

  secret_id = each.value

  labels = {
    engine = var.slug
  }

  replication {
    auto {}
  }
}

resource "random_password" "generated" {
  for_each = local.generated

  length  = 48
  special = false
}

resource "google_secret_manager_secret_version" "generated" {
  for_each = random_password.generated

  secret      = google_secret_manager_secret.own[each.key].id
  secret_data = each.value.result
}

# A real value is added out of band as a NEW version; this one stays as
# version 1 and "latest" moves on. Cloud Run pins "latest" when a revision is
# created, so adding the real value must be followed by a redeploy — the
# Cloud Build pipeline does that on every push.
resource "google_secret_manager_secret_version" "placeholder" {
  for_each = local.placeholders

  secret      = google_secret_manager_secret.own[each.key].id
  secret_data = "REPLACE_ME"
}

resource "google_secret_manager_secret_iam_member" "own" {
  for_each = google_secret_manager_secret.own

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.engine.email}"
}

resource "google_secret_manager_secret_iam_member" "shared" {
  for_each = var.shared_secret_env

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.engine.email}"
}

# ---------------------------------------------------------------------------
# API service.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "engine" {
  name     = var.slug
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Rebuildable from the image and this config; no state lives in Cloud Run.
  deletion_protection = false

  template {
    service_account = google_service_account.engine.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle = true
      }

      dynamic "env" {
        for_each = merge(var.env, local.worker_endpoint_env, local.object_storage_env)
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    # Deploys push images through Cloud Build; without this the next apply
    # would roll the service back to the image pinned in config.
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  # Cloud Run validates every referenced secret version at revision creation.
  # The versions, and the accessor grants, must exist first.
  depends_on = [
    google_secret_manager_secret_version.generated,
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_iam_member.own,
    google_secret_manager_secret_iam_member.shared,
  ]
}

# Users are redirected here from the hub's /auth/launch/<slug>. An org policy
# with domain-restricted sharing rejects allUsers — if apply fails here, that
# is why.
resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.public ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.engine.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Worker service (optional).
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "worker" {
  count = local.worker_enabled ? 1 : 0

  name     = "${var.slug}-worker"
  location = var.region

  # Reachable over the public URL, on purpose. "Internal" ingress only admits
  # traffic that arrives through a VPC — a Cloud Run service calling another
  # Cloud Run service's run.app URL is NOT internal without VPC egress, so
  # INTERNAL_ONLY would silently block the API. Access is gated by the bearer
  # token the app itself checks (token_env_var), which is exactly the posture
  # the Modal worker this emulates had.
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.engine.email
    timeout         = var.worker.timeout

    scaling {
      min_instance_count = 0
      max_instance_count = var.worker.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.worker.cpu
          memory = var.worker.memory
        }

        # LOAD-BEARING. The worker answers the kickoff request and does the
        # work in a background task; with CPU throttling on, CPU is withdrawn
        # the moment that response is sent and the job freezes with no error.
        # An instance with no in-flight requests can still be reclaimed — the
        # API's polling is what keeps it alive. If jobs are seen dying when a
        # poller stops, raise min_instance_count to 1.
        cpu_idle = false
      }

      dynamic "env" {
        for_each = merge(var.env, var.worker.env, local.object_storage_env)
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.worker_secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_version.generated,
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_iam_member.own,
    google_secret_manager_secret_iam_member.shared,
  ]
}

# Who may invoke the worker AT THE PLATFORM LAYER.
#
# This used to be `allUsers`: the worker sat on the public internet and the
# only thing in front of it was the app's own bearer check — one logging
# mistake or one path that answers before checking the header, and anyone on
# the internet is driving the pipeline. It also meant every unauthenticated
# probe spun up a container on our bill.
#
# Default now: only the engine's own service account, which is the identity
# the API runs as. For that to work the API must send a Google ID token for
# the worker's audience alongside its bearer token — on Cloud Run that is one
# request to the metadata server:
#   GET http://metadata.google.internal/computeMetadata/v1/instance/
#       service-accounts/default/identity?audience=<worker URL>
#   Metadata-Flavor: Google
#  → Authorization: Bearer <id_token>  (the app token moves to its own header)
#
# An engine whose API does not do that yet sets worker.allow_unauthenticated =
# true in its engines entry, which restores the old posture explicitly instead
# of by default.
resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  count = local.worker_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker[0].name
  role     = "roles/run.invoker"
  member = (
    var.worker.allow_unauthenticated
    ? "allUsers"
    : "serviceAccount:${google_service_account.engine.email}"
  )
}

# ---------------------------------------------------------------------------
# Jobs (optional), and their schedules.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_job" "job" {
  for_each = var.jobs

  name     = "${var.slug}-${each.key}"
  location = var.region

  deletion_protection = false

  template {
    template {
      service_account = google_service_account.engine.email
      timeout         = each.value.timeout
      max_retries     = 1

      containers {
        image   = var.image
        command = each.value.command
        args    = each.value.args

        resources {
          limits = {
            cpu    = each.value.cpu
            memory = each.value.memory
          }
        }

        dynamic "env" {
          for_each = merge(var.env, each.value.env, local.object_storage_env)
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.job_secret_env
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_iam_member.own,
  ]
}

resource "google_service_account" "scheduler" {
  for_each = { for k, v in var.jobs : k => v if v.schedule != null }

  account_id   = substr("${var.slug}-${each.key}-sched", 0, 30)
  display_name = "Scheduler → ${var.slug}-${each.key}"
}

# Executing a job is run.jobs.run, which roles/run.invoker carries.
resource "google_cloud_run_v2_job_iam_member" "scheduler" {
  for_each = google_service_account.scheduler

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.job[each.key].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value.email}"
}

resource "google_cloud_scheduler_job" "job" {
  for_each = { for k, v in var.jobs : k => v if v.schedule != null }

  name      = "${var.slug}-${each.key}"
  region    = var.region
  schedule  = each.value.schedule
  time_zone = "Etc/UTC"
  paused    = each.value.paused

  attempt_deadline = "320s"

  retry_config {
    retry_count = 1
  }

  # Triggering a job is a call to the Cloud Run Admin API, so this is an OAuth
  # token against googleapis.com — not the OIDC token used to call a service.
  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.job[each.key].name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler[each.key].email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}

# ---------------------------------------------------------------------------
# Domain. Off by default — see the root variable.
# ---------------------------------------------------------------------------

variable "enable_domain_mapping" {
  type    = bool
  default = false
}

resource "google_cloud_run_domain_mapping" "engine" {
  count = var.enable_domain_mapping ? 1 : 0

  name     = "${var.slug}.${var.domain}"
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.engine.name
  }
}
