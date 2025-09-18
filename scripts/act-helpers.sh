#!/bin/bash
# Act Helper Scripts for alphanumeric-issue24-ci
# Debugging and utility functions for local GitHub Actions testing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACT_EVENTS_DIR="$PROJECT_ROOT/.github/act-events"
ACT_CACHE_DIR="$PROJECT_ROOT/.act-cache"
ARTIFACTS_DIR="/tmp/act-artifacts"

# ==========================================
# UTILITY FUNCTIONS
# ==========================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [[ "${ACT_DEBUG:-false}" == "true" ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $1"
    fi
}

# Check if act is installed
check_act_installed() {
    if ! command -v act &> /dev/null; then
        log_error "act is not installed. Please install it first:"
        echo "  brew install act  # macOS"
        echo "  # or visit: https://github.com/nektos/act"
        exit 1
    fi
}

# Check if Docker is running
check_docker_running() {
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Setup environment files if they don't exist
setup_env_files() {
    local env_file="$PROJECT_ROOT/.env.ci"
    local env_example="$PROJECT_ROOT/.env.ci.example"
    
    if [[ ! -f "$env_file" ]] && [[ -f "$env_example" ]]; then
        log_warn ".env.ci not found. Creating from example..."
        cp "$env_example" "$env_file"
        log_info "Please edit .env.ci with your actual values before running act"
    fi
}

# Create directories if they don't exist
setup_directories() {
    mkdir -p "$ACT_CACHE_DIR"
    mkdir -p "$ARTIFACTS_DIR"
    log_debug "Created cache and artifact directories"
}

# ==========================================
# ACT COMMAND WRAPPERS
# ==========================================

# List all available workflows
act_list_workflows() {
    log_info "Available workflows:"
    check_act_installed
    cd "$PROJECT_ROOT"
    act --list
}

# List all available jobs
act_list_jobs() {
    log_info "Available jobs:"
    check_act_installed
    cd "$PROJECT_ROOT"
    act --list --graph
}

# Dry run to check configuration
act_dry_run() {
    local event_type="${1:-push}"
    local event_file="$ACT_EVENTS_DIR/${event_type}.json"
    
    log_info "Running dry run for $event_type event..."
    check_act_installed
    check_docker_running
    setup_env_files
    setup_directories
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "$event_file" ]]; then
        act "$event_type" -e "$event_file" --dryrun
    else
        log_warn "Event file $event_file not found, using default event"
        act "$event_type" --dryrun
    fi
}

# Run specific job with verbose output
act_debug_job() {
    local job_name="$1"
    local event_type="${2:-push}"
    local event_file="$ACT_EVENTS_DIR/${event_type}.json"
    
    log_info "Debugging job: $job_name with event: $event_type"
    check_act_installed
    check_docker_running
    setup_env_files
    setup_directories
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "$event_file" ]]; then
        act "$event_type" -e "$event_file" -j "$job_name" --verbose
    else
        log_warn "Event file $event_file not found, using default event"
        act "$event_type" -j "$job_name" --verbose
    fi
}

# Interactive shell in act container
act_shell() {
    local job_name="$1"
    local event_type="${2:-push}"
    local event_file="$ACT_EVENTS_DIR/${event_type}.json"
    
    log_info "Starting interactive shell for job: $job_name"
    check_act_installed
    check_docker_running
    setup_env_files
    setup_directories
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "$event_file" ]]; then
        act "$event_type" -e "$event_file" -j "$job_name" --shell
    else
        log_warn "Event file $event_file not found, using default event"
        act "$event_type" -j "$job_name" --shell
    fi
}

# ==========================================
# TESTING SCENARIOS
# ==========================================

# Test all main workflows
act_test_all() {
    log_info "Testing all main workflows..."
    
    local events=("push" "pull_request")
    local exit_code=0
    
    for event in "${events[@]}"; do
        log_info "Testing $event workflow..."
        if act_dry_run "$event"; then
            log_success "$event workflow test passed"
        else
            log_error "$event workflow test failed"
            exit_code=1
        fi
    done
    
    return $exit_code
}

# Test specific workspace pipeline
act_test_workspace() {
    local workspace="$1"
    local event_type="${2:-push}"
    
    case "$workspace" in
        "voice-terminal"|"voice")
            act_debug_job "voice-terminal-pipeline" "$event_type"
            ;;
        "electron"|"electron-shell")
            act_debug_job "electron-pipeline" "$event_type"
            ;;
        "quality"|"code-quality")
            act_debug_job "code-quality" "$event_type"
            ;;
        *)
            log_error "Unknown workspace: $workspace"
            log_info "Available workspaces: voice-terminal, electron, quality"
            exit 1
            ;;
    esac
}

# ==========================================
# CACHE AND CLEANUP
# ==========================================

