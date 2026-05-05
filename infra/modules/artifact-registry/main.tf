resource "google_artifact_registry_repository" "docker" {
  repository_id = "grc-${var.environment}"
  location      = var.region
  project       = var.project_id
  format        = "DOCKER"
  description   = "GRC Docker images — ${var.environment}"

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}

# Allow the Cloud Run service account to pull images
resource "google_artifact_registry_repository_iam_member" "cloud_run_reader" {
  repository = google_artifact_registry_repository.docker.name
  location   = var.region
  project    = var.project_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.service_account_email}"
}

# Allow the GitHub Actions service account to push images
resource "google_artifact_registry_repository_iam_member" "github_writer" {
  repository = google_artifact_registry_repository.docker.name
  location   = var.region
  project    = var.project_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${var.github_sa_email}"
}
