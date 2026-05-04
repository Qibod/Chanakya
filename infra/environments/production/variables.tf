variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "service_account_email" {
  type = string
}

variable "api_image" {
  type = string
}

variable "worker_image" {
  type = string
}
