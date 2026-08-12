data "alicloud_instances" "target" {
  count          = var.enable_apply ? 1 : 0
  ids            = [var.ecs_instance_id]
  status         = "Running"
  vpc_id         = var.vpc_id
  vswitch_id     = var.vswitch_id
  enable_details = true
}

data "alicloud_db_instances" "target" {
  count          = var.enable_apply ? 1 : 0
  ids            = [var.rds_instance_id]
  engine         = "PostgreSQL"
  status         = "Running"
  vpc_id         = var.vpc_id
  vswitch_id     = var.vswitch_id
  enable_details = true
}

data "alicloud_security_groups" "target" {
  count  = var.enable_apply ? 1 : 0
  ids    = [var.security_group_id]
  vpc_id = var.vpc_id
}

data "alicloud_vswitches" "target" {
  count      = var.enable_apply ? 1 : 0
  ids        = [var.vswitch_id]
  vpc_id     = var.vpc_id
  zone_id    = var.zone_id
  cidr_block = var.vswitch_cidr
}

resource "terraform_data" "isolation_gate" {
  count = var.enable_apply ? 1 : 0
  input = {
    environment       = var.environment
    region            = var.region
    zone_id           = var.zone_id
    vpc_id            = var.vpc_id
    vswitch_id        = var.vswitch_id
    ecs_instance_id   = var.ecs_instance_id
    rds_instance_id   = var.rds_instance_id
    security_group_id = var.security_group_id
  }

  lifecycle {
    precondition {
      condition     = try(length(data.alicloud_instances.target[0].instances) == 1, false)
      error_message = "The approved ECS target is not a running instance in the approved VPC/vSwitch."
    }
    precondition {
      condition     = try(data.alicloud_instances.target[0].instances[0].private_ip == var.ecs_private_ip, false)
      error_message = "The approved ECS private IP does not match live Alibaba Cloud state."
    }
    precondition {
      condition     = try(contains(data.alicloud_instances.target[0].instances[0].security_groups, var.security_group_id), false)
      error_message = "The approved security group is not attached to the ECS target."
    }
    precondition {
      condition     = try(length(data.alicloud_db_instances.target[0].instances) == 1, false)
      error_message = "The approved RDS target is not a running PostgreSQL instance in the approved VPC/vSwitch."
    }
    precondition {
      condition     = try(length(data.alicloud_security_groups.target[0].groups) == 1, false)
      error_message = "The approved security group is not present in the approved VPC."
    }
    precondition {
      condition = try(
        length(data.alicloud_vswitches.target[0].vswitches) == 1
        && data.alicloud_vswitches.target[0].vswitches[0].id == var.vswitch_id
        && data.alicloud_vswitches.target[0].vswitches[0].vpc_id == var.vpc_id
        && data.alicloud_vswitches.target[0].vswitches[0].zone_id == var.zone_id
        && data.alicloud_vswitches.target[0].vswitches[0].cidr_block == var.vswitch_cidr,
        false
      )
      error_message = "The declared vSwitch ID, VPC, zone, or CIDR does not match live Alibaba Cloud state."
    }
  }
}

resource "alicloud_security_group_rule" "https" {
  for_each          = var.enable_apply ? toset(var.https_source_cidrs) : toset([])
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "443/443"
  priority          = 10
  security_group_id = var.security_group_id
  cidr_ip           = each.value
  description       = "Approved isolated preproduction HTTPS ingress"
  depends_on        = [terraform_data.isolation_gate]
}

resource "alicloud_security_group_rule" "ssh" {
  count             = var.enable_apply ? 1 : 0
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 20
  security_group_id = var.security_group_id
  cidr_ip           = var.ssh_source_cidr
  description       = "Approved isolated preproduction SSH administration"
  depends_on        = [terraform_data.isolation_gate]
}
