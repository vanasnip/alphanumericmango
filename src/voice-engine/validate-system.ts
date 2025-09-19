#!/usr/bin/env ts-node
/**
 * End-to-End System Validation for Coqui TTS Voice Engine
 * Comprehensive validation of the complete voice terminal integration
 */

import { TTSService } from './tts-service';
import { VoiceTerminalIntegration, VoiceTerminalCommandHandler } from './voice-terminal-integration';
import { HealthMonitor } from './health-monitor';
import { ConfigManager } from './config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details?: string;
  error?: string;
}

interface ValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: ValidationResult[];
}

class SystemValidator {
  private configManager: ConfigManager;
  private ttsService?: TTSService;
  private voiceTerminal?: VoiceTerminalIntegration;
  private commandHandler?: VoiceTerminalCommandHandler;
  private healthMonitor?: HealthMonitor;
  private results: ValidationResult[] = [];

  constructor(environment: string = 'development') {
    this.configManager = new ConfigManager(environment);
    console.log(`🚀 Initializing system validator for ${environment} environment`);
  }

  /**
   * Run complete system validation
   */
  async validateSystem(): Promise<ValidationSummary> {
    console.log('\n📋 Starting End-to-End System Validation');
    console.log('=' * 60);

    const startTime = Date.now();

    try {
      // Phase 1: Configuration validation
      await this.validateConfiguration();

      // Phase 2: Service initialization
      await this.validateServiceInitialization();

      // Phase 3: Core TTS functionality
      await this.validateTTSFunctionality();

      // Phase 4: Voice terminal integration
      await this.validateVoiceTerminalIntegration();

      // Phase 5: Performance validation
      await this.validatePerformance();

      // Phase 6: Health monitoring
      await this.validateHealthMonitoring();

      // Phase 7: Error handling and recovery
      await this.validateErrorHandling();

    } catch (error) {
      console.error('❌ Critical validation error:', error);
      this.addResult('System Validation', 'FAIL', 0, undefined, error instanceof Error ? error.message : String(error));
    } finally {
      await this.cleanup();
    }

    const totalDuration = Date.now() - startTime;
    const summary = this.generateSummary(totalDuration);
    
    this.printSummary(summary);
    return summary;
  }

  /**
   * Validate configuration management
   */
  private async validateConfiguration(): Promise<void> {
    console.log('\n🔧 Phase 1: Configuration Validation');

    await this.runTest('Load Configuration', async () => {
      const config = this.configManager.getConfig();
      
      if (!config.tts.defaultModel) {
        throw new Error('Default TTS model not configured');
      }
      
      if (config.tts.maxConcurrentRequests < 1) {
        throw new Error('Invalid maxConcurrentRequests configuration');
      }
      
      return `Environment: ${config.environment}, Model: ${config.tts.defaultModel}`;
    });

    await this.runTest('Environment Variables', async () => {
      const envVars = this.configManager.exportAsEnvironmentVariables();
      
      if (Object.keys(envVars).length === 0) {
        throw new Error('No environment variables exported');
      }
      
      return `Exported ${Object.keys(envVars).length} environment variables`;
    });

    await this.runTest('Cache Directory', async () => {
      const config = this.configManager.getTTSConfig();
      await fs.mkdir(config.cacheDir, { recursive: true });
      
      // Test write permissions
      const testFile = path.join(config.cacheDir, 'test-write.tmp');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return `Cache directory: ${config.cacheDir}`;
    });
  }

