#!/bin/bash

# =============================================================================
# Cache Manager for alphanumeric-issue24-ci
# =============================================================================
# Advanced cache management utilities for optimizing CI performance.
# Provides fine-grained control over different cache types and strategies.

set -eo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly CACHE_DIR="${PROJECT_ROOT}/.cache"
readonly ACT_CACHE_DIR="${PROJECT_ROOT}/.act-cache"
readonly CACHE_CONFIG="${CACHE_DIR}/cache.config"

# Cache types and their configurations
CACHE_TYPES="node_modules:Node.js dependencies cache
playwright:Playwright browser binaries
docker:Docker images and containers
npm:NPM package cache
act:Act runner cache
artifacts:Build artifacts cache
test_results:Test results and coverage"

# Cache policies  
CACHE_POLICIES="aggressive:Cache everything, never expire
balanced:Cache with TTL, cleanup old entries
conservative:Cache only essential items
development:Fast access, frequent updates
ci:Optimized for CI performance"

# Global variables
VERBOSE=0
DRY_RUN=0
CACHE_POLICY="balanced"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

debug() {
    if [[ "$VERBOSE" == "1" ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $*" >&2
    fi
}

success() {
    echo -e "${CYAN}[SUCCESS]${NC} $*"
}

dry_run_prefix() {
    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} "
    fi
}

humanize_size() {
    local size=$1
    if [[ $size -gt 1073741824 ]]; then
        echo "$(( size / 1073741824 ))GB"
    elif [[ $size -gt 1048576 ]]; then
        echo "$(( size / 1048576 ))MB"
    elif [[ $size -gt 1024 ]]; then
        echo "$(( size / 1024 ))KB"
    else
        echo "${size}B"
    fi
}

get_dir_size() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        du -sb "$dir" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# =============================================================================
# CACHE CONFIGURATION MANAGEMENT
# =============================================================================

init_cache_config() {
    mkdir -p "$CACHE_DIR"
    
    if [[ ! -f "$CACHE_CONFIG" ]]; then
        cat > "$CACHE_CONFIG" << EOF
# Cache Manager Configuration
# Generated on $(date)

# Cache policy: aggressive, balanced, conservative, development, ci
CACHE_POLICY=${CACHE_POLICY}

# TTL settings (in seconds)
NODE_MODULES_TTL=86400    # 24 hours
PLAYWRIGHT_TTL=604800     # 7 days
DOCKER_TTL=259200         # 3 days
NPM_TTL=86400            # 24 hours
ARTIFACTS_TTL=3600       # 1 hour
TEST_RESULTS_TTL=3600    # 1 hour

# Size limits (in bytes)
MAX_CACHE_SIZE=5368709120     # 5GB
MAX_NODE_MODULES_SIZE=2147483648  # 2GB
MAX_PLAYWRIGHT_SIZE=1073741824    # 1GB

# Cleanup thresholds
CLEANUP_THRESHOLD=0.8     # Cleanup when 80% full
AGGRESSIVE_CLEANUP=0.9    # Aggressive cleanup at 90%

# Last cleanup timestamp
LAST_CLEANUP=0
EOF
        log "Initialized cache configuration: $CACHE_CONFIG"
    fi
    
    # Source the configuration
    source "$CACHE_CONFIG"
}

update_cache_config() {
    local key="$1"
    local value="$2"
    
    if [[ -f "$CACHE_CONFIG" ]]; then
        if grep -q "^${key}=" "$CACHE_CONFIG"; then
            sed -i.bak "s/^${key}=.*/${key}=${value}/" "$CACHE_CONFIG"
        else
            echo "${key}=${value}" >> "$CACHE_CONFIG"
        fi
        debug "Updated config: ${key}=${value}"
    fi
}

# =============================================================================
# CACHE ANALYSIS AND MONITORING
# =============================================================================

analyze_cache() {
    log "Analyzing cache structure and usage..."
    
    init_cache_config
    source "$CACHE_CONFIG"
    
    local total_size=0
    local cache_report="${CACHE_DIR}/cache_analysis.txt"
    
    {
        echo "Cache Analysis Report - $(date)"
        echo "=================================="
        echo
        echo "Cache Policy: $CACHE_POLICY"
        echo "Cache Directory: $CACHE_DIR"
        echo
        echo "Cache Breakdown:"
        echo "----------------"
        
        echo "$CACHE_TYPES" | while IFS=':' read -r cache_type description; do
            local cache_path="${CACHE_DIR}/${cache_type}"
            local size=$(get_dir_size "$cache_path")
            total_size=$((total_size + size))
            
            local human_size=$(humanize_size "$size")
            
            printf "%-15s: %8s - %s\n" "$cache_type" "$human_size" "$description"
            
            if [[ -d "$cache_path" && "$VERBOSE" == "1" ]]; then
                echo "  Contents:"
                find "$cache_path" -maxdepth 2 -type d 2>/dev/null | \
                    head -5 | \
                    sed 's/^/    /'
                if [[ $(find "$cache_path" -maxdepth 2 -type d 2>/dev/null | wc -l) -gt 5 ]]; then
                    echo "    ... ($(find "$cache_path" -type d 2>/dev/null | wc -l) total directories)"
                fi
                echo
            fi
        done
        
        echo
        echo "Total Cache Size: $(humanize_size $total_size)"
        echo "Max Cache Size: $(humanize_size $MAX_CACHE_SIZE)"
        
        local usage_percent=$((total_size * 100 / MAX_CACHE_SIZE))
        echo "Cache Usage: ${usage_percent}%"
        
        if [[ $usage_percent -gt 80 ]]; then
            echo "WARNING: Cache usage is high (>80%)"
        fi
        
    } | tee "$cache_report"
    
    success "Cache analysis saved to: $cache_report"
}

monitor_cache_performance() {
    log "Monitoring cache performance..."
    
    local performance_log="${CACHE_DIR}/performance.log"
    
    if [[ ! -f "$performance_log" ]]; then
        warn "No performance log found at: $performance_log"
        return 1
    fi
    
    echo "Recent Cache Performance:"
    echo "========================"
    
    # Show last 20 operations
    tail -n 20 "$performance_log" | while IFS=',' read -r timestamp operation duration; do
        if [[ "$timestamp" != "timestamp" ]]; then
            local formatted_time=$(date -d "$timestamp" +'%H:%M:%S' 2>/dev/null || echo "$timestamp")
            printf "%s: %-30s (%3ss)\n" "$formatted_time" "$operation" "$duration"
        fi
    done
    
    echo
    echo "Performance Summary:"
    echo "==================="
    
    # Calculate averages for different operations
    local temp_file=$(mktemp)
    grep -v "^timestamp" "$performance_log" > "$temp_file" || true
    
    local operations=("Node modules caching" "Node modules restoration" "Playwright browser caching" "Docker optimization")
    
    for op in "${operations[@]}"; do
        local avg_duration
        avg_duration=$(grep "$op" "$temp_file" | \
            awk -F',' '{sum+=$3; count++} END {if(count>0) print int(sum/count); else print 0}')
        
        if [[ "$avg_duration" -gt 0 ]]; then
            printf "%-30s: %3ss average\n" "$op" "$avg_duration"
        fi
    done
    
    rm -f "$temp_file"
}

# =============================================================================
# CACHE CLEANUP AND MAINTENANCE
# =============================================================================

cleanup_expired_cache() {
    log "Cleaning up expired cache entries..."
    
    init_cache_config
    source "$CACHE_CONFIG"
    
    local current_time=$(date +%s)
    local cleaned_items=0
    
    # Node modules cleanup
    if [[ -d "${CACHE_DIR}/node_modules" ]]; then
        find "${CACHE_DIR}/node_modules" -name ".cache_marker" -type f | while read -r marker; do
            local marker_time=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker" 2>/dev/null || echo 0)
            local age=$((current_time - marker_time))
            
            if [[ $age -gt $NODE_MODULES_TTL ]]; then
                local cache_dir=$(dirname "$marker")
                if [[ "$DRY_RUN" == "1" ]]; then
                    info "$(dry_run_prefix)Would remove expired cache: $cache_dir"
                else
                    rm -rf "$cache_dir"
                    debug "Removed expired node_modules cache: $cache_dir"
                    ((cleaned_items++))
                fi
            fi
        done
    fi
    
    # Artifacts cleanup
    if [[ -d "${CACHE_DIR}/artifacts" ]]; then
        find "${CACHE_DIR}/artifacts" -type f -mtime +1 | while read -r artifact; do
            if [[ "$DRY_RUN" == "1" ]]; then
                info "$(dry_run_prefix)Would remove old artifact: $artifact"
            else
                rm -f "$artifact"
                debug "Removed old artifact: $artifact"
                ((cleaned_items++))
            fi
        done
    fi
    
    # Test results cleanup
    if [[ -d "${CACHE_DIR}/test_results" ]]; then
        find "${CACHE_DIR}/test_results" -type f -mtime +1 | while read -r result; do
            if [[ "$DRY_RUN" == "1" ]]; then
                info "$(dry_run_prefix)Would remove old test result: $result"
            else
                rm -f "$result"
                debug "Removed old test result: $result"
                ((cleaned_items++))
            fi
        done
    fi
    
    if [[ "$DRY_RUN" != "1" ]]; then
        update_cache_config "LAST_CLEANUP" "$current_time"
        success "Cleaned up $cleaned_items expired cache entries"
    else
        info "Dry run completed - no changes made"
    fi
}

cleanup_by_size() {
    log "Cleaning cache by size limits..."
    
    init_cache_config
    source "$CACHE_CONFIG"
    
    local total_size=$(get_dir_size "$CACHE_DIR")
    local threshold_size=$((MAX_CACHE_SIZE * CLEANUP_THRESHOLD / 100))
    
    if [[ $total_size -lt $threshold_size ]]; then
        info "Cache size OK: $(humanize_size $total_size) < $(humanize_size $threshold_size)"
        return 0
    fi
    
    warn "Cache size exceeds threshold: $(humanize_size $total_size) >= $(humanize_size $threshold_size)"
    
    # Find largest cache directories and clean oldest first
    local temp_file=$(mktemp)
    
    for cache_type in "${!CACHE_TYPES[@]}"; do
        local cache_path="${CACHE_DIR}/${cache_type}"
        if [[ -d "$cache_path" ]]; then
            local size=$(get_dir_size "$cache_path")
            local mtime=$(stat -c %Y "$cache_path" 2>/dev/null || stat -f %m "$cache_path" 2>/dev/null || echo 0)
            echo "$size $mtime $cache_path" >> "$temp_file"
        fi
    done
    
    # Sort by age (oldest first) and remove until under threshold
    sort -k2 -n "$temp_file" | while read -r size mtime path; do
        local current_total=$(get_dir_size "$CACHE_DIR")
        if [[ $current_total -lt $threshold_size ]]; then
            break
        fi
        
        if [[ "$DRY_RUN" == "1" ]]; then
            info "$(dry_run_prefix)Would remove cache directory: $path ($(humanize_size $size))"
        else
            rm -rf "$path"
            log "Removed cache directory: $path ($(humanize_size $size))"
        fi
    done
    
    rm -f "$temp_file"
}

smart_cleanup() {
    log "Performing smart cache cleanup..."
    
    cleanup_expired_cache
    cleanup_by_size
    
    # Additional Docker cleanup
    if command -v docker >/dev/null 2>&1; then
        if [[ "$DRY_RUN" == "1" ]]; then
            info "$(dry_run_prefix)Would clean Docker cache"
        else
            docker system prune -f --volumes --filter "until=24h" >/dev/null 2>&1 || true
            debug "Performed Docker system cleanup"
        fi
    fi
    
    success "Smart cleanup completed"
}

# =============================================================================
# CACHE STRATEGY MANAGEMENT
# =============================================================================

set_cache_policy() {
    local policy="$1"
    
    local policy_found=0
    echo "$CACHE_POLICIES" | while IFS=':' read -r policy_name policy_desc; do
        if [[ "$policy_name" == "$policy" ]]; then
            policy_found=1
            break
        fi
    done
    
    if [[ $policy_found -eq 0 ]]; then
        error "Unknown cache policy: $policy"
        echo "Available policies:"
        echo "$CACHE_POLICIES" | while IFS=':' read -r policy_name policy_desc; do
            echo "  $policy_name: $policy_desc"
        done
        return 1
    fi
    
    log "Setting cache policy to: $policy"
    
    case "$policy" in
        "aggressive")
            update_cache_config "NODE_MODULES_TTL" "2592000"  # 30 days
            update_cache_config "PLAYWRIGHT_TTL" "2592000"    # 30 days
            update_cache_config "MAX_CACHE_SIZE" "10737418240" # 10GB
            ;;
        "balanced")
            update_cache_config "NODE_MODULES_TTL" "86400"     # 24 hours
            update_cache_config "PLAYWRIGHT_TTL" "604800"     # 7 days
            update_cache_config "MAX_CACHE_SIZE" "5368709120"  # 5GB
            ;;
        "conservative")
            update_cache_config "NODE_MODULES_TTL" "3600"      # 1 hour
            update_cache_config "PLAYWRIGHT_TTL" "86400"      # 24 hours
            update_cache_config "MAX_CACHE_SIZE" "2147483648"  # 2GB
            ;;
        "development")
            update_cache_config "NODE_MODULES_TTL" "86400"     # 24 hours
            update_cache_config "CLEANUP_THRESHOLD" "0.9"     # Higher threshold
            ;;
        "ci")
            update_cache_config "NODE_MODULES_TTL" "604800"    # 7 days
            update_cache_config "PLAYWRIGHT_TTL" "2592000"    # 30 days
            update_cache_config "CLEANUP_THRESHOLD" "0.7"     # Lower threshold
            ;;
    esac
    
    update_cache_config "CACHE_POLICY" "$policy"
    success "Cache policy set to: $policy"
}

