# Tmux Integration System - Deployment Runbook

## Overview

This runbook provides comprehensive deployment procedures for the tmux integration system across multiple environments and platforms. It covers Kubernetes deployments, Docker configurations, cloud infrastructure setup, and automated deployment pipelines.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Infrastructure](#cloud-infrastructure)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Environment Configuration](#environment-configuration)
8. [Monitoring Setup](#monitoring-setup)
9. [Backup and Recovery](#backup-and-recovery)
10. [Rollback Procedures](#rollback-procedures)

## Prerequisites

### System Requirements

| Component | Minimum | Recommended | Production |
|-----------|---------|-------------|------------|
| CPU | 2 cores | 4 cores | 8 cores |
| Memory | 4GB | 8GB | 16GB |
| Storage | 20GB | 50GB | 100GB SSD |
| Network | 100Mbps | 1Gbps | 10Gbps |

### Software Dependencies

```bash
# Required software versions
kubernetes: >=1.24.0
docker: >=20.10.0
helm: >=3.8.0
kubectl: >=1.24.0
redis: >=6.2.0
postgresql: >=13.0
nginx: >=1.20.0
```

### Access Requirements

```bash
# Required permissions and access
- Kubernetes cluster admin access
- Docker registry push/pull access
- Cloud provider admin access (AWS/GCP/Azure)
- DNS management access
- SSL certificate management
- Monitoring system access
```

## Environment Setup

### Development Environment

```bash
#!/bin/bash
# dev-setup.sh - Development environment setup

# Create namespace
kubectl create namespace tmux-dev

# Deploy Redis for development
helm install redis-dev bitnami/redis \
  --namespace tmux-dev \
  --set auth.enabled=false \
  --set replica.replicaCount=1

# Deploy PostgreSQL for development
helm install postgres-dev bitnami/postgresql \
  --namespace tmux-dev \
  --set auth.postgresPassword=devpassword \
  --set primary.persistence.enabled=false

# Create development secrets
kubectl create secret generic tmux-secrets \
  --namespace tmux-dev \
  --from-literal=redis-url=redis://redis-dev-master:6379 \
  --from-literal=db-url=postgresql://postgres:devpassword@postgres-dev:5432/postgres \
  --from-literal=jwt-secret=dev-jwt-secret-key

# Deploy development configuration
kubectl apply -f k8s/overlays/development/
```

### Staging Environment

```bash
#!/bin/bash
# staging-setup.sh - Staging environment setup

# Create namespace
kubectl create namespace tmux-staging

# Deploy Redis cluster for staging
helm install redis-staging bitnami/redis \
  --namespace tmux-staging \
  --set auth.enabled=true \
  --set auth.password=$(openssl rand -base64 32) \
  --set replica.replicaCount=3 \
  --set persistence.enabled=true \
  --set persistence.size=10Gi

# Deploy PostgreSQL with replication
helm install postgres-staging bitnami/postgresql \
  --namespace tmux-staging \
  --set auth.postgresPassword=$(openssl rand -base64 32) \
  --set primary.persistence.enabled=true \
  --set primary.persistence.size=50Gi \
  --set readReplicas.replicaCount=2

# Create staging secrets from external secret manager
kubectl apply -f k8s/staging/external-secrets.yaml

# Deploy staging configuration
kubectl apply -f k8s/overlays/staging/
```

### Production Environment

```bash
#!/bin/bash
# production-setup.sh - Production environment setup

# Create namespace
kubectl create namespace tmux-production

# Deploy Redis Enterprise cluster
helm install redis-prod redis-enterprise/redis-enterprise \
  --namespace tmux-production \
  --set cluster.nodes=6 \
  --set cluster.persistentVolume.size=100Gi \
  --set cluster.resources.limits.cpu=4 \
  --set cluster.resources.limits.memory=8Gi

# Deploy PostgreSQL with high availability
helm install postgres-prod bitnami/postgresql-ha \
  --namespace tmux-production \
  --set postgresql.replicaCount=3 \
  --set postgresql.resources.limits.cpu=2 \
  --set postgresql.resources.limits.memory=4Gi \
  --set persistence.size=200Gi

# Create production secrets from external secret manager
kubectl apply -f k8s/production/external-secrets.yaml

# Deploy production configuration
kubectl apply -f k8s/overlays/production/
```

## Kubernetes Deployment

### Base Configuration

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tmux-system
  labels:
    name: tmux-system
    environment: production
```

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tmux-config
  namespace: tmux-system
data:
  app.yaml: |
    server:
      port: 8080
      websocket_port: 8081
      read_timeout: 30s
      write_timeout: 30s
      
    tmux:
      max_sessions: 10000
      session_timeout: 3600
      cleanup_interval: 300
      command_timeout: 30
      
    cache:
      ttl: 3600
      max_size: 1000000
      
    security:
      jwt_expiry: 3600
      max_login_attempts: 5
      rate_limit: 100
      
    monitoring:
      metrics_enabled: true
      tracing_enabled: true
      log_level: info
```

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tmux-service
  namespace: tmux-system
  labels:
    app: tmux-service
    component: backend
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  selector:
    matchLabels:
      app: tmux-service
  template:
    metadata:
      labels:
        app: tmux-service
        component: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: tmux-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: tmux-service
        image: tmux-service:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        - containerPort: 8081
          name: websocket
          protocol: TCP
        env:
        - name: CONFIG_PATH
          value: "/etc/tmux/app.yaml"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: tmux-secrets
              key: redis-url
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: tmux-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: tmux-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /etc/tmux
          readOnly: true
        - name: tmp
          mountPath: /tmp
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            Port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
      volumes:
      - name: config
        configMap:
          name: tmux-config
      - name: tmp
        emptyDir: {}
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
      - effect: NoSchedule
        key: tmux-service
        operator: Equal
        value: "true"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - tmux-service
              topologyKey: kubernetes.io/hostname
```

### Service Configuration

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: tmux-service
  namespace: tmux-system
  labels:
    app: tmux-service
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  - port: 8081
    targetPort: 8081
    protocol: TCP
    name: websocket
  selector:
    app: tmux-service

---
apiVersion: v1
kind: Service
metadata:
  name: tmux-service-headless
  namespace: tmux-system
  labels:
    app: tmux-service
spec:
  type: ClusterIP
  clusterIP: None
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: tmux-service
```

### Ingress Configuration

```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tmux-ingress
  namespace: tmux-system
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: tmux-service
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$remote_addr"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - tmux.company.com
    secretName: tmux-tls
  rules:
  - host: tmux.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: tmux-service
            port:
              number: 80
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: tmux-service
            port:
              number: 8081
```

### Auto-scaling Configuration

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tmux-service-hpa
  namespace: tmux-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tmux-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: tmux_active_sessions
      target:
        type: AverageValue
        averageValue: "500"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      selectPolicy: Max
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      selectPolicy: Min
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
apiVersion: autoscaling/v2
kind: VerticalPodAutoscaler
metadata:
  name: tmux-service-vpa
  namespace: tmux-system
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tmux-service
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: tmux-service
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 4
        memory: 8Gi
```

## Docker Deployment

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  tmux-service:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: tmux-service:latest
    ports:
      - "8080:8080"
      - "8081:8081"
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/tmux
      - JWT_SECRET=your-jwt-secret-key
      - LOG_LEVEL=info
    depends_on:
      - redis
      - postgres
    volumes:
      - ./config:/etc/tmux:ro
      - tmux-data:/var/lib/tmux
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=tmux
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - tmux-service
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  tmux-data:
  redis-data:
  postgres-data:
  prometheus-data:
  grafana-data:

networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Production Docker Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  tmux-service:
    image: tmux-service:${TAG:-latest}
    deploy:
      replicas: 5
      update_config:
        parallelism: 2
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
    environment:
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - LOG_LEVEL=warn
      - ENVIRONMENT=production
    secrets:
      - jwt_secret
      - db_password
    networks:
      - backend
      - frontend
    volumes:
      - type: bind
        source: ./config/production.yaml
        target: /etc/tmux/app.yaml
        read_only: true

  nginx:
    image: nginx:alpine
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    ports:
      - target: 80
        published: 80
        mode: host
      - target: 443
        published: 443
        mode: host
    volumes:
      - type: bind
        source: ./nginx/nginx.conf
        target: /etc/nginx/nginx.conf
        read_only: true
      - type: bind
        source: ./ssl
        target: /etc/nginx/ssl
        read_only: true
    networks:
      - frontend
    depends_on:
      - tmux-service

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  db_password:
    file: ./secrets/db_password.txt

networks:
  frontend:
    driver: overlay
    driver_opts:
      encrypted: "true"
  backend:
    driver: overlay
    internal: true
    driver_opts:
      encrypted: "true"
```

## Cloud Infrastructure

### AWS Deployment

```yaml
# aws/cloudformation-template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Tmux Integration System Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  VpcCidr:
    Type: String
    Default: 10.0.0.0/16
    Description: CIDR block for VPC

Resources:
  # VPC Configuration
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub tmux-vpc-${Environment}

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub tmux-public-subnet-1-${Environment}

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub tmux-public-subnet-2-${Environment}

  # Private Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub tmux-private-subnet-1-${Environment}

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub tmux-private-subnet-2-${Environment}

  # EKS Cluster
  EKSCluster:
    Type: AWS::EKS::Cluster
    Properties:
      Name: !Sub tmux-cluster-${Environment}
      Version: '1.24'
      RoleArn: !GetAtt EKSClusterRole.Arn
      ResourcesVpcConfig:
        SecurityGroupIds:
          - !Ref EKSClusterSecurityGroup
        SubnetIds:
          - !Ref PublicSubnet1
          - !Ref PublicSubnet2
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
      Logging:
        ClusterLogging:
          EnabledTypes:
            - Type: api
            - Type: audit
            - Type: authenticator
            - Type: controllerManager
            - Type: scheduler

  # EKS Node Group
  EKSNodeGroup:
    Type: AWS::EKS::Nodegroup
    Properties:
      ClusterName: !Ref EKSCluster
      NodegroupName: !Sub tmux-nodegroup-${Environment}
      NodeRole: !GetAtt EKSNodeGroupRole.Arn
      Subnets:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      InstanceTypes:
        - t3.large
        - t3.xlarge
      ScalingConfig:
        MinSize: 3
        MaxSize: 20
        DesiredSize: 5
      UpdateConfig:
        MaxUnavailablePercentage: 25
      AmiType: AL2_x86_64
      CapacityType: ON_DEMAND
      DiskSize: 50
      Labels:
        environment: !Ref Environment
        application: tmux-service

  # RDS Instance
  RDSInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub tmux-db-${Environment}
      DBInstanceClass: db.t3.medium
      Engine: postgres
      EngineVersion: '15.3'
      MasterUsername: tmuxadmin
      MasterUserPassword: !Ref DBPassword
      AllocatedStorage: 100
      StorageType: gp2
      StorageEncrypted: true
      VPCSecurityGroups:
        - !Ref RDSSecurityGroup
      DBSubnetGroupName: !Ref DBSubnetGroup
      BackupRetentionPeriod: 7
      MultiAZ: true
      PubliclyAccessible: false
      Tags:
        - Key: Name
          Value: !Sub tmux-db-${Environment}

  # ElastiCache Redis Cluster
  ElastiCacheSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for ElastiCache
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  ElastiCacheCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: !Sub tmux-redis-${Environment}
      Description: Redis cluster for tmux service
      NumCacheClusters: 3
      Engine: redis
      EngineVersion: '7.0'
      CacheNodeType: cache.t3.micro
      CacheSubnetGroupName: !Ref ElastiCacheSubnetGroup
      SecurityGroupIds:
        - !Ref ElastiCacheSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true
```

### Terraform Configuration

```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
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
  }
  
  backend "s3" {
    bucket = "tmux-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "tmux-integration"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "./modules/vpc"
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "eks" {
  source = "./modules/eks"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  
  cluster_version = var.eks_cluster_version
  node_instance_types = var.eks_node_instance_types
  node_desired_size   = var.eks_node_desired_size
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
}

module "rds" {
  source = "./modules/rds"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  
  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  engine_version    = var.rds_engine_version
}

module "elasticache" {
  source = "./modules/elasticache"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  
  node_type        = var.elasticache_node_type
  num_cache_nodes  = var.elasticache_num_nodes
  engine_version   = var.elasticache_engine_version
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Tmux Service

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Run tests
      run: |
        go test -v -race -coverprofile=coverage.out ./...
        go tool cover -html=coverage.out -o coverage.html

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.out

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  build:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.meta.outputs.tags }}
      digest: ${{ steps.build.outputs.digest }}
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha

    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region us-west-2 --name tmux-cluster-staging

    - name: Deploy to staging
      run: |
        kubectl set image deployment/tmux-service \
          tmux-service=${{ needs.build.outputs.image }} \
          -n tmux-staging
        kubectl rollout status deployment/tmux-service -n tmux-staging --timeout=300s

    - name: Run smoke tests
      run: |
        kubectl run smoke-test --rm -i --restart=Never \
          --image=curlimages/curl \
          --overrides='{"spec":{"restartPolicy":"Never"}}' \
          -- curl -f http://tmux-service.tmux-staging.svc.cluster.local/health

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region us-west-2 --name tmux-cluster-production

    - name: Deploy to production
      run: |
        kubectl set image deployment/tmux-service \
          tmux-service=${{ needs.build.outputs.image }} \
          -n tmux-production
        kubectl rollout status deployment/tmux-service -n tmux-production --timeout=600s

    - name: Verify deployment
      run: |
        kubectl get pods -n tmux-production -l app=tmux-service
        kubectl run health-check --rm -i --restart=Never \
          --image=curlimages/curl \
          --overrides='{"spec":{"restartPolicy":"Never"}}' \
          -- curl -f http://tmux-service.tmux-production.svc.cluster.local/health
```

## Environment Configuration

### Production Configuration

```yaml
# config/production.yaml
server:
  port: 8080
  websocket_port: 8081
  read_timeout: 30s
  write_timeout: 30s
  shutdown_timeout: 30s
  max_header_bytes: 1048576

tmux:
  max_sessions: 10000
  session_timeout: 3600  # 1 hour
  cleanup_interval: 300  # 5 minutes
  command_timeout: 30
  max_output_buffer: 1048576  # 1MB
  history_limit: 10000

database:
  max_open_connections: 100
  max_idle_connections: 10
  connection_max_lifetime: 3600
  connection_max_idle_time: 300

cache:
  ttl: 3600
  max_size: 10000000  # 10M entries
  eviction_policy: "lru"

security:
  jwt_expiry: 3600  # 1 hour
  refresh_expiry: 86400  # 24 hours
  max_login_attempts: 5
  rate_limit: 1000  # requests per minute
  bcrypt_cost: 12

monitoring:
  metrics_enabled: true
  tracing_enabled: true
  profiling_enabled: false
  log_level: "warn"
  log_format: "json"

performance:
  worker_pool_size: 100
  max_concurrent_sessions: 1000
  connection_pool_size: 50
  request_timeout: 30s
```

### Environment-Specific Overlays

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tmux-production

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml
- service-patch.yaml

images:
- name: tmux-service
  newTag: v2.0.0

replicas:
- name: tmux-service
  count: 10

configMapGenerator:
- name: tmux-config
  files:
  - app.yaml=production.yaml
  behavior: replace
```

## Monitoring Setup

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'tmux-service'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - tmux-production
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "id": null,
    "title": "Tmux Service Dashboard",
    "tags": ["tmux", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Active Sessions",
        "type": "stat",
        "targets": [
          {
            "expr": "tmux_active_sessions",
            "legendFormat": "Active Sessions"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 8000},
                {"color": "red", "value": 9500}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(tmux_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(tmux_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "seconds",
            "min": 0
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup-database.sh - Database backup script

set -euo pipefail

BACKUP_DIR="/var/backups/tmux"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="tmux_backup_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform backup
kubectl exec -n tmux-production deployment/postgres -- \
  pg_dump -U postgres tmux > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" \
  "s3://tmux-backups/database/${BACKUP_FILE}.gz"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "tmux_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: ${BACKUP_FILE}.gz"
```

### Session State Backup

```bash
#!/bin/bash
# backup-sessions.sh - Session state backup script

set -euo pipefail

BACKUP_DIR="/var/backups/tmux-sessions"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Redis data
kubectl exec -n tmux-production deployment/redis -- \
  redis-cli BGSAVE

# Wait for backup to complete
sleep 10

# Copy Redis backup
kubectl cp tmux-production/redis-0:/data/dump.rdb \
  "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb" \
  "s3://tmux-backups/sessions/redis_${TIMESTAMP}.rdb"

echo "Session backup completed: redis_${TIMESTAMP}.rdb"
```

## Rollback Procedures

### Application Rollback

```bash
#!/bin/bash
# rollback-deployment.sh - Rollback deployment script

set -euo pipefail

NAMESPACE="${1:-tmux-production}"
DEPLOYMENT="${2:-tmux-service}"

echo "Rolling back $DEPLOYMENT in namespace $NAMESPACE"

# Get current revision
CURRENT_REVISION=$(kubectl rollout history deployment/$DEPLOYMENT -n $NAMESPACE --output=jsonpath='{.metadata.generation}')

echo "Current revision: $CURRENT_REVISION"

# Rollback to previous revision
kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE

# Wait for rollback to complete
kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=300s

# Verify rollback
NEW_REVISION=$(kubectl rollout history deployment/$DEPLOYMENT -n $NAMESPACE --output=jsonpath='{.metadata.generation}')

echo "Rollback completed. New revision: $NEW_REVISION"

# Run health check
kubectl run health-check-rollback --rm -i --restart=Never \
  --image=curlimages/curl \
  --overrides='{"spec":{"restartPolicy":"Never"}}' \
  -- curl -f "http://tmux-service.$NAMESPACE.svc.cluster.local/health"

echo "Rollback verification completed successfully"
```

### Database Rollback

```bash
#!/bin/bash
# rollback-database.sh - Database rollback script

set -euo pipefail

BACKUP_FILE="$1"
NAMESPACE="${2:-tmux-production}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup_file> [namespace]"
  exit 1
fi

echo "Rolling back database from backup: $BACKUP_FILE"

# Download backup from S3
aws s3 cp "s3://tmux-backups/database/$BACKUP_FILE" "/tmp/$BACKUP_FILE"

# Uncompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip "/tmp/$BACKUP_FILE"
  BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

# Stop application
kubectl scale deployment/tmux-service --replicas=0 -n $NAMESPACE

# Wait for pods to terminate
kubectl wait --for=delete pod -l app=tmux-service -n $NAMESPACE --timeout=120s

# Restore database
kubectl exec -n $NAMESPACE deployment/postgres -- \
  psql -U postgres -c "DROP DATABASE IF EXISTS tmux;"

kubectl exec -n $NAMESPACE deployment/postgres -- \
  psql -U postgres -c "CREATE DATABASE tmux;"

kubectl exec -i -n $NAMESPACE deployment/postgres -- \
  psql -U postgres tmux < "/tmp/$BACKUP_FILE"

# Restart application
kubectl scale deployment/tmux-service --replicas=5 -n $NAMESPACE

# Wait for application to be ready
kubectl rollout status deployment/tmux-service -n $NAMESPACE --timeout=300s

echo "Database rollback completed successfully"
```

---

**Document Version:** 2.0.0  
**Last Updated:** 2025-09-19  
**Next Review:** 2025-10-19  

This deployment runbook provides comprehensive procedures for deploying and managing the tmux integration system across multiple environments and platforms, ensuring reliable and consistent deployments.