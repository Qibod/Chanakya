terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "grc-terraform-state-production"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "cloud_sql" {
  source      = "../../modules/cloud-sql"
  project_id  = var.project_id
  region      = var.region
  environment = "production"
  vpc_network = module.networking.vpc_self_link
  db_password = var.db_password
}

module "cloud_run" {
  source                = "../../modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  environment           = "production"
  service_account_email = var.service_account_email
  api_image             = var.api_image
  worker_image          = var.worker_image
}

module "cloud_tasks" {
  source      = "../../modules/cloud-tasks"
  project_id  = var.project_id
  region      = var.region
  environment = "production"
}

module "cloud_storage" {
  source                = "../../modules/cloud-storage"
  project_id            = var.project_id
  region                = var.region
  environment           = "production"
  service_account_email = var.service_account_email
}

module "memorystore" {
  source      = "../../modules/memorystore"
  project_id  = var.project_id
  region      = var.region
  environment = "production"
  vpc_network = module.networking.vpc_self_link
}

module "secret_manager" {
  source                = "../../modules/secret-manager"
  project_id            = var.project_id
  region                = var.region
  environment           = "production"
  service_account_email = var.service_account_email
}

module "networking" {
  source      = "../../modules/networking"
  project_id  = var.project_id
  region      = var.region
  environment = "production"
}
