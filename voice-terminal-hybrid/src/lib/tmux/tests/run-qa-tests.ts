#!/usr/bin/env node

import { QATestOrchestrator } from './QATestOrchestrator';
import type { QATestConfig } from './QATestOrchestrator';

/**
 * CLI Runner for Comprehensive QA Test Suite
 * 
 * Usage:
 *   npm run qa-tests                    # Run all tests
 *   npm run qa-tests --quick           # Run quick validation only
 *   npm run qa-tests --integration     # Run integration tests only
 *   npm run qa-tests --concurrency     # Run concurrency tests only
 *   npm run qa-tests --regression      # Run regression tests only
 *   npm run qa-tests --performance     # Run performance tests only
 *   npm run qa-tests --race-conditions # Run race condition tests only
 *   npm run qa-tests --output report.json # Save report to file
 *   npm run qa-tests --format html     # Generate HTML report
 *   npm run qa-tests --parallel        # Run tests in parallel
 *   npm run qa-tests --continue-on-failure # Don't stop on first failure
 * 
 * Examples:
 *   # Full QA validation for Phase 2
 *   npm run qa-tests --output phase2-validation.json
 * 
 *   # Quick performance check
 *   npm run qa-tests --quick --performance
 * 
 *   # Full validation with HTML report
 *   npm run qa-tests --format html --output qa-report.html
 */

interface CLIOptions {
  quick: boolean;
  integration: boolean;
  concurrency: boolean;
  regression: boolean;
  performance: boolean;
  raceConditions: boolean;
  output?: string;
  format: 'console' | 'json' | 'html' | 'junit';
  parallel: boolean;
  continueOnFailure: boolean;
  timeout: number;
  help: boolean;
  verbose: boolean;
}

class QATestCLI {
  private options: CLIOptions;

