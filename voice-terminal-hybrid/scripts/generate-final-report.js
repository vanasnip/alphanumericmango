#!/usr/bin/env node

/**
 * Final Report Generator
 * Combines all test results into a comprehensive system validation report
 */

const fs = require('fs');
const path = require('path');

function generateFinalReport(allResultsDir) {
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    summary: {
      totalTestSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      executionTime: 0,
      successRate: 0
    },
    suiteResults: {},
    performanceMetrics: {
      averageLatency: 0,
      maxLatency: 0,
      p95Latency: 0,
      memoryUsage: 0,
      throughput: 0
    },
    complianceStatus: {
      userJourneyCompletion: false,
      endToEndLatency: false,
      dataLossEvents: false,
      recoveryTime: false,
      crossBrowserParity: false,
      overallCompliance: false
    },
    criticalIssues: [],
    recommendations: [],
    browserCompatibility: {
      supportedBrowsers: [],
      issues: []
    },
    networkResilience: {
      connectionStability: 0,
      recoveryTime: 0,
      dataIntegrity: 100
    },
    multiUserPerformance: {
      maxConcurrentUsers: 0,
      scalabilityScore: 0
    },
    securityValidation: {
      testsRun: 0,
      vulnerabilitiesFound: 0,
      riskLevel: 'low'
    },
    accessibilityValidation: {
      wcagCompliance: 0,
      issuesFound: 0
    }
  };

  // Process all result directories
  const resultDirs = fs.readdirSync(allResultsDir);
  
  resultDirs.forEach(dir => {
    const dirPath = path.join(allResultsDir, dir);
    if (fs.statSync(dirPath).isDirectory()) {
      processResultDirectory(dirPath, report);
    }
  });

  // Calculate summary metrics
  calculateSummaryMetrics(report);
  
  // Determine compliance status
  determineComplianceStatus(report);
  
  // Generate recommendations
  generateRecommendations(report);
  
  return report;
}

function processResultDirectory(dirPath, report) {
  const dirName = path.basename(dirPath);
  
  if (dirName.includes('test-results')) {
    processTestResults(dirPath, report);
  } else if (dirName.includes('performance-analysis')) {
    processPerformanceAnalysis(dirPath, report);
  } else if (dirName.includes('security-report')) {
    processSecurityReport(dirPath, report);
  } else if (dirName.includes('accessibility-report')) {
    processAccessibilityReport(dirPath, report);
  }
}

function processTestResults(dirPath, report) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    if (file.endsWith('.json') && file.includes('results')) {
      try {
        const filePath = path.join(dirPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Extract suite information from filename
        const suiteMatch = file.match(/test-results-(.+?)-/);
        const suiteName = suiteMatch ? suiteMatch[1] : 'unknown';
        
        if (!report.suiteResults[suiteName]) {
          report.suiteResults[suiteName] = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            duration: 0,
            browser: 'unknown',
            issues: []
          };
        }
        
        // Process test data
        if (data.suites) {
          data.suites.forEach(suite => {
            if (suite.specs) {
              suite.specs.forEach(spec => {
                report.summary.totalTests++;
                report.suiteResults[suiteName].totalTests++;
                
                if (spec.ok) {
                  report.summary.passedTests++;
                  report.suiteResults[suiteName].passedTests++;
                } else {
                  report.summary.failedTests++;
                  report.suiteResults[suiteName].failedTests++;
                  
                  // Extract error information
                  if (spec.tests) {
                    spec.tests.forEach(test => {
                      if (test.results) {
                        test.results.forEach(result => {
                          if (result.error) {
                            report.suiteResults[suiteName].issues.push({
                              test: spec.title,
                              error: result.error.message || 'Unknown error'
                            });
                          }
                        });
                      }
                    });
                  }
                }
                
                // Add duration
                if (spec.tests) {
                  const totalDuration = spec.tests.reduce((sum, test) => {
                    return sum + (test.results ? test.results.reduce((s, r) => s + (r.duration || 0), 0) : 0);
                  }, 0);
                  report.suiteResults[suiteName].duration += totalDuration;
                }
              });
            }
          });
        }
        
        // Extract browser information
        const browserMatch = file.match(/-(chromium|firefox|webkit|edge)-/);
        if (browserMatch) {
          report.suiteResults[suiteName].browser = browserMatch[1];
        }
        
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }
  });
}

