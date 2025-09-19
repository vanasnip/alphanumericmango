#!/bin/bash

# =============================================================================
# Performance Monitor for alphanumeric-issue24-ci
# =============================================================================
# Advanced performance monitoring and analytics for CI optimization.
# Tracks timing, resource usage, and efficiency metrics across CI runs.

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly CACHE_DIR="${PROJECT_ROOT}/.cache"
readonly PERFORMANCE_DIR="${CACHE_DIR}/performance"
readonly METRICS_DB="${PERFORMANCE_DIR}/metrics.db"
readonly PERFORMANCE_LOG="${CACHE_DIR}/performance.log"

# Metric types
METRIC_TYPES="timing:Execution time measurements
resource:CPU, memory, disk usage
cache:Cache hit rates and efficiency
network:Network operations and bandwidth
build:Build and compilation metrics
test:Test execution and coverage"

# Global state
VERBOSE=0
REALTIME=0
PROFILE_PID=""
MONITORING_SESSION=""

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

bold() {
    echo -e "${BOLD}$*${NC}"
}

get_timestamp() {
    date +%s
}

get_iso_timestamp() {
    date -Iseconds
}

humanize_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))
    
    if [[ $hours -gt 0 ]]; then
        printf "%dh %dm %ds" $hours $minutes $secs
    elif [[ $minutes -gt 0 ]]; then
        printf "%dm %ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

humanize_bytes() {
    local bytes=$1
    local units=('B' 'KB' 'MB' 'GB' 'TB')
    local unit=0
    
    while [[ $bytes -gt 1024 && $unit -lt 4 ]]; do
        bytes=$((bytes / 1024))
        ((unit++))
    done
    
    echo "${bytes}${units[$unit]}"
}

# =============================================================================
# INITIALIZATION AND SETUP
# =============================================================================

init_performance_monitoring() {
    log "Initializing performance monitoring system..."
    
    # Create directory structure
    mkdir -p "$PERFORMANCE_DIR"
    mkdir -p "${PERFORMANCE_DIR}/sessions"
    mkdir -p "${PERFORMANCE_DIR}/reports"
    mkdir -p "${PERFORMANCE_DIR}/profiles"
    
    # Initialize metrics database (simple CSV format)
    if [[ ! -f "$METRICS_DB" ]]; then
        cat > "$METRICS_DB" << EOF
timestamp,session_id,metric_type,operation,value,unit,metadata
EOF
        debug "Initialized metrics database: $METRICS_DB"
    fi
    
    # Create session ID
    MONITORING_SESSION="session_$(date +%Y%m%d_%H%M%S)_$$"
    debug "Started monitoring session: $MONITORING_SESSION"
    
    success "Performance monitoring initialized"
}

# =============================================================================
# METRIC COLLECTION
# =============================================================================

record_metric() {
    local metric_type="$1"
    local operation="$2"
    local value="$3"
    local unit="$4"
    local metadata="${5:-}"
    
    local timestamp=$(get_iso_timestamp)
    
    echo "$timestamp,$MONITORING_SESSION,$metric_type,$operation,$value,$unit,$metadata" >> "$METRICS_DB"
    
    if [[ "$VERBOSE" == "1" ]]; then
        debug "Recorded metric: $metric_type/$operation = $value $unit"
    fi
}

start_timing() {
    local operation="$1"
    local start_file="${PERFORMANCE_DIR}/timing_${operation//[^a-zA-Z0-9]/_}_start"
    echo "$(get_timestamp)" > "$start_file"
    debug "Started timing: $operation"
}

end_timing() {
    local operation="$1"
    local start_file="${PERFORMANCE_DIR}/timing_${operation//[^a-zA-Z0-9]/_}_start"
    
    if [[ ! -f "$start_file" ]]; then
        warn "No start time found for operation: $operation"
        return 1
    fi
    
    local start_time=$(cat "$start_file")
    local end_time=$(get_timestamp)
    local duration=$((end_time - start_time))
    
    record_metric "timing" "$operation" "$duration" "seconds"
    rm -f "$start_file"
    
    debug "Completed timing: $operation (${duration}s)"
    echo "$duration"
}

