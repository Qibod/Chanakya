resource "google_sql_database_instance" "main" {
  name             = "${var.project_id}-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.environment == "production" ? true : false

  settings {
    tier              = var.environment == "production" ? "db-g1-small" : "db-f1-micro"
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = var.environment == "production" ? 50 : 10

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 4
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = var.environment == "production" ? "100" : "25"
    }

    user_labels = {
      managed-by  = "terraform"
      environment = var.environment
    }
  }
}

resource "google_sql_database" "grc" {
  name     = "grc"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

resource "google_sql_user" "app" {
  name     = "grc-app"
  instance = google_sql_database_instance.main.name
  password = var.db_password
  project  = var.project_id
}
