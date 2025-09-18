import { EventEmitter } from 'events';
import { WhisperEngine } from '../index';
import {
  IVoiceEngine,
  VoiceConfig,
  TranscriptionResult,
  VoiceEngineStatus,
  VoiceEngineCapabilities,
  AudioData
} from '../interfaces/IVoiceEngine';

/**
 * Whisper adapter implementing the unified voice engine interface
 */
export class WhisperAdapter extends EventEmitter implements IVoiceEngine {
  private whisperEngine: WhisperEngine | null = null;
  private config: VoiceConfig = {};
  private status: VoiceEngineStatus = {
    engine: 'whisper',
    initialized: false,
    isProcessing: false,
    isRecording: false,
    queueSize: 0
  };
  private recordingBuffer: Float32Array[] = [];
  private isRecordingActive = false;

  async initialize(config: VoiceConfig): Promise<void> {
    try {
      this.config = config;
      
      // Map config to WhisperEngine format
      const whisperConfig = {
        modelSize: this.mapModelSize(config.modelSize),
        language: config.language || 'en',
        cacheDir: config.cacheDir
      };
      
      this.whisperEngine = new WhisperEngine(whisperConfig as any);
      
      // Forward events
      this.whisperEngine.on('initialization:complete', () => {
        this.status.initialized = true;
        this.status.modelLoaded = true;
        this.emit('ready');
      });
      
      this.whisperEngine.on('initialization:error', (error) => {
        this.status.lastError = error.message;
        this.emit('error', error);
      });
      
      this.whisperEngine.on('transcription:start', () => {
        this.status.isProcessing = true;
        this.emit('transcription-start');
      });
      
      this.whisperEngine.on('transcription:complete', (result) => {
        this.status.isProcessing = false;
        this.emit('transcription-complete', result);
      });
      
      this.whisperEngine.on('transcription:error', (error) => {
        this.status.isProcessing = false;
        this.status.lastError = error.message;
        this.emit('error', error);
      });
      
      await this.whisperEngine.initialize();
      
      this.status.initialized = true;
      this.status.queueSize = this.whisperEngine.getQueueSize();
    } catch (error) {
      this.status.lastError = (error as Error).message;
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.whisperEngine) {
      await this.whisperEngine.cleanup();
      this.whisperEngine = null;
    }
    
    this.status.initialized = false;
    this.status.modelLoaded = false;
    this.recordingBuffer = [];
  }

  async startRecording(): Promise<void> {
    if (!this.whisperEngine || !this.status.initialized) {
      throw new Error('Voice engine not initialized');
    }
    
    if (this.isRecordingActive) {
      throw new Error('Recording already in progress');
    }
    
    this.isRecordingActive = true;
    this.status.isRecording = true;
    this.recordingBuffer = [];
    
    this.emit('recording-start');
    
    // In a real implementation, this would start capturing audio
    // For now, we'll simulate with a placeholder
    // TODO: Integrate with actual audio capture
  }

  async stopRecording(): Promise<TranscriptionResult> {
    if (!this.isRecordingActive) {
      throw new Error('No recording in progress');
    }
    
    this.isRecordingActive = false;
    this.status.isRecording = false;
    
    this.emit('recording-stop');
    
    // Combine recording buffer
    const totalLength = this.recordingBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    
    for (const buffer of this.recordingBuffer) {
      combinedAudio.set(buffer, offset);
      offset += buffer.length;
    }
    
    // Clear buffer
    this.recordingBuffer = [];
    
    // Transcribe the recorded audio
    if (combinedAudio.length === 0) {
      return {
        text: '',
        processingTime: 0,
        timestamp: Date.now()
      };
    }
    
    return await this.transcribe(combinedAudio);
  }

  async cancelRecording(): Promise<void> {
    if (!this.isRecordingActive) {
      return;
    }
    
    this.isRecordingActive = false;
    this.status.isRecording = false;
    this.recordingBuffer = [];
    
    this.emit('recording-stop');
  }

  async transcribe(audio: AudioData): Promise<TranscriptionResult> {
    if (!this.whisperEngine || !this.status.initialized) {
      throw new Error('Voice engine not initialized');
    }
    
    // Handle different audio formats
    let audioInput: Buffer | Float32Array | string;
    
    if (audio instanceof Blob) {
      // Convert Blob to Buffer
      const arrayBuffer = await audio.arrayBuffer();
      audioInput = Buffer.from(arrayBuffer);
    } else if (audio instanceof MediaStream) {
      throw new Error('MediaStream transcription not yet implemented');
    } else {
      audioInput = audio as Buffer | Float32Array | string;
    }
    
    const result = await this.whisperEngine.transcribe(audioInput);
    
    // Update queue size
    this.status.queueSize = this.whisperEngine.getQueueSize();
    
    return result;
  }

  getStatus(): VoiceEngineStatus {
    if (this.whisperEngine) {
      this.status.queueSize = this.whisperEngine.getQueueSize();
      const engineStatus = this.whisperEngine.getStatus();
      this.status.modelLoaded = engineStatus.modelLoaded;
    }
    
    return { ...this.status };
  }

  getCapabilities(): VoiceEngineCapabilities {
    return {
      offline: true,
      streaming: false,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      modelSizes: ['tiny', 'base', 'small', 'medium', 'large'],
      maxAudioLength: 30 * 60 * 1000 // 30 minutes in ms
    };
  }

  isReady(): boolean {
    return this.whisperEngine?.isReady() || false;
  }

  async updateConfig(config: Partial<VoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // If model size changed, need to reinitialize
    if (config.modelSize && this.whisperEngine) {
      const newModelSize = this.mapModelSize(config.modelSize);
      await this.whisperEngine.switchModel(newModelSize as any);
    }
  }

  private mapModelSize(size?: string): string {
    const sizeMap: Record<string, string> = {
      'tiny': 'tiny.en',
      'base': 'base.en',
      'small': 'small.en',
      'medium': 'medium.en',
      'large': 'large'
    };
    
    return sizeMap[size || 'base'] || 'base.en';
  }
}