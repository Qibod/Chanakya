resource "google_redis_instance" "cache" {
  name           = "grc-redis-${var.environment}"
  tier           = "BASIC"
  memory_size_gb = var.environment == "production" ? 2 : 1
  region         = var.region
  project        = var.project_id

  redis_version    = "REDIS_7_0"
  display_name     = "GRC Redis Cache (${var.environment})"
  authorized_network = var.vpc_network

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}
