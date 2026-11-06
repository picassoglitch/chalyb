terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in GCS so it is not on anyone's laptop. The bucket is created
  # out-of-band before `terraform init`; see README.md "Bootstrap".
  backend "gcs" {
    bucket = "chalyb-tfstate"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
