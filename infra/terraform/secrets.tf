# Project-wide secrets. Per-engine secrets are created by the engine module,
# so adding an agent does not mean editing this file.
#
# Containers only — no values. A secret_version resource would write the
# material into Terraform state in plaintext. Add versions out of band:
#
#   printf '%s' "$VALUE" | gcloud secrets versions add zernio-api-key \
#     --data-file=- --project=<project>

locals {
  shared_secrets = {
    "zernio-api-key"  = "Zernio publishing API key."
    "drive-token-key" = "Encryption key for Google Drive refresh tokens at rest."
  }
}

resource "google_secret_manager_secret" "shared" {
  for_each = local.shared_secrets

  secret_id = each.key

  labels = {
    scope = "shared"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}
