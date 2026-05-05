variable "project_id" {
  type        = string
  description = "GCP project ID for staging"
}

variable "region" {
  type        = string
  description = "GCP region — change to europe-west1 for EU data residency (ARCH-12)"
  default     = "us-central1"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "service_account_email" {
  type        = string
  description = "Service account used by Cloud Run services"
}

variable "github_sa_email" {
  type        = string
  description = "Service account used by GitHub Actions (Workload Identity Federation principal)"
}