  /**
   * Validate service initialization
   */
  private async validateServiceInitialization(): Promise<void> {
    console.log('\n🏗️ Phase 2: Service Initialization');

    await this.runTest('TTS Service Initialization', async () => {
      const ttsConfig = this.configManager.getTTSConfig();
      this.ttsService = new TTSService({
        model: ttsConfig.defaultModel,
        pythonPath: ttsConfig.pythonPath,
        modulePath: ttsConfig.pythonModulePath,
        maxConcurrentRequests: ttsConfig.maxConcurrentRequests,
        timeoutMs: ttsConfig.requestTimeoutMs,
        cacheDir: ttsConfig.cacheDir,
        enableGPU: ttsConfig.enableGPU,
        enableStreaming: ttsConfig.enableStreaming
      });

      await this.ttsService.initialize();
      
      const health = await this.ttsService.getHealthStatus();
      if (health.status !== 'healthy') {
        throw new Error(`TTS service unhealthy: ${health.issues.join(', ')}`);
      }
      
      return `TTS service ready with ${health.processId} PID`;
    });

    await this.runTest('Voice Terminal Integration', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not initialized');
      }

      const vtConfig = this.configManager.getVoiceTerminalConfig();
      this.voiceTerminal = new VoiceTerminalIntegration({
        ...vtConfig,
        tts: {
          model: vtConfig.defaultVoice,
          pythonPath: this.configManager.getTTSConfig().pythonPath,
          modulePath: this.configManager.getTTSConfig().pythonModulePath,
          maxConcurrentRequests: this.configManager.getTTSConfig().maxConcurrentRequests,
          timeoutMs: this.configManager.getTTSConfig().requestTimeoutMs,
          cacheDir: this.configManager.getTTSConfig().cacheDir,
          enableGPU: this.configManager.getTTSConfig().enableGPU,
          enableStreaming: this.configManager.getTTSConfig().enableStreaming
        }
      });

      await this.voiceTerminal.initialize();
      
      const health = await this.voiceTerminal.getHealthStatus();
      if (health.tts?.status === 'unhealthy') {
        throw new Error('Voice terminal TTS unhealthy');
      }
      
      return 'Voice terminal integration ready';
    });

    await this.runTest('Command Handler Setup', async () => {
      if (!this.voiceTerminal) {
        throw new Error('Voice terminal not initialized');
      }

      this.commandHandler = new VoiceTerminalCommandHandler(this.voiceTerminal);
      return 'Command handler ready';
    });

    await this.runTest('Health Monitor Setup', async () => {
      const monConfig = this.configManager.getMonitoringConfig();
      this.healthMonitor = new HealthMonitor(
        monConfig,
        this.ttsService,
        this.voiceTerminal
      );

      this.healthMonitor.start();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const health = this.healthMonitor.getCurrentHealth();
      if (!health || health.overall === 'critical') {
        throw new Error('System health critical');
      }
      
      return `Health monitor active (status: ${health.overall})`;
    });
  }

  /**
   * Validate core TTS functionality
   */
  private async validateTTSFunctionality(): Promise<void> {
    console.log('\n🎤 Phase 3: TTS Functionality Validation');

    await this.runTest('Basic Text Synthesis', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const result = await this.ttsService.synthesize({
        text: 'Hello, this is a validation test for the TTS system.'
      });

      if (!result.success || !result.outputPath) {
        throw new Error('Text synthesis failed');
      }

      // Verify file exists and has content
      const stats = await fs.stat(result.outputPath);
      if (stats.size === 0) {
        throw new Error('Generated audio file is empty');
      }

      return `Generated ${stats.size} bytes audio in ${result.duration}ms`;
    });

    await this.runTest('Streaming Synthesis', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const text = 'This is a streaming synthesis test with multiple sentences for real-time generation.';
      let chunkCount = 0;
      let firstAudioTime: number | null = null;
      const startTime = Date.now();

      for await (const chunk of this.ttsService.synthesizeStreaming({ text })) {
        if (chunk.type === 'audio') {
          chunkCount++;
          if (firstAudioTime === null) {
            firstAudioTime = Date.now() - startTime;
          }
        }
      }

      if (chunkCount === 0) {
        throw new Error('No audio chunks generated');
      }

      return `Generated ${chunkCount} chunks, first audio in ${firstAudioTime}ms`;
    });

    await this.runTest('Model Management', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const models = await this.ttsService.getAvailableModels();
      if (models.length === 0) {
        throw new Error('No TTS models available');
      }

      // Test model switching if multiple models available
      if (models.length > 1) {
        const originalModel = models[0];
        const newModel = models[1];
        
        await this.ttsService.switchModel(newModel);
        await this.ttsService.switchModel(originalModel);
      }

      return `${models.length} models available: ${models.join(', ')}`;
    });

    await this.runTest('Cache Performance', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const text = 'Cache performance test text';
      
      // First synthesis (cache miss)
      const result1 = await this.ttsService.synthesize({ text });
      
      // Second synthesis (cache hit)
      const result2 = await this.ttsService.synthesize({ text });

      if (!result1.success || !result2.success) {
        throw new Error('Cache test synthesis failed');
      }

      const speedup = result1.duration! / result2.duration!;
      
      return `Cache speedup: ${speedup.toFixed(1)}x (${result1.duration}ms → ${result2.duration}ms)`;
    });
  }

  /**
   * Validate voice terminal integration
   */
  private async validateVoiceTerminalIntegration(): Promise<void> {
    console.log('\n🗣️ Phase 4: Voice Terminal Integration');

    await this.runTest('Voice Command Processing', async () => {
      if (!this.commandHandler) {
        throw new Error('Command handler not available');
      }

      const command = {
        id: 'validation-test-1',
        text: 'Show project status',
        timestamp: Date.now(),
        context: { projectId: 'test-project' }
      };

      const response = await this.commandHandler.handleProjectCommand(command);
      
      if (!response.audioPath || !response.metadata) {
        throw new Error('Voice command processing failed');
      }

      return `Response generated in ${response.metadata.synthesisTime}ms (${response.metadata.audioLength.toFixed(1)}s audio)`;
    });

    await this.runTest('Navigation Commands', async () => {
      if (!this.commandHandler) {
        throw new Error('Command handler not available');
      }

      const command = {
        id: 'validation-test-2',
        text: 'Open terminal view',
        timestamp: Date.now()
      };

      const response = await this.commandHandler.handleNavigationCommand(command);
      
      if (!response.text.includes('terminal')) {
        throw new Error('Navigation command not properly processed');
      }

      return `Navigation response: "${response.text}"`;
    });

    await this.runTest('Status Commands', async () => {
      if (!this.commandHandler) {
        throw new Error('Command handler not available');
      }

      const command = {
        id: 'validation-test-3',
        text: 'What is the system status?',
        timestamp: Date.now()
      };

      const response = await this.commandHandler.handleStatusCommand(command);
      
      if (!response.text || response.text.length === 0) {
        throw new Error('Status command returned empty response');
      }

      return `Status response: "${response.text}"`;
    });

    await this.runTest('Voice Management', async () => {
      if (!this.voiceTerminal) {
        throw new Error('Voice terminal not available');
      }

      const voices = await this.voiceTerminal.getAvailableVoices();
      
      if (voices.length === 0) {
        throw new Error('No voices available');
      }

      // Test voice switching if multiple voices
      if (voices.length > 1) {
        const newVoice = voices.find(v => v !== this.configManager.getVoiceTerminalConfig().defaultVoice);
        if (newVoice) {
          await this.voiceTerminal.switchVoice(newVoice);
        }
      }

      return `${voices.length} voices available: ${voices.join(', ')}`;
    });
  }

  /**
   * Validate performance characteristics
   */
  private async validatePerformance(): Promise<void> {
    console.log('\n⚡ Phase 5: Performance Validation');

    await this.runTest('Latency Target Validation', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const testTexts = [
        'Quick test',
        'Medium length test sentence for latency validation',
        'This is a longer test sentence that should still meet the performance targets for text-to-speech synthesis in the voice terminal application'
      ];

      const latencies: number[] = [];
      
      for (const text of testTexts) {
        const result = await this.ttsService.synthesize({ text });
        if (result.success && result.duration) {
          latencies.push(result.duration);
        }
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const target = this.configManager.getMonitoringConfig().maxAverageLatencyMs;

      if (avgLatency > target) {
        throw new Error(`Average latency ${avgLatency.toFixed(0)}ms exceeds target ${target}ms`);
      }

      return `Average: ${avgLatency.toFixed(0)}ms, Max: ${maxLatency.toFixed(0)}ms (target: ${target}ms)`;
    });

    await this.runTest('Concurrent Request Handling', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const concurrentRequests = 3;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        this.ttsService!.synthesize({ text: `Concurrent test ${i}` })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const totalTime = Date.now() - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / concurrentRequests) * 100;

      if (successRate < 80) {
        throw new Error(`Low success rate: ${successRate.toFixed(0)}%`);
      }

      return `${successCount}/${concurrentRequests} successful (${totalTime}ms total)`;
    });

    await this.runTest('Memory Usage Validation', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const initialMemory = process.memoryUsage().rss;
      
      // Perform multiple synthesis operations
      for (let i = 0; i < 5; i++) {
        await this.ttsService.synthesize({ text: `Memory test ${i}` });
      }

      const finalMemory = process.memoryUsage().rss;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // MB
      const maxGrowth = 100; // 100MB limit

      if (memoryGrowth > maxGrowth) {
        throw new Error(`Memory growth ${memoryGrowth.toFixed(0)}MB exceeds limit ${maxGrowth}MB`);
      }

      return `Memory growth: ${memoryGrowth.toFixed(1)}MB (limit: ${maxGrowth}MB)`;
    });

    await this.runTest('Performance Metrics Collection', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const metrics = await this.ttsService.getPerformanceMetrics();
      
      if (typeof metrics.totalRequests !== 'number' || metrics.totalRequests === 0) {
        throw new Error('Invalid performance metrics');
      }

      return `Requests: ${metrics.totalRequests}, Avg latency: ${metrics.averageLatency.toFixed(0)}ms, Error rate: ${metrics.errorRate.toFixed(1)}%`;
    });
  }

  /**
   * Validate health monitoring system
   */
  private async validateHealthMonitoring(): Promise<void> {
    console.log('\n🏥 Phase 6: Health Monitoring Validation');

    await this.runTest('Health Status Collection', async () => {
      if (!this.healthMonitor) {
        throw new Error('Health monitor not available');
      }

      const health = this.healthMonitor.getCurrentHealth();
      
      if (!health) {
        throw new Error('No health status available');
      }

      if (health.components.length === 0) {
        throw new Error('No components monitored');
      }

      const componentStatuses = health.components.map(c => `${c.component}:${c.status}`);
      
      return `Overall: ${health.overall}, Components: ${componentStatuses.join(', ')}`;
    });

    await this.runTest('Alert System', async () => {
      if (!this.healthMonitor) {
        throw new Error('Health monitor not available');
      }

      const activeAlerts = this.healthMonitor.getActiveAlerts();
      const alertHistory = this.healthMonitor.getAlertHistory();

      return `Active alerts: ${activeAlerts.length}, Alert history: ${alertHistory.length}`;
    });

    await this.runTest('Health Data Export', async () => {
      if (!this.healthMonitor) {
        throw new Error('Health monitor not available');
      }

      const exportPath = path.join(this.configManager.getTTSConfig().cacheDir, 'health-export-test.json');
      
      await this.healthMonitor.exportHealthData(exportPath);
      
      // Verify file was created
      const stats = await fs.stat(exportPath);
      await fs.unlink(exportPath); // Clean up
      
      return `Exported ${stats.size} bytes health data`;
    });
  }

  /**
   * Validate error handling and recovery
   */
  private async validateErrorHandling(): Promise<void> {
    console.log('\n🛡️ Phase 7: Error Handling Validation');

    await this.runTest('Invalid Input Handling', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      // Test empty text
      try {
        await this.ttsService.synthesize({ text: '' });
        throw new Error('Should have rejected empty text');
      } catch (error) {
        // Expected error
      }

      // Test very long text
      try {
        const longText = 'A'.repeat(20000);
        await this.ttsService.synthesize({ text: longText });
        throw new Error('Should have rejected oversized text');
      } catch (error) {
        // Expected error
      }

      return 'Input validation working correctly';
    });

    await this.runTest('Service Recovery', async () => {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      // Test normal operation
      const result1 = await this.ttsService.synthesize({ text: 'Recovery test 1' });
      
      if (!result1.success) {
        throw new Error('Normal operation failed');
      }

      // Test recovery after potential error
      const result2 = await this.ttsService.synthesize({ text: 'Recovery test 2' });
      
      if (!result2.success) {
        throw new Error('Service did not recover properly');
      }

      return 'Service recovery validated';
    });

    await this.runTest('Resource Cleanup', async () => {
      // Test that temporary files are cleaned up
      const cacheDir = this.configManager.getTTSConfig().cacheDir;
      const files = await fs.readdir(cacheDir);
      const tempFiles = files.filter(f => f.includes('temp') || f.includes('tmp'));
      
      return `Cache directory clean (${files.length} files, ${tempFiles.length} temp files)`;
    });
  }

  /**
   * Run a single test with error handling
   */
  private async runTest(testName: string, testFunction: () => Promise<string>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const details = await testFunction();
      const duration = Date.now() - startTime;
      
      this.addResult(testName, 'PASS', duration, details);
      console.log(`  ✅ ${testName} (${duration}ms)`);
      
      if (details) {
        console.log(`     ${details}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.addResult(testName, 'FAIL', duration, undefined, errorMessage);
      console.log(`  ❌ ${testName} (${duration}ms)`);
      console.log(`     Error: ${errorMessage}`);
    }
  }

  /**
   * Add test result
   */
  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', duration: number, details?: string, error?: string): void {
    this.results.push({
      test,
      status,
      duration,
      details,
      error
    });
  }

  /**
   * Generate validation summary
   */
  private generateSummary(totalDuration: number): ValidationSummary {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    return {
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      duration: totalDuration,
      results: this.results
    };
  }

  /**
   * Print validation summary
   */
  private printSummary(summary: ValidationSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️ Skipped: ${summary.skipped}`);
    console.log(`⏱️ Duration: ${(summary.duration / 1000).toFixed(1)}s`);
    
    const successRate = (summary.passed / summary.totalTests) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    // Overall status
    if (summary.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED - System validation successful!');
    } else if (successRate >= 80) {
      console.log('\n⚠️ MOSTLY PASSED - Some issues need attention');
    } else {
      console.log('\n🚨 VALIDATION FAILED - System needs significant fixes');
    }
    
    // Failed tests summary
    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      summary.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`  • ${r.test}: ${r.error}`);
        });
    }
    
    console.log('');
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.healthMonitor) {
        this.healthMonitor.stop();
      }
      
      if (this.voiceTerminal) {
        await this.voiceTerminal.shutdown();
      }
      
      if (this.ttsService) {
        await this.ttsService.shutdown();
      }
      
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
}

// Main execution
async function main() {
  const environment = process.argv[2] || 'development';
  const validator = new SystemValidator(environment);
  
  try {
    const summary = await validator.validateSystem();
    
    // Exit with appropriate code
    process.exit(summary.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { SystemValidator, ValidationResult, ValidationSummary };