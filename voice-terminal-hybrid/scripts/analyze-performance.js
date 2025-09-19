#!/usr/bin/env node

/**
 * Performance Analysis Script
 * Analyzes E2E test results for performance metrics and trends
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds
const THRESHOLDS = {
  latency: {
    good: 50,
    acceptable: 65,
    poor: 100
  },
  memory: {
    good: 100 * 1024 * 1024,    // 100MB
    acceptable: 200 * 1024 * 1024, // 200MB
    poor: 500 * 1024 * 1024     // 500MB
  },
  throughput: {
    good: 15,  // ops/sec
    acceptable: 10,
    poor: 5
  }
};

function analyzePerformance(resultsDir) {
  const results = {
    summary: {
      totalTests: 0,
      performanceTests: 0,
      passedPerformance: 0,
      averageLatency: 0,
      maxMemoryUsage: 0,
      averageThroughput: 0
    },
    metrics: {
      latency: [],
      memory: [],
      throughput: []
    },
    trends: [],
    recommendations: []
  };

  // Read all test result files
  const testFiles = fs.readdirSync(resultsDir).filter(file => file.includes('test-results'));
  
  testFiles.forEach(testDir => {
    const testPath = path.join(resultsDir, testDir);
    if (fs.statSync(testPath).isDirectory()) {
      analyzeTestDirectory(testPath, results);
    }
  });

  // Calculate summary metrics
  calculateSummaryMetrics(results);
  
  // Generate recommendations
  generateRecommendations(results);
  
  return results;
}

function analyzeTestDirectory(testPath, results) {
  // Look for JSON results files
  const files = fs.readdirSync(testPath);
  
  files.forEach(file => {
    if (file.endsWith('.json') && file.includes('results')) {
      try {
        const filePath = path.join(testPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.suites) {
          data.suites.forEach(suite => {
            if (suite.specs) {
              suite.specs.forEach(spec => {
                analyzeTestSpec(spec, results);
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
  });
}

function analyzeTestSpec(spec, results) {
  results.summary.totalTests++;
  
  if (spec.title.toLowerCase().includes('performance') || 
      spec.title.toLowerCase().includes('latency') ||
      spec.title.toLowerCase().includes('throughput')) {
    
    results.summary.performanceTests++;
    
    if (spec.ok) {
      results.summary.passedPerformance++;
    }
    
    // Extract performance metrics from test results
    spec.tests?.forEach(test => {
      if (test.results) {
        test.results.forEach(result => {
          extractMetrics(result, results);
        });
      }
    });
  }
}

function extractMetrics(result, results) {
  // Extract latency metrics
  if (result.stdout) {
    const latencyMatch = result.stdout.match(/latency[:\s]+(\d+\.?\d*)ms/i);
    if (latencyMatch) {
      const latency = parseFloat(latencyMatch[1]);
      results.metrics.latency.push(latency);
    }
    
    // Extract memory usage
    const memoryMatch = result.stdout.match(/memory[:\s]+(\d+\.?\d*)\s*(MB|KB|bytes)/i);
    if (memoryMatch) {
      let memory = parseFloat(memoryMatch[1]);
      const unit = memoryMatch[2].toLowerCase();
      
      if (unit === 'kb') memory *= 1024;
      else if (unit === 'mb') memory *= 1024 * 1024;
      
      results.metrics.memory.push(memory);
    }
    
    // Extract throughput
    const throughputMatch = result.stdout.match(/throughput[:\s]+(\d+\.?\d*)\s*(ops?\/s|operations)/i);
    if (throughputMatch) {
      const throughput = parseFloat(throughputMatch[1]);
      results.metrics.throughput.push(throughput);
    }
  }
}

function calculateSummaryMetrics(results) {
  // Calculate average latency
  if (results.metrics.latency.length > 0) {
    results.summary.averageLatency = results.metrics.latency.reduce((sum, val) => sum + val, 0) / results.metrics.latency.length;
  }
  
  // Calculate max memory usage
  if (results.metrics.memory.length > 0) {
    results.summary.maxMemoryUsage = Math.max(...results.metrics.memory);
  }
  
  // Calculate average throughput
  if (results.metrics.throughput.length > 0) {
    results.summary.averageThroughput = results.metrics.throughput.reduce((sum, val) => sum + val, 0) / results.metrics.throughput.length;
  }
}

function generateRecommendations(results) {
  const { summary } = results;
  
  // Latency recommendations
  if (summary.averageLatency > THRESHOLDS.latency.poor) {
    results.recommendations.push({
      type: 'critical',
      category: 'latency',
      message: `Average latency (${summary.averageLatency.toFixed(2)}ms) exceeds acceptable threshold (${THRESHOLDS.latency.poor}ms)`,
      suggestion: 'Optimize WebSocket communication, reduce payload sizes, and implement caching'
    });
  } else if (summary.averageLatency > THRESHOLDS.latency.acceptable) {
    results.recommendations.push({
      type: 'warning',
      category: 'latency',
      message: `Average latency (${summary.averageLatency.toFixed(2)}ms) is above target (${THRESHOLDS.latency.acceptable}ms)`,
      suggestion: 'Consider optimizing network communication and reducing processing time'
    });
  }
  
  // Memory recommendations
  if (summary.maxMemoryUsage > THRESHOLDS.memory.poor) {
    results.recommendations.push({
      type: 'critical',
      category: 'memory',
      message: `Peak memory usage (${(summary.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB) is excessive`,
      suggestion: 'Implement memory pooling, optimize data structures, and add memory leak detection'
    });
  } else if (summary.maxMemoryUsage > THRESHOLDS.memory.acceptable) {
    results.recommendations.push({
      type: 'warning',
      category: 'memory',
      message: `Memory usage (${(summary.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB) could be optimized`,
      suggestion: 'Review memory allocation patterns and implement cleanup routines'
    });
  }
  
  // Throughput recommendations
  if (summary.averageThroughput < THRESHOLDS.throughput.poor) {
    results.recommendations.push({
      type: 'critical',
      category: 'throughput',
      message: `Throughput (${summary.averageThroughput.toFixed(2)} ops/s) is below minimum requirements`,
      suggestion: 'Optimize command processing pipeline and implement request batching'
    });
  } else if (summary.averageThroughput < THRESHOLDS.throughput.acceptable) {
    results.recommendations.push({
      type: 'warning',
      category: 'throughput',
      message: `Throughput (${summary.averageThroughput.toFixed(2)} ops/s) could be improved`,
      suggestion: 'Consider parallel processing and caching strategies'
    });
  }
  
  // Success rate recommendations
  const successRate = results.summary.performanceTests > 0 ? 
    (results.summary.passedPerformance / results.summary.performanceTests) * 100 : 100;
  
  if (successRate < 95) {
    results.recommendations.push({
      type: 'critical',
      category: 'reliability',
      message: `Performance test success rate (${successRate.toFixed(1)}%) is below 95%`,
      suggestion: 'Investigate and fix failing performance tests to ensure system stability'
    });
  }
}

function generateReport(results) {
  const report = [];
  
  report.push('# Performance Analysis Report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  
  // Summary Section
  report.push('## Summary');
  report.push(`- **Total Tests**: ${results.summary.totalTests}`);
  report.push(`- **Performance Tests**: ${results.summary.performanceTests}`);
  report.push(`- **Performance Success Rate**: ${results.summary.performanceTests > 0 ? 
    ((results.summary.passedPerformance / results.summary.performanceTests) * 100).toFixed(1) : 'N/A'}%`);
  report.push(`- **Average Latency**: ${results.summary.averageLatency.toFixed(2)}ms`);
  report.push(`- **Max Memory Usage**: ${(results.summary.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
  report.push(`- **Average Throughput**: ${results.summary.averageThroughput.toFixed(2)} ops/sec`);
  report.push('');
  
  // Metrics Section
  report.push('## Detailed Metrics');
  
  if (results.metrics.latency.length > 0) {
    const latencies = results.metrics.latency.sort((a, b) => a - b);
    report.push('### Latency Distribution');
    report.push(`- **Min**: ${Math.min(...latencies).toFixed(2)}ms`);
    report.push(`- **Max**: ${Math.max(...latencies).toFixed(2)}ms`);
    report.push(`- **Median**: ${latencies[Math.floor(latencies.length / 2)].toFixed(2)}ms`);
    report.push(`- **95th Percentile**: ${latencies[Math.floor(latencies.length * 0.95)].toFixed(2)}ms`);
    report.push('');
  }
  
  if (results.metrics.memory.length > 0) {
    report.push('### Memory Usage');
    report.push(`- **Peak Usage**: ${(Math.max(...results.metrics.memory) / 1024 / 1024).toFixed(2)}MB`);
    report.push(`- **Average Usage**: ${(results.metrics.memory.reduce((sum, val) => sum + val, 0) / results.metrics.memory.length / 1024 / 1024).toFixed(2)}MB`);
    report.push('');
  }
  
  // Recommendations Section
  if (results.recommendations.length > 0) {
    report.push('## Recommendations');
    
    const critical = results.recommendations.filter(r => r.type === 'critical');
    const warnings = results.recommendations.filter(r => r.type === 'warning');
    
    if (critical.length > 0) {
      report.push('### Critical Issues');
      critical.forEach(rec => {
        report.push(`- **${rec.category.toUpperCase()}**: ${rec.message}`);
        report.push(`  - *Suggestion*: ${rec.suggestion}`);
      });
      report.push('');
    }
    
    if (warnings.length > 0) {
      report.push('### Warnings');
      warnings.forEach(rec => {
        report.push(`- **${rec.category.toUpperCase()}**: ${rec.message}`);
        report.push(`  - *Suggestion*: ${rec.suggestion}`);
      });
      report.push('');
    }
  }
  
  // Compliance Check
  report.push('## Compliance Status');
  const latencyCompliant = results.summary.averageLatency <= THRESHOLDS.latency.acceptable;
  const memoryCompliant = results.summary.maxMemoryUsage <= THRESHOLDS.memory.acceptable;
  const throughputCompliant = results.summary.averageThroughput >= THRESHOLDS.throughput.acceptable;
  
  report.push(`- **Latency Compliance**: ${latencyCompliant ? '✅ PASS' : '❌ FAIL'} (≤${THRESHOLDS.latency.acceptable}ms)`);
  report.push(`- **Memory Compliance**: ${memoryCompliant ? '✅ PASS' : '❌ FAIL'} (≤${(THRESHOLDS.memory.acceptable / 1024 / 1024).toFixed(0)}MB)`);
  report.push(`- **Throughput Compliance**: ${throughputCompliant ? '✅ PASS' : '❌ FAIL'} (≥${THRESHOLDS.throughput.acceptable} ops/s)`);
  
  const overallCompliant = latencyCompliant && memoryCompliant && throughputCompliant;
  report.push(`- **Overall Compliance**: ${overallCompliant ? '✅ PASS' : '❌ FAIL'}`);
  
  return report.join('\n');
}

// Main execution
if (require.main === module) {
  const resultsDir = process.argv[2];
  
  if (!resultsDir) {
    console.error('Usage: node analyze-performance.js <results-directory>');
    process.exit(1);
  }
  
  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory does not exist: ${resultsDir}`);
    process.exit(1);
  }
  
  try {
    const results = analyzePerformance(resultsDir);
    const report = generateReport(results);
    console.log(report);
    
    // Write detailed results to JSON file
    fs.writeFileSync('performance-analysis.json', JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('Error analyzing performance:', error);
    process.exit(1);
  }
}

module.exports = { analyzePerformance, generateReport };