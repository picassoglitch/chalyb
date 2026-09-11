output "engine_urls" {
  description = "run.app URL per engine. Point DNS at these, or map the domain."
  value       = { for k, m in module.engine : k => m.url }
}

output "media_bucket" {
  value = google_storage_bucket.media.name
}

output "artifact_registry" {
  description = "Push images here as <this>/<slug>:<tag>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.engines.repository_id}"
}

output "secrets_needing_values" {
  description = "Secrets Terraform created empty. Each needs a version before the engines start."
  value = sort(concat(
    flatten([for m in module.engine : m.secret_ids]),
    [for s in google_secret_manager_secret.shared : s.secret_id],
  ))
}

output "worker_urls" {
  description = "Worker URL per engine that has one. The API is wired to these automatically."
  value       = { for k, m in module.engine : k => m.worker_url if m.worker_url != null }
}

output "jobs" {
  description = "Cloud Run Jobs per engine. Run one on demand with `gcloud run jobs execute <name>`."
  value       = { for k, m in module.engine : k => m.job_names if length(m.job_names) > 0 }
}
