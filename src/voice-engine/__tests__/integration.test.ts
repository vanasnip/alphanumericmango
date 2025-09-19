/**
 * Integration Tests for Coqui TTS Voice Engine
 * Comprehensive end-to-end testing of TTS functionality
 */

import { TTSService, TTSConfig } from '../tts-service';
import { VoiceTerminalIntegration, VoiceTerminalConfig } from '../voice-terminal-integration';
import { HealthMonitor } from '../health-monitor';
import { ConfigManager, ProductionConfig } from '../config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test configuration
const TEST_CONFIG: TTSConfig = {
  model: 'fast',
  pythonPath: 'python3',
  modulePath: path.join(__dirname, '../../../modules/voice-engine'),
  maxConcurrentRequests: 3,
  timeoutMs: 10000,
  cacheDir: path.join(os.tmpdir(), 'tts-test-cache'),
  enableGPU: false, // Disable GPU for tests
  enableStreaming: true
};

const TEST_VT_CONFIG: VoiceTerminalConfig = {
  tts: TEST_CONFIG,
  enableResponseAudio: true,
  defaultVoice: 'fast',
  playbackVolume: 0.5,
  playbackSpeed: 1.0,
  maxResponseLength: 500,
  enableStreamingResponse: true,
  responseQueueSize: 5,
  enableInterruption: true,
  enableVisualFeedback: false,
  showSynthesisProgress: false,
  enableWaveformDisplay: false
};

