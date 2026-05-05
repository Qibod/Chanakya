output "repository_url" {
  description = "Base URL for Docker images: {region}-docker.pkg.dev/{project}/grc-{env}"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
