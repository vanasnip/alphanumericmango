#!/usr/bin/env node

/**
 * GitHub Summary Generator
 * Creates a GitHub Actions summary from test results
 */

const fs = require('fs');
const path = require('path');

function createGitHubSummary(allResultsDir) {
  const summary = [];
  
  // Parse test results
  const results = parseTestResults(allResultsDir);
  
  // Add title and status
  summary.push('# 🧪 E2E System Validation Results');
  summary.push('');
  
  if (results.overallSuccess) {
    summary.push('## ✅ System Validation **PASSED**');
    summary.push('');
    summary.push('🎉 All system validation requirements have been met!');
  } else {
    summary.push('## ❌ System Validation **FAILED**');
    summary.push('');
    summary.push('⚠️ Some critical requirements were not met. Review the details below.');
  }
  
  summary.push('');
  
  // Add quick metrics
  summary.push('## 📊 Quick Metrics');
  summary.push('');
  summary.push('| Metric | Value | Status |');
  summary.push('|--------|-------|--------|');
  summary.push(`| Success Rate | ${results.successRate.toFixed(1)}% | ${results.successRate >= 95 ? '✅' : '❌'} |`);
  summary.push(`| Avg Latency | ${results.avgLatency.toFixed(2)}ms | ${results.avgLatency <= 65 ? '✅' : '❌'} |`);
  summary.push(`| Test Suites | ${results.passedSuites}/${results.totalSuites} | ${results.passedSuites === results.totalSuites ? '✅' : '❌'} |`);
  summary.push(`| Browsers | ${results.browserCount} tested | ${results.browserCount >= 3 ? '✅' : '⚠️'} |`);
  summary.push('');
  
  // Add compliance status
  summary.push('## 🎯 Compliance Status');
  summary.push('');
  const compliance = results.compliance;
  summary.push('| Requirement | Status | Details |');
  summary.push('|-------------|--------|---------|');
  summary.push(`| User Journey Completion | ${compliance.userJourney ? '✅' : '❌'} | 100% completion rate required |`);
  summary.push(`| End-to-End Latency | ${compliance.latency ? '✅' : '❌'} | <65ms requirement |`);
  summary.push(`| Zero Data Loss | ${compliance.dataLoss ? '✅' : '❌'} | No data loss events |`);
  summary.push(`| Recovery Time | ${compliance.recovery ? '✅' : '❌'} | <5 second recovery |`);
  summary.push(`| Cross-Browser Parity | ${compliance.browser ? '✅' : '❌'} | >98% feature parity |`);
  summary.push('');
  
  // Add test suite breakdown
  summary.push('## 📋 Test Suite Results');
  summary.push('');
  
  if (results.suites && results.suites.length > 0) {
    results.suites.forEach(suite => {
      const status = suite.failed === 0 ? '✅' : '❌';
      const rate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : '0';
      
      summary.push(`### ${status} ${suite.name}`);
      summary.push(`- **Tests**: ${suite.passed}/${suite.total} passed (${rate}%)`);
      summary.push(`- **Duration**: ${(suite.duration / 1000).toFixed(1)}s`);
      
      if (suite.browser) {
        summary.push(`- **Browser**: ${suite.browser}`);
      }
      
      if (suite.failed > 0 && suite.errors.length > 0) {
        summary.push('- **Issues**:');
        suite.errors.slice(0, 3).forEach(error => { // Limit to first 3 errors
          summary.push(`  - ${error}`);
        });
        if (suite.errors.length > 3) {
          summary.push(`  - ... and ${suite.errors.length - 3} more`);
        }
      }
      summary.push('');
    });
  }
  
  // Add performance insights
  if (results.performance) {
    summary.push('## ⚡ Performance Insights');
    summary.push('');
    
    const perf = results.performance;
    summary.push('| Metric | Value | Threshold | Status |');
    summary.push('|--------|-------|-----------|--------|');
    summary.push(`| Average Latency | ${perf.avgLatency}ms | ≤65ms | ${perf.avgLatency <= 65 ? '✅' : '❌'} |`);
    summary.push(`| P95 Latency | ${perf.p95Latency}ms | ≤100ms | ${perf.p95Latency <= 100 ? '✅' : '❌'} |`);
    summary.push(`| Memory Usage | ${perf.memory}MB | ≤200MB | ${perf.memory <= 200 ? '✅' : '❌'} |`);
    summary.push(`| Throughput | ${perf.throughput} ops/s | ≥10 ops/s | ${perf.throughput >= 10 ? '✅' : '❌'} |`);
    summary.push('');
  }
  
  // Add critical issues
  if (results.criticalIssues && results.criticalIssues.length > 0) {
    summary.push('## 🚨 Critical Issues');
    summary.push('');
    results.criticalIssues.forEach(issue => {
      summary.push(`- ⚠️ ${issue}`);
    });
    summary.push('');
  }
  
  // Add recommendations
  if (results.recommendations && results.recommendations.length > 0) {
    summary.push('## 💡 Key Recommendations');
    summary.push('');
    
    const critical = results.recommendations.filter(r => r.priority === 'Critical').slice(0, 3);
    const high = results.recommendations.filter(r => r.priority === 'High').slice(0, 2);
    
    if (critical.length > 0) {
      summary.push('### 🔴 Critical Priority');
      critical.forEach(rec => {
        summary.push(`- **${rec.category}**: ${rec.issue}`);
      });
      summary.push('');
    }
    
    if (high.length > 0) {
      summary.push('### 🟡 High Priority');
      high.forEach(rec => {
        summary.push(`- **${rec.category}**: ${rec.issue}`);
      });
      summary.push('');
    }
  }
  
  // Add environment info
  summary.push('## 🔧 Environment');
  summary.push('');
  summary.push(`- **Node Version**: ${process.version}`);
  summary.push(`- **Environment**: ${process.env.NODE_ENV || 'test'}`);
  summary.push(`- **CI**: ${process.env.CI ? 'Yes' : 'No'}`);
  summary.push(`- **Timestamp**: ${new Date().toISOString()}`);
  summary.push('');
  
  // Add artifacts info
  summary.push('## 📎 Artifacts');
  summary.push('');
  summary.push('The following test artifacts are available:');
  summary.push('- 📊 Detailed HTML reports');
  summary.push('- 📹 Test execution videos (on failure)');
  summary.push('- 📸 Screenshots (on failure)');
  summary.push('- 📋 Performance analysis');
  summary.push('- 🔒 Security validation report');
  summary.push('- ♿ Accessibility compliance report');
  summary.push('');
  
  // Add footer
  summary.push('---');
  summary.push('*Generated by E2E System Validation Framework*');
  
  return summary.join('\n');
}