# =============================================================================
# CACHE VALIDATION AND INTEGRITY
# =============================================================================

validate_cache() {
    log "Validating cache integrity..."
    
    local issues=0
    
    # Check cache directory structure
    local required_dirs=("node_modules" "playwright" "docker" "npm" "artifacts")
    
    for dir in "${required_dirs[@]}"; do
        local dir_path="${CACHE_DIR}/${dir}"
        if [[ ! -d "$dir_path" ]]; then
            warn "Missing cache directory: $dir_path"
            if [[ "$DRY_RUN" != "1" ]]; then
                mkdir -p "$dir_path"
                debug "Created missing directory: $dir_path"
            fi
        fi
    done
    
    # Validate node_modules caches
    if [[ -d "${CACHE_DIR}/node_modules" ]]; then
        find "${CACHE_DIR}/node_modules" -name ".cache_marker" | while read -r marker; do
            local cache_dir=$(dirname "$marker")
            local workspace_name=$(basename "$cache_dir")
            
            # Check if package.json exists in original workspace
            local original_workspace
            case "$workspace_name" in
                ".")
                    original_workspace="${PROJECT_ROOT}"
                    ;;
                *)
                    original_workspace="${PROJECT_ROOT}/${workspace_name//_/\/}"
                    ;;
            esac
            
            if [[ ! -f "${original_workspace}/package.json" ]]; then
                warn "Orphaned cache for non-existent workspace: $workspace_name"
                if [[ "$DRY_RUN" != "1" ]]; then
                    rm -rf "$cache_dir"
                    debug "Removed orphaned cache: $cache_dir"
                    ((issues++))
                fi
            fi
        done
    fi
    
    # Check cache sizes against limits
    init_cache_config
    source "$CACHE_CONFIG"
    
    local total_size=$(get_dir_size "$CACHE_DIR")
    if [[ $total_size -gt $MAX_CACHE_SIZE ]]; then
        warn "Cache size exceeds limit: $(humanize_size $total_size) > $(humanize_size $MAX_CACHE_SIZE)"
        ((issues++))
    fi
    
    if [[ $issues -eq 0 ]]; then
        success "Cache validation passed - no issues found"
    else
        warn "Cache validation found $issues issues"
    fi
    
    return $issues
}

