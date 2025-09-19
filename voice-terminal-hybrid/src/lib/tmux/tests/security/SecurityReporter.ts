/**
 * Security Test Reporter and Automation Infrastructure
 * 
 * This module provides comprehensive reporting, alerting, and automation
 * for security testing results. Integrates with CI/CD pipelines and
 * provides real-time security monitoring.
 */

import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SecurityTestResult, SecurityTestSuite } from './SecurityTestSuite';
import { AttackVectorTests, AttackTestResult } from './AttackVectorTests';
import { PenetrationTests, PenetrationTestResult } from './PenetrationTests';
import { RegressionTests, RegressionTestResult } from './RegressionTests';

export interface SecurityReport {
  version: string;
  timestamp: number;
  buildNumber?: string;
  gitCommit?: string;
  environment: string;
  summary: SecuritySummary;
  testResults: {
    securitySuite: SecurityTestResult[];
    attackVectors: AttackTestResult[];
    penetrationTests: PenetrationTestResult[];
    regressionTests: RegressionTestResult[];
  };
  metrics: SecurityMetrics;
  riskAssessment: RiskAssessment;
  recommendations: SecurityRecommendation[];
  alerts: SecurityAlert[];
}

export interface SecuritySummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalVulnerabilities: number;
  highRiskVulnerabilities: number;
  regressions: number;
  testCoverage: number;
  overallSecurityScore: number;
  status: 'SECURE' | 'WARNING' | 'CRITICAL' | 'FAIL';
}

export interface SecurityMetrics {
  vulnerability: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  performance: {
    averageExecutionTime: number;
    slowestTest: string;
    fastestTest: string;
    performanceImpact: number;
  };
  coverage: {
    attackVectorsCovered: number;
    totalAttackVectors: number;
    categoryBreakdown: Record<string, number>;
  };
  trend: {
    improvementRate: number;
    regressionRate: number;
    stabilityScore: number;
  };
}

export interface RiskAssessment {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  topRisks: RiskFactor[];
  mitigationEffectiveness: number;
  residualRisk: number;
}

export interface RiskFactor {
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  mitigation: string;
}

export interface SecurityRecommendation {
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  actionItems: string[];
  estimatedEffort: string;
  businessImpact: string;
}

export interface SecurityAlert {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'VULNERABILITY' | 'REGRESSION' | 'PERFORMANCE' | 'TREND';
  title: string;
  description: string;
  affectedTests: string[];
  recommendedActions: string[];
  urgency: 'IMMEDIATE' | 'URGENT' | 'NORMAL' | 'LOW';
}

export interface ReporterConfig {
  outputDirectory: string;
  reportFormats: ('json' | 'html' | 'pdf' | 'junit' | 'sarif')[];
  enableRealTimeAlerts: boolean;
  alertThresholds: {
    critical: number;
    high: number;
    regressions: number;
  };
  integrations: {
    slack?: SlackConfig;
    teams?: TeamsConfig;
    email?: EmailConfig;
    jira?: JiraConfig;
  };
  cicd: {
    failOnCritical: boolean;
    failOnHigh: boolean;
    failOnRegressions: boolean;
    maxAcceptableRisk: number;
  };
}

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  username: string;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  recipients: string[];
}

export interface JiraConfig {
  url: string;
  username: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
}

/**
 * Comprehensive Security Testing Reporter
 * Provides automated reporting, alerting, and CI/CD integration
 */
export class SecurityReporter extends EventEmitter {
  private config: ReporterConfig;
  private report: SecurityReport;

  constructor(config: Partial<ReporterConfig> = {}) {
    super();
    
    this.config = {
      outputDirectory: config.outputDirectory || './security-reports',
      reportFormats: config.reportFormats || ['json', 'html'],
      enableRealTimeAlerts: config.enableRealTimeAlerts ?? true,
      alertThresholds: {
        critical: config.alertThresholds?.critical || 1,
        high: config.alertThresholds?.high || 3,
        regressions: config.alertThresholds?.regressions || 1,
        ...config.alertThresholds
      },
      integrations: config.integrations || {},
      cicd: {
        failOnCritical: config.cicd?.failOnCritical ?? true,
        failOnHigh: config.cicd?.failOnHigh ?? false,
        failOnRegressions: config.cicd?.failOnRegressions ?? true,
        maxAcceptableRisk: config.cicd?.maxAcceptableRisk || 20,
        ...config.cicd
      }
    };

    this.initializeReport();
    this.ensureOutputDirectory();
  }

