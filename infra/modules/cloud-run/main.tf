resource "google_cloud_run_v2_service" "api" {
  name     = "grc-api-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    containers {
      image = var.api_image

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = var.environment == "production" ? "2" : "1"
          memory = var.environment == "production" ? "1Gi" : "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "staging"
      }

    }
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}

resource "google_cloud_run_v2_job" "worker" {
  name     = "grc-worker-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    template {
      service_account = var.service_account_email

      containers {
        image = var.worker_image

        resources {
          limits = {
            cpu    = "2"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = var.environment == "production" ? "production" : "staging"
        }
      }
    }
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}
