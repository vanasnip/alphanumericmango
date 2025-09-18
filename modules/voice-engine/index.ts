import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { spawn } from 'child_process';
import {
  SecurityError,
  ValidationError,
  validatePath,
  validateAudioPath,
  validateAudioData,
  validateModelSize,
  validateLanguage,
  validateConfig,
  sanitizeError,
  sanitizeEventData,
  verifyModelIntegrity,
  EventRateLimiter
} from './security';

export interface WhisperConfig {
  modelSize: 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en' | 'large';
  modelPath?: string;
  cacheDir?: string;
  language?: string;
  maxConcurrent?: number;
  gpuEnabled?: boolean;
  coreMLEnabled?: boolean;
  threads?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  processingTime: number;
  timestamp: number;
}

export interface WhisperStatus {
  initialized: boolean;
  modelLoaded: boolean;
  modelSize: string;
  error?: string;
}

export class WhisperEngine extends EventEmitter {
  private whisperPath: string | null = null;
  private config: WhisperConfig;
  private status: WhisperStatus;
  private initializationPromise: Promise<void> | null = null;
  private processingQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private modelPath: string | null = null;
  private rateLimiter: EventRateLimiter;

  constructor(config: WhisperConfig) {
    super();
    
    // Validate configuration
    validateConfig(config);
    
    this.config = {
      modelSize: validateModelSize(config.modelSize || 'base'),
      cacheDir: config.cacheDir || path.join(process.cwd(), '.whisper-models'),
      language: validateLanguage(config.language || 'en'),
      maxConcurrent: Math.min(config.maxConcurrent || 1, 10),
      gpuEnabled: config.gpuEnabled ?? false,
      coreMLEnabled: config.coreMLEnabled ?? (process.platform === 'darwin'),
      threads: Math.min(config.threads ?? 4, 32),
      ...config
    };
    
    // Validate cache directory path
    this.config.cacheDir = validatePath(this.config.cacheDir!, process.cwd());
    
    this.status = {
      initialized: false,
      modelLoaded: false,
      modelSize: this.config.modelSize
    };
    
    this.rateLimiter = new EventRateLimiter();
  }

