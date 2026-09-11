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

  # Derived from `name` (computed: projects/<p>/secrets/<id>) rather than
  # `secret_id` (configured). With secret_id, Terraform knows the value from
  # the config alone, so the output happily listed secrets a partial apply had
  # never created — which made `terraform output` look like proof of existence
  # when it was only an echo of the config.
  value = [for s in google_secret_manager_secret.own : element(split("/", s.name), 3)]
}

output "job_names" {
  value = [for j in google_cloud_run_v2_job.job : j.name]
}

output "placeholder_secret_ids" {
  description = "Secrets created with a REPLACE_ME version; a human adds the real value."
  value       = [for k, _ in local.placeholders : element(split("/", google_secret_manager_secret.own[k].name), 3)]
}
