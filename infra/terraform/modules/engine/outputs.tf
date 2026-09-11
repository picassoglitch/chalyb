output "url" {
  description = "The API service's run.app URL."
  value       = google_cloud_run_v2_service.engine.uri
}

output "worker_url" {
  description = "The worker's URL, or null when the engine has no worker."
  value       = local.worker_enabled ? google_cloud_run_v2_service.worker[0].uri : null
}

output "service_account_email" {
  value = google_service_account.engine.email
}

output "service_name" {
  value = google_cloud_run_v2_service.engine.name
}

output "secret_ids" {
  description = "The three secrets this module created. Each needs a version before the engine starts."
  value       = [for s in google_secret_manager_secret.own : s.secret_id]
}

output "job_names" {
  value = [for j in google_cloud_run_v2_job.job : j.name]
}