# Clean act cache and artifacts
act_clean() {
    log_info "Cleaning act cache and artifacts..."
    
    if [[ -d "$ACT_CACHE_DIR" ]]; then
        rm -rf "$ACT_CACHE_DIR"
        log_success "Removed act cache directory"
    fi
    
    if [[ -d "$ARTIFACTS_DIR" ]]; then
        rm -rf "$ARTIFACTS_DIR"
        log_success "Removed artifacts directory"
    fi
    
    # Clean Docker containers and images used by act
    log_info "Cleaning Docker resources..."
    docker container prune -f --filter "label=act" || true
    docker image prune -f --filter "label=act" || true
    
    log_success "Cleanup completed"
}

# Show cache and artifact sizes
act_status() {
    log_info "Act status and resource usage:"
    
    echo
    echo -e "${CYAN}Cache Directory:${NC} $ACT_CACHE_DIR"
    if [[ -d "$ACT_CACHE_DIR" ]]; then
        du -sh "$ACT_CACHE_DIR" 2>/dev/null || echo "  Empty or inaccessible"
    else
        echo "  Does not exist"
    fi
    
    echo
    echo -e "${CYAN}Artifacts Directory:${NC} $ARTIFACTS_DIR"
    if [[ -d "$ARTIFACTS_DIR" ]]; then
        du -sh "$ARTIFACTS_DIR" 2>/dev/null || echo "  Empty or inaccessible"
    else
        echo "  Does not exist"
    fi
    
    echo
    echo -e "${CYAN}Docker Resources:${NC}"
    docker images --filter "label=act" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || echo "  No act-related Docker images found"
    
    echo
    echo -e "${CYAN}Environment Files:${NC}"
    if [[ -f "$PROJECT_ROOT/.env.ci" ]]; then
        echo -e "  ${GREEN}✓${NC} .env.ci exists"
    else
        echo -e "  ${YELLOW}!${NC} .env.ci missing (will use .env.ci.example)"
    fi
    
    if [[ -f "$PROJECT_ROOT/.secrets.ci" ]]; then
        echo -e "  ${GREEN}✓${NC} .secrets.ci exists"
    else
        echo -e "  ${YELLOW}!${NC} .secrets.ci missing (optional)"
    fi
}

# ==========================================
# MAIN COMMAND DISPATCHER
# ==========================================

show_help() {
    cat << EOF
Act Helper Script for alphanumeric-issue24-ci

USAGE:
    $0 <command> [arguments]

COMMANDS:
    list                List all available workflows
    jobs                List all available jobs with graph
    dry-run [event]     Perform dry run (default: push)
    debug <job> [event] Debug specific job with verbose output
    shell <job> [event] Start interactive shell in job container
    
    test-all            Test all main workflows
    test <workspace>    Test specific workspace (voice-terminal|electron|quality)
    
    clean               Clean cache and artifacts
    status              Show cache status and resource usage
    
    help                Show this help message

EXAMPLES:
    $0 list                                    # List all workflows
    $0 dry-run push                           # Dry run push event
    $0 debug voice-terminal-pipeline          # Debug voice terminal job
    $0 shell electron-pipeline pull_request   # Interactive shell for electron job
    $0 test voice-terminal                    # Test voice terminal workspace
    $0 clean                                  # Clean up cache and artifacts

ENVIRONMENT VARIABLES:
    ACT_DEBUG=true      Enable debug output
    ACT_VERBOSE=true    Enable verbose act output

FILES:
    .env.ci            Local environment variables (create from .env.ci.example)
    .secrets.ci        Local secrets (optional)
    .actrc             Act configuration file

EVENT PAYLOADS:
    .github/act-events/push.json             Push event
    .github/act-events/pull_request.json     Pull request event
    .github/act-events/workflow_dispatch.json Manual trigger event
    .github/act-events/schedule.json         Scheduled event
    .github/act-events/release.json          Release event

For more information, see: https://github.com/nektos/act
EOF
}

# Main command dispatcher
main() {
    case "${1:-help}" in
        "list"|"ls")
            act_list_workflows
            ;;
        "jobs"|"graph")
            act_list_jobs
            ;;
        "dry-run"|"dryrun"|"dry")
            act_dry_run "${2:-push}"
            ;;
        "debug"|"dbg")
            if [[ -z "${2:-}" ]]; then
                log_error "Job name required for debug command"
                echo "Usage: $0 debug <job_name> [event_type]"
                exit 1
            fi
            act_debug_job "$2" "${3:-push}"
            ;;
        "shell"|"sh")
            if [[ -z "${2:-}" ]]; then
                log_error "Job name required for shell command"
                echo "Usage: $0 shell <job_name> [event_type]"
                exit 1
            fi
            act_shell "$2" "${3:-push}"
            ;;
        "test-all"|"test_all")
            act_test_all
            ;;
        "test")
            if [[ -z "${2:-}" ]]; then
                log_error "Workspace name required for test command"
                echo "Usage: $0 test <workspace>"
                exit 1
            fi
            act_test_workspace "$2" "${3:-push}"
            ;;
        "clean"|"cleanup")
            act_clean
            ;;
        "status"|"info")
            act_status
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"