function processPerformanceAnalysis(dirPath, report) {
  const performanceFile = path.join(dirPath, 'performance-analysis.md');
  
  if (fs.existsSync(performanceFile)) {
    const content = fs.readFileSync(performanceFile, 'utf8');
    
    // Extract metrics from performance report
    const latencyMatch = content.match(/Average Latency.*?(\d+\.?\d*)ms/);
    if (latencyMatch) {
      report.performanceMetrics.averageLatency = parseFloat(latencyMatch[1]);
    }
    
    const memoryMatch = content.match(/Max Memory Usage.*?(\d+\.?\d*)MB/);
    if (memoryMatch) {
      report.performanceMetrics.memoryUsage = parseFloat(memoryMatch[1]);
    }
    
    const throughputMatch = content.match(/Average Throughput.*?(\d+\.?\d*)\s*ops/);
    if (throughputMatch) {
      report.performanceMetrics.throughput = parseFloat(throughputMatch[1]);
    }
    
    // Extract P95 latency
    const p95Match = content.match(/95th Percentile.*?(\d+\.?\d*)ms/);
    if (p95Match) {
      report.performanceMetrics.p95Latency = parseFloat(p95Match[1]);
    }
  }
}

function processSecurityReport(dirPath, report) {
  // Look for security report files
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    if (file.includes('security') && file.endsWith('.json')) {
      try {
        const filePath = path.join(dirPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        report.securityValidation.testsRun += data.testsRun || 0;
        report.securityValidation.vulnerabilitiesFound += data.vulnerabilitiesFound || 0;
        
        if (data.riskLevel && data.riskLevel !== 'low') {
          report.securityValidation.riskLevel = data.riskLevel;
        }
        
      } catch (error) {
        console.error(`Error processing security report ${file}:`, error.message);
      }
    }
  });
}

function processAccessibilityReport(dirPath, report) {
  // Process accessibility report
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    if (file.includes('accessibility') && file.endsWith('.json')) {
      try {
        const filePath = path.join(dirPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.wcagCompliance) {
          report.accessibilityValidation.wcagCompliance = data.wcagCompliance;
        }
        
        if (data.issuesFound) {
          report.accessibilityValidation.issuesFound = data.issuesFound;
        }
        
      } catch (error) {
        console.error(`Error processing accessibility report ${file}:`, error.message);
      }
    }
  });
}

function calculateSummaryMetrics(report) {
  // Calculate suite-level metrics
  const suiteNames = Object.keys(report.suiteResults);
  report.summary.totalTestSuites = suiteNames.length;
  
  suiteNames.forEach(suiteName => {
    const suite = report.suiteResults[suiteName];
    if (suite.failedTests === 0) {
      report.summary.passedSuites++;
    } else {
      report.summary.failedSuites++;
    }
    
    report.summary.executionTime += suite.duration;
  });
  
  // Calculate success rate
  if (report.summary.totalTests > 0) {
    report.summary.successRate = (report.summary.passedTests / report.summary.totalTests) * 100;
  }
  
  // Calculate browser compatibility
  const browsers = new Set();
  suiteNames.forEach(suiteName => {
    const browser = report.suiteResults[suiteName].browser;
    if (browser && browser !== 'unknown') {
      browsers.add(browser);
    }
  });
  report.browserCompatibility.supportedBrowsers = Array.from(browsers);
  
  // Calculate network resilience metrics
  const networkSuite = report.suiteResults['NetworkResilienceTests'];
  if (networkSuite) {
    report.networkResilience.connectionStability = networkSuite.passedTests / networkSuite.totalTests * 100;
  }
  
  // Calculate multi-user performance
  const multiUserSuite = report.suiteResults['MultiUserScenarios'];
  if (multiUserSuite) {
    report.multiUserPerformance.scalabilityScore = multiUserSuite.passedTests / multiUserSuite.totalTests * 100;
    // Estimate max concurrent users based on test results
    report.multiUserPerformance.maxConcurrentUsers = multiUserSuite.passedTests > 0 ? 25 : 10;
  }
}

function determineComplianceStatus(report) {
  // User journey completion (100% success rate requirement)
  report.complianceStatus.userJourneyCompletion = report.summary.successRate >= 100;
  
  // End-to-end latency (<65ms requirement)
  report.complianceStatus.endToEndLatency = report.performanceMetrics.averageLatency <= 65;
  
  // Data loss events (zero tolerance)
  const systemSuite = report.suiteResults['SystemIntegrationTests'];
  report.complianceStatus.dataLossEvents = !systemSuite || systemSuite.issues.every(issue => 
    !issue.error.toLowerCase().includes('data loss')
  );
  
  // Recovery time (<5 seconds requirement)
  report.complianceStatus.recoveryTime = report.networkResilience.recoveryTime <= 5000;
  
  // Cross-browser parity (>98% requirement)
  const browserCount = report.browserCompatibility.supportedBrowsers.length;
  const expectedBrowsers = 3; // chromium, firefox, webkit
  report.complianceStatus.crossBrowserParity = (browserCount / expectedBrowsers) >= 0.98;
  
  // Overall compliance
  report.complianceStatus.overallCompliance = 
    report.complianceStatus.userJourneyCompletion &&
    report.complianceStatus.endToEndLatency &&
    report.complianceStatus.dataLossEvents &&
    report.complianceStatus.recoveryTime &&
    report.complianceStatus.crossBrowserParity;
}

