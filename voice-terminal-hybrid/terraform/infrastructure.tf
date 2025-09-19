# Voice Terminal Infrastructure as Code
# Multi-region deployment with auto-scaling and session persistence
# Target: 1000+ concurrent users with 99.9% availability
# Cloud providers: AWS, GCP, Azure support

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "s3" {
    bucket         = "voice-terminal-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "voice-terminal-terraform-locks"
  }
}

# Variables for multi-environment deployment
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "regions" {
  description = "AWS regions for multi-region deployment"
  type        = map(object({
    primary = bool
    azs     = list(string)
  }))
  default = {
    "us-west-2" = {
      primary = true
      azs     = ["us-west-2a", "us-west-2b", "us-west-2c"]
    }
    "us-east-1" = {
      primary = false
      azs     = ["us-east-1a", "us-east-1b", "us-east-1c"]
    }
    "eu-west-1" = {
      primary = false
      azs     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
    }
  }
}

variable "cluster_config" {
  description = "EKS cluster configuration"
  type = object({
    version           = string
    node_groups       = map(object({
      instance_types  = list(string)
      scaling_config  = object({
        desired_size = number
        max_size     = number
        min_size     = number
      })
      capacity_type   = string
    }))
  })
  default = {
    version = "1.28"
    node_groups = {
      websocket_nodes = {
        instance_types = ["c5.2xlarge", "c5.4xlarge"]
        scaling_config = {
          desired_size = 6
          max_size     = 50
          min_size     = 3
        }
        capacity_type = "ON_DEMAND"
      }
      tmux_nodes = {
        instance_types = ["m5.xlarge", "m5.2xlarge"]
        scaling_config = {
          desired_size = 4
          max_size     = 20
          min_size     = 2
        }
        capacity_type = "SPOT"
      }
      redis_nodes = {
        instance_types = ["r5.large", "r5.xlarge"]
        scaling_config = {
          desired_size = 6
          max_size     = 12
          min_size     = 6
        }
        capacity_type = "ON_DEMAND"
      }
    }
  }
}

# Local values for common tags and naming
locals {
  name_prefix = "voice-terminal-${var.environment}"
  
  common_tags = {
    Environment   = var.environment
    Project       = "voice-terminal-hybrid"
    ManagedBy    = "terraform"
    Owner        = "platform-team"
    CostCenter   = "engineering"
    Application  = "voice-terminal"
    Backup       = "required"
    Monitoring   = "enabled"
  }
  
  # Calculate total capacity for scaling
  total_websocket_capacity = sum([
    for region, config in var.regions : 
    config.primary ? 10000 : 5000
  ])
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  state    = "available"
  
  filter {
    name   = "zone-name"
    values = each.value.azs
  }
}

# VPC for each region
resource "aws_vpc" "main" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  cidr_block           = "10.${index(keys(var.regions), each.key)}.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name   = "${local.name_prefix}-vpc-${each.key}"
    Region = each.key
    Type   = "vpc"
  })
}

# Internet Gateway for each VPC
resource "aws_internet_gateway" "main" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  vpc_id   = aws_vpc.main[each.key].id
  
  tags = merge(local.common_tags, {
    Name   = "${local.name_prefix}-igw-${each.key}"
    Region = each.key
  })
}

# Subnets for multi-AZ deployment
resource "aws_subnet" "private" {
  for_each = {
    for combo in flatten([
      for region, config in var.regions : [
        for i, az in config.azs : {
          region = region
          az     = az
          index  = i
        }
      ]
    ]) : "${combo.region}-${combo.az}" => combo
  }
  
  provider = aws.region[each.value.region]
  
  vpc_id            = aws_vpc.main[each.value.region].id
  cidr_block        = "10.${index(keys(var.regions), each.value.region)}.${each.value.index + 1}.0/24"
  availability_zone = each.value.az
  
  map_public_ip_on_launch = false
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${each.value.region}-${each.value.index + 1}"
    Type = "private"
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${local.name_prefix}-${each.value.region}" = "owned"
  })
}

