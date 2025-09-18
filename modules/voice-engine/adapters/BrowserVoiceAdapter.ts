import { EventEmitter } from 'events';
import {
  IVoiceEngine,
  VoiceConfig,
  TranscriptionResult,
  VoiceEngineStatus,
  VoiceEngineCapabilities,
  AudioData
} from '../interfaces/IVoiceEngine';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

/**
 * Browser WebSpeech API adapter implementing the unified voice engine interface
 */
export class BrowserVoiceAdapter extends EventEmitter implements IVoiceEngine {
  private recognition: any = null;
  private config: VoiceConfig = {};
  private status: VoiceEngineStatus = {
    engine: 'webspeech',
    initialized: false,
    isProcessing: false,
    isRecording: false,
    queueSize: 0
  };
  private recordingStartTime = 0;
  private currentTranscript = '';
  private finalTranscript = '';

  async initialize(config: VoiceConfig): Promise<void> {
    try {
      this.config = config;
      
      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }
      
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.continuous = config.continuous ?? true;
      this.recognition.interimResults = config.interimResults ?? true;
      this.recognition.maxAlternatives = config.maxAlternatives ?? 1;
      this.recognition.lang = config.language || 'en-US';
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.status.initialized = true;
      this.emit('ready');
    } catch (error) {
      this.status.lastError = (error as Error).message;
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      this.status.isRecording = true;
      this.recordingStartTime = Date.now();
      this.emit('recording-start');
    };
    
    this.recognition.onend = () => {
      this.status.isRecording = false;
      this.emit('recording-stop');
    };
    
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + ' ';
          
          // Emit final result
          const result: TranscriptionResult = {
            text: transcript,
            confidence: event.results[i][0].confidence,
            processingTime: Date.now() - this.recordingStartTime,
            timestamp: Date.now(),
            alternatives: event.results[i].length > 1 
              ? Array.from(event.results[i]).slice(1).map((alt: any) => ({
                  text: alt.transcript,
                  confidence: alt.confidence
                }))
              : undefined
          };
          
          this.emit('transcription-complete', result);
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (interimTranscript) {
        this.currentTranscript = interimTranscript;
        this.emit('interim-result', interimTranscript);
      }
    };
    
    this.recognition.onerror = (event: any) => {
      this.status.lastError = `Speech recognition error: ${event.error}`;
      this.status.isRecording = false;
      this.emit('error', new Error(this.status.lastError));
    };
    
    this.recognition.onnomatch = () => {
      this.emit('interim-result', '');
    };
  }

  async cleanup(): Promise<void> {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      
      this.recognition = null;
    }
    
    this.status.initialized = false;
    this.currentTranscript = '';
    this.finalTranscript = '';
  }

  async startRecording(): Promise<void> {
    if (!this.recognition || !this.status.initialized) {
      throw new Error('Voice engine not initialized');
    }
    
    if (this.status.isRecording) {
      throw new Error('Recording already in progress');
    }
    
    this.currentTranscript = '';
    this.finalTranscript = '';
    this.recordingStartTime = Date.now();
    
    try {
      await this.recognition.start();
      this.status.isProcessing = true;
    } catch (error) {
      if ((error as any).name === 'InvalidStateError') {
        // Already started, ignore
      } else {
        throw error;
      }
    }
  }

  async stopRecording(): Promise<TranscriptionResult> {
    if (!this.status.isRecording) {
      throw new Error('No recording in progress');
    }
    
    return new Promise((resolve) => {
      const processingTime = Date.now() - this.recordingStartTime;
      
      // Listen for the final result
      const onEnd = () => {
        this.status.isProcessing = false;
        
        const result: TranscriptionResult = {
          text: this.finalTranscript.trim() || this.currentTranscript.trim(),
          processingTime,
          timestamp: Date.now(),
          confidence: 0.95 // WebSpeech doesn't always provide confidence
        };
        
        this.currentTranscript = '';
        this.finalTranscript = '';
        
        resolve(result);
      };
      
      this.recognition.onend = () => {
        this.status.isRecording = false;
        this.emit('recording-stop');
        onEnd();
      };
      
      try {
        this.recognition.stop();
      } catch (e) {
        // If already stopped, resolve immediately
        onEnd();
      }
    });
  }

  async cancelRecording(): Promise<void> {
    if (!this.status.isRecording) {
      return;
    }
    
    try {
      this.recognition.abort();
    } catch (e) {
      // Ignore errors
    }
    
    this.status.isRecording = false;
    this.status.isProcessing = false;
    this.currentTranscript = '';
    this.finalTranscript = '';
  }

  async transcribe(audio: AudioData): Promise<TranscriptionResult> {
    // WebSpeech API doesn't support direct audio transcription
    // It only works with microphone input
    throw new Error('Direct audio transcription not supported by WebSpeech API. Use startRecording/stopRecording for microphone input.');
  }

  getStatus(): VoiceEngineStatus {
    return { ...this.status };
  }

  getCapabilities(): VoiceEngineCapabilities {
    return {
      offline: false, // Requires internet connection
      streaming: true, // Supports real-time streaming
      languages: [
        'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 
        'it-IT', 'pt-BR', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR'
      ],
      modelSizes: undefined, // Not applicable
      maxAudioLength: undefined // Continuous recording supported
    };
  }

  isReady(): boolean {
    return this.status.initialized && !this.status.lastError;
  }

  async updateConfig(config: Partial<VoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Update recognition settings if initialized
    if (this.recognition) {
      if (config.language) {
        this.recognition.lang = config.language;
      }
      if (config.continuous !== undefined) {
        this.recognition.continuous = config.continuous;
      }
      if (config.interimResults !== undefined) {
        this.recognition.interimResults = config.interimResults;
      }
      if (config.maxAlternatives !== undefined) {
        this.recognition.maxAlternatives = config.maxAlternatives;
      }
    }
  }
}