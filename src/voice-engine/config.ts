/**
 * Production Configuration for Coqui TTS Voice Engine
 * Comprehensive configuration management with environment-based overrides
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Configuration interfaces
export interface TTSEngineConfig {
  // Core TTS settings
  defaultModel: string;
  availableModels: string[];
  enableGPU: boolean;
  enableStreaming: boolean;
  
  // Performance settings
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  maxTextLength: number;
  
  // Cache settings
  cacheDir: string;
  memoryCacheSizeMB: number;
  maxCacheEntries: number;
  enableCompression: boolean;
  cacheCleanupIntervalMs: number;
  
  // Model pool settings
  modelPoolMaxMemoryMB: number;
  preloadModels: string[];
  
  // Audio settings
  audioFormat: 'wav' | 'mp3' | 'flac' | 'ogg';
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  
  // Security settings
  enableInputValidation: boolean;
  maxRequestsPerMinute: number;
  enableAuditLogging: boolean;
  
  // Python process settings
  pythonPath: string;
  pythonModulePath: string;
  pythonProcessTimeout: number;
  enableDebugLogging: boolean;
}

export interface VoiceTerminalConfig {
  // Voice terminal specific settings
  enableResponseAudio: boolean;
  defaultVoice: string;
  audioOutputDevice?: string;
  playbackVolume: number;
  playbackSpeed: number;
  
  // Response handling
  maxResponseLength: number;
  enableStreamingResponse: boolean;
  responseQueueSize: number;
  enableInterruption: boolean;
  
  // UI integration
  enableVisualFeedback: boolean;
  showSynthesisProgress: boolean;
  enableWaveformDisplay: boolean;
}

export interface MonitoringConfig {
  // Health monitoring
  healthCheckIntervalMs: number;
  performanceMetricsRetentionMs: number;
  enableAlerts: boolean;
  
  // Performance targets
  maxAverageLatencyMs: number;
  minCacheHitRate: number;
  maxErrorRate: number;
  maxMemoryUsageMB: number;
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFilePath?: string;
  enableMetricsExport: boolean;
  metricsExportIntervalMs: number;
}

export interface ProductionConfig {
  environment: 'development' | 'staging' | 'production';
  tts: TTSEngineConfig;
  voiceTerminal: VoiceTerminalConfig;
  monitoring: MonitoringConfig;
}

// Default configurations by environment
const DEFAULT_CONFIGS: Record<string, Partial<ProductionConfig>> = {
  development: {
    environment: 'development',
    tts: {
      defaultModel: 'fast',
      availableModels: ['default', 'fast', 'vits'],
      enableGPU: true,
      enableStreaming: true,
      maxConcurrentRequests: 3,
      requestTimeoutMs: 30000,
      maxTextLength: 5000,
      memoryCacheSizeMB: 128,
      maxCacheEntries: 200,
      enableCompression: false,
      modelPoolMaxMemoryMB: 1000,
      preloadModels: ['fast'],
      audioFormat: 'wav',
      sampleRate: 22050,
      bitDepth: 16,
      enableInputValidation: true,
      maxRequestsPerMinute: 60,
      enableAuditLogging: false,
      pythonPath: 'python3',
      pythonProcessTimeout: 60000,
      enableDebugLogging: true
    },
    voiceTerminal: {
      enableResponseAudio: true,
      defaultVoice: 'fast',
      playbackVolume: 0.8,
      playbackSpeed: 1.0,
      maxResponseLength: 1000,
      enableStreamingResponse: true,
      responseQueueSize: 10,
      enableInterruption: true,
      enableVisualFeedback: true,
      showSynthesisProgress: true,
      enableWaveformDisplay: false
    },
    monitoring: {
      healthCheckIntervalMs: 30000,
      performanceMetricsRetentionMs: 3600000, // 1 hour
      enableAlerts: false,
      maxAverageLatencyMs: 200,
      minCacheHitRate: 50,
      maxErrorRate: 10,
      maxMemoryUsageMB: 2048,
      logLevel: 'debug',
      enableMetricsExport: false,
      metricsExportIntervalMs: 60000
    }
  },

  staging: {
    environment: 'staging',
    tts: {
      defaultModel: 'fast',
      availableModels: ['default', 'fast', 'vits', 'jenny'],
      enableGPU: true,
      enableStreaming: true,
      maxConcurrentRequests: 5,
      requestTimeoutMs: 30000,
      maxTextLength: 8000,
      memoryCacheSizeMB: 256,
      maxCacheEntries: 500,
      enableCompression: true,
      modelPoolMaxMemoryMB: 1500,
      preloadModels: ['default', 'fast'],
      audioFormat: 'wav',
      sampleRate: 22050,
      bitDepth: 16,
      enableInputValidation: true,
      maxRequestsPerMinute: 120,
      enableAuditLogging: true,
      pythonPath: 'python3',
      pythonProcessTimeout: 60000,
      enableDebugLogging: false
    },
    voiceTerminal: {
      enableResponseAudio: true,
      defaultVoice: 'fast',
      playbackVolume: 0.8,
      playbackSpeed: 1.0,
      maxResponseLength: 1500,
      enableStreamingResponse: true,
      responseQueueSize: 15,
      enableInterruption: true,
      enableVisualFeedback: true,
      showSynthesisProgress: true,
      enableWaveformDisplay: true
    },
    monitoring: {
      healthCheckIntervalMs: 15000,
      performanceMetricsRetentionMs: 7200000, // 2 hours
      enableAlerts: true,
      maxAverageLatencyMs: 150,
      minCacheHitRate: 70,
      maxErrorRate: 5,
      maxMemoryUsageMB: 3072,
      logLevel: 'info',
      enableMetricsExport: true,
      metricsExportIntervalMs: 30000
    }
  },

  production: {
    environment: 'production',
    tts: {
      defaultModel: 'fast',
      availableModels: ['default', 'fast', 'vits', 'jenny'],
      enableGPU: true,
      enableStreaming: true,
      maxConcurrentRequests: 10,
      requestTimeoutMs: 30000,
      maxTextLength: 10000,
      memoryCacheSizeMB: 512,
      maxCacheEntries: 1000,
      enableCompression: true,
      modelPoolMaxMemoryMB: 2000,
      preloadModels: ['default', 'fast', 'vits'],
      audioFormat: 'wav',
      sampleRate: 22050,
      bitDepth: 16,
      enableInputValidation: true,
      maxRequestsPerMinute: 300,
      enableAuditLogging: true,
      pythonPath: 'python3',
      pythonProcessTimeout: 45000,
      enableDebugLogging: false
    },
    voiceTerminal: {
      enableResponseAudio: true,
      defaultVoice: 'fast',
      playbackVolume: 0.8,
      playbackSpeed: 1.0,
      maxResponseLength: 2000,
      enableStreamingResponse: true,
      responseQueueSize: 20,
      enableInterruption: true,
      enableVisualFeedback: true,
      showSynthesisProgress: false,
      enableWaveformDisplay: true
    },
    monitoring: {
      healthCheckIntervalMs: 10000,
      performanceMetricsRetentionMs: 14400000, // 4 hours
      enableAlerts: true,
      maxAverageLatencyMs: 150,
      minCacheHitRate: 80,
      maxErrorRate: 2,
      maxMemoryUsageMB: 4096,
      logLevel: 'warn',
      enableMetricsExport: true,
      metricsExportIntervalMs: 15000
    }
  }
};

/**
 * Configuration Manager
 * Handles loading, validation, and management of configuration
 */