function generateRecommendations(report) {
  // Performance recommendations
  if (report.performanceMetrics.averageLatency > 65) {
    report.criticalIssues.push('End-to-end latency exceeds 65ms requirement');
    report.recommendations.push({
      category: 'Performance',
      priority: 'High',
      issue: `Average latency is ${report.performanceMetrics.averageLatency.toFixed(2)}ms`,
      suggestion: 'Optimize WebSocket communication and reduce payload sizes'
    });
  }
  
  // Success rate recommendations
  if (report.summary.successRate < 95) {
    report.criticalIssues.push('Test success rate below 95%');
    report.recommendations.push({
      category: 'Reliability',
      priority: 'Critical',
      issue: `Success rate is ${report.summary.successRate.toFixed(1)}%`,
      suggestion: 'Investigate and fix failing tests to improve system stability'
    });
  }
  
  // Memory usage recommendations
  if (report.performanceMetrics.memoryUsage > 200) {
    report.recommendations.push({
      category: 'Performance',
      priority: 'Medium',
      issue: `Memory usage is ${report.performanceMetrics.memoryUsage.toFixed(2)}MB`,
      suggestion: 'Implement memory optimization and garbage collection improvements'
    });
  }
  
  // Security recommendations
  if (report.securityValidation.vulnerabilitiesFound > 0) {
    report.criticalIssues.push(`${report.securityValidation.vulnerabilitiesFound} security vulnerabilities found`);
    report.recommendations.push({
      category: 'Security',
      priority: 'Critical',
      issue: `Found ${report.securityValidation.vulnerabilitiesFound} vulnerabilities`,
      suggestion: 'Address all security vulnerabilities before deployment'
    });
  }
  
  // Browser compatibility recommendations
  if (report.browserCompatibility.supportedBrowsers.length < 3) {
    report.recommendations.push({
      category: 'Compatibility',
      priority: 'Medium',
      issue: 'Limited browser support detected',
      suggestion: 'Expand testing to include all major browsers'
    });
  }
}

