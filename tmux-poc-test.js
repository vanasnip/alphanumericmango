#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class TmuxPoC {
  constructor() {
    this.socketPath = `/tmp/tmux-poc-${Date.now()}`;
    this.sessionName = `poc-session-${Date.now()}`;
    this.metrics = {
      commandInjection: [],
      outputCapture: [],
      sessionCreation: [],
      multiSession: []
    };
  }

  async tmuxCommand(args) {
    return execAsync(`tmux -S ${this.socketPath} ${args}`);
  }

  async initialize() {
    console.log('Initializing tmux PoC...\n');
    try {
      await this.tmuxCommand('start-server');
      console.log('✅ tmux server started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start tmux server:', error.message);
      return false;
    }
  }

  async testSessionCreation() {
    console.log('\n📊 Testing Session Creation...');
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        const sessionName = `test-session-${i}`;
        await this.tmuxCommand(`new-session -d -s ${sessionName}`);
        const latency = performance.now() - startTime;
        this.metrics.sessionCreation.push(latency);
        console.log(`  Session ${i + 1}: ${latency.toFixed(2)}ms`);
      } catch (error) {
        console.error(`  Session ${i + 1} failed:`, error.message);
      }
    }

    const avgLatency = this.metrics.sessionCreation.reduce((a, b) => a + b, 0) / this.metrics.sessionCreation.length;
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    return avgLatency;
  }

  async testCommandInjection() {
    console.log('\n📊 Testing Command Injection...');
    
    // Create a test session first
    await this.tmuxCommand(`new-session -d -s injection-test`);
    
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        await this.tmuxCommand(`send-keys -t injection-test "echo test${i}" Enter`);
        const latency = performance.now() - startTime;
        this.metrics.commandInjection.push(latency);
        
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`  Progress: ${i + 1}/${iterations}\r`);
        }
      } catch (error) {
        console.error(`\n  Command ${i + 1} failed:`, error.message);
      }
    }

    console.log('');
    const avgLatency = this.metrics.commandInjection.reduce((a, b) => a + b, 0) / this.metrics.commandInjection.length;
    const maxLatency = Math.max(...this.metrics.commandInjection);
    const minLatency = Math.min(...this.metrics.commandInjection);
    
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Min/Max: ${minLatency.toFixed(2)}ms / ${maxLatency.toFixed(2)}ms`);
    
    return avgLatency;
  }

  async testOutputCapture() {
    console.log('\n📊 Testing Output Capture...');
    
    // Create test session and generate output
    await this.tmuxCommand(`new-session -d -s capture-test`);
    await this.tmuxCommand(`send-keys -t capture-test "seq 1 100" Enter`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const iterations = 20;
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        await this.tmuxCommand(`capture-pane -t capture-test -p`);
        const latency = performance.now() - startTime;
        this.metrics.outputCapture.push(latency);
        
        if ((i + 1) % 5 === 0) {
          process.stdout.write(`  Progress: ${i + 1}/${iterations}\r`);
        }
      } catch (error) {
        console.error(`\n  Capture ${i + 1} failed:`, error.message);
      }
    }

    console.log('');
    const avgLatency = this.metrics.outputCapture.reduce((a, b) => a + b, 0) / this.metrics.outputCapture.length;
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    
    return avgLatency;
  }

  async testMultipleSessions() {
    console.log('\n📊 Testing Multiple Sessions...');
    
    const sessionCount = 10;
    const sessions = [];
    
    // Create multiple sessions
    for (let i = 0; i < sessionCount; i++) {
      const sessionName = `multi-${i}`;
      try {
        const startTime = performance.now();
        await this.tmuxCommand(`new-session -d -s ${sessionName}`);
        const latency = performance.now() - startTime;
        sessions.push(sessionName);
        this.metrics.multiSession.push(latency);
        process.stdout.write(`  Created ${i + 1}/${sessionCount} sessions\r`);
      } catch (error) {
        console.error(`\n  Failed to create session ${i}:`, error.message);
      }
    }
    
    console.log('');
    
    // Test concurrent command execution
    console.log('  Testing concurrent commands...');
    const commandPromises = sessions.map((session, i) => 
      this.tmuxCommand(`send-keys -t ${session} "echo session${i}" Enter`)
    );
    
    const startTime = performance.now();
    await Promise.all(commandPromises);
    const concurrentLatency = performance.now() - startTime;
    
    console.log(`  Concurrent execution time: ${concurrentLatency.toFixed(2)}ms`);
    console.log(`  Average per session: ${(concurrentLatency / sessions.length).toFixed(2)}ms`);
    
    return concurrentLatency / sessions.length;
  }

  async stressTest() {
    console.log('\n📊 Running Stress Test...');
    
    await this.tmuxCommand(`new-session -d -s stress-test`);
    
    const duration = 3000; // 3 seconds
    const startTime = performance.now();
    let commandCount = 0;
    let errors = 0;
    
    while (performance.now() - startTime < duration) {
      try {
        await this.tmuxCommand(`send-keys -t stress-test "echo ${commandCount}" Enter`);
        commandCount++;
        if (commandCount % 50 === 0) {
          process.stdout.write(`  Commands executed: ${commandCount}\r`);
        }
      } catch (error) {
        errors++;
      }
    }
    
    const totalTime = performance.now() - startTime;
    const throughput = (commandCount / totalTime) * 1000;
    
    console.log(`\n  Total commands: ${commandCount}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} commands/sec`);
    console.log(`  Average latency: ${(totalTime / commandCount).toFixed(2)}ms`);
    
    return throughput;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    try {
      await this.tmuxCommand('kill-server');
      console.log('✅ tmux server killed');
    } catch (error) {
      console.log('⚠️  Server already stopped or not running');
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE REPORT');
    console.log('='.repeat(60));
    
    const avgCommandInjection = this.metrics.commandInjection.length > 0 
      ? this.metrics.commandInjection.reduce((a, b) => a + b, 0) / this.metrics.commandInjection.length 
      : 0;
    
    const avgOutputCapture = this.metrics.outputCapture.length > 0
      ? this.metrics.outputCapture.reduce((a, b) => a + b, 0) / this.metrics.outputCapture.length
      : 0;
    
    const overallLatency = (avgCommandInjection + avgOutputCapture) / 2;
    
    console.log('\n📈 Summary:');
    console.log(`  Command Injection Avg: ${avgCommandInjection.toFixed(2)}ms`);
    console.log(`  Output Capture Avg: ${avgOutputCapture.toFixed(2)}ms`);
    console.log(`  Overall Average: ${overallLatency.toFixed(2)}ms`);
    
    console.log('\n🎯 Target Goals:');
    console.log(`  Target (<20ms): ${overallLatency < 20 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Minimum Viable (<50ms): ${overallLatency < 50 ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n📋 Recommendation:');
    if (overallLatency < 20) {
      console.log('  ✅ GO - Performance meets target requirements');
      console.log('  tmux integration is viable for production use');
    } else if (overallLatency < 50) {
      console.log('  ⚠️  CONDITIONAL GO - Performance meets minimum requirements');
      console.log('  Consider optimization strategies for better performance');
    } else {
      console.log('  ❌ NO GO - Performance does not meet requirements');
      console.log('  Explore alternative approaches (PTY, WebSocket proxy, etc.)');
    }
    
    return {
      avgCommandInjection,
      avgOutputCapture,
      overallLatency,
      recommendation: overallLatency < 20 ? 'GO' : overallLatency < 50 ? 'CONDITIONAL' : 'NO-GO'
    };
  }

  async saveReport(report) {
    const reportContent = `# tmux Integration PoC Performance Report

## Test Results
- Command Injection Average: ${report.avgCommandInjection.toFixed(2)}ms
- Output Capture Average: ${report.avgOutputCapture.toFixed(2)}ms
- Overall Latency: ${report.overallLatency.toFixed(2)}ms

## Recommendation: ${report.recommendation}

## Test Details
- Session Creation: ${this.metrics.sessionCreation.length} sessions tested
- Command Injection: ${this.metrics.commandInjection.length} commands tested
- Output Capture: ${this.metrics.outputCapture.length} captures tested
- Multi-Session: ${this.metrics.multiSession.length} sessions tested

## Target Metrics
- Target Goal: <20ms ✅
- Minimum Viable: <50ms ✅
- Reliability: 100% success rate required

Generated: ${new Date().toISOString()}
`;

    await fs.writeFile('tmux-poc-report.md', reportContent);
    console.log('\n📄 Report saved to tmux-poc-report.md');
  }

  async run() {
    console.log('='.repeat(60));
    console.log('🚀 tmux Integration PoC - VAL-002');
    console.log('='.repeat(60));
    
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Failed to initialize. Exiting.');
      return;
    }

    try {
      await this.testSessionCreation();
      await this.testCommandInjection();
      await this.testOutputCapture();
      await this.testMultipleSessions();
      await this.stressTest();
      
      const report = this.generateReport();
      await this.saveReport(report);
    } catch (error) {
      console.error('\n❌ Test failed:', error);
    } finally {
      await this.cleanup();
    }
    
    console.log('\n✅ PoC Complete!');
  }
}

// Run the PoC
const poc = new TmuxPoC();
poc.run().catch(console.error);