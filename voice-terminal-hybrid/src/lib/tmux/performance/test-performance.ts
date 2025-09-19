#!/usr/bin/env node

/**
 * Quick performance validation script
 * Run this to verify the <15ms latency target is met
 */

import { runPerformanceBenchmark } from './PerformanceBenchmark';

async function main() {
  console.log('🎯 Performance Optimization Validation');
  console.log('Target: <15ms average latency\n');

  try {
    // Run quick validation
    await runPerformanceBenchmark({ 
      quick: true,
      config: {
        performanceMode: 'performance',
        socketPath: '/tmp/tmux-socket-test',
        commandTimeout: 5000
      }
    });

    console.log('\n🏆 Performance validation completed!');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Performance validation failed:', errorMessage);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}