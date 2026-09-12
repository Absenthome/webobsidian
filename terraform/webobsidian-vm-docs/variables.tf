variable "webobsidian_base_url" {
  description = "Base URL of the WebObsidian instance, e.g. \"https://notes.example.com\" (no trailing slash)."
  type        = string
}

variable "webobsidian_api_key" {
  description = "WebObsidian Agent API key (Settings -> API Keys) with the \"write\" scope."
  type        = string
  sensitive   = true
}

variable "notes_path_prefix" {
  description = "Vault-relative folder to write VM notes into. No leading/trailing slash needed."
  type        = string
  default     = "Infra/VMs"
}

variable "vms" {
  description = <<-EOT
    Map of VM name => arbitrary attributes to document. Keys become the note filename
    (one note per VM, at "<notes_path_prefix>/<key>.md"). Values can hold whatever fields
    your default or custom template expects, e.g.:

      {
        "web-01" = {
          ip       = "10.0.1.10"
          provider = "aws"
          instance_type = "t3.small"
          region   = "us-east-1"
          tags     = ["prod", "web"]
          notes    = "Fronts the marketing site."
        }
      }

    Do not use "/" inside a key — it becomes the note filename, not a subfolder.
  EOT
  type        = map(any)
  default     = {}
}

variable "template_file" {
  description = <<-EOT
    Optional path to a custom markdown template (Terraform `templatefile` syntax). Rendered
    with two variables: `name` (the map key) and `vm` (that VM's attribute map). Defaults to
    the module's built-in template.
  EOT
  type        = string
  default     = null
}

variable "delete_on_destroy" {
  description = "If true, DELETE (move to trash) the note when its VM entry is removed or the module is destroyed. If false, notes are left in the vault."
  type        = bool
  default     = true
}

variable "curl_interpreter" {
  description = "Shell used to run the curl commands, as a Terraform local-exec `interpreter` list. Override for Windows (e.g. [\"PowerShell\", \"-Command\"]) if `curl` isn't on PATH under `cmd`."
  type        = list(string)
  default     = ["/bin/sh", "-c"]
}
