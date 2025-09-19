/**
 * TypeScript wrapper for Coqui TTS Python service
 * Handles process management and IPC communication
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// SECURITY: Input validation utilities
class SecurityValidator {
  // Maximum text length for synthesis
  private static readonly MAX_TEXT_LENGTH = 10000;
  
  // Allowed characters for paths (alphanumeric, dash, underscore, dot)
  private static readonly SAFE_PATH_PATTERN = /^[a-zA-Z0-9._-]+$/;
  
  // Forbidden patterns in text
  private static readonly FORBIDDEN_PATTERNS = [
    /<script[^>]*>/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:\/\//i,
    /\$\{[^}]*\}/,
    /`[^`]*`/,
    /eval\s*\(/i,
    /exec\s*\(/i
  ];
  
  static validateText(text: string): string {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }
    
    if (text.length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    if (text.length > this.MAX_TEXT_LENGTH) {
      throw new Error(`Text too long (max ${this.MAX_TEXT_LENGTH} characters)`);
    }
    
    // Check for forbidden patterns
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        throw new Error(`Forbidden pattern detected`);
      }
    }
    
    // Basic sanitization - remove control characters except whitespace
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').trim();
  }
  
  static validateOutputPath(outputPath: string): string {
    if (typeof outputPath !== 'string') {
      throw new Error('Output path must be a string');
    }
    
    // No absolute paths allowed
    if (path.isAbsolute(outputPath)) {
      throw new Error('Absolute paths not allowed');
    }
    
    // No path traversal attempts
    if (outputPath.includes('..') || outputPath.includes('./') || outputPath.includes('~')) {
      throw new Error('Path traversal attempts not allowed');
    }
    
    // Only safe characters allowed
    const filename = path.basename(outputPath);
    if (!this.SAFE_PATH_PATTERN.test(filename)) {
      throw new Error('Invalid characters in filename');
    }
    
    // Must have valid audio extension
    const ext = path.extname(outputPath).toLowerCase();
    if (!['.wav', '.mp3', '.flac', '.ogg'].includes(ext)) {
      throw new Error('Invalid file extension');
    }
    
    return outputPath;
  }
  
  static validatePythonPath(pythonPath: string): string {
    if (typeof pythonPath !== 'string') {
      throw new Error('Python path must be a string');
    }
    
    // Must be absolute path for security
    if (!path.isAbsolute(pythonPath)) {
      throw new Error('Python path must be absolute');
    }
    
    // No special characters that could be used for injection
    if (/[;&|`$(){}\[\]<>]/.test(pythonPath)) {
      throw new Error('Invalid characters in Python path');
    }
    
    return pythonPath;
  }
}

export interface TTSConfig {
  modelName?: string;
  cacheDir?: string;
  pythonPath?: string;
  maxQueueSize?: number;
}

export interface TTSMetrics {
  totalSynthesized: number;
  totalTimeMs: number;
  averageLatencyMs: number;
  cacheHits: number;
}

export interface SynthesisResult {
  success: boolean;
  outputPath?: string;
  latencyMs?: number;
  error?: string;
}

export class TTSWrapper extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: TTSConfig;
  private isReady: boolean = false;
  private commandQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private responseBuffer: string = '';
  private processingLock: boolean = false;  // SECURITY: Prevent race conditions

  constructor(config: TTSConfig = {}) {
    super();
    
    // SECURITY: Validate configuration inputs
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const defaultCacheDir = path.join(homeDir, '.cache', 'coqui_tts');
    
    this.config = {
      modelName: config.modelName || 'default',
      cacheDir: config.cacheDir || defaultCacheDir,
      pythonPath: config.pythonPath || 'python3',
      maxQueueSize: Math.min(config.maxQueueSize || 100, 1000) // Cap at 1000
    };
    
    // SECURITY: Validate cache directory
    if (config.cacheDir && path.isAbsolute(config.cacheDir)) {
      // Only allow absolute paths in safe locations
      const safePrefixes = [homeDir, '/tmp', '/var/tmp'];
      const isSafe = safePrefixes.some(prefix => config.cacheDir!.startsWith(prefix));
      if (!isSafe) {
        throw new Error('Cache directory must be in a safe location');
      }
    }
  }

  /**
   * Initialize the TTS service
   */
  async initialize(): Promise<void> {
    if (this.process) {
      throw new Error('TTS service already initialized');
    }

    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'tts_service.py');
      
      // Check if Python script exists
      if (!fs.existsSync(scriptPath)) {
        reject(new Error(`TTS service script not found: ${scriptPath}`));
        return;
      }

      // Check if virtual environment exists
      const venvPath = path.join(__dirname, 'venv');
      // SECURITY: Validate Python executable path to prevent command injection
      let pythonExec: string;
      
      // Check for virtual environment first (safest option)
      if (fs.existsSync(venvPath)) {
        pythonExec = path.join(venvPath, 'bin', 'python');
      } else {
        // Use safe allowlist of Python paths
        const allowedPythonPaths = [
          '/usr/bin/python3',
          '/usr/local/bin/python3',
          '/opt/homebrew/bin/python3',
          path.join(__dirname, 'venv', 'bin', 'python'),
          path.join(__dirname, 'venv', 'Scripts', 'python.exe') // Windows
        ];
        
        // If user specified a path, validate it's in the allowlist
        if (this.config.pythonPath) {
          const resolvedPath = path.resolve(this.config.pythonPath);
          if (allowedPythonPaths.includes(resolvedPath)) {
            pythonExec = resolvedPath;
          } else {
            console.warn(`Python path not in allowlist: ${this.config.pythonPath}`);
            pythonExec = allowedPythonPaths.find(p => fs.existsSync(p)) || 'python3';
          }
        } else {
          // Find first available Python from allowlist
          pythonExec = allowedPythonPaths.find(p => fs.existsSync(p)) || 'python3';
        }
      }
      
      // SECURITY: Final validation - no command injection characters
      if (/[;&|`$(){}[\]<>]/.test(pythonExec)) {
        reject(new Error('Python path contains unsafe characters'));
        return;
      }

      // Spawn Python process with restricted environment
      this.process = spawn(pythonExec, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // SECURITY: Minimal, controlled environment
          PATH: process.env.PATH || '',
          HOME: process.env.HOME || '',
          PYTHONUNBUFFERED: '1',
          PYTHONDONTWRITEBYTECODE: '1',
          // Explicitly unset dangerous variables
          LD_PRELOAD: undefined,
          LD_LIBRARY_PATH: undefined
        },
        // SECURITY: Never use shell to prevent command injection
        shell: false,
        windowsHide: true
      });

      // Handle stdout (responses)
      this.process.stdout?.on('data', (data: Buffer) => {
        this.responseBuffer += data.toString();
        this.processResponses();
      });

      // Handle stderr (logging)
      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.emit('log', message);
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.emit('error', error);
        if (!this.isReady) {
          reject(error);
        }
      });

      // Handle process exit
      this.process.on('close', (code) => {
        this.isReady = false;
        this.process = null;
        this.emit('close', code);
        
        // Reject pending commands
        this.commandQueue.forEach(cmd => {
          cmd.reject(new Error('TTS process terminated'));
        });
        this.commandQueue = [];
      });

      // Wait for ready signal
      const readyHandler = (response: any) => {
        if (response.status === 'ready') {
          this.isReady = true;
          this.emit('ready', response.models);
          resolve();
        }
      };

      // Set up one-time ready handler
      this.once('response', readyHandler);

      // Set timeout for initialization
      setTimeout(() => {
        if (!this.isReady) {
          this.removeListener('response', readyHandler);
          this.cleanup();
          reject(new Error('TTS service initialization timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Process buffered responses
   */
  private processResponses(): void {
    // SECURITY: Prevent race conditions in response processing
    if (this.processingLock) {
      return; // Already processing responses
    }
    
    this.processingLock = true;
    
    try {
      const lines = this.responseBuffer.split('\n');
      this.responseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            this.handleResponse(response);
          } catch (error) {
            console.error('Failed to parse TTS response:', line);
          }
        }
      }
    } finally {
      this.processingLock = false;
    }
  }

  /**
   * Handle response from Python process
   */
  private handleResponse(response: any): void {
    this.emit('response', response);

    // Handle queued command responses
    if (this.commandQueue.length > 0 && response.status !== 'ready') {
      const command = this.commandQueue.shift();
      if (command) {
        if (response.status === 'success') {
          command.resolve(response);
        } else if (response.status === 'error') {
          command.reject(new Error(response.message || 'Unknown error'));
        } else {
          command.resolve(response);
        }
      }
    }
  }

  /**
   * Send command to Python process
   */
  private async sendCommand(command: any): Promise<any> {
    if (!this.process || !this.isReady) {
      throw new Error('TTS service not initialized');
    }

    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.commandQueue.length >= (this.config.maxQueueSize || 100)) {
        reject(new Error('Command queue full'));
        return;
      }
      
      // SECURITY: Validate command structure
      if (typeof command !== 'object' || command === null) {
        reject(new Error('Invalid command format'));
        return;
      }
      
      // SECURITY: Whitelist allowed command types
      const allowedCommands = ['synthesize', 'switch_model', 'get_metrics', 'clear_cache', 'shutdown'];
      if (!allowedCommands.includes(command.type)) {
        reject(new Error(`Command type not allowed: ${command.type}`));
        return;
      }

      // Add to queue
      this.commandQueue.push({ resolve, reject });

      try {
        // Send command with size limit
        const commandStr = JSON.stringify(command) + '\n';
        
        // SECURITY: Limit command size to prevent DoS
        if (commandStr.length > 50000) {
          reject(new Error('Command too large'));
          return;
        }
        
        this.process?.stdin?.write(commandStr);
      } catch (error) {
        // Remove from queue if send failed
        this.commandQueue.pop();
        reject(error);
      }
    });
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, outputPath?: string): Promise<SynthesisResult> {
    const startTime = Date.now();

    try {
      // SECURITY: Validate inputs before sending to Python process
      const validatedText = SecurityValidator.validateText(text);
      let validatedOutputPath: string | undefined;
      
      if (outputPath) {
        validatedOutputPath = SecurityValidator.validateOutputPath(outputPath);
      }

      const response = await this.sendCommand({
        type: 'synthesize',
        text: validatedText,
        output_path: validatedOutputPath
      });

      const latency = Date.now() - startTime;

      return {
        success: true,
        outputPath: response.output_path,
        latencyMs: response.latency_ms || latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Synthesize text with streaming (returns audio chunks)
   */
  async *synthesizeStream(text: string): AsyncGenerator<Buffer, void, unknown> {
    const result = await this.synthesize(text);
    
    if (!result.success || !result.outputPath) {
      throw new Error(result.error || 'Synthesis failed');
    }

    // Read and stream the audio file in chunks
    const stream = fs.createReadStream(result.outputPath, { highWaterMark: 16 * 1024 });
    
    for await (const chunk of stream) {
      yield chunk as Buffer;
    }

    // Clean up temporary file
    try {
      fs.unlinkSync(result.outputPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Switch to a different voice model
   */
  async switchModel(modelName: string): Promise<void> {
    const response = await this.sendCommand({
      type: 'switch_model',
      model: modelName
    });

    if (response.status !== 'success') {
      throw new Error(response.message || 'Failed to switch model');
    }

    this.config.modelName = modelName;
    this.emit('modelChanged', modelName);
  }

  /**
   * Get available voice models
   */
  getAvailableModels(): string[] {
    // These should match the Python service models
    return ['default', 'fast', 'vits', 'jenny'];
  }

  /**
   * Get performance metrics
   */
  async getMetrics(): Promise<TTSMetrics> {
    const response = await this.sendCommand({
      type: 'get_metrics'
    });

    if (response.status !== 'success') {
      throw new Error('Failed to get metrics');
    }

    return {
      totalSynthesized: response.metrics.total_synthesized,
      totalTimeMs: response.metrics.total_time_ms,
      averageLatencyMs: response.metrics.average_latency_ms,
      cacheHits: response.metrics.cache_hits
    };
  }

  /**
   * Clear audio cache
   */
  async clearCache(): Promise<void> {
    await this.sendCommand({
      type: 'clear_cache'
    });
  }

  /**
   * Check if service is ready
   */
  isServiceReady(): boolean {
    return this.isReady && this.process !== null;
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      // Send shutdown command
      await this.sendCommand({ type: 'shutdown' });
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore errors during shutdown
    }

    // Force kill if still running
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.isReady = false;
    this.commandQueue = [];
    this.responseBuffer = '';
  }
}