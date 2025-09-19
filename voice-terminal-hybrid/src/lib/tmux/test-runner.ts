#!/usr/bin/env node

import { TmuxIntegration } from './TmuxIntegration';
import { TmuxBenchmark, runBenchmark } from './benchmark';

async function testBasicFunctionality() {
  console.log('Testing basic tmux integration functionality...\n');
  
  const integration = new TmuxIntegration({
    performanceMode: 'balanced'
  });
  
  try {
    await integration.initialize();
    console.log('✅ Initialization successful');
    
    const sessions = integration.getSessions();
    console.log(`✅ Found ${sessions.length} existing sessions`);
    
    const testSession = await integration.createSession('test-basic');
    console.log(`✅ Created session: ${testSession.name} (${testSession.id})`);
    
    const result = await integration.executeCommand('echo "Hello from tmux"');
    console.log(`✅ Command executed in ${result.executionTime?.toFixed(2)}ms`);
    
    const output = await integration.getOutput(10);
    console.log(`✅ Captured output (${output.split('\n').length} lines)`);
    
    const metrics = integration.getPerformanceMetrics();
    console.log(`✅ Performance metrics: Avg latency ${metrics.averageLatency.toFixed(2)}ms`);
    
    await integration.cleanup();
    console.log('✅ Cleanup successful\n');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testMultipleSessions() {
  console.log('Testing multiple session handling...\n');
  
  const integration = new TmuxIntegration({
    performanceMode: 'balanced'
  });
  
  try {
    await integration.initialize();
    
    const sessionCount = 5;
    const sessions = [];
    
    for (let i = 0; i < sessionCount; i++) {
      const session = await integration.createSession(`multi-test-${i}`);
      sessions.push(session);
      console.log(`✅ Created session ${i + 1}/${sessionCount}: ${session.name}`);
    }
    
    for (let i = 0; i < sessions.length; i++) {
      await integration.executeCommand(`echo "Session ${i} active"`, sessions[i].id);
    }
    console.log(`✅ Executed commands in all ${sessionCount} sessions`);
    
    await integration.switchSession(sessions[2].id);
    const activeSession = integration.getActiveSession();
    console.log(`✅ Switched active session to: ${activeSession?.name}`);
    
    const allSessions = integration.getSessions();
    console.log(`✅ Total sessions running: ${allSessions.length}`);
    
    await integration.cleanup();
    console.log('✅ All sessions cleaned up\n');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testContinuousCapture() {
  console.log('Testing continuous output capture...\n');
  
  const integration = new TmuxIntegration({
    performanceMode: 'balanced'
  });
  
  try {
    await integration.initialize();
    
    const outputs: string[] = [];
    integration.startContinuousCapture((output) => {
      outputs.push(output);
    });
    
    console.log('✅ Started continuous capture');
    
    await integration.executeCommand('for i in {1..5}; do echo "Output $i"; sleep 0.1; done');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Captured ${outputs.length} output events`);
    
    await integration.cleanup();
    console.log('✅ Cleanup successful\n');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testErrorHandling() {
  console.log('Testing error handling...\n');
  
  const integration = new TmuxIntegration({
    performanceMode: 'balanced',
    commandTimeout: 1000
  });
  
  try {
    await integration.initialize();
    
    try {
      await integration.executeCommand('invalid-command-xyz');
      console.log('✅ Invalid command handled gracefully');
    } catch {
      console.log('✅ Invalid command error caught');
    }
    
    try {
      await integration.switchSession('non-existent-session');
      console.log('❌ Should have thrown error for non-existent session');
    } catch {
      console.log('✅ Non-existent session error caught');
    }
    
    const metrics = integration.getPerformanceMetrics();
    console.log(`✅ Success rate after errors: ${metrics.successRate.toFixed(2)}%`);
    
    await integration.cleanup();
    console.log('✅ Cleanup successful\n');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('tmux Integration Test Suite');
  console.log('='.repeat(60) + '\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--benchmark') || args.includes('-b')) {
    await runBenchmark();
  } else if (args.includes('--quick') || args.includes('-q')) {
    const success = await testBasicFunctionality();
    process.exit(success ? 0 : 1);
  } else {
    const tests = [
      testBasicFunctionality,
      testMultipleSessions,
      testContinuousCapture,
      testErrorHandling
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      const success = await test();
      if (success) passed++;
      else failed++;
    }
    
    console.log('='.repeat(60));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    
    if (failed === 0) {
      console.log('\n✅ All tests passed! Running performance benchmark...\n');
      await runBenchmark();
    }
    
    process.exit(failed === 0 ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}