measure_command() {
    local operation="$1"
    shift
    local command=("$@")
    
    log "Measuring command: $operation"
    
    local start_time=$(get_timestamp)
    local temp_file=$(mktemp)
    
    # Capture command output and timing
    if /usr/bin/time -o "$temp_file" -f "%e %M %P" "${command[@]}" >/dev/null 2>&1; then
        local end_time=$(get_timestamp)
        local wall_time=$((end_time - start_time))
        
        # Parse time output (elapsed, max_rss, cpu_percent)
        local time_stats
        time_stats=$(cat "$temp_file" 2>/dev/null || echo "0 0 0%")
        local elapsed_time=$(echo "$time_stats" | awk '{print $1}')
        local max_memory=$(echo "$time_stats" | awk '{print $2}')
        local cpu_percent=$(echo "$time_stats" | awk '{print $3}' | tr -d '%')
        
        # Record metrics
        record_metric "timing" "$operation" "$wall_time" "seconds"
        record_metric "resource" "${operation}_cpu" "$cpu_percent" "percent"
        record_metric "resource" "${operation}_memory" "$max_memory" "kb"
        
        success "Command completed: $operation (${wall_time}s)"
        
        rm -f "$temp_file"
        return 0
    else
        local exit_code=$?
        warn "Command failed: $operation (exit code: $exit_code)"
        rm -f "$temp_file"
        return $exit_code
    fi
}

monitor_system_resources() {
    local operation="${1:-system}"
    local duration="${2:-60}"
    local interval="${3:-5}"
    
    log "Monitoring system resources for ${duration}s (${operation})"
    
    local monitor_file="${PERFORMANCE_DIR}/monitor_${operation}_$(date +%s).log"
    local end_time=$(($(get_timestamp) + duration))
    
    echo "timestamp,cpu_percent,memory_percent,disk_io,network_io" > "$monitor_file"
    
    while [[ $(get_timestamp) -lt $end_time ]]; do
        # Get CPU usage
        local cpu_usage
        cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | tr -d '%' || echo "0")
        
        # Get memory usage
        local memory_usage
        memory_usage=$(vm_stat | awk '
            /Pages free/ {free=$3}
            /Pages active/ {active=$3}
            /Pages inactive/ {inactive=$3}
            /Pages wired/ {wired=$3}
            /Pages compressed/ {compressed=$3}
            END {
                total = free + active + inactive + wired + compressed;
                used = active + inactive + wired + compressed;
                if (total > 0) print int((used/total)*100); else print 0
            }' || echo "0")
        
        # Get disk I/O (simplified)
        local disk_io
        disk_io=$(iostat -d 1 1 | tail -1 | awk '{print $2+$3}' || echo "0")
        
        # Get network I/O (simplified)
        local network_io
        network_io=$(netstat -ib | awk '/en0/ {print $7+$10; exit}' || echo "0")
        
        local timestamp=$(get_iso_timestamp)
        echo "$timestamp,$cpu_usage,$memory_usage,$disk_io,$network_io" >> "$monitor_file"
        
        # Record instantaneous metrics
        record_metric "resource" "${operation}_cpu" "$cpu_usage" "percent"
        record_metric "resource" "${operation}_memory" "$memory_usage" "percent"
        
        sleep "$interval"
    done
    
    debug "System monitoring completed: $monitor_file"
}

# =============================================================================
# CI WORKFLOW MONITORING
# =============================================================================

