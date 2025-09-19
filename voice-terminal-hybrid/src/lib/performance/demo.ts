/**
 * Performance Optimization Demo
 * Demonstrates the complete enterprise performance optimization suite
 */

import { 
  EnterprisePerformanceSuite,
  AdvancedOptimizer,
  LoadTestSuite,
  PerformanceValidator
} from './index.js';

/**
 * Complete demonstration of performance optimization features
 */
async function runDemo(): Promise<void> {
  console.log('🎯 Enterprise Performance Optimization Demo');
  console.log('==========================================\n');
  
  // Initialize the performance suite
  const suite = new EnterprisePerformanceSuite();
  await suite.initialize();
  
  try {
    // Step 1: Initial health check
    console.log('📋 Step 1: Initial Health Check');
    console.log('--------------------------------');
    await suite.runHealthCheck();
    
    // Step 2: Run optimization
    console.log('\n⚡ Step 2: Performance Optimization');
    console.log('-----------------------------------');
    await suite.optimize();
    
    // Step 3: Quick validation
    console.log('\n🔍 Step 3: Quick Validation');
    console.log('---------------------------');
    const validator = suite.getValidator();
    const quickReport = await validator.validatePerformance({
      includeLoadTest: false,
      testDuration: 60,
      environment: 'demo'
    });
    
    console.log(`✅ Quick validation completed - Pass Rate: ${quickReport.summary.passRate.toFixed(1)}%`);
    
    // Step 4: Load testing demonstration
    console.log('\n🚀 Step 4: Load Test Demonstration');
    console.log('----------------------------------');
    const loadTestSuite = suite.getLoadTestSuite();
    
    // Run a smaller scale demo test
    const demoReport = await loadTestSuite.runScenario({
      name: 'Demo Load Test',
      description: 'Demonstration with 100 users',
      duration: 120,  // 2 minutes
      users: 100,
      profile: 'mixed',
      stressType: 'sustained',
      customConfig: {
        rampUpDuration: 30,
        rampDownDuration: 15
      }
    });
    
    loadTestSuite.printReport(demoReport);
    
    // Step 5: Complete validation
    console.log('\n🎯 Step 5: Complete Enterprise Validation');
    console.log('------------------------------------------');
    const completeReport = await validator.validatePerformance({
      includeLoadTest: true,
      testDuration: 180,
      environment: 'demo-complete'
    });
    
    validator.printValidationReport(completeReport);
    
    // Step 6: Performance scorecard
    console.log('\n🏆 Step 6: Performance Scorecard');
    console.log('---------------------------------');
    const scorecard = validator.generateScorecard();
    
    console.log(`Overall Grade: ${scorecard.grade}`);
    console.log(`Overall Score: ${scorecard.overallScore.toFixed(1)}/100`);
    console.log('\nCategory Breakdown:');
    for (const [category, score] of Object.entries(scorecard.categoryScores)) {
      const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
      console.log(`  ${category}: ${score.toFixed(1)}/100 (${grade})`);
    }
    
    // Step 7: Demonstrate monitoring
    console.log('\n📡 Step 7: Continuous Monitoring Demo');
    console.log('-------------------------------------');
    
    validator.onAlert((alert) => {
      console.log(`🚨 ALERT: ${alert.description}`);
      console.log(`   Severity: ${alert.severity}`);
      console.log(`   Recommendation: ${alert.recommendation}`);
    });
    
    console.log('Monitoring active for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const alertHistory = validator.getAlertHistory();
    console.log(`Alerts generated during demo: ${alertHistory.length}`);
    
    // Step 8: Export results
    console.log('\n📄 Step 8: Export Results');
    console.log('-------------------------');
    
    const exportedJSON = await loadTestSuite.exportResults(demoReport, 'json');
    console.log(`JSON export size: ${(exportedJSON.length / 1024).toFixed(1)} KB`);
    
    const exportedCSV = await loadTestSuite.exportResults(demoReport, 'csv');
    console.log(`CSV export size: ${(exportedCSV.length / 1024).toFixed(1)} KB`);
    
    // Final summary
    console.log('\n✅ Demo Summary');
    console.log('===============');
    console.log(`🎯 Overall System Grade: ${scorecard.grade}`);
    console.log(`⚡ Performance Improvement: ${completeReport.optimization.improvementPercent.toFixed(1)}%`);
    console.log(`🚀 Load Test Peak Throughput: ${demoReport.summary.peakThroughput.toFixed(0)} cmd/s`);
    console.log(`💾 Memory Efficiency: ${(demoReport.performance.memoryEfficiency * 100).toFixed(1)}%`);
    console.log(`🔄 Cache Efficiency: ${(demoReport.performance.cacheEfficiency * 100).toFixed(1)}%`);
    
    if (scorecard.grade === 'A' || scorecard.grade === 'B') {
      console.log('\n🏆 Excellent! Your system meets enterprise performance standards.');
      console.log('   Ready for production deployment at scale.');
    } else {
      console.log('\n⚠️  Performance optimization opportunities identified.');
      console.log('   Review the recommendations above for improvements.');
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await suite.destroy();
  }
}

/**
 * Advanced demo showing individual component usage
 */
async function runAdvancedDemo(): Promise<void> {
  console.log('🔬 Advanced Performance Component Demo');
  console.log('======================================\n');
  
  // Demonstrate individual components
  
  // 1. Advanced Optimizer
  console.log('⚡ Advanced Optimizer Demo');
  console.log('--------------------------');
  const optimizer = new AdvancedOptimizer({
    strategies: {
      enablePredictiveOptimization: true,
      enableAdaptiveCaching: true,
      enableConnectionPooling: true,
      enableMessageCompression: true,
      enableBinaryProtocol: true,
      enableOutputStreaming: true,
      enableCommandBatching: true,
      enableSmartPrefetching: true
    }
  });
  
  await optimizer.initialize();
  
  // Simulate command execution
  console.log('Executing optimized commands...');
  for (let i = 0; i < 10; i++) {
    await optimizer.executeOptimizedCommand(
      `user-${i}`,
      `session-${i % 3}`,
      `echo "test command ${i}"`,
      { priority: i % 3 === 0 ? 'high' : 'normal' }
    );
  }
  
  const optimizerMetrics = optimizer.getCurrentMetrics();
  console.log(`Commands executed with ${optimizerMetrics.latency.total.toFixed(2)}ms avg latency`);
  
  // 2. Load Test Suite
  console.log('\n🚀 Load Test Suite Demo');
  console.log('------------------------');
  const loadTestSuite = new LoadTestSuite({
    maxConcurrentUsers: 500,
    scenarios: [{
      name: 'Advanced Demo',
      description: 'Custom scenario for advanced demo',
      duration: 90,
      users: 500,
      profile: 'power-user',
      stressType: 'burst'
    }]
  }, optimizer);
  
  const advancedReport = await loadTestSuite.runQuickValidation();
  console.log(`Load test completed: ${advancedReport.summary.totalCommands} commands executed`);
  console.log(`Peak throughput: ${advancedReport.summary.peakThroughput.toFixed(0)} cmd/s`);
  
  // 3. Performance Validator
  console.log('\n🎯 Performance Validator Demo');
  console.log('------------------------------');
  const validator = new PerformanceValidator(optimizer, {
    latency: { totalEndToEnd: 50, browser: 30, backend: 10 },
    throughput: { commandsPerSecond: 5000, concurrentUsers: 500 }
  });
  
  const validationReport = await validator.validatePerformance({
    includeLoadTest: false,
    testDuration: 60,
    environment: 'advanced-demo'
  });
  
  console.log(`Validation completed: ${validationReport.summary.passRate.toFixed(1)}% pass rate`);
  
  // Cleanup
  await optimizer.destroy();
  await validator.destroy();
  
  console.log('\n✅ Advanced demo completed successfully!');
}

/**
 * Benchmark comparison demo
 */
async function runBenchmarkDemo(): Promise<void> {
  console.log('📊 Performance Benchmark Comparison');
  console.log('===================================\n');
  
  // Test without optimizations
  console.log('🔴 Baseline (No Optimizations)');
  console.log('-------------------------------');
  const baselineOptimizer = new AdvancedOptimizer({
    strategies: {
      enablePredictiveOptimization: false,
      enableAdaptiveCaching: false,
      enableConnectionPooling: false,
      enableMessageCompression: false,
      enableBinaryProtocol: false,
      enableOutputStreaming: false,
      enableCommandBatching: false,
      enableSmartPrefetching: false
    }
  });
  
  await baselineOptimizer.initialize();
  
  const baselineStart = performance.now();
  for (let i = 0; i < 100; i++) {
    await baselineOptimizer.executeOptimizedCommand(
      'user-baseline',
      'session-baseline',
      `echo "baseline test ${i}"`,
      { priority: 'normal' }
    );
  }
  const baselineTime = performance.now() - baselineStart;
  const baselineMetrics = baselineOptimizer.getCurrentMetrics();
  
  console.log(`Baseline: 100 commands in ${baselineTime.toFixed(2)}ms`);
  console.log(`Avg latency: ${baselineMetrics.latency.total.toFixed(2)}ms`);
  
  // Test with full optimizations
  console.log('\n🟢 Optimized (All Features)');
  console.log('----------------------------');
  const optimizedOptimizer = new AdvancedOptimizer({
    strategies: {
      enablePredictiveOptimization: true,
      enableAdaptiveCaching: true,
      enableConnectionPooling: true,
      enableMessageCompression: true,
      enableBinaryProtocol: true,
      enableOutputStreaming: true,
      enableCommandBatching: true,
      enableSmartPrefetching: true
    }
  });
  
  await optimizedOptimizer.initialize();
  
  const optimizedStart = performance.now();
  for (let i = 0; i < 100; i++) {
    await optimizedOptimizer.executeOptimizedCommand(
      'user-optimized',
      'session-optimized',
      `echo "optimized test ${i}"`,
      { priority: 'normal' }
    );
  }
  const optimizedTime = performance.now() - optimizedStart;
  const optimizedMetrics = optimizedOptimizer.getCurrentMetrics();
  
  console.log(`Optimized: 100 commands in ${optimizedTime.toFixed(2)}ms`);
  console.log(`Avg latency: ${optimizedMetrics.latency.total.toFixed(2)}ms`);
  
  // Calculate improvements
  const timeImprovement = ((baselineTime - optimizedTime) / baselineTime) * 100;
  const latencyImprovement = ((baselineMetrics.latency.total - optimizedMetrics.latency.total) / baselineMetrics.latency.total) * 100;
  
  console.log('\n📈 Performance Improvements');
  console.log('---------------------------');
  console.log(`Total execution time: ${timeImprovement.toFixed(1)}% faster`);
  console.log(`Average latency: ${latencyImprovement.toFixed(1)}% reduction`);
  console.log(`Cache hit rate: ${(optimizedMetrics.cache.hitRate * 100).toFixed(1)}%`);
  
  // Cleanup
  await baselineOptimizer.destroy();
  await optimizedOptimizer.destroy();
  
  console.log('\n✅ Benchmark comparison completed!');
}

/**
 * Main demo runner
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const demoType = args[0] || 'complete';
  
  console.log(`🎯 Starting ${demoType} demo...\n`);
  
  try {
    switch (demoType) {
      case 'complete':
        await runDemo();
        break;
      case 'advanced':
        await runAdvancedDemo();
        break;
      case 'benchmark':
        await runBenchmarkDemo();
        break;
      case 'all':
        await runDemo();
        await runAdvancedDemo();
        await runBenchmarkDemo();
        break;
      default:
        console.log(`Unknown demo type: ${demoType}`);
        console.log('Available demos: complete, advanced, benchmark, all');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
  
  console.log('\n🎉 Demo completed successfully!');
}

// Run demo if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export { runDemo, runAdvancedDemo, runBenchmarkDemo };