resource "aws_subnet" "public" {
  for_each = {
    for combo in flatten([
      for region, config in var.regions : [
        for i, az in config.azs : {
          region = region
          az     = az
          index  = i
        }
      ]
    ]) : "${combo.region}-${combo.az}" => combo
  }
  
  provider = aws.region[each.value.region]
  
  vpc_id            = aws_vpc.main[each.value.region].id
  cidr_block        = "10.${index(keys(var.regions), each.value.region)}.${each.value.index + 10}.0/24"
  availability_zone = each.value.az
  
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${each.value.region}-${each.value.index + 1}"
    Type = "public"
    "kubernetes.io/role/elb" = "1"
    "kubernetes.io/cluster/${local.name_prefix}-${each.value.region}" = "owned"
  })
}

# NAT Gateways for private subnet internet access
resource "aws_eip" "nat" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  domain   = "vpc"
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${each.key}"
  })
}

resource "aws_nat_gateway" "main" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public["${each.key}-${data.aws_availability_zones.available[each.key].names[0]}"].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-${each.key}"
  })
  
  depends_on = [aws_internet_gateway.main]
}

# Route tables for public and private subnets
resource "aws_route_table" "public" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  vpc_id   = aws_vpc.main[each.key].id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[each.key].id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt-${each.key}"
    Type = "public"
  })
}

resource "aws_route_table" "private" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  vpc_id   = aws_vpc.main[each.key].id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[each.key].id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${each.key}"
    Type = "private"
  })
}

# Route table associations
resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public
  
  provider = aws.region[split("-", each.key)[0]]
  
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public[split("-", each.key)[0]].id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private
  
  provider = aws.region[split("-", each.key)[0]]
  
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[split("-", each.key)[0]].id
}

# Security Groups
resource "aws_security_group" "eks_cluster" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name_prefix = "${local.name_prefix}-eks-cluster-"
  vpc_id      = aws_vpc.main[each.key].id
  
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-cluster-sg-${each.key}"
  })
}

resource "aws_security_group" "eks_nodes" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name_prefix = "${local.name_prefix}-eks-nodes-"
  vpc_id      = aws_vpc.main[each.key].id
  
  ingress {
    description = "Node to node communication"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }
  
  ingress {
    description     = "Cluster to node communication"
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster[each.key].id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-nodes-sg-${each.key}"
  })
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name     = "${local.name_prefix}-${each.key}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.cluster_config.version
  
  vpc_config {
    subnet_ids              = [for subnet in aws_subnet.private : subnet.id if startswith(subnet.tags.Name, "${local.name_prefix}-private-${each.key}")]
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = ["0.0.0.0/0"]
    security_group_ids      = [aws_security_group.eks_cluster[each.key].id]
  }
  
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  
  encryption_config {
    provider {
      key_arn = aws_kms_key.eks[each.key].arn
    }
    resources = ["secrets"]
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
    aws_cloudwatch_log_group.eks_cluster,
  ]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-${each.key}"
  })
}

# EKS Node Groups
resource "aws_eks_node_group" "main" {
  for_each = {
    for combo in flatten([
      for region in keys(var.regions) : [
        for node_group_name, node_group_config in var.cluster_config.node_groups : {
          key         = "${region}-${node_group_name}"
          region      = region
          name        = node_group_name
          config      = node_group_config
        }
      ]
    ]) : combo.key => combo
  }
  
  provider = aws.region[each.value.region]
  
  cluster_name    = aws_eks_cluster.main[each.value.region].name
  node_group_name = each.value.name
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = [for subnet in aws_subnet.private : subnet.id if startswith(subnet.tags.Name, "${local.name_prefix}-private-${each.value.region}")]
  
  capacity_type   = each.value.config.capacity_type
  instance_types  = each.value.config.instance_types
  
  scaling_config {
    desired_size = each.value.config.scaling_config.desired_size
    max_size     = each.value.config.scaling_config.max_size
    min_size     = each.value.config.scaling_config.min_size
  }
  
  update_config {
    max_unavailable_percentage = 25
  }
  
  # Taints for workload isolation
  dynamic "taint" {
    for_each = each.value.name == "redis_nodes" ? [1] : []
    content {
      key    = "redis-dedicated"
      value  = "true"
      effect = "NO_SCHEDULE"
    }
  }
  
  labels = {
    node-type = each.value.name
    region    = each.value.region
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-${each.value.name}-${each.value.region}"
  })
}

