# The identity Cloud Build uses to build, push and deploy.
#
# A DEDICATED service account rather than the legacy Cloud Build default:
# Google has been moving new projects off that default, and relying on it
# means a deploy that works in one project mysteriously 403s in the next.
# Naming the identity makes the permissions explicit and auditable.
#
# Use it by passing the flag from `terraform output cloud_build_service_account`:
#
#   gcloud builds submit --config=cloudbuild.yaml \
#     --service-account=projects/<project>/serviceAccounts/<email> \
#     --gcs-source-staging-dir=gs://<build_source_bucket>/source \
#     --substitutions=SHORT_SHA=$(git rev-parse --short=7 HEAD)
#
# A user-specified build service account requires the build to send logs to
# Cloud Logging only — which is why every cloudbuild.yaml sets
# `logging: CLOUD_LOGGING_ONLY`. Without that pairing the build fails before
# it starts, with an error about logging buckets rather than permissions.
#
# It also has to READ THE SOURCE. `gcloud builds submit` uploads the tarball
# to a bucket and the build account fetches it from there. gcloud's default
# is an auto-created `<project>_cloudbuild` bucket that only the legacy
# default build account can read, so the very first submit with this account
# died with "could not resolve source: storage.objects.get denied". The
# staging bucket below is ours, the grant is scoped to it, and the
# --gcs-source-staging-dir flag points gcloud at it. The alternative —
# project-wide objectViewer — would also let the deployer read the media
# bucket and the Terraform state, which holds every generated secret.

resource "google_service_account" "deployer" {
  account_id   = "chalyb-deployer"
  display_name = "Cloud Build — build, push, deploy"

  depends_on = [google_project_service.enabled]
}

locals {
  deployer_roles = [
    # Push images to Artifact Registry.
    "roles/artifactregistry.writer",

    # Create and update Cloud Run services. Deliberately `developer`, not
    # `admin`: deploys only need to change the image and the revision.
    # Terraform owns the IAM bindings, and a deployer that could rewrite them
    # could make a private service public.
    "roles/run.developer",

    # Deploying a service that RUNS AS another service account requires
    # permission to act as it. Without this the deploy fails with
    # "caller does not have permission to act as service account", which
    # reads like an Artifact Registry problem and is not.
    "roles/iam.serviceAccountUser",

    # Required for a user-specified build service account.
    "roles/logging.logWriter",
  ]
}

resource "google_project_iam_member" "deployer" {
  for_each = toset(local.deployer_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Where `gcloud builds submit` stages the source tarball (see the header).
# Tarballs are throwaway — the image in Artifact Registry is the artifact —
# so they expire after a week.
resource "google_storage_bucket" "build_source" {
  name     = var.build_source_bucket_name != "" ? var.build_source_bucket_name : "${var.project_id}-build-source"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.enabled]
}

resource "google_storage_bucket_iam_member" "deployer_build_source" {
  bucket = google_storage_bucket.build_source.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.deployer.email}"
}
