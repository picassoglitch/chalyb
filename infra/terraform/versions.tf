terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # State lives in GCS so it is not on anyone's laptop — the failure mode that
  # started this migration. The bucket has to exist before `terraform init`,
  # so it is created out-of-band; see README.md "Bootstrap". Uncomment and run
  # `terraform init -migrate-state` once it is there.
  #
  # backend "gcs" {
  #   bucket = "chalyb-tfstate"
  #   prefix = "prod"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