# =============================================================================
# REPORTING AND STATISTICS
# =============================================================================

generate_cache_report() {
    log "Generating comprehensive cache report..."
    
    local report_file="${CACHE_DIR}/cache_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Comprehensive Cache Report"
        echo "=========================="
        echo "Generated: $(date)"
        echo "Project: alphanumeric-issue24-ci"
        echo
        
        # System information
        echo "System Information:"
        echo "------------------"
        echo "OS: $(uname -s) $(uname -r)"
        echo "Architecture: $(uname -m)"
        echo "Available disk space: $(df -h "$CACHE_DIR" | tail -1 | awk '{print $4}')"
        echo
        
        # Cache configuration
        echo "Cache Configuration:"
        echo "-------------------"
        if [[ -f "$CACHE_CONFIG" ]]; then
            cat "$CACHE_CONFIG"
        else
            echo "No cache configuration found"
        fi
        echo
        
        # Cache analysis
        analyze_cache
        echo
        
        # Performance metrics
        if [[ -f "${CACHE_DIR}/performance.log" ]]; then
            echo "Performance Metrics:"
            echo "-------------------"
            monitor_cache_performance
        fi
        
    } > "$report_file"
    
    success "Cache report generated: $report_file"
    
    if [[ "$VERBOSE" == "1" ]]; then
        cat "$report_file"
    fi
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_help() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND [ARGS]

