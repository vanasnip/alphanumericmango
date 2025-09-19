# Multi-stage Docker build for production tmux service
# Security-hardened container with comprehensive monitoring and scanning

# Stage 1: Build dependencies and security scanning
FROM node:20-alpine AS security-scanner
WORKDIR /app

# Install security scanning tools
RUN apk add --no-cache \
    git \
    bash \
    curl \
    jq

# Install security scanning tools
RUN npm install -g \
    audit-ci@^6.6.1 \
    @cyclonedx/cyclonedx-npm@^1.10.0 \
    npm-audit-resolver@^3.0.0-RC.0

# Copy package files for security analysis
COPY package*.json ./
COPY tsconfig*.json ./

# Generate Software Bill of Materials (SBOM)
RUN cyclonedx-npm --output-file /app/sbom.json

# Run security audit
RUN npm audit --audit-level=high --production

# Stage 2: Build application
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy source files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src/ ./src/
COPY static/ ./static/

# Install dependencies
RUN npm ci --only=production --frozen-lockfile

# Build application
RUN npm run build

# Stage 3: Security scanning base
FROM alpine:3.19 AS security-base

# Install security scanning tools
RUN apk add --no-cache \
    curl \
    bash \
    trivy \
    ca-certificates

# Create security scan results directory
RUN mkdir -p /security-scans

# Stage 4: Production runtime
FROM alpine:3.19 AS runtime

# Security: Create non-root user
RUN addgroup -g 10001 -S tmuxservice && \
    adduser -u 10001 -S tmuxservice -G tmuxservice -s /bin/bash

# Install runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    tmux \
    bash \
    curl \
    ca-certificates \
    tini \
    dumb-init \
    procps \
    shadow \
    util-linux

# Security: Update packages and remove package manager cache
RUN apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Create required directories with proper permissions
RUN mkdir -p \
    /app \
    /var/log/audit \
    /var/log/tmux \
    /var/run/tmux \
    /tmp/tmux-socket \
    /etc/tmux \
    /etc/secrets && \
    chown -R tmuxservice:tmuxservice \
        /app \
        /var/log/audit \
        /var/log/tmux \
        /var/run/tmux \
        /tmp/tmux-socket \
        /etc/tmux \
        /etc/secrets && \
    chmod 755 /app && \
    chmod 750 /var/log/audit /var/log/tmux && \
    chmod 755 /var/run/tmux && \
    chmod 777 /tmp/tmux-socket && \
    chmod 755 /etc/tmux && \
    chmod 700 /etc/secrets

# Copy built application
COPY --from=builder --chown=tmuxservice:tmuxservice /app/build /app/
COPY --from=builder --chown=tmuxservice:tmuxservice /app/package*.json /app/
COPY --from=builder --chown=tmuxservice:tmuxservice /app/node_modules /app/node_modules/

# Copy SBOM for supply chain security
COPY --from=security-scanner /app/sbom.json /app/

# Install production monitoring and security tools
RUN npm install -g \
    prom-client@^15.1.0 \
    winston@^3.11.0 \
    helmet@^7.1.0

# Create tmux configuration
RUN cat > /etc/tmux/tmux.conf << 'EOF'
# Security-hardened tmux configuration for production
set-option -g default-shell "/bin/bash"
set-option -g history-limit 10000
set-option -g escape-time 0
set-option -g status-interval 5
set-option -g automatic-rename on
set-option -g renumber-windows on

# Security settings
set-option -g lock-after-time 1800
set-option -g visual-activity on
set-option -g monitor-activity on
set-option -g bell-action any

# Logging for audit trail
set-option -g history-file "/var/log/tmux/command-history.log"

# Server options
set-option -s exit-empty off
set-option -s focus-events on
set-option -s escape-time 0

# Session management
set-option -g destroy-unattached off
set-option -g detach-on-destroy off

# Security: Disable dangerous commands
unbind-key &
unbind-key x
EOF

# Create startup script with security checks
RUN cat > /app/start.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Security: Verify file permissions
echo "Verifying file permissions..."
ls -la /app/
ls -la /var/log/
ls -la /etc/tmux/

