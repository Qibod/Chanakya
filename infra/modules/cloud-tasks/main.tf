locals {
  queues = [
    "evidence-sync",
    "fingerprint",
    "report-generate",
    "regulatory-scan",
    "integration-poll",
  ]
}

resource "google_cloud_tasks_queue" "queues" {
  for_each = toset(local.queues)

  name     = "grc-${each.value}-${var.environment}"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = var.environment == "production" ? 100 : 10
    max_dispatches_per_second = var.environment == "production" ? 50 : 5
  }

  retry_config {
    max_attempts  = 5
    max_backoff   = "300s"
    min_backoff   = "5s"
    max_doublings = 5
  }

  stackdriver_logging_config {
    sampling_ratio = var.environment == "production" ? 0.1 : 1.0
  }
}

# Pub/Sub dead-letter topic for failed tasks
resource "google_pubsub_topic" "dead_letter" {
  name    = "grc-tasks-dead-letter-${var.environment}"
  project = var.project_id

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}