# IAM Roles
resource "aws_iam_role" "eks_cluster" {
  name = "${local.name_prefix}-eks-cluster-role"
  
  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
    Version = "2012-10-17"
  })
  
  tags = local.common_tags
}

resource "aws_iam_role" "eks_node_group" {
  name = "${local.name_prefix}-eks-node-group-role"
  
  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
    Version = "2012-10-17"
  })
  
  tags = local.common_tags
}

# IAM Role Policy Attachments
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}

# KMS Key for EKS encryption
resource "aws_kms_key" "eks" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  description             = "EKS Secret Encryption Key for ${each.key}"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-kms-${each.key}"
  })
}

resource "aws_kms_alias" "eks" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name          = "alias/${local.name_prefix}-eks-${each.key}"
  target_key_id = aws_kms_key.eks[each.key].key_id
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "eks_cluster" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name              = "/aws/eks/${local.name_prefix}-${each.key}/cluster"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.eks[each.key].arn
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-logs-${each.key}"
  })
}

# Application Load Balancer for WebSocket traffic
resource "aws_lb" "websocket" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name               = "${local.name_prefix}-ws-alb-${each.key}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[each.key].id]
  subnets            = [for subnet in aws_subnet.public : subnet.id if startswith(subnet.tags.Name, "${local.name_prefix}-public-${each.key}")]
  
  enable_deletion_protection = var.environment == "prod"
  enable_http2              = true
  enable_cross_zone_load_balancing = true
  
  access_logs {
    bucket  = aws_s3_bucket.alb_logs[each.key].bucket
    prefix  = "websocket-alb"
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-websocket-alb-${each.key}"
  })
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = aws_vpc.main[each.key].id
  
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg-${each.key}"
  })
}

# S3 Bucket for ALB logs
resource "aws_s3_bucket" "alb_logs" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  
  bucket        = "${local.name_prefix}-alb-logs-${each.key}-${random_id.bucket_suffix.hex}"
  force_destroy = var.environment != "prod"
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-logs-${each.key}"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 Bucket configuration
resource "aws_s3_bucket_versioning" "alb_logs" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  bucket   = aws_s3_bucket.alb_logs[each.key].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  bucket   = aws_s3_bucket.alb_logs[each.key].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  for_each = var.regions
  
  provider = aws.region[each.key]
  bucket   = aws_s3_bucket.alb_logs[each.key].id
  
  rule {
    id     = "log_lifecycle"
    status = "Enabled"
    
    expiration {
      days = 90
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Outputs for downstream configuration
output "cluster_endpoints" {
  description = "EKS cluster endpoints for each region"
  value = {
    for region, cluster in aws_eks_cluster.main : region => cluster.endpoint
  }
}

output "cluster_security_group_ids" {
  description = "Security group IDs attached to the EKS clusters"
  value = {
    for region, cluster in aws_eks_cluster.main : region => cluster.vpc_config[0].cluster_security_group_id
  }
}

output "cluster_iam_role_arns" {
  description = "IAM role ARNs for the EKS clusters"
  value = {
    for region, cluster in aws_eks_cluster.main : region => cluster.role_arn
  }
}

output "load_balancer_dns_names" {
  description = "DNS names of the load balancers"
  value = {
    for region, lb in aws_lb.websocket : region => lb.dns_name
  }
}

output "vpc_ids" {
  description = "VPC IDs for each region"
  value = {
    for region, vpc in aws_vpc.main : region => vpc.id
  }
}

output "private_subnet_ids" {
  description = "Private subnet IDs for each region"
  value = {
    for region in keys(var.regions) : region => [
      for subnet in aws_subnet.private : subnet.id
      if startswith(subnet.tags.Name, "${local.name_prefix}-private-${region}")
    ]
  }
}

output "capacity_planning" {
  description = "Capacity planning information"
  value = {
    total_websocket_capacity    = local.total_websocket_capacity
    regions_count              = length(var.regions)
    total_node_groups          = length(var.cluster_config.node_groups) * length(var.regions)
    estimated_max_connections  = local.total_websocket_capacity * 0.8
  }
}