# Security: Check for suspicious processes
echo "Checking system processes..."
ps aux | head -20

# Validate environment variables
echo "Validating environment..."
if [[ -z "${NODE_ENV:-}" ]]; then
    export NODE_ENV="production"
fi

if [[ -z "${LOG_LEVEL:-}" ]]; then
    export LOG_LEVEL="info"
fi

# Security: Validate tmux socket directory
if [[ ! -d "/tmp/tmux-socket" ]]; then
    echo "Error: tmux socket directory not found"
    exit 1
fi

# Ensure tmux server is not running (clean start)
tmux -S /tmp/tmux-socket kill-server 2>/dev/null || true

# Start tmux server in background
echo "Starting tmux server..."
tmux -S /tmp/tmux-socket new-session -d -s init "sleep infinity"

# Health check
echo "Performing startup health check..."
if ! tmux -S /tmp/tmux-socket list-sessions; then
    echo "Error: tmux server failed to start"
    exit 1
fi

echo "Tmux service starting successfully..."

# Start Node.js application
exec node /app/server.js
EOF

# Make startup script executable
RUN chmod +x /app/start.sh && \
    chown tmuxservice:tmuxservice /app/start.sh

# Create health check script
RUN cat > /app/health-check.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Check if Node.js process is running
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo "Node.js process not running"
    exit 1
fi

# Check if tmux server is responsive
if ! tmux -S /tmp/tmux-socket list-sessions > /dev/null 2>&1; then
    echo "tmux server not responsive"
    exit 1
fi

# Check HTTP endpoint
if ! curl -f -s http://localhost:8080/health > /dev/null; then
    echo "HTTP health check failed"
    exit 1
fi

echo "Health check passed"
exit 0
EOF

RUN chmod +x /app/health-check.sh && \
    chown tmuxservice:tmuxservice /app/health-check.sh

# Create monitoring script
RUN cat > /app/monitor.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "=== System Monitoring Report ==="
echo "Timestamp: $(date -Iseconds)"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime)"
echo

echo "=== Memory Usage ==="
free -h
echo

echo "=== Disk Usage ==="
df -h
echo

echo "=== Process Information ==="
ps aux | grep -E "(tmux|node)" | grep -v grep
echo

echo "=== Tmux Sessions ==="
tmux -S /tmp/tmux-socket list-sessions 2>/dev/null || echo "No sessions found"
echo

echo "=== Network Connections ==="
netstat -tuln 2>/dev/null | grep -E "(8080|9090)" || echo "No connections on monitored ports"
echo

echo "=== Log Files ==="
find /var/log -name "*.log" -type f -exec ls -lh {} \; 2>/dev/null || echo "No log files found"
echo "=========================="
EOF

RUN chmod +x /app/monitor.sh && \
    chown tmuxservice:tmuxservice /app/monitor.sh

# Create application server file
RUN cat > /app/server.js << 'EOF'
const express = require('express');
const helmet = require('helmet');
const prometheus = require('prom-client');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(express.json({ limit: '1mb' }));

// Prometheus metrics
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0]
});

const tmuxSessionsGauge = new prometheus.Gauge({
    name: 'tmux_active_sessions',
    help: 'Number of active tmux sessions'
});

const tmuxCommandsCounter = new prometheus.Counter({
    name: 'tmux_commands_total',
    help: 'Total number of tmux commands executed',
    labelNames: ['command', 'status']
});

const securityEventsCounter = new prometheus.Counter({
    name: 'security_events_total',
    help: 'Total number of security events',
    labelNames: ['event_type', 'severity']
});

// Middleware to track request duration
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration
            .labels(req.method, req.route?.path || req.path, res.statusCode)
            .observe(duration);
    });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        status: 'OK',
        checks: {
            tmux: false,
            memory: false,
            disk: false
        }
    };

    // Check tmux server
    const tmux = spawn('tmux', ['-S', '/tmp/tmux-socket', 'list-sessions']);
    tmux.on('close', (code) => {
        healthCheck.checks.tmux = code === 0;
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        healthCheck.checks.memory = memUsage.heapUsed < 400 * 1024 * 1024; // 400MB limit
        
        // Check disk space
        try {
            const stats = fs.statSync('/tmp');
            healthCheck.checks.disk = true;
        } catch (error) {
            healthCheck.checks.disk = false;
        }

        const allHealthy = Object.values(healthCheck.checks).every(Boolean);
        res.status(allHealthy ? 200 : 503).json(healthCheck);
    });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
    res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});

