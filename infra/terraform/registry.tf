# One Docker repo for every engine image. Images are pushed as
# <region>-docker.pkg.dev/<project>/engines/<slug>:<tag>.
resource "google_artifact_registry_repository" "engines" {
  location      = var.region
  repository_id = "engines"
  format        = "DOCKER"
  description   = "Container images for the Chalyb engines."

  # The first 0.5 GB is free and images are the easiest thing to let pile up.
  # Keep recent tags, bin untagged layers after a week.
  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  depends_on = [google_project_service.enabled]
}