export class ConfigManager {
  private config: ProductionConfig;
  private configPath?: string;

  constructor(environment?: string, configPath?: string) {
    this.configPath = configPath;
    this.config = this.loadConfiguration(environment);
  }

  /**
   * Load configuration based on environment
   */
  private loadConfiguration(environment?: string): ProductionConfig {
    // Determine environment
    const env = environment || 
                process.env.NODE_ENV || 
                process.env.TTS_ENVIRONMENT || 
                'development';

    console.log(`Loading TTS configuration for environment: ${env}`);

    // Get base configuration
    const baseConfig = DEFAULT_CONFIGS[env];
    if (!baseConfig) {
      throw new Error(`Unknown environment: ${env}`);
    }

    // Deep merge with environment overrides and custom config
    let config = this.deepMerge(baseConfig, this.loadEnvironmentOverrides());
    
    // Load custom config file if specified
    if (this.configPath) {
      const customConfig = this.loadConfigFile(this.configPath);
      config = this.deepMerge(config, customConfig);
    }

    // Apply dynamic defaults
    config = this.applyDynamicDefaults(config as ProductionConfig);

    // Validate configuration
    this.validateConfiguration(config as ProductionConfig);

    return config as ProductionConfig;
  }

  /**
   * Load environment variable overrides
   */
  private loadEnvironmentOverrides(): Partial<ProductionConfig> {
    const overrides: any = {};

    // TTS overrides
    if (process.env.TTS_DEFAULT_MODEL) {
      overrides.tts = { ...overrides.tts, defaultModel: process.env.TTS_DEFAULT_MODEL };
    }
    
    if (process.env.TTS_ENABLE_GPU) {
      overrides.tts = { ...overrides.tts, enableGPU: process.env.TTS_ENABLE_GPU === 'true' };
    }
    
    if (process.env.TTS_CACHE_DIR) {
      overrides.tts = { ...overrides.tts, cacheDir: process.env.TTS_CACHE_DIR };
    }
    
    if (process.env.TTS_MEMORY_CACHE_SIZE_MB) {
      overrides.tts = { ...overrides.tts, memoryCacheSizeMB: parseInt(process.env.TTS_MEMORY_CACHE_SIZE_MB) };
    }
    
    if (process.env.TTS_MAX_CONCURRENT_REQUESTS) {
      overrides.tts = { ...overrides.tts, maxConcurrentRequests: parseInt(process.env.TTS_MAX_CONCURRENT_REQUESTS) };
    }
    
    if (process.env.TTS_PYTHON_PATH) {
      overrides.tts = { ...overrides.tts, pythonPath: process.env.TTS_PYTHON_PATH };
    }

    // Voice terminal overrides
    if (process.env.VT_DEFAULT_VOICE) {
      overrides.voiceTerminal = { ...overrides.voiceTerminal, defaultVoice: process.env.VT_DEFAULT_VOICE };
    }
    
    if (process.env.VT_PLAYBACK_VOLUME) {
      overrides.voiceTerminal = { ...overrides.voiceTerminal, playbackVolume: parseFloat(process.env.VT_PLAYBACK_VOLUME) };
    }

    // Monitoring overrides
    if (process.env.MON_LOG_LEVEL) {
      overrides.monitoring = { ...overrides.monitoring, logLevel: process.env.MON_LOG_LEVEL };
    }
    
    if (process.env.MON_ENABLE_ALERTS) {
      overrides.monitoring = { ...overrides.monitoring, enableAlerts: process.env.MON_ENABLE_ALERTS === 'true' };
    }

    return overrides;
  }