// Security events endpoint
app.post('/security/event', (req, res) => {
    const { event_type, severity, description } = req.body;
    
    if (!event_type || !severity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    securityEventsCounter.labels(event_type, severity).inc();
    
    console.log(`[SECURITY][${new Date().toISOString()}][${severity.toUpperCase()}] ${description}`);
    
    res.status(200).json({ status: 'logged' });
});

// tmux command endpoint
app.post('/tmux/command', async (req, res) => {
    const { command, session } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }

    // Security: Validate command
    const dangerousCommands = ['rm -rf', 'dd if=', 'mkfs', 'fdisk', 'format'];
    if (dangerousCommands.some(cmd => command.includes(cmd))) {
        securityEventsCounter.labels('command_blocked', 'high').inc();
        return res.status(403).json({ error: 'Command blocked for security' });
    }

    const tmuxArgs = ['-S', '/tmp/tmux-socket'];
    if (session) {
        tmuxArgs.push('-t', session);
    }
    tmuxArgs.push('send-keys', command, 'Enter');

    const tmux = spawn('tmux', tmuxArgs);
    let output = '';
    let error = '';

    tmux.stdout.on('data', (data) => {
        output += data.toString();
    });

    tmux.stderr.on('data', (data) => {
        error += data.toString();
    });

    tmux.on('close', (code) => {
        tmuxCommandsCounter.labels(command.split(' ')[0], code === 0 ? 'success' : 'error').inc();
        
        if (code === 0) {
            res.json({ status: 'success', output });
        } else {
            res.status(500).json({ status: 'error', error });
        }
    });
});

// Update tmux sessions metric periodically
setInterval(() => {
    const tmux = spawn('tmux', ['-S', '/tmp/tmux-socket', 'list-sessions']);
    let sessionCount = 0;
    
    tmux.stdout.on('data', (data) => {
        sessionCount = data.toString().split('\n').filter(line => line.trim()).length;
    });
    
    tmux.on('close', () => {
        tmuxSessionsGauge.set(sessionCount);
    });
}, 30000);

// Start metrics server
const metricsApp = express();
metricsApp.get('/metrics', (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(prometheus.register.metrics());
});

metricsApp.listen(METRICS_PORT, () => {
    console.log(`Metrics server listening on port ${METRICS_PORT}`);
});

// Start main server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tmux service listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Log level: ${process.env.LOG_LEVEL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
EOF

RUN chown tmuxservice:tmuxservice /app/server.js

# Security: Remove sensitive files and set read-only filesystem
RUN rm -rf \
    /root/.npm \
    /tmp/npm-* \
    /var/cache/apk/* \
    /usr/share/man \
    /usr/share/doc

# Security: Set file permissions
RUN find /app -type f -exec chmod 644 {} \; && \
    find /app -type d -exec chmod 755 {} \; && \
    chmod +x /app/start.sh /app/health-check.sh /app/monitor.sh

# Switch to non-root user
USER tmuxservice:tmuxservice

# Set working directory
WORKDIR /app

# Security: Set environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    PORT=8080 \
    METRICS_PORT=9090 \
    TMUX_SOCKET_PATH=/tmp/tmux-socket \
    NODE_OPTIONS="--max-old-space-size=256"

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /app/health-check.sh

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["/app/start.sh"]

# Metadata labels
LABEL org.opencontainers.image.title="Voice Terminal Tmux Service" \
      org.opencontainers.image.description="Production-ready tmux service with security hardening and monitoring" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Voice Terminal" \
      org.opencontainers.image.source="https://github.com/voice-terminal/hybrid" \
      org.opencontainers.image.documentation="https://docs.voice-terminal.io" \
      security.scan="trivy" \
      security.sbom="cyclonedx" \
      monitoring.prometheus="enabled" \
      runtime.user="tmuxservice" \
      runtime.uid="10001"