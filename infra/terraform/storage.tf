# Source VODs and rendered clips. Replaces the dead machine's local disk.
resource "google_storage_bucket" "media" {
  name     = "${var.project_id}-media"
  location = var.region

  # Uniform access: permissions come from IAM only, no per-object ACLs. The
  # engine service accounts are granted objectAdmin in engines.tf.
  uniform_bucket_level_access = true

  # Nothing here is public. Clips reach the platforms through Zernio's presigned
  # upload, and the UI serves them through the engine, so there is no reason for
  # this bucket to be world-readable.
  public_access_prevention = "enforced"

  lifecycle_rule {
    condition {
      age = var.media_retention_days
    }
    action {
      type = "Delete"
    }
  }

  # Abandoned multipart uploads otherwise accumulate invisibly and are billed.
  # This needs its own action type — a Delete rule would not touch them, and
  # days_since_noncurrent_time would be a no-op on an unversioned bucket.
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "AbortIncompleteMultipartUpload"
    }
  }

  depends_on = [google_project_service.enabled]
}
