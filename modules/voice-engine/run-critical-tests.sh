#!/bin/bash

# CRITICAL QA TEST EXECUTION SCRIPT
# Must pass before any deployment

set -e  # Exit on any error

echo "=========================================="
echo "    CRITICAL QA TEST EXECUTION SUITE"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not installed"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 not installed"
        exit 1
    fi
    
    # Check required packages
    if ! npm list jest &> /dev/null; then
        warn "Installing Jest..."
        npm install --save-dev jest @types/jest ts-jest
    fi
    
    if ! python3 -c "import pytest" &> /dev/null; then
        warn "Installing pytest..."
        pip3 install pytest pytest-cov psutil
    fi
    
    log "Prerequisites check passed"
}

# Run race condition tests
run_race_condition_tests() {
    log "Running CRITICAL race condition tests..."
    
    echo "  Testing concurrent response processing..."
    echo "  Testing command queue overflow..."
    echo "  Testing process shutdown races..."
    
    if npm test -- test/critical-race-condition.test.ts --verbose; then
        log "✅ Race condition tests PASSED"
    else
        error "❌ Race condition tests FAILED"
        exit 1
    fi
}

# Run memory leak tests
run_memory_leak_tests() {
    log "Running CRITICAL memory leak prevention tests..."
    
    echo "  Testing bounded memory growth..."
    echo "  Testing cache management..."
    echo "  Testing thread cleanup..."
    echo "  Testing file descriptor cleanup..."
    
    if python3 test/memory_leak_prevention.py; then
        log "✅ Memory leak tests PASSED"
    else
        error "❌ Memory leak tests FAILED"
        exit 1
    fi
}

# Run process cleanup tests
run_process_cleanup_tests() {
    log "Running CRITICAL process cleanup tests..."
    
    echo "  Testing graceful shutdown..."
    echo "  Testing forced termination..."
    echo "  Testing resource cleanup..."
    echo "  Testing zombie process prevention..."
    
    if npm test -- test/process-cleanup-enhancement.test.ts --verbose; then
        log "✅ Process cleanup tests PASSED"
    else
        error "❌ Process cleanup tests FAILED"
        exit 1
    fi
}

# Run stress tests
run_stress_tests() {
    log "Running stress tests for race condition detection..."
    
    echo "  Running 100 iterations of concurrent synthesis..."
    
    for i in {1..100}; do
        if ! npm test -- test/critical-race-condition.test.ts --testNamePattern="concurrent" --silent; then
            error "❌ Stress test failed at iteration $i"
            exit 1
        fi
        
        if [ $((i % 20)) -eq 0 ]; then
            echo "    Completed $i/100 iterations"
        fi
    done
    
    log "✅ Stress tests PASSED (100/100 iterations)"
}

# Monitor system resources during tests
monitor_resources() {
    log "Monitoring system resources..."
    
    # Start resource monitoring in background
    (
        while true; do
            ps aux | grep -E "(node|python|tts)" | grep -v grep >> resource_monitor.log
            sleep 1
        done
    ) &
    
    MONITOR_PID=$!
    
    # Return monitor PID for cleanup
    echo $MONITOR_PID
}

# Check for zombie processes
check_zombie_processes() {
    log "Checking for zombie processes..."
    
    ZOMBIES=$(ps aux | grep -c '[Zz]ombie\|<defunct>')
    
    if [ "$ZOMBIES" -gt 0 ]; then
        error "❌ Found $ZOMBIES zombie processes"
        ps aux | grep -E '[Zz]ombie|<defunct>'
        exit 1
    else
        log "✅ No zombie processes detected"
    fi
}

# Memory usage check
check_memory_usage() {
    log "Checking memory usage..."
    
    # Get memory usage of test processes
    MEMORY_USAGE=$(ps aux | grep -E "(node|python)" | grep -v grep | awk '{sum += $6} END {print sum/1024}')
    
    if (( $(echo "$MEMORY_USAGE > 1000" | bc -l) )); then
        error "❌ High memory usage detected: ${MEMORY_USAGE}MB"
        exit 1
    else
        log "✅ Memory usage within limits: ${MEMORY_USAGE}MB"
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    log "Starting CRITICAL QA test execution..."
    
    # Start resource monitoring
    MONITOR_PID=$(monitor_resources)
    
    # Ensure cleanup on exit
    trap "kill $MONITOR_PID 2>/dev/null || true; rm -f resource_monitor.log" EXIT
    
    # Run all critical tests
    check_prerequisites
    run_race_condition_tests
    run_memory_leak_tests
    run_process_cleanup_tests
    run_stress_tests
    
    # Post-test verification
    check_zombie_processes
    check_memory_usage
    
    # Stop resource monitoring
    kill $MONITOR_PID 2>/dev/null || true
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "=========================================="
    log "🎉 ALL CRITICAL TESTS PASSED"
    log "⏱️  Total execution time: ${duration} seconds"
    echo "=========================================="
    echo ""
    
    # Generate test report
    generate_test_report $duration
}

# Generate test report
generate_test_report() {
    local duration=$1
    local report_file="critical_test_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Critical QA Test Report

**Date**: $(date)
**Duration**: ${duration} seconds
**Status**: ✅ ALL TESTS PASSED

## Tests Executed

- ✅ Race condition prevention tests
- ✅ Memory leak prevention tests  
- ✅ Process cleanup enhancement tests
- ✅ Stress tests (100 iterations)
- ✅ Zombie process check
- ✅ Memory usage verification

## System Status

- Memory usage: Within limits
- Process count: Normal
- No zombie processes detected
- No resource leaks found

## Deployment Readiness

🟢 **READY FOR DEPLOYMENT**

All critical bugs have been verified as fixed. The system is stable and ready for production deployment.

## Next Steps

1. Deploy bug fixes to staging
2. Run integration tests
3. Deploy to production with monitoring
4. Monitor for 24 hours post-deployment

---
*Generated by Critical QA Test Suite*
EOF

    log "📄 Test report generated: $report_file"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi