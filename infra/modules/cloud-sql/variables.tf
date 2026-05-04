variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region — parameterised for EU data residency (ARCH-12). Default: us-central1"
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment: staging | production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "vpc_network" {
  type        = string
  description = "VPC network self-link for private IP"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Database user password (stored in Secret Manager)"
}
