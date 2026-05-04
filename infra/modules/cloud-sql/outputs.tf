output "instance_name" {
  value       = google_sql_database_instance.main.name
  description = "Cloud SQL instance name"
}

output "connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "Cloud SQL connection name for Cloud SQL Proxy"
}

output "private_ip" {
  value       = google_sql_database_instance.main.private_ip_address
  description = "Private IP address"
}

output "database_name" {
  value = google_sql_database.grc.name
}
