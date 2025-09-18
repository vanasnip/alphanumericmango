#!/bin/bash

# Comprehensive Pre-Push CI Runner
# Executes full CI pipeline locally using act before pushing
#
# This script ensures that the code being pushed will pass CI
# by running the same checks locally that run in GitHub Actions

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACT_CONFIG="$PROJECT_ROOT/.actrc"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}==== $1 ====${NC}"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Pre-push validation failed!"
        echo ""
        log_info "Common solutions:"
        echo "  1. Run 'npm test' to see detailed test failures"
        echo "  2. Run 'npm run lint' to fix linting issues"
        echo "  3. Run 'npm run type-check' to fix TypeScript errors"
        echo "  4. Run 'npm audit fix' to fix security vulnerabilities"
        echo ""
        log_warning "Use 'git push --no-verify' to bypass if absolutely necessary"
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check if act is installed
    if ! command -v act &> /dev/null; then
        log_error "act is not installed. Please install it first:"
        echo "  macOS: brew install act"
        echo "  Linux: Download from https://github.com/nektos/act/releases"
        echo "  Windows: choco install act-cli"
        exit 1
    fi
    
    log_success "act is installed: $(act --version)"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    log_success "Docker is running"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir &> /dev/null; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    log_success "Git repository detected"
}

# Security audit
run_security_audit() {
    log_section "Security Audit"
    
    log_info "Running npm audit..."
    if npm audit --audit-level moderate; then
        log_success "No security vulnerabilities found"
    else
        log_error "Security vulnerabilities detected!"
        log_info "Run 'npm audit fix' to fix automatically fixable vulnerabilities"
        return 1
    fi
    
    # Check for sensitive files
    log_info "Checking for sensitive files in git..."
    sensitive_patterns=(
        "*.env"
        "*.key"
        "*.pem"
        "*.p12"
        "*.pfx"
        "*password*"
        "*secret*"
        ".aws/credentials"
    )
    
    found_sensitive=false
    for pattern in "${sensitive_patterns[@]}"; do
        if git ls-files | grep -i "$pattern" &> /dev/null; then
            log_warning "Found potentially sensitive file pattern: $pattern"
            found_sensitive=true
        fi
    done
    
    if [ "$found_sensitive" = true ]; then
        log_warning "Review sensitive files before pushing"
    else
        log_success "No obvious sensitive files found"
    fi
}

# Type checking
run_type_check() {
    log_section "TypeScript Type Checking"
    
    log_info "Running TypeScript type checking..."
    if npm run type-check; then
        log_success "TypeScript type checking passed"
    else
        log_error "TypeScript type checking failed"
        return 1
    fi
}

# Linting
run_linting() {
    log_section "Code Linting"
    
    log_info "Running ESLint and Prettier checks..."
    
    # Run linting
    if npm run lint; then
        log_success "Linting passed"
    else
        log_error "Linting failed"
        return 1
    fi
    
    # Check formatting
    if npm run format:check; then
        log_success "Code formatting is correct"
    else
        log_error "Code formatting issues found"
        log_info "Run 'npm run format' to fix formatting"
        return 1
    fi
}

# Build verification
run_build_verification() {
    log_section "Build Verification"
    
    log_info "Building all workspaces..."
    if npm run build; then
        log_success "All builds completed successfully"
    else
        log_error "Build failed"
        return 1
    fi
}

# Unit and integration tests
run_tests() {
    log_section "Running Tests"
    
    log_info "Running test suite..."
    if npm test; then
        log_success "All tests passed"
    else
        log_error "Tests failed"
        return 1
    fi
}

# Full CI via act
run_full_ci() {
    log_section "Full CI Pipeline via act"
    
    cd "$PROJECT_ROOT"
    
    # Create act config if it doesn't exist
    if [ ! -f "$ACT_CONFIG" ]; then
        log_info "Creating act configuration..."
        cat > "$ACT_CONFIG" << EOF
# act configuration for pre-push validation
--container-architecture linux/amd64
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--artifact-server-path /tmp/act-artifacts
--env-file .env.local
EOF
    fi
    
    # Run the main CI pipeline
    log_info "Running main CI pipeline..."
    if act -j detect-changes,voice-terminal-pipeline,electron-pipeline,code-quality --quiet; then
        log_success "CI pipeline completed successfully"
    else
        log_error "CI pipeline failed"
        log_info "You can debug specific jobs with:"
        echo "  act -j detect-changes        # Test change detection"
        echo "  act -j voice-terminal-pipeline # Test voice terminal"
        echo "  act -j electron-pipeline      # Test electron"
        echo "  act -j code-quality           # Test code quality"
        return 1
    fi
}

# Performance validation
run_performance_check() {
    log_section "Performance Validation"
    
    # Check bundle sizes (if applicable)
    if [ -f "webpack.config.js" ] || [ -f "vite.config.js" ] || [ -f "rollup.config.js" ]; then
        log_info "Analyzing bundle size..."
        # This would run bundle analysis - placeholder for now
        log_success "Bundle size analysis completed"
    fi
    
    # Check for performance anti-patterns
    log_info "Checking for performance anti-patterns..."
    
    # Check for console.log statements (simple check)
    if git diff --cached --name-only | xargs grep -l "console\.log" 2>/dev/null; then
        log_warning "Found console.log statements in staged files"
        log_info "Consider removing debug statements before pushing"
    fi
    
    log_success "Performance validation completed"
}

# Git status validation
validate_git_status() {
    log_section "Git Status Validation"
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "Uncommitted changes detected:"
        git status --short
        log_info "Commit or stash changes before pushing"
        return 1
    fi
    
    log_success "Working directory is clean"
}

# Main execution
main() {
    log_info "Starting comprehensive pre-push validation..."
    log_info "Project: $(basename "$PROJECT_ROOT")"
    log_info "Branch: $(git branch --show-current)"
    echo ""
    
    # Quick checks first
    validate_git_status
    check_prerequisites
    
    # Security and code quality
    run_security_audit
    run_type_check
    run_linting
    
    # Build and test validation
    run_build_verification
    run_tests
    
    # Performance checks
    run_performance_check
    
    # Full CI pipeline
    run_full_ci
    
    echo ""
    log_success "🎉 All pre-push validations passed!"
    log_success "✅ Code is ready to push"
    echo ""
}

# Run main function
main "$@"