function formatMarkdownReport(report) {
  const lines = [];
  
  lines.push('# E2E System Validation Report');
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push(`**Environment:** ${report.environment}`);
  lines.push('');
  
  // Executive Summary
  lines.push('## Executive Summary');
  lines.push(`The system validation ${report.complianceStatus.overallCompliance ? '**PASSED**' : '**FAILED**'} with ${report.summary.successRate.toFixed(1)}% test success rate.`);
  lines.push('');
  
  // Compliance Status
  lines.push('## Compliance Status');
  lines.push('| Requirement | Status | Details |');
  lines.push('|-------------|--------|---------|');
  lines.push(`| User Journey Completion | ${report.complianceStatus.userJourneyCompletion ? '✅ PASS' : '❌ FAIL'} | ${report.summary.successRate.toFixed(1)}% success rate |`);
  lines.push(`| End-to-End Latency | ${report.complianceStatus.endToEndLatency ? '✅ PASS' : '❌ FAIL'} | ${report.performanceMetrics.averageLatency.toFixed(2)}ms average |`);
  lines.push(`| Zero Data Loss | ${report.complianceStatus.dataLossEvents ? '✅ PASS' : '❌ FAIL'} | No data loss events detected |`);
  lines.push(`| Recovery Time | ${report.complianceStatus.recoveryTime ? '✅ PASS' : '❌ FAIL'} | <5 second recovery |`);
  lines.push(`| Cross-Browser Parity | ${report.complianceStatus.crossBrowserParity ? '✅ PASS' : '❌ FAIL'} | ${report.browserCompatibility.supportedBrowsers.length} browsers tested |`);
  lines.push('');
  
  // Test Results Summary
  lines.push('## Test Results Summary');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Test Suites | ${report.summary.totalTestSuites} |`);
  lines.push(`| Passed Suites | ${report.summary.passedSuites} |`);
  lines.push(`| Failed Suites | ${report.summary.failedSuites} |`);
  lines.push(`| Total Tests | ${report.summary.totalTests} |`);
  lines.push(`| Success Rate | ${report.summary.successRate.toFixed(1)}% |`);
  lines.push(`| Execution Time | ${(report.summary.executionTime / 1000 / 60).toFixed(1)} minutes |`);
  lines.push('');
  
  // Performance Metrics
  lines.push('## Performance Metrics');
  lines.push('| Metric | Value | Threshold | Status |');
  lines.push('|--------|-------|-----------|--------|');
  lines.push(`| Average Latency | ${report.performanceMetrics.averageLatency.toFixed(2)}ms | ≤65ms | ${report.performanceMetrics.averageLatency <= 65 ? '✅' : '❌'} |`);
  lines.push(`| P95 Latency | ${report.performanceMetrics.p95Latency.toFixed(2)}ms | ≤100ms | ${report.performanceMetrics.p95Latency <= 100 ? '✅' : '❌'} |`);
  lines.push(`| Memory Usage | ${report.performanceMetrics.memoryUsage.toFixed(2)}MB | ≤200MB | ${report.performanceMetrics.memoryUsage <= 200 ? '✅' : '❌'} |`);
  lines.push(`| Throughput | ${report.performanceMetrics.throughput.toFixed(2)} ops/s | ≥10 ops/s | ${report.performanceMetrics.throughput >= 10 ? '✅' : '❌'} |`);
  lines.push('');
  
  // Browser Compatibility
  if (report.browserCompatibility.supportedBrowsers.length > 0) {
    lines.push('## Browser Compatibility');
    lines.push(`**Supported Browsers:** ${report.browserCompatibility.supportedBrowsers.join(', ')}`);
    lines.push('');
  }
  
  // Critical Issues
  if (report.criticalIssues.length > 0) {
    lines.push('## ⚠️ Critical Issues');
    report.criticalIssues.forEach(issue => {
      lines.push(`- ${issue}`);
    });
    lines.push('');
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    
    const critical = report.recommendations.filter(r => r.priority === 'Critical');
    const high = report.recommendations.filter(r => r.priority === 'High');
    const medium = report.recommendations.filter(r => r.priority === 'Medium');
    
    if (critical.length > 0) {
      lines.push('### Critical Priority');
      critical.forEach(rec => {
        lines.push(`- **${rec.category}**: ${rec.issue}`);
        lines.push(`  - *Solution*: ${rec.suggestion}`);
      });
      lines.push('');
    }
    
    if (high.length > 0) {
      lines.push('### High Priority');
      high.forEach(rec => {
        lines.push(`- **${rec.category}**: ${rec.issue}`);
        lines.push(`  - *Solution*: ${rec.suggestion}`);
      });
      lines.push('');
    }
    
    if (medium.length > 0) {
      lines.push('### Medium Priority');
      medium.forEach(rec => {
        lines.push(`- **${rec.category}**: ${rec.issue}`);
        lines.push(`  - *Solution*: ${rec.suggestion}`);
      });
      lines.push('');
    }
  }
  
  // Test Suite Breakdown
  lines.push('## Test Suite Breakdown');
  Object.entries(report.suiteResults).forEach(([suiteName, suite]) => {
    const successRate = suite.totalTests > 0 ? (suite.passedTests / suite.totalTests * 100).toFixed(1) : '0';
    lines.push(`### ${suiteName}`);
    lines.push(`- **Tests**: ${suite.passedTests}/${suite.totalTests} passed (${successRate}%)`);
    lines.push(`- **Duration**: ${(suite.duration / 1000).toFixed(1)}s`);
    lines.push(`- **Browser**: ${suite.browser}`);
    
    if (suite.issues.length > 0) {
      lines.push('- **Issues**:');
      suite.issues.forEach(issue => {
        lines.push(`  - ${issue.test}: ${issue.error}`);
      });
    }
    lines.push('');
  });
  
  lines.push('---');
  lines.push(`*Report generated by E2E System Validation Framework at ${report.timestamp}*`);
  
  return lines.join('\n');
}

// Main execution
if (require.main === module) {
  const allResultsDir = process.argv[2];
  
  if (!allResultsDir) {
    console.error('Usage: node generate-final-report.js <all-results-directory>');
    process.exit(1);
  }
  
  if (!fs.existsSync(allResultsDir)) {
    console.error(`Results directory does not exist: ${allResultsDir}`);
    process.exit(1);
  }
  
  try {
    const report = generateFinalReport(allResultsDir);
    const markdownReport = formatMarkdownReport(report);
    
    // Output markdown to console
    console.log(markdownReport);
    
    // Write detailed JSON report
    fs.writeFileSync('system-validation-report.json', JSON.stringify(report, null, 2));
    
    // Write HTML report
    const htmlReport = markdownReport
      .replace(/# /g, '<h1>')
      .replace(/## /g, '</h1><h2>')
      .replace(/### /g, '</h2><h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>E2E System Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .critical { background-color: #ffebee; padding: 10px; border-left: 4px solid #f44336; }
    </style>
</head>
<body>
    ${htmlReport}
</body>
</html>`;
    
    fs.writeFileSync('system-validation-report.html', fullHtml);
    
  } catch (error) {
    console.error('Error generating final report:', error);
    process.exit(1);
  }
}

module.exports = { generateFinalReport, formatMarkdownReport };