  /**
   * Run comprehensive security testing and generate reports
   */
  async generateComprehensiveSecurityReport(): Promise<SecurityReport> {
    console.log('🛡️ Starting Comprehensive Security Testing and Reporting...');
    
    const startTime = Date.now();
    this.emit('reporting-started', { timestamp: startTime });

    try {
      // Initialize test suites
      const securitySuite = new SecurityTestSuite({
        maxExecutionTime: 60000,
        enablePenetrationTesting: true,
        maliciousPayloadTesting: true,
        performanceImpactAnalysis: true
      });

      const attackVectorTests = new AttackVectorTests();
      
      const penetrationTests = new PenetrationTests({
        enableDestructiveTesting: false,
        simulateAPT: true,
        testPrivilegeEscalation: true,
        enablePersistenceTesting: false // Safety first
      });

      const regressionTests = new RegressionTests({
        autoUpdateBaseline: false,
        enableTrendAnalysis: true,
        alertOnRegression: true
      });

      // Execute all test suites
      console.log('🔍 Running security test suite...');
      const securityResults = await securitySuite.runComprehensiveSecuritySuite();
      
      console.log('🎯 Running attack vector tests...');
      const attackResults = await attackVectorTests.runAllAttackVectorTests();
      
      console.log('🔴 Running penetration tests...');
      const penetrationResults = await penetrationTests.runPenetrationTests();
      
      console.log('🔄 Running regression tests...');
      const regressionResults = await regressionTests.runRegressionTests();

      // Populate report with results
      this.report.testResults = {
        securitySuite: securityResults,
        attackVectors: attackResults,
        penetrationTests: penetrationResults,
        regressionTests: regressionResults
      };

      // Generate comprehensive analysis
      this.generateSummary();
      this.calculateMetrics();
      this.performRiskAssessment();
      this.generateRecommendations();
      this.generateAlerts();

      // Output reports in all requested formats
      await this.outputReports();

      // Send alerts if configured
      if (this.config.enableRealTimeAlerts) {
        await this.sendAlerts();
      }

      // Check CI/CD failure conditions
      this.checkCICDFailureConditions();

      const totalTime = Date.now() - startTime;
      console.log(`✅ Security reporting completed in ${totalTime}ms`);
      console.log(`📊 Overall Security Score: ${this.report.summary.overallSecurityScore}/100`);
      console.log(`🎯 Status: ${this.report.summary.status}`);

      this.emit('reporting-completed', { 
        report: this.report, 
        duration: totalTime 
      });

      return this.report;

    } catch (error) {
      console.error('Security reporting failed:', error);
      
      this.report.summary.status = 'FAIL';
      this.report.alerts.push({
        severity: 'CRITICAL',
        type: 'VULNERABILITY',
        title: 'Security Testing Infrastructure Failure',
        description: `Security testing infrastructure failed: ${error}`,
        affectedTests: ['ALL'],
        recommendedActions: [
          'Fix security testing infrastructure',
          'Investigate root cause',
          'Implement failsafe mechanisms'
        ],
        urgency: 'IMMEDIATE'
      });

      throw error;
    }
  }