function parseTestResults(allResultsDir) {
  const results = {
    overallSuccess: false,
    successRate: 0,
    avgLatency: 0,
    totalSuites: 0,
    passedSuites: 0,
    browserCount: 0,
    suites: [],
    compliance: {
      userJourney: false,
      latency: false,
      dataLoss: true,
      recovery: false,
      browser: false
    },
    performance: {
      avgLatency: 0,
      p95Latency: 0,
      memory: 0,
      throughput: 0
    },
    criticalIssues: [],
    recommendations: []
  };
  
  try {
    // Try to read the generated final report
    const reportPath = path.join(process.cwd(), 'system-validation-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      
      results.overallSuccess = report.complianceStatus?.overallCompliance || false;
      results.successRate = report.summary?.successRate || 0;
      results.avgLatency = report.performanceMetrics?.averageLatency || 0;
      results.totalSuites = report.summary?.totalTestSuites || 0;
      results.passedSuites = report.summary?.passedSuites || 0;
      results.browserCount = report.browserCompatibility?.supportedBrowsers?.length || 0;
      
      // Parse compliance
      if (report.complianceStatus) {
        results.compliance = {
          userJourney: report.complianceStatus.userJourneyCompletion,
          latency: report.complianceStatus.endToEndLatency,
          dataLoss: report.complianceStatus.dataLossEvents,
          recovery: report.complianceStatus.recoveryTime,
          browser: report.complianceStatus.crossBrowserParity
        };
      }
      
      // Parse performance
      if (report.performanceMetrics) {
        results.performance = {
          avgLatency: report.performanceMetrics.averageLatency,
          p95Latency: report.performanceMetrics.p95Latency,
          memory: report.performanceMetrics.memoryUsage,
          throughput: report.performanceMetrics.throughput
        };
      }
      
      // Parse suites
      if (report.suiteResults) {
        results.suites = Object.entries(report.suiteResults).map(([name, suite]) => ({
          name,
          total: suite.totalTests || 0,
          passed: suite.passedTests || 0,
          failed: suite.failedTests || 0,
          duration: suite.duration || 0,
          browser: suite.browser || 'unknown',
          errors: suite.issues?.map(issue => issue.error) || []
        }));
      }
      
      results.criticalIssues = report.criticalIssues || [];
      results.recommendations = report.recommendations || [];
      
    } else {
      // Fallback: try to parse individual result files
      console.warn('No final report found, parsing individual results...');
      parseIndividualResults(allResultsDir, results);
    }
  } catch (error) {
    console.error('Error parsing test results:', error);
    // Set some default values to prevent summary generation failure
    results.criticalIssues.push('Error parsing test results');
  }
  
  return results;
}

function parseIndividualResults(allResultsDir, results) {
  if (!fs.existsSync(allResultsDir)) {
    return;
  }
  
  const dirs = fs.readdirSync(allResultsDir);
  let totalTests = 0;
  let passedTests = 0;
  
  dirs.forEach(dir => {
    const dirPath = path.join(allResultsDir, dir);
    if (fs.statSync(dirPath).isDirectory() && dir.includes('test-results')) {
      // Parse this test result directory
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (file.endsWith('.json') && file.includes('results')) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
            if (data.suites) {
              data.suites.forEach(suite => {
                if (suite.specs) {
                  suite.specs.forEach(spec => {
                    totalTests++;
                    if (spec.ok) passedTests++;
                  });
                }
              });
            }
          } catch (error) {
            console.error(`Error parsing ${file}:`, error.message);
          }
        }
      });
    }
  });
  
  results.successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  results.overallSuccess = results.successRate >= 95;
}

// Main execution
if (require.main === module) {
  const allResultsDir = process.argv[2];
  
  if (!allResultsDir) {
    console.error('Usage: node create-github-summary.js <all-results-directory>');
    process.exit(1);
  }
  
  try {
    const summary = createGitHubSummary(allResultsDir);
    console.log(summary);
  } catch (error) {
    console.error('Error creating GitHub summary:', error);
    // Output a basic error summary instead of failing completely
    console.log('# 🧪 E2E System Validation Results\n\n## ❌ Error\n\nFailed to generate test summary. Please check the logs for details.\n');
    process.exit(1);
  }
}

module.exports = { createGitHubSummary };