# Pre-Push Hook System Guide

This project includes a comprehensive pre-push hook system that runs full CI validation locally before allowing pushes to remote repositories.

## Overview

The pre-push hook system ensures code quality by running the complete CI pipeline locally using `act` (GitHub Actions runner) before pushing changes. This catches issues early and prevents CI failures in the remote repository.

## Components

### 1. Pre-Push Hook (`.husky/pre-push`)
- Automatically triggered before `git push`
- Calls the comprehensive CI runner script
- Provides clear feedback on failures
- Can be bypassed with `--no-verify` for emergencies

### 2. CI Runner Script (`scripts/pre-push-ci.sh`)
- Comprehensive validation including:
  - Git status validation (no uncommitted changes)
  - Security audit (`npm audit`)
  - TypeScript type checking
  - Code linting and formatting
  - Build verification
  - Unit and integration tests
  - Full CI pipeline via `act`
  - Performance validation

### 3. NPM Scripts
```bash
# Run full pre-push validation
npm run ci:local
npm run validate:pre-push

# Run specific GitHub Actions jobs
npm run ci:act                    # Run all jobs
npm run ci:act:main              # Main CI pipeline
npm run ci:act:voice             # Voice terminal pipeline
npm run ci:act:electron          # Electron pipeline
npm run ci:act:quality           # Code quality checks

# Test and audit commands
npm run ci:test                  # List available jobs
npm run audit:security          # Security audit only
```

## Usage

### Normal Workflow
1. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

2. Push changes (pre-push hook runs automatically):
   ```bash
   git push origin your-branch
   ```

3. If validation fails, fix issues and try again.

### Manual Validation
Run the validation manually before committing:
```bash
npm run ci:local
```

### Emergency Bypass
In urgent situations, you can bypass the pre-push validation:
```bash
git push --no-verify origin your-branch
```

**⚠️ Warning**: Only use `--no-verify` when absolutely necessary, as it skips all quality checks.

## What Gets Validated

### 1. Git Status
- Ensures all changes are committed
- No uncommitted or untracked files (except allowed patterns)

### 2. Security
- NPM security audit for vulnerabilities
- Check for sensitive files in git
- Validate environment configurations

### 3. Code Quality
- TypeScript type checking
- ESLint linting
- Prettier formatting
- Code style consistency

### 4. Build Verification
- All workspace builds succeed
- No build errors or warnings
- Dependency resolution

### 5. Testing
- Unit tests pass
- Integration tests pass
- Test coverage requirements met

### 6. Performance
- Bundle size analysis (if applicable)
- Performance anti-pattern detection
- Resource usage validation

### 7. Full CI Pipeline
- Runs complete GitHub Actions workflow via `act`
- Simulates the exact CI environment
- Validates all pipeline steps

## Configuration

### Act Configuration (`.actrc`)
```bash
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--container-architecture linux/amd64
--artifact-server-path /tmp/act-artifacts
--env-file .env.local
--reuse
```

### Environment Variables (`.env.local`)
Create from `.env.local.example`:
```bash
cp .env.local.example .env.local
# Edit .env.local with your local configuration
```

## Troubleshooting

### Common Issues

#### 1. Act Not Installed
```bash
# macOS
brew install act

# Linux
# Download from https://github.com/nektos/act/releases

# Windows
choco install act-cli
```

#### 2. Docker Not Running
```bash
# Start Docker Desktop or Docker daemon
# Verify with: docker info
```

#### 3. Long Execution Time
The pre-push validation can take 2-5 minutes. For faster feedback:
```bash
# Run specific validations only
npm run lint
npm run test
npm run type-check

# Or run act with specific jobs
npm run ci:act:quality
```

#### 4. Memory Issues
If act runs out of memory:
```bash
# Add to .actrc
--container-options "--memory=4g"
```

#### 5. Permission Errors
```bash
# Ensure scripts are executable
chmod +x scripts/pre-push-ci.sh
chmod +x .husky/pre-push
```

### Debug Mode
Enable verbose output in `.actrc`:
```bash
# Uncomment this line in .actrc
--verbose
```

## Customization

### Modify Validation Steps
Edit `scripts/pre-push-ci.sh` to:
- Add custom validation steps
- Modify security checks
- Configure performance thresholds
- Adjust CI pipeline selection

### Skip Specific Validations
Set environment variables to skip steps:
```bash
export SKIP_SECURITY_AUDIT=true
export SKIP_TYPE_CHECK=true
export SKIP_FULL_CI=true
```

### Project-Specific Configuration
Each workspace can have its own validation rules by adding scripts to workspace `package.json`:
```json
{
  "scripts": {
    "validate:pre-push": "custom-validation-script"
  }
}
```

## Performance Tips

1. **Use Container Reuse**: Keep `--reuse` in `.actrc`
2. **Incremental Builds**: Leverage npm workspace caching
3. **Parallel Execution**: Act runs jobs in parallel when possible
4. **Selective Jobs**: Run only changed components via `npm run ci:act:voice`
5. **Local Caching**: Keep Docker images cached locally

## Integration with IDE

### VS Code
Add to `.vscode/tasks.json`:
```json
{
  "label": "Validate Pre-Push",
  "type": "shell",
  "command": "npm run ci:local",
  "group": "test",
  "presentation": {
    "echo": true,
    "reveal": "always",
    "panel": "new"
  }
}
```

### Terminal Aliases
Add to your shell configuration:
```bash
alias validate="npm run ci:local"
alias quick-check="npm run lint && npm run test"
```

## CI/CD Integration

This pre-push system is designed to mirror the actual CI/CD pipeline:
- Same Node.js version
- Same test commands
- Same build process
- Same quality gates

When the pre-push validation passes, the remote CI should also pass, reducing pipeline failures and improving development velocity.

## Best Practices

1. **Run validation frequently** during development
2. **Fix issues immediately** rather than accumulating technical debt
3. **Use bypass sparingly** and only for true emergencies
4. **Keep validation fast** by optimizing scripts and using caches
5. **Monitor execution time** and optimize bottlenecks
6. **Update validation rules** as the project evolves

## Support

If you encounter issues with the pre-push system:
1. Check this guide for common solutions
2. Run `npm run ci:test` to verify act configuration
3. Review the GitHub Actions workflows in `.github/workflows/`
4. Check Docker and act logs for detailed error information

---

**Remember**: The pre-push hook is designed to catch issues early and maintain code quality. While it may seem like extra overhead initially, it saves significant time by preventing CI failures and reducing the need for fix-up commits.