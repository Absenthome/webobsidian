# webobsidian-vm-docs

A Terraform module that documents your VMs in a WebObsidian vault, through the
[Agent API](../../docs/AGENT_API.md) (`/api/v1`). One markdown note gets written per VM whenever
its attributes change, and (optionally) trashed when the VM is destroyed.

It's provider-agnostic: it doesn't care whether your VMs come from `aws_instance`,
`azurerm_linux_virtual_machine`, `google_compute_instance`, `proxmox_vm_qemu`, `libvirt_domain`,
or anything else. You give it a `map(any)` of `"vm name" => { ...attributes }`; you build that map
however you like from whatever resources you actually provision. See
[../examples/aws-ec2](../examples/aws-ec2) for a worked example.

## How it works

- `local_file` renders each VM's markdown (via a template) into a JSON payload on disk.
- `null_resource` shells out to `curl -X PUT .../api/v1/notes/<path>` on create/update, and
  (if `delete_on_destroy = true`) `curl -X DELETE .../api/v1/notes/<path>` on destroy.
- A content hash in `triggers` makes this idempotent: `curl` only re-runs when a VM's rendered
  note actually changes, not on every `apply`.
- No new WebObsidian server code — this only talks to the Agent API endpoints that already exist
  (FR-6 / PRD §5), the same ones the [agent-skill](../../docs/agent-skill) and
  [mcp-server](../../mcp-server) integrations use.

## Usage

```hcl
module "vm_docs" {
  source = "./terraform/webobsidian-vm-docs"

  webobsidian_base_url = "https://notes.example.com"
  webobsidian_api_key  = var.webobsidian_api_key   # TF_VAR_webobsidian_api_key, not committed
  notes_path_prefix    = "Infra/VMs"

  vms = {
    for name, vm in your_provider_resource.example : name => {
      ip            = vm.private_ip
      instance_type = vm.instance_type
      provider      = "aws"
      tags          = ["prod"]
      notes         = "Whatever free-text context you want in the note."
    }
  }
}
```

Create the API key in WebObsidian at **Settings → API Keys** with (at minimum) the `write` scope.

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `webobsidian_base_url` | `string` | – | Base URL of the WebObsidian instance |
| `webobsidian_api_key` | `string` (sensitive) | – | Agent API key, `write` scope |
| `notes_path_prefix` | `string` | `"Infra/VMs"` | Vault folder notes are written into |
| `vms` | `map(any)` | `{}` | `"vm name" => attributes` map, one note per entry |
| `template_file` | `string` | built-in | Path to a custom `.tftpl` markdown template |
| `delete_on_destroy` | `bool` | `true` | Trash the note when its VM entry / the module is destroyed |
| `curl_interpreter` | `list(string)` | `["/bin/sh", "-c"]` | Shell used to run `curl`; override for Windows |

## Outputs

| Name | Description |
|---|---|
| `note_paths` | Vault-relative path of each note, keyed by VM name |
| `note_urls` | Full Agent API URL used for each VM's note |

## Custom templates

Pass `template_file` to override the default (`templates/vm-note.md.tftpl`). Your template is
rendered with two variables: `name` (the map key) and `vm` (that entry's attribute map) — same as
Terraform's [`templatefile`](https://developer.hashicorp.com/terraform/language/functions/templatefile).

## Caveats

- **VM names can't contain `/`** — the map key becomes the note's filename, not a subfolder path.
- **The API key ends up in Terraform state**, in plaintext, inside `null_resource.vm_note`'s
  `triggers` — this is what makes the *destroy*-time `curl` call possible without depending on
  values that may not survive to that point in a destroy. This is no different from how Terraform
  already handles most provider credentials/secrets (e.g. `random_password`): **treat your state
  as sensitive** — use a backend with encryption at rest (S3+KMS, Terraform Cloud, etc.) and don't
  commit local `.tfstate` files (already covered by the repo's `.gitignore`). Scope the API key to
  `write` only (skip `read`/`search`) to limit what a state leak could expose.
- Requires `curl` on the machine running `terraform apply`/`destroy` (this module shells out to it
  rather than depending on an HTTP-capable provider, since none in common use models full
  create/update/delete REST lifecycles against an arbitrary API cleanly).
- `terraform destroy` provisioners only run if they're still present in the config at destroy
  time — if you remove a VM's `null_resource` entirely rather than just dropping it from `vms`,
  see [Terraform's note on this](https://developer.hashicorp.com/terraform/language/resources/provisioners/syntax#destroy-time-provisioners).
