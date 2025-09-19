# GitHub Actions with Act - Local Execution Guide

This guide explains how to use the optimized GitHub Actions workflows with [act](https://github.com/nektos/act) for fast local development and testing.

## Prerequisites

### Install act
```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (using Chocolatey)
choco install act-cli

# Or download from releases
# https://github.com/nektos/act/releases
```

### Install Docker
Act requires Docker to run containers that simulate GitHub Actions runners.

## Quick Start

### 1. Basic Workflow Execution

Run the main CI/CD pipeline:
```bash
act
```

Run specific workflows:
```bash
# Voice terminal hybrid workflow
act -j voice-terminal-pipeline

# Electron shell workflow  
act -j electron-pipeline

# Just linting and type checking
act -j lint-and-check
```

### 2. Project-Specific Commands

**Voice Terminal Hybrid:**
```bash
# Basic run (lint, test, build only)
act -j lint-and-check,unit-tests,build

# Include E2E tests
act -j lint-and-check,unit-tests,e2e-tests,build -s RUN_E2E_TESTS=true

# Include all tests
act -s RUN_E2E_TESTS=true -s RUN_ACCESSIBILITY_TESTS=true -s RUN_PERFORMANCE_TESTS=true
```

**Electron Shell:**
```bash
# Basic build and test
act -j build-and-test

# Include packaging
act -j build-and-test,package-electron -s RUN_PACKAGING=true

# Include security scan
act -j build-and-test,security-scan -s RUN_SECURITY_SCAN=true
```

### 3. Workflow-Specific Commands

**Test Matrix:**
```bash
# Run simplified test matrix
act workflow_call --input project=voice-terminal-hybrid

# Run with electron project
act workflow_call --input project=electron-shell
```

**Cache Optimization:**
```bash
# Run local cache optimization
act workflow_call -j optimize-local-cache
```

**Artifact Management:**
```bash
# Manage build artifacts locally
act workflow_call --input artifact-type=build --input project=voice-terminal-hybrid

# Manage test artifacts
act workflow_call --input artifact-type=test --input project=voice-terminal-hybrid
```

**Deployment Simulation:**
```bash
# Simulate deployment to development
act workflow_call --input environment=development --input project=voice-terminal-hybrid

# Simulate production deployment
act workflow_call --input environment=production --input project=electron-shell
```

## Local Optimizations

### Performance Features
- **Single Platform**: Only runs on `ubuntu-latest` to avoid cross-platform overhead
- **Single Node Version**: Uses Node.js 20 only (instead of matrix with 18 and 20)
- **Local Caching**: Uses `node_modules` caching instead of GitHub's npm cache
- **Minimal Browsers**: Installs only Chromium for Playwright tests
- **Optimized Installs**: Uses `npm install` with `--prefer-offline --no-audit --no-fund`

### Skipped Operations
The following expensive operations are automatically skipped in act:
- External service integrations (SonarCloud, Codecov, Percy)
- Artifact uploads to GitHub
- Cross-platform builds (Windows, macOS)
- Deployment to external services
- Security scans requiring external APIs
- Email/Slack notifications

### Environment Detection
Workflows automatically detect act execution using:
```yaml
env:
  ACT_EXECUTION: ${{ github.actor || 'false' }}

# Usage in jobs
if: github.actor != 'nektos/act'  # Skip in act
if: github.actor == 'nektos/act'  # Only run in act

# In shell scripts within steps
if [ "$ACT_EXECUTION" = "nektos/act" ]; then
  echo "Running in act"
fi
```

## Advanced Usage

### Custom Variables
Note: Due to act limitations, environment variables can't be used in job conditions. 
However, you can still control behavior through:

```bash
# Run specific jobs only
act -j lint-and-check,unit-tests,build

# Run E2E tests (they're normally skipped in act)
act -j e2e-tests

# Run specific matrix combinations
act -j build-and-test  # For electron builds

# Run deployment simulation
act workflow_call --input environment=development --input project=voice-terminal-hybrid
```

### Docker Images
Use specific Docker images for different runners:
```bash
# Use Ubuntu 20.04 (faster)
act -P ubuntu-latest=node:20-bullseye

# Use larger image with more tools
act -P ubuntu-latest=catthehacker/ubuntu:act-latest

# Use minimal image
act -P ubuntu-latest=node:20-alpine
```

### Debugging
```bash
# Verbose output
act -v

# Very verbose output
act -vv

# Dry run (show what would execute)
act --dry-run

# List available workflows
act -l

# Run specific event
act push
act pull_request
act workflow_dispatch
```

### Local Secrets
Create `.secrets` file for testing:
```bash
# .secrets
GITHUB_TOKEN=your_token_here
NPM_TOKEN=your_npm_token_here
```

Use with act:
```bash
act --secret-file .secrets
```

## Troubleshooting

### Common Issues

**Docker permission errors:**
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Logout and login again
```

**Out of disk space:**
```bash
# Clean Docker
docker system prune -a

# Clean act cache
act --rm
```

**Network issues:**
```bash
# Use host network
act --network host

# Skip TLS verification (if needed)
act --insecure-secrets
```

**Memory issues:**
```bash
# Increase Docker memory limit in Docker Desktop
# Or use smaller Docker images
act -P ubuntu-latest=node:20-alpine
```

### Performance Tips

1. **Use Docker BuildKit** for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   ```

2. **Pre-pull Docker images**:
   ```bash
   docker pull node:20-bullseye
   docker pull catthehacker/ubuntu:act-latest
   ```

3. **Use local Docker registry** for frequently used images

4. **Limit concurrent jobs**:
   ```bash
   act --parallel=false
   ```

## File Structure After Act Runs

Act creates local directories for development:
```
project/
├── .npm-cache/           # Local npm cache
├── local-artifacts/      # Local artifact storage
│   ├── voice-terminal-hybrid/
│   ├── electron-shell/
│   └── metadata/
├── node_modules/         # Cached dependencies
└── .cache-info.json      # Cache metadata
```

## Comparison: Act vs GitHub Actions

| Feature | Act (Local) | GitHub Actions |
|---------|-------------|----------------|
| Speed | Fast (local) | Medium (remote) |
| Cost | Free | Usage-based |
| Secrets | Local file | GitHub Secrets |
| Artifacts | Local storage | GitHub Storage |
| Matrix builds | Simplified | Full matrix |
| External services | Simulated | Real integration |
| Debugging | Direct access | Log-based |
| Caching | Local disk | GitHub cache |

## Best Practices

1. **Develop locally with act**, deploy with GitHub Actions
2. **Use act for rapid iteration** on workflow changes
3. **Test full workflows on GitHub Actions** before merging
4. **Keep secrets in `.secrets` file** (don't commit)
5. **Clean up Docker regularly** to avoid disk space issues
6. **Use lightweight Docker images** for faster execution
7. **Parallelize independent jobs** where possible

## Example Workflow

Typical development workflow:
```bash
# 1. Make code changes
git add .

# 2. Test locally with act
act -j lint-and-check,unit-tests,build

# 3. If tests pass, test E2E locally (optional)
act -j e2e-tests -s RUN_E2E_TESTS=true

# 4. Commit and push
git commit -m "feat: add new feature"
git push

# 5. GitHub Actions runs full workflow with all tests
```

This approach gives you fast feedback locally while ensuring comprehensive testing in the cloud.