monitor_ci_workflow() {
    local workflow_name="$1"
    
    log "Starting CI workflow monitoring: $workflow_name"
    
    local workflow_start=$(get_timestamp)
    local workflow_session="${MONITORING_SESSION}_${workflow_name}"
    
    # Start system resource monitoring in background
    if [[ "$REALTIME" == "1" ]]; then
        monitor_system_resources "$workflow_name" 3600 10 &
        local monitor_pid=$!
        debug "Started system monitoring (PID: $monitor_pid)"
    fi
    
    # Monitor common CI operations
    local operations=(
        "checkout"
        "setup_node"
        "install_dependencies"
        "build"
        "test"
        "lint"
        "package"
    )
    
    for op in "${operations[@]}"; do
        if [[ -f ".github/workflows/${workflow_name}.yml" ]]; then
            if grep -q "$op" ".github/workflows/${workflow_name}.yml"; then
                info "Monitoring operation: $op"
                start_timing "${workflow_name}_${op}"
                
                # Simulate or hook into actual operation
                # This would be integrated with actual CI execution
                case "$op" in
                    "install_dependencies")
                        measure_command "${workflow_name}_npm_install" npm install
                        ;;
                    "build")
                        if [[ -f "package.json" ]]; then
                            measure_command "${workflow_name}_build" npm run build
                        fi
                        ;;
                    "test")
                        if [[ -f "package.json" ]]; then
                            measure_command "${workflow_name}_test" npm test
                        fi
                        ;;
                esac
                
                end_timing "${workflow_name}_${op}"
            fi
        fi
    done
    
    local workflow_end=$(get_timestamp)
    local workflow_duration=$((workflow_end - workflow_start))
    
    record_metric "timing" "${workflow_name}_total" "$workflow_duration" "seconds"
    
    # Stop background monitoring
    if [[ -n "${monitor_pid:-}" ]]; then
        kill "$monitor_pid" 2>/dev/null || true
        debug "Stopped system monitoring"
    fi
    
    success "CI workflow monitoring completed: $workflow_name ($(humanize_duration $workflow_duration))"
}

monitor_act_run() {
    local act_command="$1"
    
    log "Monitoring act run: $act_command"
    
    local act_start=$(get_timestamp)
    
    # Start monitoring Docker stats
    local docker_stats_file="${PERFORMANCE_DIR}/docker_stats_$(date +%s).log"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" > "$docker_stats_file" 2>/dev/null &
    local docker_monitor_pid=$!
    
    # Execute act command with timing
    measure_command "act_run" $act_command
    local act_exit_code=$?
    
    local act_end=$(get_timestamp)
    local act_duration=$((act_end - act_start))
    
    # Stop Docker monitoring
    kill "$docker_monitor_pid" 2>/dev/null || true
    
    # Analyze Docker stats
    if [[ -f "$docker_stats_file" ]]; then
        local container_count
        container_count=$(tail -n +2 "$docker_stats_file" | wc -l || echo "0")
        record_metric "resource" "act_containers" "$container_count" "count"
        debug "Docker stats saved: $docker_stats_file"
    fi
    
    record_metric "timing" "act_total" "$act_duration" "seconds"
    record_metric "build" "act_exit_code" "$act_exit_code" "code"
    
    if [[ $act_exit_code -eq 0 ]]; then
        success "Act run completed successfully ($(humanize_duration $act_duration))"
    else
        error "Act run failed with exit code $act_exit_code ($(humanize_duration $act_duration))"
    fi
    
    return $act_exit_code
}

# =============================================================================
# CACHE PERFORMANCE ANALYSIS
# =============================================================================

