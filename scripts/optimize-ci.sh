#!/bin/bash

# =============================================================================
# CI Optimization Script for alphanumeric-issue24-ci
# =============================================================================
# This script optimizes local CI runs by managing caches, reusing artifacts,
# and minimizing Docker operations for faster development cycles.

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly CACHE_DIR="${PROJECT_ROOT}/.cache"
readonly ACT_CACHE_DIR="${PROJECT_ROOT}/.act-cache"
readonly ARTIFACTS_DIR="/tmp/act-artifacts"
readonly PERFORMANCE_LOG="${CACHE_DIR}/performance.log"

# Cache subdirectories
readonly NODE_MODULES_CACHE="${CACHE_DIR}/node_modules"
readonly PLAYWRIGHT_CACHE="${CACHE_DIR}/playwright"
readonly DOCKER_CACHE="${CACHE_DIR}/docker"
readonly NPM_CACHE="${CACHE_DIR}/npm"

# Performance tracking
START_TIME=""
OPERATION=""

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $*" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

debug() {
    if [[ "${DEBUG:-0}" == "1" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*" >&2
    fi
}

start_timer() {
    START_TIME=$(date +%s)
    OPERATION="$1"
    log "Starting: $OPERATION"
}

end_timer() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    log "Completed: $OPERATION (${duration}s)"
    
    # Log performance data
    echo "$(date +'%Y-%m-%d %H:%M:%S'),$OPERATION,$duration" >> "$PERFORMANCE_LOG"
}

check_dependencies() {
    local missing_deps=()
    
    command -v node >/dev/null 2>&1 || missing_deps+=("node")
    command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
    command -v act >/dev/null 2>&1 || missing_deps+=("act")
    command -v docker >/dev/null 2>&1 || missing_deps+=("docker")
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error "Missing dependencies: ${missing_deps[*]}"
        return 1
    fi
}

# =============================================================================
# CACHE INITIALIZATION
# =============================================================================

init_cache_directories() {
    start_timer "Cache directory initialization"
    
    local cache_dirs=(
        "$CACHE_DIR"
        "$NODE_MODULES_CACHE"
        "$PLAYWRIGHT_CACHE"
        "$DOCKER_CACHE"
        "$NPM_CACHE"
        "$ACT_CACHE_DIR"
        "$ARTIFACTS_DIR"
    )
    
    for dir in "${cache_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            debug "Created cache directory: $dir"
        fi
    done
    
    # Initialize performance log with headers if it doesn't exist
    if [[ ! -f "$PERFORMANCE_LOG" ]]; then
        echo "timestamp,operation,duration_seconds" > "$PERFORMANCE_LOG"
    fi
    
    end_timer
}

# =============================================================================
# NODE_MODULES CACHING
# =============================================================================

cache_node_modules() {
    start_timer "Node modules caching"
    
    local workspaces=("." "electron-shell" "voice-terminal-components/voice-terminal-components" "voice-terminal-hybrid")
    
    for workspace in "${workspaces[@]}"; do
        local workspace_path="${PROJECT_ROOT}/${workspace}"
        local node_modules_path="${workspace_path}/node_modules"
        local cache_key="${workspace//\//_}"
        local cached_modules="${NODE_MODULES_CACHE}/${cache_key}"
        
        if [[ -d "$node_modules_path" ]]; then
            # Check if cache is outdated by comparing package.json
            local package_json="${workspace_path}/package.json"
            local cache_marker="${cached_modules}/.cache_marker"
            
            if [[ ! -f "$cache_marker" ]] || [[ "$package_json" -nt "$cache_marker" ]]; then
                log "Caching node_modules for workspace: $workspace"
                
                # Create/update cache
                rm -rf "$cached_modules"
                cp -r "$node_modules_path" "$cached_modules"
                touch "$cache_marker"
                
                debug "Cached node_modules: $node_modules_path -> $cached_modules"
            else
                debug "Cache up-to-date for workspace: $workspace"
            fi
        fi
    done
    
    end_timer
}

restore_node_modules() {
    start_timer "Node modules restoration"
    
    local workspaces=("." "electron-shell" "voice-terminal-components/voice-terminal-components" "voice-terminal-hybrid")
    
    for workspace in "${workspaces[@]}"; do
        local workspace_path="${PROJECT_ROOT}/${workspace}"
        local node_modules_path="${workspace_path}/node_modules"
        local cache_key="${workspace//\//_}"
        local cached_modules="${NODE_MODULES_CACHE}/${cache_key}"
        
        if [[ -d "$cached_modules" && ! -d "$node_modules_path" ]]; then
            log "Restoring node_modules for workspace: $workspace"
            cp -r "$cached_modules" "$node_modules_path"
            debug "Restored: $cached_modules -> $node_modules_path"
        fi
    done
    
    end_timer
}

# =============================================================================
# PLAYWRIGHT BROWSER CACHING
# =============================================================================

cache_playwright_browsers() {
    start_timer "Playwright browser caching"
    
    # Check if Playwright is installed in any workspace
    local playwright_found=false
    local workspaces=("." "electron-shell" "voice-terminal-components/voice-terminal-components" "voice-terminal-hybrid")
    
    for workspace in "${workspaces[@]}"; do
        local package_json="${PROJECT_ROOT}/${workspace}/package.json"
        if [[ -f "$package_json" ]] && grep -q "playwright" "$package_json"; then
            playwright_found=true
            break
        fi
    done
    
    if [[ "$playwright_found" == "true" ]]; then
        # Set Playwright cache directory
        export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_CACHE"
        
        # Install browsers if not cached
        if [[ ! -d "$PLAYWRIGHT_CACHE" ]] || [[ -z "$(ls -A "$PLAYWRIGHT_CACHE" 2>/dev/null)" ]]; then
            log "Installing Playwright browsers to cache"
            npx playwright install
        else
            debug "Playwright browsers already cached"
        fi
    else
        debug "Playwright not found in project"
    fi
    
    end_timer
}

# =============================================================================
# DOCKER OPTIMIZATION
# =============================================================================

optimize_docker() {
    start_timer "Docker optimization"
    
    # Prune unused Docker resources but keep recent ones
    if command -v docker >/dev/null 2>&1; then
        # Remove dangling images older than 24 hours
        docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
        
        # Remove stopped containers older than 1 hour
        docker container prune -f --filter "until=1h" >/dev/null 2>&1 || true
        
        # Keep act containers but remove others
        local act_containers
        act_containers=$(docker ps -a --filter "label=act" --format "{{.ID}}" || true)
        
        if [[ -n "$act_containers" ]]; then
            debug "Preserving act containers: $act_containers"
        fi
        
        debug "Docker cleanup completed"
    else
        warn "Docker not available for optimization"
    fi
    
    end_timer
}

# =============================================================================
# NPM CACHE OPTIMIZATION
# =============================================================================

optimize_npm_cache() {
    start_timer "NPM cache optimization"
    
    # Set npm cache directory
    npm config set cache "$NPM_CACHE" --global
    
    # Verify cache
    npm cache verify >/dev/null 2>&1 || true
    
    debug "NPM cache configured: $NPM_CACHE"
    
    end_timer
}

# =============================================================================
# ACT OPTIMIZATION
# =============================================================================

optimize_act() {
    start_timer "Act optimization"
    
    # Ensure act cache directory exists
    mkdir -p "$ACT_CACHE_DIR"
    
    # Pre-pull act containers if not present
    local act_image="catthehacker/ubuntu:act-latest"
    
    if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$act_image"; then
        log "Pre-pulling act container image"
        docker pull "$act_image" || warn "Failed to pre-pull act image"
    else
        debug "Act container image already available"
    fi
    
    # Set act environment for optimized runs
    export ACT_CACHE_DIR
    export ACT_ARTIFACTS_PATH="$ARTIFACTS_DIR"
    
    end_timer
}

# =============================================================================
# PERFORMANCE MONITORING
# =============================================================================

show_cache_stats() {
    log "Cache Statistics:"
    
    if [[ -d "$CACHE_DIR" ]]; then
        local cache_size
        cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        echo "  Total cache size: $cache_size"
        
        # Show breakdown by category
        for subdir in node_modules playwright docker npm; do
            local subdir_path="${CACHE_DIR}/${subdir}"
            if [[ -d "$subdir_path" ]]; then
                local size
                size=$(du -sh "$subdir_path" 2>/dev/null | cut -f1 || echo "unknown")
                echo "    $subdir: $size"
            fi
        done
    fi
    
    if [[ -d "$ACT_CACHE_DIR" ]]; then
        local act_cache_size
        act_cache_size=$(du -sh "$ACT_CACHE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        echo "  Act cache size: $act_cache_size"
    fi
}

show_recent_performance() {
    if [[ -f "$PERFORMANCE_LOG" ]]; then
        log "Recent Performance (last 10 runs):"
        tail -n 10 "$PERFORMANCE_LOG" | while IFS=',' read -r timestamp operation duration; do
            if [[ "$timestamp" != "timestamp" ]]; then
                echo "  $(date -d "$timestamp" +'%H:%M:%S' 2>/dev/null || echo "$timestamp"): $operation (${duration}s)"
            fi
        done
    fi
}

# =============================================================================
# MAIN OPERATIONS
# =============================================================================

full_optimization() {
    log "Starting full CI optimization"
    
    check_dependencies
    init_cache_directories
    cache_node_modules
    cache_playwright_browsers
    optimize_npm_cache
    optimize_docker
    optimize_act
    
    log "Full optimization completed"
    show_cache_stats
}

quick_restore() {
    log "Starting quick cache restoration"
    
    init_cache_directories
    restore_node_modules
    cache_playwright_browsers
    optimize_act
    
    log "Quick restoration completed"
}

clean_cache() {
    log "Cleaning optimization caches"
    
    if [[ -d "$CACHE_DIR" ]]; then
        rm -rf "$CACHE_DIR"
        log "Removed cache directory: $CACHE_DIR"
    fi
    
    if [[ -d "$ACT_CACHE_DIR" ]]; then
        rm -rf "$ACT_CACHE_DIR"
        log "Removed act cache directory: $ACT_CACHE_DIR"
    fi
    
    # Clean npm cache
    npm cache clean --force >/dev/null 2>&1 || true
    
    log "Cache cleanup completed"
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_help() {
    cat << EOF
Usage: $0 [COMMAND]

CI Optimization Commands:
  optimize, full      Run full optimization (cache everything)
  restore, quick      Quick restore of cached dependencies
  clean              Clean all optimization caches
  stats              Show cache statistics
  performance, perf  Show recent performance metrics
  help               Show this help message

Environment Variables:
  DEBUG=1            Enable debug output
  
Examples:
  $0 optimize        # Full optimization before CI runs
  $0 restore         # Quick restore for development
  $0 stats           # Check cache sizes
  $0 clean           # Reset all caches
  
EOF
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    cd "$PROJECT_ROOT"
    
    local command="${1:-optimize}"
    
    case "$command" in
        optimize|full)
            full_optimization
            ;;
        restore|quick)
            quick_restore
            ;;
        clean)
            clean_cache
            ;;
        stats)
            show_cache_stats
            ;;
        performance|perf)
            show_recent_performance
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Script interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"