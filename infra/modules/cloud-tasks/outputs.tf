output "queue_names" {
  value = { for k, v in google_cloud_tasks_queue.queues : k => v.name }
}

output "dead_letter_topic" {
  value = google_pubsub_topic.dead_letter.name
}
