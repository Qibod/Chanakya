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
  type = string
}

variable "api_image" {
  type    = string
  default = "gcr.io/cloudrun/placeholder"
}

variable "worker_image" {
  type    = string
  default = "gcr.io/cloudrun/placeholder"
}
