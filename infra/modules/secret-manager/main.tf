resource "google_project_service" "secretmanager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

# IAM: Cloud Run service account can read secrets
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${var.service_account_email}"

  depends_on = [google_project_service.secretmanager]
}

# Bootstrap secrets (values set post-deploy via gcloud or CI/CD)
locals {
  secrets = [
    "grc-db-password-${var.environment}",
    "grc-clerk-secret-key-${var.environment}",
    "grc-clerk-webhook-secret-${var.environment}",
    "grc-sentry-dsn-${var.environment}",
  ]
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(local.secrets)
  secret_id = each.value
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }

  depends_on = [google_project_service.secretmanager]
}
