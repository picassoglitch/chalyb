# Project-wide secrets. Per-engine secrets are created by the engine module,
# so adding an agent does not mean editing this file.
#
# Every secret gets a version in the same apply. Cloud Run refuses to create
# a revision whose referenced secret is empty, so "containers only, fill later"
# could never finish a first apply. Generated values do land in state — the
# state bucket is the trust boundary for this estate. Placeholders are
# replaced out of band, as a new version:
#
#   printf '%s' "$VALUE" | gcloud secrets versions add zernio-api-key \
#     --data-file=- --project=<project>

locals {
  shared_secrets = {
    "zernio-api-key"     = "Zernio publishing API key."
    "drive-token-key"    = "Encryption key for Google Drive refresh tokens at rest."
    "assemblyai-api-key" = "AssemblyAI key — ChalyClip transcription (metered, no GPU)."
    "anthropic-api-key"  = "Anthropic API key — ChalyClip's LLM router (hooks, viral detection, vision)."
  }

  # drive-token-key is an encryption key nothing outside decides — generate it.
  # The API keys are issued by their vendors, so they get a placeholder the
  # runbook has you replace. Every secret needs SOME version: Cloud Run
  # refuses to create a revision whose referenced secret is empty.
  shared_generated   = ["drive-token-key"]
  shared_placeholder = ["zernio-api-key", "assemblyai-api-key", "anthropic-api-key"]
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

resource "random_password" "shared" {
  for_each = toset(local.shared_generated)

  length  = 48
  special = false
}

resource "google_secret_manager_secret_version" "shared_generated" {
  for_each = random_password.shared

  secret      = google_secret_manager_secret.shared[each.key].id
  secret_data = each.value.result
}

resource "google_secret_manager_secret_version" "shared_placeholder" {
  for_each = toset(local.shared_placeholder)

  secret      = google_secret_manager_secret.shared[each.key].id
  secret_data = "REPLACE_ME"
}