analyze_cache_performance() {
    log "Analyzing cache performance..."
    
    local cache_analysis_file="${PERFORMANCE_DIR}/cache_analysis_$(date +%s).txt"
    
    {
        echo "Cache Performance Analysis"
        echo "========================="
        echo "Generated: $(date)"
        echo "Session: $MONITORING_SESSION"
        echo
        
        # Analyze cache hit rates
        if [[ -f "$PERFORMANCE_LOG" ]]; then
            echo "Cache Operations:"
            echo "----------------"
            
            local operations=("Node modules caching" "Node modules restoration" "Playwright browser caching")
            
            for op in "${operations[@]}"; do
                local count
                count=$(grep "$op" "$PERFORMANCE_LOG" | wc -l || echo "0")
                
                if [[ $count -gt 0 ]]; then
                    local avg_time
                    avg_time=$(grep "$op" "$PERFORMANCE_LOG" | \
                        awk -F',' '{sum+=$3; count++} END {if(count>0) print int(sum/count); else print 0}')
                    
                    local total_time
                    total_time=$(grep "$op" "$PERFORMANCE_LOG" | \
                        awk -F',' '{sum+=$3} END {print int(sum)}')
                    
                    printf "%-30s: %3d runs, %3ds avg, %3ds total\n" "$op" "$count" "$avg_time" "$total_time"
                fi
            done
        fi
        
        echo
        echo "Cache Sizes:"
        echo "-----------"
        
        # Check cache directory sizes
        if [[ -d "$CACHE_DIR" ]]; then
            for subdir in node_modules playwright docker npm artifacts; do
                local cache_path="${CACHE_DIR}/${subdir}"
                if [[ -d "$cache_path" ]]; then
                    local size
                    size=$(du -sb "$cache_path" 2>/dev/null | cut -f1 || echo "0")
                    local human_size=$(humanize_bytes "$size")
                    printf "%-15s: %s\n" "$subdir" "$human_size"
                    
                    record_metric "cache" "${subdir}_size" "$size" "bytes"
                fi
            done
        fi
        
        echo
        echo "Cache Efficiency:"
        echo "----------------"
        
        # Calculate cache hit rates (simplified)
        local node_cache_hits=0
        local node_cache_misses=0
        
        if [[ -f "$PERFORMANCE_LOG" ]]; then
            node_cache_hits=$(grep "Cache up-to-date" "$PERFORMANCE_LOG" 2>/dev/null | wc -l || echo "0")
            node_cache_misses=$(grep "Caching node_modules" "$PERFORMANCE_LOG" 2>/dev/null | wc -l || echo "0")
            
            local total_requests=$((node_cache_hits + node_cache_misses))
            if [[ $total_requests -gt 0 ]]; then
                local hit_rate=$((node_cache_hits * 100 / total_requests))
                echo "Node modules hit rate: ${hit_rate}% (${node_cache_hits}/${total_requests})"
                record_metric "cache" "node_modules_hit_rate" "$hit_rate" "percent"
            fi
        fi
        
    } | tee "$cache_analysis_file"
    
    success "Cache analysis saved: $cache_analysis_file"
}

# =============================================================================
# PERFORMANCE REPORTING
# =============================================================================

generate_performance_report() {
    local report_type="${1:-summary}"
    
    log "Generating performance report: $report_type"
    
    local report_file="${PERFORMANCE_DIR}/reports/performance_report_${report_type}_$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p "$(dirname "$report_file")"
    
    {
        echo "Performance Report - $report_type"
        echo "================================="
        echo "Generated: $(date)"
        echo "Session: $MONITORING_SESSION"
        echo "Project: alphanumeric-issue24-ci"
        echo
        
        case "$report_type" in
            "summary")
                generate_summary_report
                ;;
            "detailed")
                generate_detailed_report
                ;;
            "comparison")
                generate_comparison_report
                ;;
            "trends")
                generate_trends_report
                ;;
        esac
        
    } > "$report_file"
    
    success "Performance report generated: $report_file"
    
    if [[ "$VERBOSE" == "1" ]]; then
        cat "$report_file"
    fi
}