  private initializeReport(): void {
    this.report = {
      version: '1.0.0',
      timestamp: Date.now(),
      buildNumber: process.env.BUILD_NUMBER,
      gitCommit: process.env.GIT_COMMIT,
      environment: process.env.NODE_ENV || 'development',
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        criticalVulnerabilities: 0,
        highRiskVulnerabilities: 0,
        regressions: 0,
        testCoverage: 0,
        overallSecurityScore: 0,
        status: 'SECURE'
      },
      testResults: {
        securitySuite: [],
        attackVectors: [],
        penetrationTests: [],
        regressionTests: []
      },
      metrics: {
        vulnerability: { critical: 0, high: 0, medium: 0, low: 0 },
        performance: { averageExecutionTime: 0, slowestTest: '', fastestTest: '', performanceImpact: 0 },
        coverage: { attackVectorsCovered: 0, totalAttackVectors: 0, categoryBreakdown: {} },
        trend: { improvementRate: 0, regressionRate: 0, stabilityScore: 0 }
      },
      riskAssessment: {
        overallRiskLevel: 'LOW',
        riskScore: 0,
        topRisks: [],
        mitigationEffectiveness: 0,
        residualRisk: 0
      },
      recommendations: [],
      alerts: []
    };
  }

  private generateSummary(): void {
    const allResults = [
      ...this.report.testResults.securitySuite,
      ...this.report.testResults.attackVectors,
      ...this.report.testResults.penetrationTests,
      ...this.report.testResults.regressionTests
    ];

    this.report.summary.totalTests = allResults.length;
    this.report.summary.passedTests = allResults.filter(r => r.passed).length;
    this.report.summary.failedTests = allResults.filter(r => !r.passed).length;
    this.report.summary.criticalVulnerabilities = allResults.filter(r => !r.passed && r.severity === 'critical').length;
    this.report.summary.highRiskVulnerabilities = allResults.filter(r => !r.passed && r.severity === 'high').length;
    this.report.summary.regressions = this.report.testResults.regressionTests.filter(r => r.regression).length;
    this.report.summary.testCoverage = this.report.summary.totalTests > 0 
      ? (this.report.summary.passedTests / this.report.summary.totalTests) * 100 
      : 0;

    // Calculate overall security score
    this.report.summary.overallSecurityScore = this.calculateOverallSecurityScore();

    // Determine status
    if (this.report.summary.criticalVulnerabilities > 0 || this.report.summary.regressions > 0) {
      this.report.summary.status = 'CRITICAL';
    } else if (this.report.summary.highRiskVulnerabilities > 3) {
      this.report.summary.status = 'FAIL';
    } else if (this.report.summary.highRiskVulnerabilities > 0) {
      this.report.summary.status = 'WARNING';
    } else {
      this.report.summary.status = 'SECURE';
    }
  }

  private calculateMetrics(): void {
    const allResults = [
      ...this.report.testResults.securitySuite,
      ...this.report.testResults.attackVectors,
      ...this.report.testResults.penetrationTests,
      ...this.report.testResults.regressionTests
    ];

    // Vulnerability metrics
    this.report.metrics.vulnerability = {
      critical: allResults.filter(r => !r.passed && r.severity === 'critical').length,
      high: allResults.filter(r => !r.passed && r.severity === 'high').length,
      medium: allResults.filter(r => !r.passed && r.severity === 'medium').length,
      low: allResults.filter(r => !r.passed && r.severity === 'low').length
    };

    // Performance metrics
    const executionTimes = allResults.map(r => r.executionTime);
    this.report.metrics.performance = {
      averageExecutionTime: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
      slowestTest: allResults.find(r => r.executionTime === Math.max(...executionTimes))?.testName || 'N/A',
      fastestTest: allResults.find(r => r.executionTime === Math.min(...executionTimes))?.testName || 'N/A',
      performanceImpact: this.calculatePerformanceImpact()
    };

    // Coverage metrics
    const categories = [...new Set(allResults.map(r => r.category))];
    const categoryBreakdown: Record<string, number> = {};
    categories.forEach(cat => {
      categoryBreakdown[cat] = allResults.filter(r => r.category === cat).length;
    });

    this.report.metrics.coverage = {
      attackVectorsCovered: this.report.testResults.attackVectors.length,
      totalAttackVectors: 25, // From our attack vector database
      categoryBreakdown
    };

    // Trend metrics (would be calculated from historical data)
    this.report.metrics.trend = {
      improvementRate: this.calculateImprovementRate(),
      regressionRate: this.calculateRegressionRate(),
      stabilityScore: this.calculateStabilityScore()
    };
  }

  private performRiskAssessment(): void {
    const vulnerabilities = this.report.metrics.vulnerability;
    const regressions = this.report.summary.regressions;
    
    // Calculate overall risk score (0-100)
    let riskScore = 0;
    riskScore += vulnerabilities.critical * 25;
    riskScore += vulnerabilities.high * 15;
    riskScore += vulnerabilities.medium * 8;
    riskScore += vulnerabilities.low * 2;
    riskScore += regressions * 20;
    
    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (riskScore >= 80) riskLevel = 'CRITICAL';
    else if (riskScore >= 60) riskLevel = 'HIGH';
    else if (riskScore >= 30) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // Identify top risks
    const topRisks: RiskFactor[] = [];
    
    if (vulnerabilities.critical > 0) {
      topRisks.push({
        category: 'Critical Vulnerabilities',
        description: `${vulnerabilities.critical} critical security vulnerabilities detected`,
        likelihood: 9,
        impact: 10,
        riskScore: vulnerabilities.critical * 25,
        mitigation: 'Immediate patching and security controls implementation required'
      });
    }

    if (regressions > 0) {
      topRisks.push({
        category: 'Security Regressions',
        description: `${regressions} security regressions detected`,
        likelihood: 8,
        impact: 9,
        riskScore: regressions * 20,
        mitigation: 'Rollback changes and implement additional testing'
      });
    }

    if (vulnerabilities.high > 3) {
      topRisks.push({
        category: 'High-Risk Vulnerabilities',
        description: `${vulnerabilities.high} high-risk vulnerabilities present`,
        likelihood: 7,
        impact: 8,
        riskScore: vulnerabilities.high * 15,
        mitigation: 'Prioritize patching and implement additional security controls'
      });
    }

    this.report.riskAssessment = {
      overallRiskLevel: riskLevel,
      riskScore,
      topRisks: topRisks.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
      mitigationEffectiveness: this.calculateMitigationEffectiveness(),
      residualRisk: this.calculateResidualRisk(riskScore)
    };
  }

  private generateRecommendations(): void {
    const recommendations: SecurityRecommendation[] = [];

    // Critical vulnerabilities
    if (this.report.summary.criticalVulnerabilities > 0) {
      recommendations.push({
        priority: 'IMMEDIATE',
        category: 'Critical Security',
        title: 'Address Critical Security Vulnerabilities',
        description: `${this.report.summary.criticalVulnerabilities} critical vulnerabilities must be addressed immediately`,
        actionItems: [
          'Stop all deployments until vulnerabilities are fixed',
          'Implement emergency security patches',
          'Conduct security review of affected components',
          'Implement additional security controls'
        ],
        estimatedEffort: '1-2 days',
        businessImpact: 'HIGH - Prevents security breaches and data loss'
      });
    }

    // Regressions
    if (this.report.summary.regressions > 0) {
      recommendations.push({
        priority: 'IMMEDIATE',
        category: 'Regression Prevention',
        title: 'Fix Security Regressions',
        description: `${this.report.summary.regressions} security regressions detected`,
        actionItems: [
          'Identify and revert problematic changes',
          'Strengthen regression testing',
          'Implement automated security gates',
          'Review code change processes'
        ],
        estimatedEffort: '2-3 days',
        businessImpact: 'HIGH - Prevents security degradation'
      });
    }

    // High-risk vulnerabilities
    if (this.report.summary.highRiskVulnerabilities > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Security Hardening',
        title: 'Address High-Risk Vulnerabilities',
        description: `${this.report.summary.highRiskVulnerabilities} high-risk vulnerabilities need attention`,
        actionItems: [
          'Prioritize high-risk vulnerability fixes',
          'Implement compensating controls',
          'Enhance monitoring and detection',
          'Update security documentation'
        ],
        estimatedEffort: '1 week',
        businessImpact: 'MEDIUM - Reduces security risk exposure'
      });
    }

    // Test coverage improvement
    if (this.report.summary.testCoverage < 95) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Test Coverage',
        title: 'Improve Security Test Coverage',
        description: `Current test coverage is ${this.report.summary.testCoverage.toFixed(1)}%`,
        actionItems: [
          'Identify gaps in security test coverage',
          'Add tests for uncovered attack vectors',
          'Implement continuous security testing',
          'Set coverage requirements in CI/CD'
        ],
        estimatedEffort: '1-2 weeks',
        businessImpact: 'MEDIUM - Improves security assurance'
      });
    }

    this.report.recommendations = recommendations;
  }

  private generateAlerts(): void {
    const alerts: SecurityAlert[] = [];

    // Critical vulnerability alert
    if (this.report.summary.criticalVulnerabilities >= this.config.alertThresholds.critical) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'VULNERABILITY',
        title: 'Critical Security Vulnerabilities Detected',
        description: `${this.report.summary.criticalVulnerabilities} critical security vulnerabilities have been detected`,
        affectedTests: this.report.testResults.securitySuite
          .filter(r => !r.passed && r.severity === 'critical')
          .map(r => r.testName),
        recommendedActions: [
          'STOP ALL DEPLOYMENTS',
          'Investigate and patch immediately',
          'Implement emergency security measures',
          'Notify security team'
        ],
        urgency: 'IMMEDIATE'
      });
    }

    // Regression alert
    if (this.report.summary.regressions >= this.config.alertThresholds.regressions) {
      alerts.push({
        severity: 'HIGH',
        type: 'REGRESSION',
        title: 'Security Regressions Detected',
        description: `${this.report.summary.regressions} security regressions have been detected`,
        affectedTests: this.report.testResults.regressionTests
          .filter(r => r.regression)
          .map(r => r.testName),
        recommendedActions: [
          'Review recent changes',
          'Revert problematic commits',
          'Strengthen testing processes',
          'Update security baselines'
        ],
        urgency: 'URGENT'
      });
    }

    // High-risk vulnerability alert
    if (this.report.summary.highRiskVulnerabilities >= this.config.alertThresholds.high) {
      alerts.push({
        severity: 'HIGH',
        type: 'VULNERABILITY',
        title: 'Multiple High-Risk Vulnerabilities',
        description: `${this.report.summary.highRiskVulnerabilities} high-risk vulnerabilities detected`,
        affectedTests: this.report.testResults.securitySuite
          .filter(r => !r.passed && r.severity === 'high')
          .map(r => r.testName),
        recommendedActions: [
          'Prioritize vulnerability fixes',
          'Implement additional security controls',
          'Enhance monitoring',
          'Review security architecture'
        ],
        urgency: 'URGENT'
      });
    }

    // Performance impact alert
    if (this.report.metrics.performance.performanceImpact > 50) {
      alerts.push({
        severity: 'MEDIUM',
        type: 'PERFORMANCE',
        title: 'High Security Performance Impact',
        description: `Security measures are causing ${this.report.metrics.performance.performanceImpact.toFixed(1)}% performance impact`,
        affectedTests: [this.report.metrics.performance.slowestTest],
        recommendedActions: [
          'Optimize security implementations',
          'Profile performance bottlenecks',
          'Consider caching strategies',
          'Review security architecture'
        ],
        urgency: 'NORMAL'
      });
    }

    this.report.alerts = alerts;
  }

  private async outputReports(): Promise<void> {
    this.ensureOutputDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `security-report-${timestamp}`;

    for (const format of this.config.reportFormats) {
      try {
        switch (format) {
          case 'json':
            await this.generateJSONReport(baseFilename);
            break;
          case 'html':
            await this.generateHTMLReport(baseFilename);
            break;
          case 'junit':
            await this.generateJUnitReport(baseFilename);
            break;
          case 'sarif':
            await this.generateSARIFReport(baseFilename);
            break;
          default:
            console.warn(`Unsupported report format: ${format}`);
        }
      } catch (error) {
        console.error(`Failed to generate ${format} report:`, error);
      }
    }
  }

  private async generateJSONReport(baseFilename: string): Promise<void> {
    const filename = join(this.config.outputDirectory, `${baseFilename}.json`);
    writeFileSync(filename, JSON.stringify(this.report, null, 2));
    console.log(`📄 JSON report saved: ${filename}`);
  }

  private async generateHTMLReport(baseFilename: string): Promise<void> {
    const filename = join(this.config.outputDirectory, `${baseFilename}.html`);
    const htmlContent = this.generateHTMLContent();
    writeFileSync(filename, htmlContent);
    console.log(`📄 HTML report saved: ${filename}`);
  }

  private async generateJUnitReport(baseFilename: string): Promise<void> {
    const filename = join(this.config.outputDirectory, `${baseFilename}-junit.xml`);
    const junitContent = this.generateJUnitContent();
    writeFileSync(filename, junitContent);
    console.log(`📄 JUnit report saved: ${filename}`);
  }

  private async generateSARIFReport(baseFilename: string): Promise<void> {
    const filename = join(this.config.outputDirectory, `${baseFilename}.sarif`);
    const sarifContent = this.generateSARIFContent();
    writeFileSync(filename, JSON.stringify(sarifContent, null, 2));
    console.log(`📄 SARIF report saved: ${filename}`);
  }

  private generateHTMLContent(): string {
    const statusColor = {
      'SECURE': '#28a745',
      'WARNING': '#ffc107',
      'CRITICAL': '#dc3545',
      'FAIL': '#dc3545'
    }[this.report.summary.status] || '#6c757d';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert-critical { background: #f8d7da; border: 1px solid #f5c6cb; }
        .alert-high { background: #fff3cd; border: 1px solid #ffeaa7; }
        .test-results { margin: 20px 0; }
        .test-failed { color: #dc3545; }
        .test-passed { color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Test Report</h1>
        <p>Status: ${this.report.summary.status} | Score: ${this.report.summary.overallSecurityScore}/100</p>
        <p>Generated: ${new Date(this.report.timestamp).toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${this.report.summary.totalTests}</div>
            <div>Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.report.summary.criticalVulnerabilities}</div>
            <div>Critical Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.report.summary.regressions}</div>
            <div>Regressions</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.report.summary.testCoverage.toFixed(1)}%</div>
            <div>Test Coverage</div>
        </div>
    </div>

    ${this.report.alerts.map(alert => `
        <div class="alert alert-${alert.severity.toLowerCase()}">
            <h3>${alert.title}</h3>
            <p>${alert.description}</p>
            <strong>Recommended Actions:</strong>
            <ul>
                ${alert.recommendedActions.map(action => `<li>${action}</li>`).join('')}
            </ul>
        </div>
    `).join('')}

    <div class="test-results">
        <h2>Test Results Summary</h2>
        <h3>Security Suite (${this.report.testResults.securitySuite.length} tests)</h3>
        ${this.report.testResults.securitySuite.map(test => `
            <div class="${test.passed ? 'test-passed' : 'test-failed'}">
                ${test.passed ? '✅' : '❌'} ${test.testName} (${test.severity})
                ${test.vulnerability ? `- ${test.vulnerability}` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private generateJUnitContent(): string {
    const allResults = [
      ...this.report.testResults.securitySuite,
      ...this.report.testResults.attackVectors,
      ...this.report.testResults.penetrationTests,
      ...this.report.testResults.regressionTests
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="Security Tests" tests="${allResults.length}" failures="${this.report.summary.failedTests}" time="${this.report.metrics.performance.averageExecutionTime / 1000}">\n`;
    xml += `  <testsuite name="Security Tests" tests="${allResults.length}" failures="${this.report.summary.failedTests}">\n`;

    for (const test of allResults) {
      xml += `    <testcase name="${test.testName}" classname="${test.category}" time="${test.executionTime / 1000}">\n`;
      if (!test.passed) {
        xml += `      <failure message="${test.vulnerability || 'Test failed'}">${test.details}</failure>\n`;
      }
      xml += `    </testcase>\n`;
    }

    xml += `  </testsuite>\n`;
    xml += `</testsuites>\n`;

    return xml;
  }

  private generateSARIFContent(): any {
    return {
      version: "2.1.0",
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      runs: [{
        tool: {
          driver: {
            name: "Security Test Suite",
            version: this.report.version,
            informationUri: "https://github.com/your-org/security-tests"
          }
        },
        results: this.report.testResults.securitySuite
          .filter(test => !test.passed)
          .map(test => ({
            ruleId: test.testId,
            level: this.mapSeverityToSARIF(test.severity),
            message: {
              text: test.vulnerability || test.details
            },
            locations: [{
              physicalLocation: {
                artifactLocation: {
                  uri: "src/lib/tmux/"
                }
              }
            }]
          }))
      }]
    };
  }

  private mapSeverityToSARIF(severity: string): string {
    const mapping: Record<string, string> = {
      'critical': 'error',
      'high': 'error',
      'medium': 'warning',
      'low': 'note',
      'info': 'note'
    };
    return mapping[severity] || 'warning';
  }

  private async sendAlerts(): Promise<void> {
    if (this.report.alerts.length === 0) return;

    console.log(`📢 Sending ${this.report.alerts.length} security alert(s)...`);

    // Send to configured integrations
    for (const alert of this.report.alerts) {
      try {
        if (this.config.integrations.slack) {
          await this.sendSlackAlert(alert);
        }
        
        if (this.config.integrations.teams) {
          await this.sendTeamsAlert(alert);
        }
        
        if (this.config.integrations.email) {
          await this.sendEmailAlert(alert);
        }
        
        if (this.config.integrations.jira) {
          await this.createJiraTicket(alert);
        }
      } catch (error) {
        console.error(`Failed to send alert: ${error}`);
      }
    }
  }

  private async sendSlackAlert(alert: SecurityAlert): Promise<void> {
    // Slack integration implementation would go here
    console.log(`📱 Slack alert: ${alert.title}`);
  }

  private async sendTeamsAlert(alert: SecurityAlert): Promise<void> {
    // Teams integration implementation would go here
    console.log(`👥 Teams alert: ${alert.title}`);
  }

  private async sendEmailAlert(alert: SecurityAlert): Promise<void> {
    // Email integration implementation would go here
    console.log(`📧 Email alert: ${alert.title}`);
  }

  private async createJiraTicket(alert: SecurityAlert): Promise<void> {
    // Jira integration implementation would go here
    console.log(`🎫 Jira ticket: ${alert.title}`);
  }

  private checkCICDFailureConditions(): void {
    let shouldFail = false;
    const reasons: string[] = [];

    if (this.config.cicd.failOnCritical && this.report.summary.criticalVulnerabilities > 0) {
      shouldFail = true;
      reasons.push(`${this.report.summary.criticalVulnerabilities} critical vulnerabilities`);
    }

    if (this.config.cicd.failOnHigh && this.report.summary.highRiskVulnerabilities > 0) {
      shouldFail = true;
      reasons.push(`${this.report.summary.highRiskVulnerabilities} high-risk vulnerabilities`);
    }

    if (this.config.cicd.failOnRegressions && this.report.summary.regressions > 0) {
      shouldFail = true;
      reasons.push(`${this.report.summary.regressions} security regressions`);
    }

    if (this.report.riskAssessment.riskScore > this.config.cicd.maxAcceptableRisk) {
      shouldFail = true;
      reasons.push(`risk score ${this.report.riskAssessment.riskScore} exceeds threshold ${this.config.cicd.maxAcceptableRisk}`);
    }

    if (shouldFail) {
      const message = `CI/CD Pipeline FAILED due to: ${reasons.join(', ')}`;
      console.error(`❌ ${message}`);
      this.emit('cicd-failure', { reasons, report: this.report });
      
      // Exit with error code for CI/CD
      if (process.env.CI) {
        process.exit(1);
      }
    } else {
      console.log('✅ CI/CD security checks passed');
    }
  }

  // Calculation helper methods
  private calculateOverallSecurityScore(): number {
    const maxPossibleScore = 100;
    let deductions = 0;

    // Deduct points for vulnerabilities
    deductions += this.report.summary.criticalVulnerabilities * 25;
    deductions += this.report.summary.highRiskVulnerabilities * 10;
    deductions += this.report.summary.regressions * 15;

    // Deduct points for low test coverage
    if (this.report.summary.testCoverage < 95) {
      deductions += (95 - this.report.summary.testCoverage) * 0.5;
    }

    return Math.max(0, maxPossibleScore - deductions);
  }

  private calculatePerformanceImpact(): number {
    // Simple performance impact calculation
    const avgTime = this.report.metrics.performance.averageExecutionTime;
    const baselineTime = 100; // 100ms baseline
    return Math.max(0, ((avgTime - baselineTime) / baselineTime) * 100);
  }

  private calculateImprovementRate(): number {
    // Would calculate from historical data
    return 0;
  }

  private calculateRegressionRate(): number {
    // Would calculate from historical data
    return this.report.summary.regressions > 0 ? 
      (this.report.summary.regressions / this.report.summary.totalTests) * 100 : 0;
  }

  private calculateStabilityScore(): number {
    // Simple stability score based on test success rate
    return this.report.summary.testCoverage;
  }

  private calculateMitigationEffectiveness(): number {
    // Percentage of threats that are properly mitigated
    const totalThreats = this.report.summary.totalTests;
    const mitigatedThreats = this.report.summary.passedTests;
    return totalThreats > 0 ? (mitigatedThreats / totalThreats) * 100 : 0;
  }

  private calculateResidualRisk(riskScore: number): number {
    // Risk that remains after mitigation
    const mitigationEffectiveness = this.calculateMitigationEffectiveness() / 100;
    return riskScore * (1 - mitigationEffectiveness);
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDirectory)) {
      mkdirSync(this.config.outputDirectory, { recursive: true });
    }
  }

  getReport(): SecurityReport {
    return this.report;
  }
}

// CLI execution capability
export async function runSecurityReporting(): Promise<void> {
  const reporter = new SecurityReporter({
    outputDirectory: './security-reports',
    reportFormats: ['json', 'html', 'junit'],
    enableRealTimeAlerts: true,
    cicd: {
      failOnCritical: true,
      failOnRegressions: true,
      maxAcceptableRisk: 20
    }
  });

  try {
    await reporter.generateComprehensiveSecurityReport();
    console.log('🛡️ Security reporting completed successfully');
  } catch (error) {
    console.error('🚨 Security reporting failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityReporting();
}