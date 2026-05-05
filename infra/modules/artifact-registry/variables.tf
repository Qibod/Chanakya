variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "environment" {
  type = string
}

variable "service_account_email" {
  type        = string
  description = "Cloud Run service account — granted reader access to pull images"
}

variable "github_sa_email" {
  type        = string
  description = "GitHub Actions service account — granted writer access to push images"
}
