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
#     --substitutions=_PROJECT=<project>,_SERVICE=chalybclip
#
# A user-specified build service account requires the build to send logs to
# Cloud Logging only — which is why both cloudbuild.yaml files set
# `logging: CLOUD_LOGGING_ONLY`. Without that pairing the build fails before
# it starts, with an error about logging buckets rather than permissions.

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