  constructor() {
    this.options = this.parseArguments();
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(): CLIOptions {
    const args = process.argv.slice(2);
    const options: CLIOptions = {
      quick: false,
      integration: false,
      concurrency: false,
      regression: false,
      performance: false,
      raceConditions: false,
      format: 'console',
      parallel: false,
      continueOnFailure: false,
      timeout: 300000, // 5 minutes
      help: false,
      verbose: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--quick':
          options.quick = true;
          break;
        case '--integration':
          options.integration = true;
          break;
        case '--concurrency':
          options.concurrency = true;
          break;
        case '--regression':
          options.regression = true;
          break;
        case '--performance':
          options.performance = true;
          break;
        case '--race-conditions':
          options.raceConditions = true;
          break;
        case '--output':
        case '-o':
          options.output = args[++i];
          break;
        case '--format':
        case '-f':
          const format = args[++i] as 'console' | 'json' | 'html' | 'junit';
          if (['console', 'json', 'html', 'junit'].includes(format)) {
            options.format = format;
          }
          break;
        case '--parallel':
          options.parallel = true;
          break;
        case '--continue-on-failure':
          options.continueOnFailure = true;
          break;
        case '--timeout':
          options.timeout = parseInt(args[++i]) || options.timeout;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
      }
    }

    return options;
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
🎯 QA Test Suite for Voice Terminal Hybrid - Phase 2 Validation

USAGE:
  npm run qa-tests [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --quick                 Run quick validation tests only (faster execution)
  
  TEST CATEGORIES:
  --integration           Run integration tests (security + performance)
  --concurrency           Run concurrency tests (100+ sessions)
  --regression            Run regression tests (performance validation)
  --performance           Run performance regression tests with security
  --race-conditions       Run race condition validation tests
  
  OUTPUT OPTIONS:
  --output, -o FILE       Save report to specified file
  --format, -f FORMAT     Report format: console|json|html|junit
  --verbose, -v           Enable verbose output
  
  EXECUTION OPTIONS:
  --parallel              Run test suites in parallel (faster but less stable)
  --continue-on-failure   Continue execution even if tests fail
  --timeout MILLISECONDS  Timeout for each test suite (default: 300000ms)

EXAMPLES:
  # Run full QA validation
  npm run qa-tests

  # Quick performance check
  npm run qa-tests --quick --performance

  # Full validation with JSON report
  npm run qa-tests --output phase2-validation.json --format json

  # Integration tests only
  npm run qa-tests --integration --verbose

  # Race condition validation
  npm run qa-tests --race-conditions --output race-conditions.json

TARGET VALIDATION:
  ✅ <15ms latency with security enabled
  ✅ 100+ concurrent sessions supported
  ✅ 0 race conditions detected
  ✅ <3ms security overhead
  ✅ Zero memory leaks in 24-hour stress tests
  ✅ >95% integration test coverage

Phase 2 validates that security, performance, and backend abstraction
systems work correctly together under production load conditions.
`);
  }

  /**
   * Create QA test configuration from CLI options
   */
  private createTestConfig(): QATestConfig {
    // If specific test categories are selected, only run those
    const hasSpecificTests = this.options.integration || 
                            this.options.concurrency || 
                            this.options.regression || 
                            this.options.performance || 
                            this.options.raceConditions;

    return {
      enableIntegrationTests: hasSpecificTests ? this.options.integration : true,
      enableConcurrencyTests: hasSpecificTests ? this.options.concurrency : true,
      enableRegressionTests: hasSpecificTests ? this.options.regression : true,
      enablePerformanceRegressionTests: hasSpecificTests ? this.options.performance : true,
      enableRaceConditionValidation: hasSpecificTests ? this.options.raceConditions : true,
      enableMemoryLeakValidation: !this.options.quick,
      enableCrossBackendTests: !this.options.quick,
      parallelExecution: this.options.parallel,
      testTimeout: this.options.timeout,
      reportFormat: this.options.format,
      outputPath: this.options.output,
      continueOnFailure: this.options.continueOnFailure,
      
      // Quick mode configurations
      integrationConfig: this.options.quick ? {
        testTimeout: 15000,
        maxConcurrentSessions: 20,
        enableStressTests: false,
        validateMemoryLeaks: false
      } : undefined,
      
      concurrencyConfig: this.options.quick ? {
        maxConcurrentSessions: 50,
        maxConcurrentCommands: 100,
        testDuration: 15000,
        stressTestMultiplier: 1
      } : undefined,
      
      regressionConfig: this.options.quick ? {
        testIterations: 20,
        warmupIterations: 5
      } : undefined,
      
      performanceConfig: this.options.quick ? {
        testDuration: 15000,
        warmupDuration: 2000
      } : undefined
    };
  }

  /**
   * Run the QA test suite
   */
  async run(): Promise<void> {
    if (this.options.help) {
      this.showHelp();
      return;
    }

    console.log('🚀 Starting Voice Terminal Hybrid QA Test Suite');
    console.log('=' .repeat(60));
    
    if (this.options.quick) {
      console.log('⚡ Quick mode enabled - reduced test coverage for faster execution');
    }
    
    if (this.options.parallel) {
      console.log('🔀 Parallel execution enabled - tests will run concurrently');
    }
    
    console.log();

    const startTime = Date.now();
    const orchestrator = new QATestOrchestrator(this.createTestConfig());

    // Setup progress reporting
    this.setupProgressReporting(orchestrator);

    try {
      const report = await orchestrator.runFullQASuite();
      
      const duration = Date.now() - startTime;
      
      // Final summary
      console.log('\n🎉 QA Test Suite Completed!');
      console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(1)}s`);
      
      // Exit with appropriate code
      const exitCode = this.determineExitCode(report);
      
      if (exitCode === 0) {
        console.log('✅ All quality gates passed - system ready for release!');
      } else {
        console.log('❌ Quality gates failed - review results before release');
      }
      
      process.exit(exitCode);

    } catch (error) {
      console.error('\n💥 QA Test Suite Failed:');
      console.error(error.message);
      
      if (this.options.verbose) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Setup progress reporting
   */
  private setupProgressReporting(orchestrator: QATestOrchestrator): void {
    if (!this.options.verbose) return;

    orchestrator.on('integration-test-passed', (event) => {
      console.log(`  ✅ Integration: ${event.testName}`);
    });

    orchestrator.on('integration-test-failed', (event) => {
      console.log(`  ❌ Integration: ${event.testName} - ${event.error}`);
    });

    orchestrator.on('concurrency-test-completed', (event) => {
      const icon = event.result.errors.length === 0 ? '✅' : '❌';
      console.log(`  ${icon} Concurrency: ${event.testName}`);
    });

    orchestrator.on('regression-test-completed', (event) => {
      const icon = !event.result.isRegression ? '✅' : '❌';
      console.log(`  ${icon} Regression: ${event.testName}`);
    });

    orchestrator.on('performance-test-completed', (event) => {
      const icon = event.result.regression.overallImpact !== 'critical' ? '✅' : '❌';
      console.log(`  ${icon} Performance: ${event.testName}`);
    });

    orchestrator.on('report-generated', (report) => {
      if (this.options.output) {
        console.log(`📄 Report saved: ${this.options.output}`);
      }
    });
  }

  /**
   * Determine exit code based on test results
   */
  private determineExitCode(report: any): number {
    // Exit with 0 if all tests passed and targets met
    if (report.summary.releaseRecommendation === 'approved') {
      return 0;
    }
    
    // Exit with 1 if there are failures but not critical
    if (report.summary.releaseRecommendation === 'approved-with-monitoring' ||
        report.summary.releaseRecommendation === 'needs-optimization') {
      return 1;
    }
    
    // Exit with 2 for critical failures
    return 2;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const cli = new QATestCLI();
  await cli.run();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:');
  console.error(error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 Unhandled Rejection:');
  console.error(reason);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 QA tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 QA tests terminated');
  process.exit(1);
});

// Export for programmatic usage
export { QATestCLI, QATestOrchestrator };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to run QA tests:', error);
    process.exit(1);
  });
}