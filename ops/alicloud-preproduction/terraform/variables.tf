variable "enable_apply" {
  description = "False keeps every managed cloud rule disabled. The wrapper sets true only for an approved saved plan."
  type        = bool
  default     = false
}

variable "environment" {
  type    = string
  default = "preproduction"
  validation {
    condition     = var.environment == "preproduction"
    error_message = "This module is restricted to preproduction."
  }
}

variable "region" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "vswitch_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "ecs_instance_id" {
  type = string
}

variable "ecs_private_ip" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "https_source_cidrs" {
  type = list(string)
  validation {
    condition = length(var.https_source_cidrs) > 0 && alltrue([
      for cidr in var.https_source_cidrs : cidr != "0.0.0.0/0"
    ])
    error_message = "Preproduction HTTPS ingress must be approved and cannot be globally open."
  }
}

variable "ssh_source_cidr" {
  type = string
  validation {
    condition     = var.ssh_source_cidr != "0.0.0.0/0"
    error_message = "SSH ingress cannot be globally open."
  }
}
