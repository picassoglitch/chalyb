# One agent, end to end.
#
# Everything an engine needs lives here so that adding one is a single entry
# in var.engines: service account, its three secrets, the API service, an
# optional worker service, optional scheduled jobs, and the domain mapping.
#
# Per-agent service account rather than one shared identity — a compromised
# engine cannot read another's secrets. The worker shares the API's account:
# same trust domain, same engine, and one fewer thing to reason about.

locals {
  # Conventional secret ids. The hub reads the same values from
  # CHALYB<SLUG>_ADMIN_TOKEN / _SSO_SECRET; the names differ by side, only the
  # values must match.
  secrets = {
    admin_token  = "${var.slug}-admin-token"
    sso_secret   = "${var.slug}-sso-secret"
    database_url = "${var.slug}-database-url"
  }

  worker_enabled = var.worker != null

  # Wire the API to its worker, if the engine wants to know the URL.
  worker_endpoint_env = (
    local.worker_enabled && var.worker.endpoint_env_var != null
    ? { (var.worker.endpoint_env_var) = google_cloud_run_v2_service.worker[0].uri }
    : {}
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

# ---------------------------------------------------------------------------
# Secrets. Containers only — values are added out of band with
# `gcloud secrets versions add`, never through Terraform, which would write
# the material into state in plaintext.
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
        for_each = merge(var.env, local.worker_endpoint_env)
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = {
          (var.secret_env_names.admin_token)  = google_secret_manager_secret.own["admin_token"].secret_id
          (var.secret_env_names.sso_secret)   = google_secret_manager_secret.own["sso_secret"].secret_id
          (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
        }
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

      dynamic "env" {
        for_each = var.shared_secret_env
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

  depends_on = [
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

  # Only the API dispatches to it.
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
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
        for_each = merge(var.env, var.worker.env)
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = {
          (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
        }
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

      dynamic "env" {
        for_each = var.shared_secret_env
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
    google_secret_manager_secret_iam_member.own,
    google_secret_manager_secret_iam_member.shared,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  count = local.worker_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.engine.email}"
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
          for_each = merge(var.env, each.value.env)
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = {
            (var.secret_env_names.database_url) = google_secret_manager_secret.own["database_url"].secret_id
          }
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

  depends_on = [google_secret_manager_secret_iam_member.own]
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
