locals {
  prefix_clean    = trim(var.notes_path_prefix, "/")
  prefix_segments = [for s in split("/", local.prefix_clean) : urlencode(s) if s != ""]

  # Human-readable vault-relative path, e.g. "Infra/VMs/web-01.md" (for outputs/debugging).
  note_rel_path = { for k, v in var.vms : k => "${local.prefix_clean}/${k}.md" }

  # Percent-encoded path segments for the actual API call (each.key must not contain "/").
  note_url_path = { for k, v in var.vms : k => join("/", concat(local.prefix_segments, [urlencode("${k}.md")])) }

  template_path = coalesce(var.template_file, "${path.module}/templates/vm-note.md.tftpl")
  note_content  = { for k, v in var.vms : k => templatefile(local.template_path, { name = k, vm = v }) }

  # Written next to the root module (not inside this module's own directory, which may be a
  # read-only checkout when sourced from a registry/git ref).
  payload_dir = "${path.root}/.terraform-webobsidian-vm-docs"
}

# One JSON payload file per VM. Using a real file + `curl --data-binary @file` (instead of
# inlining JSON into the shell command) sidesteps shell-escaping the note body entirely —
# `jsonencode()` already produces valid, safely-escaped JSON.
resource "local_file" "payload" {
  for_each = var.vms

  filename        = "${local.payload_dir}/${each.key}.json"
  content         = jsonencode({ content = local.note_content[each.key] })
  file_permission = "0600"
}

resource "null_resource" "vm_note" {
  for_each = var.vms

  # Everything the destroy-time provisioner needs is duplicated into `triggers` (via `self.*`)
  # rather than referenced from `var.*`/other resources directly, since destroy-time
  # provisioners aren't guaranteed access to those once a destroy is underway.
  triggers = {
    content_sha       = sha256(local.note_content[each.key])
    base_url          = var.webobsidian_base_url
    api_key           = var.webobsidian_api_key
    note_url_path     = local.note_url_path[each.key]
    delete_on_destroy = tostring(var.delete_on_destroy)
    interpreter_json  = jsonencode(var.curl_interpreter)
  }

  provisioner "local-exec" {
    interpreter = jsondecode(self.triggers.interpreter_json)
    command     = "curl -sSf -X PUT \"${self.triggers.base_url}/api/v1/notes/${self.triggers.note_url_path}\" -H \"X-API-Key: ${self.triggers.api_key}\" -H 'Content-Type: application/json' --data-binary @${local_file.payload[each.key].filename}"
  }

  provisioner "local-exec" {
    when        = destroy
    interpreter = jsondecode(self.triggers.interpreter_json)
    command     = <<-EOT
      if [ "${self.triggers.delete_on_destroy}" = "true" ]; then
        curl -sSf -X DELETE "${self.triggers.base_url}/api/v1/notes/${self.triggers.note_url_path}" \
          -H "X-API-Key: ${self.triggers.api_key}"
      fi
    EOT
  }

  depends_on = [local_file.payload]
}
