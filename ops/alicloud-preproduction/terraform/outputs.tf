output "validated_bindings" {
  description = "Non-secret resource bindings validated before any managed ingress rule."
  value = var.enable_apply ? {
    environment       = var.environment
    region            = var.region
    zone_id           = var.zone_id
    vpc_id            = var.vpc_id
    vswitch_id        = var.vswitch_id
    security_group_id = var.security_group_id
    ecs_instance_id   = var.ecs_instance_id
    rds_instance_id   = var.rds_instance_id
  } : null
}