Cache Manager for alphanumeric-issue24-ci

COMMANDS:
  analyze              Analyze cache structure and usage
  monitor              Monitor cache performance
  cleanup              Perform smart cache cleanup
  cleanup-expired      Clean up expired cache entries only
  cleanup-size         Clean up cache by size limits
  validate             Validate cache integrity
  report               Generate comprehensive cache report
  policy <name>        Set cache policy (aggressive|balanced|conservative|development|ci)
  stats                Show cache statistics
  help                 Show this help message

OPTIONS:
  -v, --verbose        Enable verbose output
  -n, --dry-run        Show what would be done without making changes
  -p, --policy <name>  Set cache policy before operation

EXAMPLES:
  $0 analyze                    # Analyze current cache
  $0 cleanup --dry-run          # See what cleanup would do
  $0 policy aggressive          # Set aggressive caching
  $0 -v cleanup                 # Verbose cleanup
  $0 report                     # Generate detailed report

CACHE POLICIES:
EOF
    
    echo "$CACHE_POLICIES" | while IFS=':' read -r policy_name policy_desc; do
        printf "  %-12s: %s\n" "$policy_name" "$policy_desc"
    done
    
    echo
    echo "For more information, see the cache directory: $CACHE_DIR"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    cd "$PROJECT_ROOT"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=1
                shift
                ;;
            -p|--policy)
                if [[ -n "${2:-}" ]]; then
                    CACHE_POLICY="$2"
                    shift 2
                else
                    error "Policy option requires a value"
                    exit 1
                fi
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            --)
                shift
                break
                ;;
            -*)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done
    
    local command="${1:-analyze}"
    
    case "$command" in
        analyze)
            analyze_cache
            ;;
        monitor)
            monitor_cache_performance
            ;;
        cleanup)
            smart_cleanup
            ;;
        cleanup-expired)
            cleanup_expired_cache
            ;;
        cleanup-size)
            cleanup_by_size
            ;;
        validate)
            validate_cache
            ;;
        report)
            generate_cache_report
            ;;
        policy)
            if [[ -n "${2:-}" ]]; then
                set_cache_policy "$2"
            else
                error "Policy command requires a policy name"
                show_help
                exit 1
            fi
            ;;
        stats)
            analyze_cache
            monitor_cache_performance
            ;;
        help|--help)
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