/**
 * Electron Renderer Process Adapter for Voice Engine
 * Communicates with main process via IPC
 */

import { EventEmitter } from 'events';
import { ipcRenderer } from 'electron';
import {
  IVoiceEngine,
  VoiceConfig,
  TranscriptionResult,
  VoiceEngineStatus,
  VoiceEngineCapabilities,
  AudioData
} from '../interfaces/IVoiceEngine';

export class ElectronWhisperAdapter extends EventEmitter implements IVoiceEngine {
  private config: VoiceConfig = {};
  private status: VoiceEngineStatus = {
    engine: 'whisper',
    initialized: false,
    isProcessing: false,
    isRecording: false,
    queueSize: 0
  };

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for events from main process
    ipcRenderer.on('whisper:event', (event, data) => {
      switch (data.type) {
        case 'ready':
          this.status.initialized = true;
          this.emit('ready');
          break;
          
        case 'error':
          this.status.lastError = data.data?.message;
          this.emit('error', new Error(data.data?.message || 'Unknown error'));
          break;
          
        case 'recording-start':
          this.status.isRecording = true;
          this.emit('recording-start');
          break;
          
        case 'recording-stop':
          this.status.isRecording = false;
          this.emit('recording-stop');
          break;
          
        case 'transcription-start':
          this.status.isProcessing = true;
          this.emit('transcription-start');
          break;
          
        case 'transcription-complete':
          this.status.isProcessing = false;
          this.emit('transcription-complete', data.data);
          break;
          
        case 'interim-result':
          this.emit('interim-result', data.data?.text);
          break;
      }
    });
  }

  async initialize(config: VoiceConfig): Promise<void> {
    this.config = config;
    
    const result = await ipcRenderer.invoke('whisper:initialize', config);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to initialize whisper engine');
    }
    
    this.status.initialized = true;
  }

  async cleanup(): Promise<void> {
    const result = await ipcRenderer.invoke('whisper:cleanup');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to cleanup whisper engine');
    }
    
    this.status.initialized = false;
    this.status.isProcessing = false;
    this.status.isRecording = false;
    
    // Remove event listeners
    ipcRenderer.removeAllListeners('whisper:event');
  }

  async startRecording(): Promise<void> {
    const result = await ipcRenderer.invoke('whisper:startRecording');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to start recording');
    }
    
    this.status.isRecording = true;
  }

  async stopRecording(): Promise<TranscriptionResult> {
    const result = await ipcRenderer.invoke('whisper:stopRecording');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to stop recording');
    }
    
    this.status.isRecording = false;
    
    return result.data;
  }

  async cancelRecording(): Promise<void> {
    const result = await ipcRenderer.invoke('whisper:cancelRecording');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel recording');
    }
    
    this.status.isRecording = false;
  }

  async transcribe(audio: AudioData): Promise<TranscriptionResult> {
    let buffer: Buffer;
    
    // Convert audio data to buffer for IPC transfer
    if (audio instanceof Float32Array) {
      buffer = Buffer.from(audio.buffer);
    } else if (audio instanceof Blob) {
      const arrayBuffer = await audio.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (Buffer.isBuffer(audio)) {
      buffer = audio;
    } else if (typeof audio === 'string') {
      // For file paths, we need to read the file in renderer
      throw new Error('File path transcription should be done in main process');
    } else if (audio instanceof MediaStream) {
      throw new Error('MediaStream transcription not yet implemented');
    } else {
      throw new Error('Unsupported audio data type');
    }
    
    const result = await ipcRenderer.invoke('whisper:transcribe', buffer);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to transcribe audio');
    }
    
    return result.data;
  }

  async getStatus(): Promise<VoiceEngineStatus> {
    const result = await ipcRenderer.invoke('whisper:getStatus');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get status');
    }
    
    this.status = { ...this.status, ...result.data };
    
    return this.status;
  }

  getStatus(): VoiceEngineStatus {
    // Return cached status synchronously
    // For fresh status, use the async version above
    return { ...this.status };
  }

  async getCapabilities(): Promise<VoiceEngineCapabilities> {
    const result = await ipcRenderer.invoke('whisper:getCapabilities');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get capabilities');
    }
    
    return result.data;
  }

  getCapabilities(): VoiceEngineCapabilities {
    // Return default capabilities synchronously
    return {
      offline: true,
      streaming: false,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      modelSizes: ['tiny', 'base', 'small', 'medium', 'large'],
      maxAudioLength: 30 * 60 * 1000
    };
  }

  isReady(): boolean {
    return this.status.initialized && !this.status.lastError;
  }

  async updateConfig(config: Partial<VoiceConfig>): Promise<void> {
    const result = await ipcRenderer.invoke('whisper:updateConfig', config);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update config');
    }
    
    this.config = { ...this.config, ...config };
  }
}

/**
 * Factory function to create appropriate voice engine for renderer
 */
export function createVoiceEngine(type: 'whisper' | 'webspeech' | 'auto'): IVoiceEngine {
  if (type === 'auto') {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electron) {
      return new ElectronWhisperAdapter();
    } else {
      // Fall back to browser implementation
      throw new Error('Browser adapter should be imported separately');
    }
  } else if (type === 'whisper') {
    return new ElectronWhisperAdapter();
  } else {
    throw new Error('WebSpeech adapter should be imported separately');
  }
}