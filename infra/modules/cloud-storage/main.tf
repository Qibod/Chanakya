resource "google_storage_bucket" "evidence" {
  name                        = "${var.project_id}-evidence-${var.environment}"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = var.environment != "production"
  uniform_bucket_level_access = true

  # Object Retention Lock — WORM storage for evidence immutability (ARCH-10, FR15)
  # Blobs cannot be deleted once written; meets SOX 7-year retention requirement
  retention_policy {
    is_locked        = var.environment == "production"
    retention_period = var.environment == "production" ? 220752000 : 86400 # 7 years | 1 day
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
    purpose     = "evidence-storage"
  }
}

# IAM: only Cloud Run service account can write
resource "google_storage_bucket_iam_member" "api_writer" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.service_account_email}"
}
