output "note_paths" {
  description = "Vault-relative path of each generated note, keyed by VM name."
  value       = local.note_rel_path
}

output "note_urls" {
  description = "Full API URL used for each VM's note, keyed by VM name."
  value       = { for k, p in local.note_url_path : k => "${var.webobsidian_base_url}/api/v1/notes/${p}" }
}
