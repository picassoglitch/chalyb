# Every agent, from one map.
#
# ADDING AN AGENT: add an entry to var.engines (or to terraform.tfvars). The
# module creates its service account, its three secrets, the Cloud Run
# service, and — if the entry asks for them — a worker service and scheduled
# jobs. Nothing else in this directory needs editing.
#
# The full checklist, including the hub-side migration and the new repo, is in
# docs/infra/adding-an-engine.md.

module "engine" {
  source   = "./modules/engine"
  for_each = var.engines

  slug         = each.key
  display_name = coalesce(each.value.display_name, each.key)
  project_id   = var.project_id
  region       = var.region
  domain       = var.domain

  image         = each.value.image
  cpu           = each.value.cpu
  memory        = each.value.memory
  max_instances = each.value.max_instances
  public        = each.value.public

  media_bucket = google_storage_bucket.media.name

  env = merge(
    {
      ENGINE_SLUG     = each.key
      PUBLIC_URL      = "https://${each.key}.${var.domain}"
      CHALYB_BASE_URL = coalesce(var.hub_url, "https://www.${var.domain}")
    },
    each.value.env,
    lookup(var.engine_extra_env, each.key, {}),
    each.key == local.relay_engine ? local.relay_engine_env : {},
  )

  vpc_egress = each.key == local.relay_engine ? local.relay_vpc_egress : null

  secret_env_names          = each.value.secret_env_names
  object_storage_env_prefix = each.value.object_storage_env_prefix

  shared_secret_env = merge(
    {
      for var_name, secret_key in each.value.shared_secrets :
      var_name => google_secret_manager_secret.shared[secret_key].secret_id
    },
    lookup(var.engine_extra_secret_env, each.key, {}),
  )

  worker = each.value.worker
  boost  = each.value.boost
  jobs   = each.value.jobs

  # Chalito has no subdomain: its screens live inside the hub (/app/chalito) and the browser
  # calls its api on the Cloud Run URL (owner decision 2026-10-05).
  enable_domain_mapping = var.enable_domain_mappings && each.key != "chalito"

  # Without this the module's resources race API enablement. On a fresh
  # project the root-level secrets (which do wait) got created and nothing in
  # the module did — the first apply died on "API not enabled" errors that
  # read like a broken config.
  depends_on = [google_project_service.enabled]
}