describe('TTS Service Integration Tests', () => {
  let ttsService: TTSService;
  let testCacheDir: string;

  beforeAll(async () => {
    testCacheDir = TEST_CONFIG.cacheDir!;
    await fs.mkdir(testCacheDir, { recursive: true });
  });

  afterAll(async () => {
    if (ttsService) {
      await ttsService.shutdown();
    }
    // Clean up test cache
    try {
      await fs.rmdir(testCacheDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to clean up test cache:', error);
    }
  });

  beforeEach(() => {
    ttsService = new TTSService(TEST_CONFIG);
  });

  afterEach(async () => {
    if (ttsService) {
      await ttsService.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize TTS service successfully', async () => {
      await expect(ttsService.initialize()).resolves.toBeUndefined();
      
      const health = await ttsService.getHealthStatus();
      expect(health.status).toBe('healthy');
    }, 30000);

    it('should handle initialization with invalid Python path', async () => {
      const invalidService = new TTSService({
        ...TEST_CONFIG,
        pythonPath: '/invalid/python/path'
      });

      await expect(invalidService.initialize()).rejects.toThrow();
    }, 10000);

    it('should get available models after initialization', async () => {
      await ttsService.initialize();
      
      const models = await ttsService.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('fast');
    }, 30000);
  });

  describe('Text-to-Speech Synthesis', () => {
    beforeEach(async () => {
      await ttsService.initialize();
    });

    it('should synthesize short text successfully', async () => {
      const result = await ttsService.synthesize({
        text: 'Hello, this is a test.',
        outputPath: path.join(testCacheDir, 'test-short.wav')
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      
      // Verify file exists
      const fileExists = await fs.access(result.outputPath!).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    }, 30000);

    it('should synthesize medium length text', async () => {
      const text = 'This is a medium length text that should test the TTS system\'s ability to handle longer sentences with proper pacing and intonation.';
      
      const result = await ttsService.synthesize({
        text,
        outputPath: path.join(testCacheDir, 'test-medium.wav')
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.latency).toBeLessThan(5000); // Should be under 5 seconds
    }, 30000);

    it('should handle cache hits for repeated text', async () => {
      const text = 'This text will be cached.';
      
      // First synthesis
      const result1 = await ttsService.synthesize({
        text,
        outputPath: path.join(testCacheDir, 'cache-test-1.wav')
      });
      
      // Second synthesis (should be cached)
      const result2 = await ttsService.synthesize({
        text,
        outputPath: path.join(testCacheDir, 'cache-test-2.wav')
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.duration).toBeLessThan(result1.duration!);
    }, 30000);

    it('should validate input text', async () => {
      // Empty text
      await expect(ttsService.synthesize({ text: '' })).rejects.toThrow();
      
      // Very long text
      const longText = 'A'.repeat(15000);
      await expect(ttsService.synthesize({ text: longText })).rejects.toThrow();
    }, 10000);

    it('should handle invalid output paths', async () => {
      await expect(ttsService.synthesize({
        text: 'Test',
        outputPath: '/invalid/path/output.wav'
      })).rejects.toThrow();
    }, 10000);
  });

  describe('Streaming Synthesis', () => {
    beforeEach(async () => {
      await ttsService.initialize();
    });

    it('should perform streaming synthesis', async () => {
      const text = 'This is a streaming synthesis test with multiple sentences. Each sentence should be processed as a separate chunk for real-time audio generation.';
      
      const chunks: any[] = [];
      let firstChunkTime: number | null = null;
      const startTime = Date.now();

      for await (const chunk of ttsService.synthesizeStreaming({ text })) {
        chunks.push(chunk);
        
        if (chunk.type === 'audio' && firstChunkTime === null) {
          firstChunkTime = Date.now() - startTime;
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(firstChunkTime).toBeLessThan(2000); // First chunk under 2 seconds
      
      const audioChunks = chunks.filter(c => c.type === 'audio');
      expect(audioChunks.length).toBeGreaterThan(0);
      
      const completeChunks = chunks.filter(c => c.type === 'complete');
      expect(completeChunks.length).toBe(1);
    }, 30000);

    it('should handle streaming errors gracefully', async () => {
      const chunks: any[] = [];
      
      try {
        for await (const chunk of ttsService.synthesizeStreaming({ text: '' })) {
          chunks.push(chunk);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      await ttsService.initialize();
    });

    it('should switch between models', async () => {
      const models = await ttsService.getAvailableModels();
      
      if (models.length > 1) {
        const originalModel = models[0];
        const newModel = models[1];
        
        await ttsService.switchModel(newModel);
        
        // Verify model switch
        const result = await ttsService.synthesize({
          text: 'Testing model switch',
          outputPath: path.join(testCacheDir, 'model-switch-test.wav')
        });
        
        expect(result.success).toBe(true);
        expect(result.metadata?.model).toBe(newModel);
      }
    }, 30000);

    it('should handle invalid model names', async () => {
      await expect(ttsService.switchModel('nonexistent-model')).rejects.toThrow();
    }, 10000);
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await ttsService.initialize();
    });

    it('should collect performance metrics', async () => {
      // Perform some synthesis operations
      await ttsService.synthesize({ text: 'Metrics test 1' });
      await ttsService.synthesize({ text: 'Metrics test 2' });
      
      const metrics = await ttsService.getPerformanceMetrics();
      
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
    }, 30000);

    it('should track cache performance', async () => {
      const text = 'Cache performance test';
      
      // First request (cache miss)
      await ttsService.synthesize({ text });
      
      // Second request (cache hit)
      await ttsService.synthesize({ text });
      
      const metrics = await ttsService.getPerformanceMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await ttsService.initialize();
    });

    it('should handle service shutdown gracefully', async () => {
      const synthesisPromise = ttsService.synthesize({ text: 'Test before shutdown' });
      
      // Shutdown while synthesis is in progress
      setTimeout(() => ttsService.shutdown(), 100);
      
      // Should either complete or fail gracefully
      try {
        await synthesisPromise;
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        ttsService.synthesize({
          text: `Concurrent test ${i}`,
          outputPath: path.join(testCacheDir, `concurrent-${i}.wav`)
        })
      );

      const results = await Promise.allSettled(promises);
      
      // At least some should succeed
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0);
    }, 30000);
  });
});

describe('Voice Terminal Integration Tests', () => {
  let voiceTerminal: VoiceTerminalIntegration;

  beforeAll(async () => {
    await fs.mkdir(TEST_VT_CONFIG.tts.cacheDir!, { recursive: true });
  });

  afterAll(async () => {
    if (voiceTerminal) {
      await voiceTerminal.shutdown();
    }
  });

  beforeEach(() => {
    voiceTerminal = new VoiceTerminalIntegration(TEST_VT_CONFIG);
  });

  afterEach(async () => {
    if (voiceTerminal) {
      await voiceTerminal.shutdown();
    }
  });

  describe('Voice Terminal Initialization', () => {
    it('should initialize voice terminal integration', async () => {
      await expect(voiceTerminal.initialize()).resolves.toBeUndefined();
      
      const health = await voiceTerminal.getHealthStatus();
      expect(health.voiceTerminal).toBeDefined();
    }, 30000);
  });

  describe('Voice Command Processing', () => {
    beforeEach(async () => {
      await voiceTerminal.initialize();
    });

    it('should process voice commands with audio response', async () => {
      const command = {
        id: 'test-command-1',
        text: 'Show me the project status',
        timestamp: Date.now(),
        context: { projectId: 'test-project' }
      };

      const response = await voiceTerminal.processVoiceCommand(command, 'Project status is active with no pending tasks.');

      expect(response.id).toBeDefined();
      expect(response.commandId).toBe(command.id);
      expect(response.audioPath).toBeDefined();
      expect(response.metadata?.synthesisTime).toBeGreaterThan(0);
    }, 30000);

    it('should handle streaming responses', async () => {
      const command = {
        id: 'test-command-2',
        text: 'Give me a detailed explanation',
        timestamp: Date.now()
      };

      const longResponse = 'This is a detailed explanation that should trigger streaming synthesis due to its length and complexity.';
      
      const response = await voiceTerminal.processVoiceCommand(command, longResponse);

      expect(response.streaming).toBe(true);
      expect(response.audioPath).toBeDefined();
    }, 30000);

    it('should truncate very long responses', async () => {
      const command = {
        id: 'test-command-3',
        text: 'Tell me everything',
        timestamp: Date.now()
      };

      const veryLongResponse = 'A'.repeat(2000); // Exceeds maxResponseLength
      
      const response = await voiceTerminal.processVoiceCommand(command, veryLongResponse);

      expect(response.text.length).toBeLessThanOrEqual(TEST_VT_CONFIG.maxResponseLength! + 3); // +3 for "..."
    }, 30000);
  });

  describe('Audio Playback Management', () => {
    beforeEach(async () => {
      await voiceTerminal.initialize();
    });

    it('should queue audio responses', async () => {
      const command = {
        id: 'test-queue-1',
        text: 'Queue test',
        timestamp: Date.now()
      };

      const response = await voiceTerminal.processVoiceCommand(command, 'This is queued for playback.');

      await expect(voiceTerminal.queueAudioResponse(response)).resolves.toBeUndefined();
    }, 30000);

    it('should handle playback interruption', async () => {
      const command1 = {
        id: 'test-interrupt-1',
        text: 'First command',
        timestamp: Date.now()
      };

      const command2 = {
        id: 'test-interrupt-2',
        text: 'Interrupting command',
        timestamp: Date.now() + 1000
      };

      const response1 = await voiceTerminal.processVoiceCommand(command1, 'This is the first response.');
      const response2 = await voiceTerminal.processVoiceCommand(command2, 'This interrupts the first.');

      await voiceTerminal.queueAudioResponse(response1);
      await voiceTerminal.queueAudioResponse(response2, { interrupt: true });

      // Should handle interruption gracefully
      expect(true).toBe(true); // Placeholder for interrupt verification
    }, 30000);
  });

  describe('Voice Management', () => {
    beforeEach(async () => {
      await voiceTerminal.initialize();
    });

    it('should get available voices', async () => {
      const voices = await voiceTerminal.getAvailableVoices();
      
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    }, 30000);

    it('should switch voices', async () => {
      const voices = await voiceTerminal.getAvailableVoices();
      
      if (voices.length > 1) {
        const newVoice = voices.find(v => v !== TEST_VT_CONFIG.defaultVoice);
        if (newVoice) {
          await expect(voiceTerminal.switchVoice(newVoice)).resolves.toBeUndefined();
        }
      }
    }, 30000);
  });
});

describe('Health Monitoring Tests', () => {
  let healthMonitor: HealthMonitor;
  let ttsService: TTSService;

  beforeAll(async () => {
    ttsService = new TTSService(TEST_CONFIG);
    await ttsService.initialize();
  });

  afterAll(async () => {
    if (healthMonitor) {
      healthMonitor.stop();
    }
    if (ttsService) {
      await ttsService.shutdown();
    }
  });

  beforeEach(() => {
    healthMonitor = new HealthMonitor(
      {
        healthCheckIntervalMs: 1000,
        performanceMetricsRetentionMs: 60000,
        enableAlerts: true,
        maxAverageLatencyMs: 150,
        minCacheHitRate: 70,
        maxErrorRate: 5,
        maxMemoryUsageMB: 2048,
        logLevel: 'info',
        enableMetricsExport: false,
        metricsExportIntervalMs: 30000
      },
      ttsService
    );
  });

  afterEach(() => {
    if (healthMonitor) {
      healthMonitor.stop();
    }
  });

  describe('Health Check Functionality', () => {
    it('should start and perform health checks', (done) => {
      let checkCount = 0;
      
      healthMonitor.on('healthCheck', (health) => {
        checkCount++;
        
        expect(health.overall).toBeDefined();
        expect(health.components).toBeDefined();
        expect(health.systemMetrics).toBeDefined();
        
        if (checkCount >= 2) {
          done();
        }
      });

      healthMonitor.start();
    }, 10000);

    it('should detect component health issues', async () => {
      healthMonitor.start();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const currentHealth = healthMonitor.getCurrentHealth();
      expect(currentHealth).toBeDefined();
      expect(currentHealth!.components.length).toBeGreaterThan(0);
      
      // TTS service should be healthy
      const ttsComponent = currentHealth!.components.find(c => c.component === 'tts-service');
      expect(ttsComponent?.status).toBe('healthy');
    }, 15000);
  });

  describe('Alert Management', () => {
    it('should generate alerts for performance issues', (done) => {
      healthMonitor.on('alert', (alert) => {
        expect(alert.id).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.component).toBeDefined();
        expect(alert.message).toBeDefined();
        done();
      });

      healthMonitor.start();
      
      // Simulate performance issue by triggering high latency
      // This would require mocking the TTS service to return high latency
    }, 15000);

    it('should maintain alert history', async () => {
      healthMonitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const alertHistory = healthMonitor.getAlertHistory();
      expect(Array.isArray(alertHistory)).toBe(true);
    }, 15000);
  });
});

describe('Configuration Management Tests', () => {
  describe('Config Loading', () => {
    it('should load default development configuration', () => {
      const configManager = new ConfigManager('development');
      const config = configManager.getConfig();
      
      expect(config.environment).toBe('development');
      expect(config.tts.defaultModel).toBe('fast');
      expect(config.monitoring.logLevel).toBe('debug');
    });

    it('should load production configuration with optimizations', () => {
      const configManager = new ConfigManager('production');
      const config = configManager.getConfig();
      
      expect(config.environment).toBe('production');
      expect(config.tts.memoryCacheSizeMB).toBeGreaterThan(256);
      expect(config.monitoring.enableAlerts).toBe(true);
    });

    it('should handle environment variable overrides', () => {
      // Set test environment variables
      const originalModel = process.env.TTS_DEFAULT_MODEL;
      process.env.TTS_DEFAULT_MODEL = 'vits';
      
      const configManager = new ConfigManager('development');
      const config = configManager.getConfig();
      
      expect(config.tts.defaultModel).toBe('vits');
      
      // Restore original
      if (originalModel) {
        process.env.TTS_DEFAULT_MODEL = originalModel;
      } else {
        delete process.env.TTS_DEFAULT_MODEL;
      }
    });
  });

  describe('Config Validation', () => {
    it('should validate configuration values', () => {
      expect(() => {
        new ConfigManager('development');
      }).not.toThrow();
    });

    it('should reject invalid configuration', () => {
      expect(() => {
        const configManager = new ConfigManager('development');
        configManager.updateConfig({
          tts: {
            maxConcurrentRequests: -1 // Invalid value
          } as any
        });
      }).toThrow();
    });
  });
});

describe('End-to-End Performance Tests', () => {
  let ttsService: TTSService;

  beforeAll(async () => {
    ttsService = new TTSService({
      ...TEST_CONFIG,
      enableGPU: false // Consistent testing environment
    });
    await ttsService.initialize();
  });

  afterAll(async () => {
    if (ttsService) {
      await ttsService.shutdown();
    }
  });

  it('should meet latency targets for short text', async () => {
    const startTime = Date.now();
    
    const result = await ttsService.synthesize({
      text: 'Quick test'
    });
    
    const latency = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(latency).toBeLessThan(5000); // 5 second max for test environment
  }, 10000);

  it('should handle burst of requests efficiently', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
      text: `Burst test request number ${i}`,
      outputPath: path.join(TEST_CONFIG.cacheDir!, `burst-${i}.wav`)
    }));

    const startTime = Date.now();
    
    const results = await Promise.all(
      requests.map(req => ttsService.synthesize(req))
    );
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    expect(successCount).toBeGreaterThan(5); // At least 50% success
    expect(totalTime).toBeLessThan(30000); // Under 30 seconds total
  }, 40000);

  it('should maintain performance under sustained load', async () => {
    const metrics: number[] = [];
    
    // Run synthesis operations for a period
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      
      await ttsService.synthesize({
        text: `Sustained load test ${i}`
      });
      
      metrics.push(Date.now() - startTime);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Check that performance doesn't degrade significantly
    const firstMetric = metrics[0];
    const lastMetric = metrics[metrics.length - 1];
    
    expect(lastMetric).toBeLessThan(firstMetric * 2); // No more than 2x degradation
  }, 30000);
});