  // Override emit to add rate limiting and sanitization
  emit(eventName: string, ...args: any[]): boolean {
    if (!this.rateLimiter.canEmit(eventName)) {
      return false;
    }
    
    // Sanitize event data
    const sanitizedArgs = args.map(arg => sanitizeEventData(arg));
    
    return super.emit(eventName, ...sanitizedArgs);
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.emit('initialization:start', { modelSize: this.config.modelSize });
      
      if (!fs.existsSync(this.config.cacheDir!)) {
        fs.mkdirSync(this.config.cacheDir!, { recursive: true });
      }

      this.modelPath = await this.downloadModel(this.config.modelSize);
      
      if (!this.modelPath) {
        throw new Error(`Failed to download or locate model: ${this.config.modelSize}`);
      }

      this.whisperPath = await this.setupWhisperBinary();
      
      if (!this.whisperPath) {
        throw new Error('Failed to setup Whisper.cpp binary');
      }

      this.status.initialized = true;
      this.status.modelLoaded = true;
      
      this.emit('initialization:complete', this.status);
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : String(error);
      this.emit('initialization:error', error);
      throw error;
    }
  }

  async transcribe(audioData: Buffer | Float32Array | string): Promise<TranscriptionResult> {
    if (!this.status.initialized || !this.whisperPath || !this.modelPath) {
      throw new Error('WhisperEngine not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          this.isProcessing = true;
          this.emit('transcription:start');

          let audioPath: string;
          
          if (typeof audioData === 'string') {
            // Validate audio file path
            audioPath = validateAudioPath(audioData, process.cwd());
            if (!fs.existsSync(audioPath)) {
              throw new ValidationError('Audio file not found');
            }
            
            // Check file size
            const stats = fs.statSync(audioPath);
            if (stats.size > 100 * 1024 * 1024) {
              throw new ValidationError('Audio file exceeds maximum size');
            }
          } else if (Buffer.isBuffer(audioData) || audioData instanceof Float32Array) {
            if (audioData instanceof Float32Array) {
              validateAudioData(audioData);
            } else if (audioData.length > 100 * 1024 * 1024) {
              throw new ValidationError('Audio buffer exceeds maximum size');
            }
            
            const tempPath = path.join(this.config.cacheDir!, `temp_${Date.now()}.wav`);
            if (Buffer.isBuffer(audioData)) {
              fs.writeFileSync(tempPath, audioData);
            } else {
              const wavBuffer = this.float32ArrayToWav(audioData);
              fs.writeFileSync(tempPath, wavBuffer);
            }
            audioPath = tempPath;
          } else {
            throw new ValidationError('Invalid audio data format');
          }

          const transcriptionStartTime = Date.now();
          const result = await this.runWhisper(audioPath);
          const transcriptionTime = Date.now() - transcriptionStartTime;

          if (audioPath.includes('temp_')) {
            try {
              fs.unlinkSync(audioPath);
            } catch {}
          }

          const processingTime = Date.now() - startTime;
          
          const transcriptionResult: TranscriptionResult = {
            text: result,
            language: this.config.language,
            processingTime,
            timestamp: Date.now()
          };

          this.emit('transcription:complete', transcriptionResult);
          resolve(transcriptionResult);
        } catch (error) {
          const sanitized = sanitizeError(error as Error);
          this.emit('transcription:error', sanitized);
          reject(sanitized);
        } finally {
          this.isProcessing = false;
          this.processNext();
        }
      };

      this.processingQueue.push(task);
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  private async processNext(): Promise<void> {
    if (this.processingQueue.length === 0 || this.isProcessing) {
      return;
    }

    const nextTask = this.processingQueue.shift();
    if (nextTask) {
      await nextTask();
    }
  }

  async switchModel(modelSize: 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en' | 'large'): Promise<void> {
    this.config.modelSize = modelSize;
    this.status.modelSize = modelSize;
    this.status.initialized = false;
    this.status.modelLoaded = false;
    this.whisperPath = null;
    this.initializationPromise = null;
    
    await this.initialize();
  }

  getStatus(): WhisperStatus {
    return { ...this.status };
  }

  async cleanup(): Promise<void> {
    this.whisperPath = null;
    this.processingQueue = [];
    this.status.initialized = false;
    this.status.modelLoaded = false;
    
    this.emit('cleanup:complete');
  }

  private async downloadModel(modelName: string): Promise<string> {
    const modelPath = path.join(this.config.cacheDir!, `ggml-${modelName}.bin`);
    
    if (fs.existsSync(modelPath)) {
      this.emit('model:found', { path: modelPath });
      return modelPath;
    }

    const modelUrls: Record<string, string> = {
      'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      'tiny.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
      'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      'base.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
      'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
      'small.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
      'medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
      'medium.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
      'large': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin'
    };

    const url = modelUrls[modelName];
    if (!url) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    this.emit('model:download-start', { model: modelName, url });
    
    try {
      execSync(`curl -L -o "${modelPath}" "${url}"`, { stdio: 'inherit' });
      this.emit('model:download-complete', { path: modelPath });
      return modelPath;
    } catch (error) {
      this.emit('model:download-error', error);
      throw new Error(`Failed to download model: ${error}`);
    }
  }

  private async setupWhisperBinary(): Promise<string> {
    const whisperBinPath = path.join(this.config.cacheDir!, 'whisper.cpp');
    
    if (fs.existsSync(whisperBinPath)) {
      return whisperBinPath;
    }

    this.emit('whisper:binary-setup', { path: whisperBinPath });
    
    try {
      const repoPath = path.join(this.config.cacheDir!, 'whisper-cpp-repo');
      
      if (!fs.existsSync(repoPath)) {
        execSync(`git clone https://github.com/ggerganov/whisper.cpp.git "${repoPath}"`, { stdio: 'inherit' });
      }
      
      execSync(`cd "${repoPath}" && cmake -B build && cmake --build build --config Release`, { stdio: 'inherit' });
      
      const mainBinary = path.join(repoPath, 'build', 'bin', 'whisper-cli');
      if (fs.existsSync(mainBinary)) {
        fs.copyFileSync(mainBinary, whisperBinPath);
        fs.chmodSync(whisperBinPath, '755');
        return whisperBinPath;
      } else {
        throw new Error('Failed to build whisper.cpp');
      }
    } catch (error) {
      this.emit('whisper:binary-error', error);
      throw error;
    }
  }

  private async runWhisper(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath!,
        '-f', audioPath,
        '-l', this.config.language || 'en',
        '-t', String(this.config.threads || 4),
        '--no-timestamps',
        '-p', '1',  // Number of processors (1 for single processing)
        '--print-realtime',
        '--no-print-progress'
      ];

      if (this.config.gpuEnabled) {
        args.push('--gpu-layers', '999');
      }
      
      if (process.platform === 'darwin' && this.config.coreMLEnabled) {
        args.push('--use-coreml');
      }

      const whisperProcess = spawn(this.whisperPath!, args);
      let output = '';
      let errorOutput = '';

      whisperProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      whisperProcess.on('close', (code) => {
        if (code === 0) {
          const lines = output.split('\n');
          const transcription = lines
            .filter(line => line.trim() && !line.includes('[') && !line.includes('whisper_'))
            .join(' ')
            .trim();
          resolve(transcription);
        } else {
          reject(new Error(`Whisper process exited with code ${code}: ${errorOutput}`));
        }
      });

      whisperProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private float32ArrayToWav(float32Array: Float32Array, sampleRate: number = 16000): Buffer {
    const length = float32Array.length;
    const buffer = Buffer.alloc(44 + length * 2);
    const view = new DataView(buffer.buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  isReady(): boolean {
    return this.status.initialized && this.status.modelLoaded;
  }

  getQueueSize(): number {
    return this.processingQueue.length;
  }
}

let defaultEngine: WhisperEngine | null = null;

export async function initializeWhisper(config?: Partial<WhisperConfig>): Promise<WhisperEngine> {
  const engine = new WhisperEngine({
    modelSize: 'base',
    ...config
  });
  
  await engine.initialize();
  
  if (!defaultEngine) {
    defaultEngine = engine;
  }
  
  return engine;
}

export function getDefaultEngine(): WhisperEngine | null {
  return defaultEngine;
}

export async function transcribeAudio(
  audioData: Buffer | Float32Array | string,
  config?: Partial<WhisperConfig>
): Promise<TranscriptionResult> {
  let engine = defaultEngine;
  
  if (!engine) {
    engine = await initializeWhisper(config);
  }
  
  return engine.transcribe(audioData);
}

export default {
  WhisperEngine,
  initializeWhisper,
  getDefaultEngine,
  transcribeAudio
};