generate_summary_report() {
    echo "Summary Report"
    echo "=============="
    echo
    
    # Recent performance metrics
    if [[ -f "$METRICS_DB" ]]; then
        echo "Recent Operations (last 10):"
        echo "----------------------------"
        tail -n 10 "$METRICS_DB" | while IFS=',' read -r timestamp session_id metric_type operation value unit metadata; do
            if [[ "$timestamp" != "timestamp" ]]; then
                local formatted_time
                formatted_time=$(date -d "$timestamp" +'%H:%M:%S' 2>/dev/null || echo "$timestamp")
                printf "%s: %-20s = %6s %s\n" "$formatted_time" "$operation" "$value" "$unit"
            fi
        done
        echo
    fi
    
    # System information
    echo "System Information:"
    echo "------------------"
    echo "OS: $(uname -s) $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "CPU cores: $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "unknown")"
    echo "Memory: $(free -h 2>/dev/null | awk '/^Mem:/ {print $2}' || sysctl hw.memsize 2>/dev/null | awk '{print int($2/1024/1024/1024)"GB"}' || echo "unknown")"
    echo
    
    # Cache statistics
    analyze_cache_performance
}

generate_detailed_report() {
    echo "Detailed Report"
    echo "==============="
    echo
    
    if [[ ! -f "$METRICS_DB" ]]; then
        echo "No metrics data available"
        return
    fi
    
    # Group metrics by type
    echo "$METRIC_TYPES" | while IFS=':' read -r metric_type description; do
        echo "$description ($metric_type):"
        echo "$(printf '=%.0s' $(seq 1 $((${#description} + ${#metric_type} + 4))))"
        
        grep ",$metric_type," "$METRICS_DB" | tail -n 20 | while IFS=',' read -r timestamp session_id mt operation value unit metadata; do
            local formatted_time
            formatted_time=$(date -d "$timestamp" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$timestamp")
            printf "%s: %-25s = %8s %-8s %s\n" "$formatted_time" "$operation" "$value" "$unit" "$metadata"
        done
        echo
    done
}

generate_comparison_report() {
    echo "Comparison Report"
    echo "================="
    echo
    
    echo "Comparing current session with previous sessions..."
    echo
    
    # This would compare metrics across sessions
    # Implementation depends on having historical data
    echo "Feature not fully implemented yet"
}

generate_trends_report() {
    echo "Trends Report"
    echo "============="
    echo
    
    echo "Performance trends over time..."
    echo
    
    # This would analyze trends in metrics
    # Implementation depends on having time-series data
    echo "Feature not fully implemented yet"
}

# =============================================================================
# REAL-TIME MONITORING
# =============================================================================

start_realtime_monitoring() {
    local operation="${1:-general}"
    
    log "Starting real-time monitoring for: $operation"
    
    REALTIME=1
    
    # Create real-time dashboard
    local dashboard_file="${PERFORMANCE_DIR}/realtime_${operation}_$(date +%s).log"
    
    {
        echo "Real-time Performance Dashboard"
        echo "==============================="
        echo "Operation: $operation"
        echo "Started: $(date)"
        echo
        
        while true; do
            clear
            echo "Real-time Performance Monitor - $operation"
            echo "$(date)"
            echo "==========================================="
            echo
            
            # Current resource usage
            echo "System Resources:"
            echo "----------------"
            local cpu_usage
            cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' || echo "0%")
            echo "CPU: $cpu_usage"
            
            local memory_usage
            memory_usage=$(vm_stat | awk '
                /Pages free/ {free=$3}
                /Pages active/ {active=$3}
                /Pages inactive/ {inactive=$3}
                /Pages wired/ {wired=$3}
                END {
                    total = free + active + inactive + wired;
                    used = active + inactive + wired;
                    if (total > 0) print int((used/total)*100)"%"; else print "0%"
                }' || echo "0%")
            echo "Memory: $memory_usage"
            echo
            
            # Recent operations
            echo "Recent Operations:"
            echo "-----------------"
            if [[ -f "$PERFORMANCE_LOG" ]]; then
                tail -n 5 "$PERFORMANCE_LOG" | while IFS=',' read -r timestamp operation duration; do
                    if [[ "$timestamp" != "timestamp" ]]; then
                        local formatted_time
                        formatted_time=$(date -d "$timestamp" +'%H:%M:%S' 2>/dev/null || echo "$timestamp")
                        printf "%s: %-30s (%3ss)\n" "$formatted_time" "$operation" "$duration"
                    fi
                done
            fi
            echo
            
            echo "Press Ctrl+C to stop monitoring"
            sleep 5
        done
        
    } | tee "$dashboard_file"
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_help() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND [ARGS]

Performance Monitor for alphanumeric-issue24-ci

COMMANDS:
  init                 Initialize performance monitoring
  monitor <operation>  Monitor a specific operation
  measure <cmd>        Measure command execution
  workflow <name>      Monitor CI workflow
  act <cmd>            Monitor act command execution
  cache                Analyze cache performance
  report [type]        Generate performance report (summary|detailed|comparison|trends)
  realtime [op]        Start real-time monitoring dashboard
  stats                Show current performance statistics
  help                 Show this help message

OPTIONS:
  -v, --verbose        Enable verbose output
  -r, --realtime       Enable real-time monitoring features
  -s, --session <id>   Use specific monitoring session

EXAMPLES:
  $0 init                           # Initialize monitoring
  $0 measure npm install            # Measure npm install
  $0 workflow voice-terminal        # Monitor workflow
  $0 act "act push"                 # Monitor act run
  $0 cache                          # Cache analysis
  $0 report detailed                # Detailed report
  $0 realtime build                 # Real-time monitoring
  $0 -v stats                       # Verbose statistics

METRIC TYPES:
EOF
    
    echo "$METRIC_TYPES" | while IFS=':' read -r metric_type description; do
        printf "  %-10s: %s\n" "$metric_type" "$description"
    done
    
    echo
    echo "Performance data is stored in: $PERFORMANCE_DIR"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

cleanup() {
    if [[ -n "$PROFILE_PID" ]]; then
        kill "$PROFILE_PID" 2>/dev/null || true
    fi
    debug "Cleanup completed"
}

main() {
    cd "$PROJECT_ROOT"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -r|--realtime)
                REALTIME=1
                shift
                ;;
            -s|--session)
                if [[ -n "${2:-}" ]]; then
                    MONITORING_SESSION="$2"
                    shift 2
                else
                    error "Session option requires a value"
                    exit 1
                fi
                ;;
            -h|--help)
                show_help
                exit 0
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
    
    local command="${1:-stats}"
    
    # Initialize if needed
    if [[ "$command" != "help" && "$command" != "--help" ]]; then
        init_performance_monitoring
    fi
    
    case "$command" in
        init)
            # Already initialized above
            ;;
        monitor)
            if [[ -n "${2:-}" ]]; then
                monitor_system_resources "$2" "${3:-300}" "${4:-5}"
            else
                error "Monitor command requires an operation name"
                exit 1
            fi
            ;;
        measure)
            if [[ $# -gt 1 ]]; then
                shift
                measure_command "user_command" "$@"
            else
                error "Measure command requires a command to measure"
                exit 1
            fi
            ;;
        workflow)
            if [[ -n "${2:-}" ]]; then
                monitor_ci_workflow "$2"
            else
                error "Workflow command requires a workflow name"
                exit 1
            fi
            ;;
        act)
            if [[ -n "${2:-}" ]]; then
                shift
                monitor_act_run "$*"
            else
                error "Act command requires an act command to monitor"
                exit 1
            fi
            ;;
        cache)
            analyze_cache_performance
            ;;
        report)
            generate_performance_report "${2:-summary}"
            ;;
        realtime)
            start_realtime_monitoring "${2:-general}"
            ;;
        stats)
            if [[ -f "$METRICS_DB" ]]; then
                generate_summary_report
            else
                warn "No performance data available"
            fi
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
trap cleanup INT TERM EXIT

# Run main function with all arguments
main "$@"