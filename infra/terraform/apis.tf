# APIs the rest of this config depends on. Every other resource takes an
# implicit dependency on these through google_project_service, so a fresh
# project converges in one apply instead of failing on "API not enabled".
locals {
  services = [
    "run.googleapis.com",
    "cloudscheduler.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
    "monitoring.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.services)

  project = var.project_id
  service = each.value

  # Leave APIs on when a resource is removed. Disabling an API can break other
  # things in the project that Terraform does not manage.
  disable_on_destroy = false
}
