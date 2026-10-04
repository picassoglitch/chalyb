# The ChalyOBS RTMP relay (repo picassoglitch/chalybclip-live).
#
# Cloud Run cannot accept RTMP on :1935, so this is the one VM in the estate:
# a small Container-Optimized OS box that runs the relay image from Artifact
# Registry. Encoders push to rtmp://ingest.<domain>/live/<key>; the relay asks
# ChalyOBS to authorize, fans the stream out to the tenant's platforms and
# reports start/end so ChalyOBS meters stream.minutes through the hub.
#
# COST: the VM and IP are ~$15/month. The bill that grows is egress: every
# platform leg is ~2.7 GB per streaming hour at 6 Mbps. The address is on the
# Standard network tier (~$0.085/GB, first 200 GB/month free) instead of
# Premium (~$0.12/GB). See docs/infra/gcp-migration.md, "The RTMP problem".
# Moving to a flat-rate host later only moves this VM and the DNS record.

locals {
  # The engine that owns the relay: gets its env and the VPC egress below.
  relay_engine = "chalybobs"

  relay_zone   = "${var.region}-a"
  relay_tag    = "chalyb-relay"
  relay_subnet = "projects/${var.project_id}/regions/${var.region}/subnetworks/default"

  relay_container_env = merge(
    {
      CHALYBOBS_URL     = "https://${local.relay_engine}.${var.domain}"
      RELAY_SECRET_NAME = google_secret_manager_secret.shared["chalybobs-relay-secret"].secret_id
    },
    # Recordings go to the media bucket (30-day lifecycle) only when
    # something consumes them — ChalyClip's auto-clip. Off = deleted locally.
    var.relay_upload_recordings ? {
      STORAGE_BUCKET                = google_storage_bucket.media.name
      STORAGE_PREFIX                = "live"
      STORAGE_REMOTE                = ":gcs:"
      RCLONE_GCS_ENV_AUTH           = "true"
      RCLONE_GCS_BUCKET_POLICY_ONLY = "true"
    } : {},
  )

  relay_engine_env = {
    # What the encoder panel shows. Must be the raw RTMP host: ingest.<domain>
    # is a DNS-only (not proxied) A record to the static IP below.
    CHALYBOBS_RELAY_RTMP_URL = "rtmp://ingest.${var.domain}/live"
    # HLS live preview, over the VPC only (firewall below).
    CHALYBOBS_RELAY_INTERNAL_HLS = "http://${google_compute_address.relay_internal.address}:8888"
  }

  relay_vpc_egress = {
    network    = "default"
    subnetwork = "default"
  }
}

variable "relay_image" {
  description = "Relay image. The VM pulls it on every service start."
  type        = string
  default     = "us-central1-docker.pkg.dev/chalyb/engines/chalyb-relay:latest"
}

variable "relay_machine_type" {
  description = "ffmpeg legs are -c copy (no transcode), so a shared-core box is enough."
  type        = string
  default     = "e2-small"
}

variable "relay_upload_recordings" {
  description = <<-EOT
    Upload each stream's recording to the media bucket for ChalyClip to clip.
    Leave off until ChalyOBS → ChalyClip forwarding is wired: until then
    nothing reads them and they are just storage cost.
  EOT
  type        = bool
  default     = false
}

resource "google_service_account" "relay" {
  account_id   = "chalyb-relay"
  display_name = "ChalyOBS RTMP relay (GCE)"
}

resource "google_secret_manager_secret_iam_member" "relay_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.shared["chalybobs-relay-secret"].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.relay.email}"
}

resource "google_artifact_registry_repository_iam_member" "relay_pull" {
  location   = google_artifact_registry_repository.engines.location
  repository = google_artifact_registry_repository.engines.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.relay.email}"
}

# Create + read back (rclone checks the upload). No delete, no admin.
resource "google_storage_bucket_iam_member" "relay_media" {
  for_each = toset(["roles/storage.objectCreator", "roles/storage.objectViewer"])

  bucket = google_storage_bucket.media.name
  role   = each.value
  member = "serviceAccount:${google_service_account.relay.email}"
}

resource "google_project_iam_member" "relay_logs" {
  for_each = toset(["roles/logging.logWriter", "roles/monitoring.metricWriter"])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.relay.email}"
}

resource "google_compute_address" "relay" {
  name         = "chalyb-relay"
  region       = var.region
  network_tier = "STANDARD"

  depends_on = [google_project_service.enabled]
}

# Fixed so CHALYBOBS_RELAY_INTERNAL_HLS survives a VM rebuild.
resource "google_compute_address" "relay_internal" {
  name         = "chalyb-relay-internal"
  region       = var.region
  address_type = "INTERNAL"
  subnetwork   = local.relay_subnet

  depends_on = [google_project_service.enabled]
}

resource "google_compute_firewall" "relay_rtmp" {
  name      = "chalyb-relay-rtmp"
  network   = "default"
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["1935"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.relay_tag]

  depends_on = [google_project_service.enabled]
}

# HLS preview: only ChalyOBS, which egresses from the default subnet (Direct
# VPC egress). Never public — the HLS path carries the stream key.
resource "google_compute_firewall" "relay_hls" {
  name      = "chalyb-relay-hls"
  network   = "default"
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["8888"]
  }

  source_ranges = [data.google_compute_subnetwork.default.ip_cidr_range]
  target_tags   = [local.relay_tag]
}

# SSH through IAP only (gcloud compute ssh --tunnel-through-iap).
resource "google_compute_firewall" "relay_ssh" {
  name      = "chalyb-relay-iap-ssh"
  network   = "default"
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = [local.relay_tag]

  depends_on = [google_project_service.enabled]
}

data "google_compute_subnetwork" "default" {
  name   = "default"
  region = var.region

  depends_on = [google_project_service.enabled]
}

resource "google_compute_instance" "relay" {
  name         = "chalyb-relay"
  zone         = local.relay_zone
  machine_type = var.relay_machine_type
  tags         = [local.relay_tag]

  # Recreated by apply when it must be; the relay holds no state.
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "cos-cloud/cos-stable"
      # Room for a few concurrent recordings before upload/delete.
      size = 30
      type = "pd-standard"
    }
  }

  network_interface {
    subnetwork = local.relay_subnet
    network_ip = google_compute_address.relay_internal.address

    access_config {
      nat_ip       = google_compute_address.relay.address
      network_tier = "STANDARD"
    }
  }

  service_account {
    email  = google_service_account.relay.email
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot = true
  }

  metadata = {
    google-logging-enabled = "true"
    enable-oslogin         = "TRUE"
    # COS runs cloud-init on every boot, so a metadata change applies on the
    # next restart without recreating the VM.
    user-data = templatefile("${path.module}/relay-cloud-init.yaml", {
      image    = var.relay_image
      registry = split("/", var.relay_image)[0]
      env      = local.relay_container_env
    })
  }

  depends_on = [
    google_secret_manager_secret_iam_member.relay_secret,
    google_artifact_registry_repository_iam_member.relay_pull,
    google_secret_manager_secret_version.shared_generated,
  ]
}

output "relay_ip" {
  description = "Point ingest.<domain> here: an A record, DNS only (not proxied)."
  value       = google_compute_address.relay.address
}
