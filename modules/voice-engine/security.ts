import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

/**
 * Security module for Whisper Engine
 * Provides input validation, path sanitization, and security utilities
 */

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Security configuration
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PATH_LENGTH = 260;
const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
const ALLOWED_MODEL_SIZES = ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large'];
const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];

// Model checksums for integrity verification
const MODEL_CHECKSUMS: Record<string, string> = {
  'tiny': 'bd577a113a864445d4c299885e0cb97d4ba92b5f',
  'tiny.en': 'c78c86eb1a8faa21b369bcd33207cc90d64ae9df',
  'base': 'ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205',
  'base.en': '25a8566e1d0c1e2231d1c762132cd20e0dab60e',
  'small': '9ecf779972d90ba49c06e068d9e6b1765e6b7f04',
  'small.en': 'd3dd57d32accea0b295c96e26691aa14d8822fac',
  'medium': '345ae4da62f9b3d59415adc60059e353e94f3b6f',
  'medium.en': 'd7440d14dc463c3d6e26f4e0b5a69e0f0e5dd6c4',
  'large': '0b5b3216d60a2d32fc086b47ea8c67589aaeb26c'
};

/**
 * Validates and sanitizes file paths to prevent path traversal attacks
 */
export function validatePath(userPath: string, basePath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new ValidationError('Invalid path provided');
  }

  if (userPath.length > MAX_PATH_LENGTH) {
    throw new ValidationError('Path exceeds maximum length');
  }

  // Normalize and resolve the path
  const normalized = path.normalize(userPath);
  const resolved = path.resolve(basePath, normalized);

  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new SecurityError('Path traversal attempt detected');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = ['..', '~', '%', '\0', '\n', '\r'];
  for (const pattern of suspiciousPatterns) {
    if (normalized.includes(pattern)) {
      throw new SecurityError(`Suspicious path pattern detected: ${pattern}`);
    }
  }

  return resolved;
}

/**
 * Validates audio file paths and extensions
 */
export function validateAudioPath(audioPath: string, basePath: string): string {
  const validPath = validatePath(audioPath, basePath);
  const ext = path.extname(validPath).toLowerCase();

  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    throw new ValidationError(`Invalid audio file extension: ${ext}`);
  }

  return validPath;
}

/**
 * Validates Float32Array audio data
 */
export function validateAudioData(data: Float32Array): void {
  if (!data || !(data instanceof Float32Array)) {
    throw new ValidationError('Invalid audio data type');
  }

  if (data.length === 0) {
    throw new ValidationError('Empty audio data');
  }

  if (data.length * 4 > MAX_AUDIO_SIZE) {
    throw new ValidationError(`Audio data exceeds maximum size of ${MAX_AUDIO_SIZE} bytes`);
  }

  // Check for invalid values
  let hasValidSamples = false;
  for (let i = 0; i < Math.min(data.length, 1000); i++) {
    if (!isFinite(data[i])) {
      throw new ValidationError('Audio data contains invalid values (NaN or Infinity)');
    }
    if (Math.abs(data[i]) > 0) {
      hasValidSamples = true;
    }
  }

  if (!hasValidSamples) {
    throw new ValidationError('Audio data contains only silence');
  }
}

/**
 * Validates model size parameter
 */
export function validateModelSize(modelSize: string): string {
  if (!ALLOWED_MODEL_SIZES.includes(modelSize)) {
    throw new ValidationError(`Invalid model size: ${modelSize}`);
  }
  return modelSize;
}

/**
 * Validates language code
 */
export function validateLanguage(language: string): string {
  if (!ALLOWED_LANGUAGES.includes(language)) {
    throw new ValidationError(`Unsupported language: ${language}`);
  }
  return language;
}

/**
 * Sanitizes error messages to remove sensitive information
 */
export function sanitizeError(error: Error): Error {
  const sanitized = new Error('An error occurred during processing');
  
  // Map specific error types to generic messages
  if (error instanceof SecurityError) {
    sanitized.message = 'Security validation failed';
  } else if (error instanceof ValidationError) {
    sanitized.message = 'Input validation failed';
  } else if (error.message.includes('ENOENT')) {
    sanitized.message = 'Resource not found';
  } else if (error.message.includes('EACCES')) {
    sanitized.message = 'Permission denied';
  } else if (error.message.includes('ENOMEM')) {
    sanitized.message = 'Insufficient memory';
  }

  // Remove file paths and system information
  sanitized.stack = undefined;
  
  return sanitized;
}

/**
 * Verifies model file integrity using checksums
 */
export async function verifyModelIntegrity(modelPath: string, modelName: string): Promise<boolean> {
  const expectedChecksum = MODEL_CHECKSUMS[modelName];
  if (!expectedChecksum) {
    throw new ValidationError(`No checksum available for model: ${modelName}`);
  }

  try {
    const fileBuffer = await fs.readFile(modelPath);
    const hash = crypto.createHash('sha1');
    hash.update(fileBuffer);
    const actualChecksum = hash.digest('hex');

    if (actualChecksum !== expectedChecksum) {
      throw new SecurityError('Model file integrity check failed');
    }

    return true;
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new Error('Failed to verify model integrity');
  }
}

/**
 * Validates configuration object
 */
export function validateConfig(config: any): void {
  if (config.modelSize) {
    validateModelSize(config.modelSize);
  }

  if (config.language) {
    validateLanguage(config.language);
  }

  if (config.threads !== undefined) {
    if (!Number.isInteger(config.threads) || config.threads < 1 || config.threads > 32) {
      throw new ValidationError('Invalid thread count');
    }
  }

  if (config.maxConcurrent !== undefined) {
    if (!Number.isInteger(config.maxConcurrent) || config.maxConcurrent < 1 || config.maxConcurrent > 10) {
      throw new ValidationError('Invalid max concurrent value');
    }
  }
}

/**
 * Filters sensitive data from event payloads
 */
export function sanitizeEventData(eventData: any): any {
  if (!eventData) return {};

  const sanitized = { ...eventData };
  
  // Remove paths
  delete sanitized.path;
  delete sanitized.modelPath;
  delete sanitized.cacheDir;
  delete sanitized.url;
  
  // Sanitize error objects
  if (sanitized.error) {
    sanitized.error = sanitizeError(sanitized.error).message;
  }

  return sanitized;
}

/**
 * Rate limiting for event emissions
 */
export class EventRateLimiter {
  private eventCounts: Map<string, number[]> = new Map();
  private readonly maxEventsPerSecond = 100;
  private readonly windowMs = 1000;

  canEmit(eventName: string): boolean {
    const now = Date.now();
    const counts = this.eventCounts.get(eventName) || [];
    
    // Remove old entries outside the window
    const validCounts = counts.filter(time => now - time < this.windowMs);
    
    if (validCounts.length >= this.maxEventsPerSecond) {
      return false;
    }
    
    validCounts.push(now);
    this.eventCounts.set(eventName, validCounts);
    
    return true;
  }

  reset(): void {
    this.eventCounts.clear();
  }
}