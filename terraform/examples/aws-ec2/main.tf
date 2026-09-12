# Example: document every aws_instance in this root module as a WebObsidian note whenever
# it's created/updated, and trash the note when the instance is destroyed. This module is
# provider-agnostic — swap `aws_instance` for whatever resource type you actually provision
# (azurerm_linux_virtual_machine, google_compute_instance, proxmox_vm_qemu, libvirt_domain, ...).
# All it needs is a map of "vm name -> attributes".

variable "instances" {
  type = map(object({
    instance_type = string
    ami           = string
  }))
  default = {
    "web-01" = { instance_type = "t3.small", ami = "ami-0123456789abcdef0" }
    "web-02" = { instance_type = "t3.small", ami = "ami-0123456789abcdef0" }
  }
}

resource "aws_instance" "vm" {
  for_each      = var.instances
  ami           = each.value.ami
  instance_type = each.value.instance_type
  tags          = { Name = each.key }
}

module "vm_docs" {
  source = "../../webobsidian-vm-docs"

  webobsidian_base_url = "https://notes.example.com"
  webobsidian_api_key  = var.webobsidian_api_key # set via TF_VAR_webobsidian_api_key, not committed
  notes_path_prefix    = "Infra/AWS"

  vms = {
    for name, inst in aws_instance.vm : name => {
      provider          = "aws"
      instance_id       = inst.id
      instance_type     = inst.instance_type
      ami               = inst.ami
      private_ip        = inst.private_ip
      public_ip         = inst.public_ip
      availability_zone = inst.availability_zone
      tags              = ["aws", "ec2"]
      notes             = "Provisioned by Terraform. Edit infrastructure via the aws_instance resource, not this note."
    }
  }
}

variable "webobsidian_api_key" {
  type      = string
  sensitive = true
}

output "vm_note_urls" {
  value = module.vm_docs.note_urls
}
