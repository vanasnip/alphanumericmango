/**
 * Unified Voice Engine Interface
 * Provides abstraction for different voice recognition implementations
 */

export interface VoiceConfig {
  language?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  cacheDir?: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  processingTime: number;
  timestamp: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
}

export interface VoiceEngineStatus {
  engine: 'whisper' | 'webspeech' | 'none';
  initialized: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  queueSize: number;
  modelLoaded?: boolean;
  lastError?: string;
}

export interface VoiceEngineCapabilities {
  offline: boolean;
  streaming: boolean;
  languages: string[];
  modelSizes?: string[];
  maxAudioLength?: number;
}

export type AudioData = Buffer | Float32Array | Blob | string | MediaStream;

/**
 * Unified interface for all voice engines
 */
export interface IVoiceEngine {
  // Initialization
  initialize(config: VoiceConfig): Promise<void>;
  cleanup(): Promise<void>;
  
  // Recording controls
  startRecording(): Promise<void>;
  stopRecording(): Promise<TranscriptionResult>;
  cancelRecording(): Promise<void>;
  
  // Direct transcription
  transcribe(audio: AudioData): Promise<TranscriptionResult>;
  
  // Status and capabilities
  getStatus(): VoiceEngineStatus;
  getCapabilities(): VoiceEngineCapabilities;
  isReady(): boolean;
  
  // Configuration
  updateConfig(config: Partial<VoiceConfig>): Promise<void>;
  
  // Events
  on(event: 'ready', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'recording-start', listener: () => void): this;
  on(event: 'recording-stop', listener: () => void): this;
  on(event: 'transcription-start', listener: () => void): this;
  on(event: 'transcription-complete', listener: (result: TranscriptionResult) => void): this;
  on(event: 'interim-result', listener: (text: string) => void): this;
  
  off(event: string, listener: Function): this;
}

/**
 * Base class for voice engine implementations
 */
export abstract class BaseVoiceEngine implements IVoiceEngine {
  protected config: VoiceConfig = {};
  protected status: VoiceEngineStatus = {
    engine: 'none',
    initialized: false,
    isProcessing: false,
    isRecording: false,
    queueSize: 0
  };
  
  abstract initialize(config: VoiceConfig): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract startRecording(): Promise<void>;
  abstract stopRecording(): Promise<TranscriptionResult>;
  abstract cancelRecording(): Promise<void>;
  abstract transcribe(audio: AudioData): Promise<TranscriptionResult>;
  abstract getCapabilities(): VoiceEngineCapabilities;
  
  getStatus(): VoiceEngineStatus {
    return { ...this.status };
  }
  
  isReady(): boolean {
    return this.status.initialized && !this.status.lastError;
  }
  
  async updateConfig(config: Partial<VoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    // Re-initialize if needed
    if (this.status.initialized) {
      await this.cleanup();
      await this.initialize(this.config);
    }
  }
  
  // Event handling - to be implemented by extending EventEmitter
  on(event: string, listener: Function): this {
    // Implementation depends on EventEmitter extension
    return this;
  }
  
  off(event: string, listener: Function): this {
    // Implementation depends on EventEmitter extension
    return this;
  }
}

/**
 * Factory function to create appropriate voice engine
 */
export function createVoiceEngine(type: 'whisper' | 'webspeech' | 'auto'): IVoiceEngine {
  // This will be implemented to return appropriate engine
  throw new Error('Voice engine factory not yet implemented');
}