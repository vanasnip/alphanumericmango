/**
 * Whisper Model Interface for STT Benchmarking
 * Simulates Whisper.cpp integration for VAL-003 validation
 */

export type WhisperModelSize = 'tiny' | 'base' | 'small';

export interface WhisperTranscription {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  tokens: number;
}

export interface WhisperConfig {
  model: WhisperModelSize;
  language: string;
  threads: number;
  maxLength: number;
  beamSize: number;
  temperature: number;
}

const MODEL_SIZES: Record<WhisperModelSize, number> = {
  tiny: 39,   // 39 MB
  base: 74,   // 74 MB
  small: 244  // 244 MB
};

const MODEL_PERFORMANCE: Record<WhisperModelSize, {
  coldStart: { min: number; max: number };
  warmProcessing: { min: number; max: number };
  accuracy: number;
}> = {
  tiny: {
    coldStart: { min: 60, max: 90 },
    warmProcessing: { min: 25, max: 50 },
    accuracy: 0.89
  },
  base: {
    coldStart: { min: 80, max: 120 },
    warmProcessing: { min: 40, max: 80 },
    accuracy: 0.92
  },
  small: {
    coldStart: { min: 100, max: 150 },
    warmProcessing: { min: 50, max: 100 },
    accuracy: 0.95
  }
};

export class WhisperModel {
  private modelSize: WhisperModelSize;
  private config: WhisperConfig;
  private isLoaded: boolean = false;
  private isWarm: boolean = false;
  
  constructor(modelSize: WhisperModelSize) {
    this.modelSize = modelSize;
    this.config = {
      model: modelSize,
      language: 'en',
      threads: 4,
      maxLength: 224,
      beamSize: 5,
      temperature: 0.0
    };
  }
  
  /**
   * Load the Whisper model
   */
  async load(): Promise<void> {
    console.log(`Loading Whisper ${this.modelSize} model...`);
    
    // Simulate model loading time
    const loadTime = MODEL_SIZES[this.modelSize] * 10; // ~10ms per MB
    await new Promise(resolve => setTimeout(resolve, loadTime));
    
    this.isLoaded = true;
    console.log(`Whisper ${this.modelSize} model loaded (${MODEL_SIZES[this.modelSize]}MB)`);
  }
  
  /**
   * Transcribe audio buffer to text
   */
  async transcribe(audioBuffer: ArrayBuffer): Promise<WhisperTranscription> {
    if (!this.isLoaded) {
      throw new Error('Whisper model not loaded');
    }
    
    const perf = MODEL_PERFORMANCE[this.modelSize];
    const processingTime = this.isWarm
      ? this.randomBetween(perf.warmProcessing.min, perf.warmProcessing.max)
      : this.randomBetween(perf.coldStart.min, perf.coldStart.max);
    
    // Simulate transcription processing
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Mark model as warm after first run
    this.isWarm = true;
    
    // Generate simulated transcription
    const transcription: WhisperTranscription = {
      text: this.generateSampleTranscription(),
      confidence: perf.accuracy + (Math.random() * 0.05 - 0.025), // ±2.5% variance
      language: 'en',
      duration: processingTime,
      tokens: Math.floor(Math.random() * 50 + 10)
    };
    
    return transcription;
  }
  
  /**
   * Configure model parameters
   */
  configure(config: Partial<WhisperConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get model name
   */
  getModelName(): string {
    return `whisper-${this.modelSize}`;
  }
  
  /**
   * Get model size in MB
   */
  getModelSize(): number {
    return MODEL_SIZES[this.modelSize];
  }
  
  /**
   * Get expected accuracy
   */
  getExpectedAccuracy(): number {
    return MODEL_PERFORMANCE[this.modelSize].accuracy;
  }
  
  /**
   * Unload the model and cleanup resources
   */
  async unload(): Promise<void> {
    if (!this.isLoaded) {
      console.warn(`Whisper ${this.modelSize} model is not loaded`);
      return;
    }
    
    try {
      // Simulate cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear model state
      this.isLoaded = false;
      this.isWarm = false;
      
      console.log(`Whisper ${this.modelSize} model unloaded successfully`);
    } catch (error) {
      console.error(`Error unloading Whisper ${this.modelSize} model:`, error);
      throw error;
    }
  }
  
  /**
   * Dispose of the model (alias for unload for consistency)
   */
  async dispose(): Promise<void> {
    await this.unload();
  }
  
  /**
   * Generate sample transcription for testing
   */
  private generateSampleTranscription(): string {
    const commands = [
      'git status',
      'npm install express',
      'docker compose up',
      'kubectl get pods',
      'cd source components',
      'ls dash la',
      'python manage dot py runserver',
      'cargo build release',
      'make clean all',
      'yarn test coverage'
    ];
    
    return commands[Math.floor(Math.random() * commands.length)];
  }
  
  /**
   * Random number between min and max
   */
  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}