  /**
   * Load configuration from file
   */
  private loadConfigFile(configPath: string): Partial<ProductionConfig> {
    try {
      const configContent = require(path.resolve(configPath));
      console.log(`Loaded custom configuration from: ${configPath}`);
      return configContent;
    } catch (error) {
      console.warn(`Failed to load config file ${configPath}:`, error);
      return {};
    }
  }

  /**
   * Apply dynamic defaults based on system environment
   */
  private applyDynamicDefaults(config: ProductionConfig): ProductionConfig {
    // Set cache directory if not specified
    if (!config.tts.cacheDir) {
      config.tts.cacheDir = path.join(os.homedir(), '.cache', 'alphanumeric-tts');
    }

    // Set Python module path if not specified
    if (!config.tts.pythonModulePath) {
      config.tts.pythonModulePath = path.join(__dirname, '../../modules/voice-engine');
    }

    // Set cache cleanup interval
    if (!config.tts.cacheCleanupIntervalMs) {
      config.tts.cacheCleanupIntervalMs = config.environment === 'production' ? 300000 : 600000; // 5 or 10 minutes
    }

    // Set log file path if logging to file
    if (!config.monitoring.logFilePath && config.environment !== 'development') {
      config.monitoring.logFilePath = path.join(config.tts.cacheDir, 'logs', 'tts.log');
    }

    return config;
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(config: ProductionConfig): void {
    const errors: string[] = [];

    // TTS validation
    if (config.tts.maxConcurrentRequests < 1) {
      errors.push('maxConcurrentRequests must be at least 1');
    }
    
    if (config.tts.requestTimeoutMs < 1000) {
      errors.push('requestTimeoutMs must be at least 1000ms');
    }
    
    if (config.tts.memoryCacheSizeMB < 1) {
      errors.push('memoryCacheSizeMB must be at least 1MB');
    }
    
    if (!config.tts.availableModels.includes(config.tts.defaultModel)) {
      errors.push('defaultModel must be in availableModels list');
    }

    // Voice terminal validation
    if (config.voiceTerminal.playbackVolume < 0 || config.voiceTerminal.playbackVolume > 1) {
      errors.push('playbackVolume must be between 0 and 1');
    }
    
    if (config.voiceTerminal.playbackSpeed < 0.1 || config.voiceTerminal.playbackSpeed > 3.0) {
      errors.push('playbackSpeed must be between 0.1 and 3.0');
    }

    // Monitoring validation
    if (config.monitoring.healthCheckIntervalMs < 1000) {
      errors.push('healthCheckIntervalMs must be at least 1000ms');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get current configuration
   */
  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  /**
   * Get TTS configuration
   */
  getTTSConfig(): TTSEngineConfig {
    return { ...this.config.tts };
  }

  /**
   * Get voice terminal configuration
   */
  getVoiceTerminalConfig(): VoiceTerminalConfig {
    return { ...this.config.voiceTerminal };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return { ...this.config.monitoring };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<ProductionConfig>): void {
    const newConfig = this.deepMerge(this.config, updates);
    this.validateConfiguration(newConfig);
    this.config = newConfig;
    console.log('Configuration updated');
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(filePath: string): Promise<void> {
    const configJson = JSON.stringify(this.config, null, 2);
    await fs.writeFile(filePath, configJson, 'utf8');
    console.log(`Configuration saved to: ${filePath}`);
  }

  /**
   * Export configuration as environment variables
   */
  exportAsEnvironmentVariables(): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    // TTS variables
    envVars.TTS_DEFAULT_MODEL = this.config.tts.defaultModel;
    envVars.TTS_ENABLE_GPU = this.config.tts.enableGPU.toString();
    envVars.TTS_CACHE_DIR = this.config.tts.cacheDir;
    envVars.TTS_MEMORY_CACHE_SIZE_MB = this.config.tts.memoryCacheSizeMB.toString();
    envVars.TTS_MAX_CONCURRENT_REQUESTS = this.config.tts.maxConcurrentRequests.toString();
    envVars.TTS_PYTHON_PATH = this.config.tts.pythonPath;
    
    // Voice terminal variables
    envVars.VT_DEFAULT_VOICE = this.config.voiceTerminal.defaultVoice;
    envVars.VT_PLAYBACK_VOLUME = this.config.voiceTerminal.playbackVolume.toString();
    
    // Monitoring variables
    envVars.MON_LOG_LEVEL = this.config.monitoring.logLevel;
    envVars.MON_ENABLE_ALERTS = this.config.monitoring.enableAlerts.toString();
    
    return envVars;
  }
}

// Create and export default configuration manager
const defaultConfigManager = new ConfigManager();

export default defaultConfigManager;
export { defaultConfigManager as configManager };