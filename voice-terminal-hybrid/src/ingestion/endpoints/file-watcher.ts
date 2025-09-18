/**
 * File watcher for JSON notification ingestion
 */

import { watch } from 'chokidar';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import type { FSWatcher } from 'chokidar';
import type { IngestionConfig, IngestionResult } from '../types/index.js';

export interface FileWatcherOptions {
  config: IngestionConfig;
  processor: (payload: any, source: 'file') => Promise<IngestionResult>;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}

/**
 * File watcher for notification ingestion from JSON files
 */
export class NotificationFileWatcher {
  private watcher?: FSWatcher;
  private options: FileWatcherOptions;
  private isRunning = false;
  private processingQueue = new Set<string>();

  constructor(options: FileWatcherOptions) {
    this.options = options;
  }

  /**
   * Start watching for file changes
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.options.logger?.warn('File watcher already running');
      return;
    }

    try {
      // Ensure watch directory exists
      await this.ensureDirectoryExists();

      const watchOptions = {
        ignored: [
          /\.tmp$/, // Ignore temporary files
          /\.part$/, // Ignore partial files
          /^\./     // Ignore hidden files
        ],
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000, // Wait 1 second for file to stabilize
          pollInterval: 100
        },
        ignoreInitial: false // Process existing files on startup
      };

      this.watcher = watch(this.options.config.fileWatcher.directory, watchOptions);

      this.watcher.on('add', this.handleFileAdded.bind(this));
      this.watcher.on('change', this.handleFileChanged.bind(this));
      this.watcher.on('error', this.handleWatcherError.bind(this));
      this.watcher.on('ready', () => {
        this.isRunning = true;
        this.options.logger?.info('File watcher started', {
          directory: this.options.config.fileWatcher.directory,
          watchOptions
        });
      });

    } catch (error) {
      this.options.logger?.error('Failed to start file watcher', {
        error: error instanceof Error ? error.message : String(error),
        directory: this.options.config.fileWatcher.directory
      });
      throw error;
    }
  }

  /**
   * Stop watching for file changes
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.watcher) {
      return;
    }

    try {
      await this.watcher.close();
      this.isRunning = false;
      this.options.logger?.info('File watcher stopped');
    } catch (error) {
      this.options.logger?.error('Error stopping file watcher', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Handle file added event
   */
  private async handleFileAdded(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    this.options.logger?.info('File added', { filePath });
    await this.processFile(filePath);
  }

  /**
   * Handle file changed event
   */
  private async handleFileChanged(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    this.options.logger?.info('File changed', { filePath });
    await this.processFile(filePath);
  }

  /**
   * Handle watcher error
   */
  private handleWatcherError(error: Error): void {
    this.options.logger?.error('File watcher error', {
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Check if file should be processed
   */
  private shouldProcessFile(filePath: string): boolean {
    // Only process JSON files
    if (extname(filePath).toLowerCase() !== '.json') {
      return false;
    }

    // Don't process files already being processed
    if (this.processingQueue.has(filePath)) {
      return false;
    }

    return true;
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string): Promise<void> {
    if (this.processingQueue.has(filePath)) {
      this.options.logger?.warn('File already being processed', { filePath });
      return;
    }

    this.processingQueue.add(filePath);

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const notifications = await this.parseNotifications(fileContent, filePath);

      if (notifications.length === 0) {
        this.options.logger?.warn('No valid notifications found in file', { filePath });
        await this.handleProcessedFile(filePath, false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const notification of notifications) {
        try {
          const payload = {
            ...notification,
            filePath,
            timestamp: new Date().toISOString()
          };

          const result = await this.options.processor(payload, 'file');

          if (result.success) {
            successCount++;
            this.options.logger?.info('Notification processed from file', {
              filePath,
              notificationId: result.notification?.id,
              source: result.notification?.source
            });
          } else {
            errorCount++;
            this.options.logger?.warn('Failed to process notification from file', {
              filePath,
              error: result.error
            });
          }
        } catch (error) {
          errorCount++;
          this.options.logger?.error('Error processing notification from file', {
            filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.options.logger?.info('File processing completed', {
        filePath,
        totalNotifications: notifications.length,
        successCount,
        errorCount
      });

      // Delete file if all notifications were processed successfully
      await this.handleProcessedFile(filePath, errorCount === 0);

    } catch (error) {
      this.options.logger?.error('Failed to process file', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });

      // Move file to error directory or add error suffix
      await this.handleFailedFile(filePath, error);
    } finally {
      this.processingQueue.delete(filePath);
    }
  }

  /**
   * Parse notifications from file content
   */
  private async parseNotifications(content: string, filePath: string): Promise<any[]> {
    try {
      const parsed = JSON.parse(content);

      // Handle single notification
      if (!Array.isArray(parsed)) {
        return [parsed];
      }

      // Handle array of notifications
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item !== null && typeof item === 'object');
      }

      return [];
    } catch (error) {
      this.options.logger?.error('Failed to parse JSON file', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });

      // Try to parse as newline-delimited JSON
      return this.parseNDJSON(content, filePath);
    }
  }

  /**
   * Parse newline-delimited JSON
   */
  private parseNDJSON(content: string, filePath: string): any[] {
    const notifications: any[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed && typeof parsed === 'object') {
          notifications.push(parsed);
        }
      } catch (error) {
        this.options.logger?.warn('Failed to parse NDJSON line', {
          filePath,
          lineNumber: i + 1,
          line: lines[i].slice(0, 100), // Log first 100 chars
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return notifications;
  }

  /**
   * Handle successfully processed file
   */
  private async handleProcessedFile(filePath: string, success: boolean): Promise<void> {
    try {
      if (success) {
        // Delete the file after successful processing
        await fs.unlink(filePath);
        this.options.logger?.info('File deleted after successful processing', { filePath });
      } else {
        // Move to error directory or rename with error suffix
        const errorPath = this.getErrorFilePath(filePath);
        await fs.rename(filePath, errorPath);
        this.options.logger?.info('File moved to error location', { 
          originalPath: filePath, 
          errorPath 
        });
      }
    } catch (error) {
      this.options.logger?.error('Failed to handle processed file', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle file that failed to process
   */
  private async handleFailedFile(filePath: string, error: any): Promise<void> {
    try {
      const errorPath = this.getErrorFilePath(filePath);
      await fs.rename(filePath, errorPath);
      
      // Create error log file
      const errorLogPath = errorPath + '.error';
      const errorInfo = {
        timestamp: new Date().toISOString(),
        originalPath: filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
      
      await fs.writeFile(errorLogPath, JSON.stringify(errorInfo, null, 2));
      
      this.options.logger?.info('Failed file moved to error location', {
        originalPath: filePath,
        errorPath,
        errorLogPath
      });
    } catch (renameError) {
      this.options.logger?.error('Failed to move error file', {
        filePath,
        error: renameError instanceof Error ? renameError.message : String(renameError)
      });
    }
  }

  /**
   * Get error file path
   */
  private getErrorFilePath(filePath: string): string {
    const dir = this.options.config.fileWatcher.directory;
    const errorDir = join(dir, 'errors');
    const fileName = `${Date.now()}_error_${filePath.split('/').pop()}`;
    return join(errorDir, fileName);
  }

  /**
   * Ensure watch directory and error directory exist
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = this.options.config.fileWatcher.directory;
    const errorDir = join(dir, 'errors');

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.mkdir(errorDir, { recursive: true });
      
      this.options.logger?.info('Watch directories created', { dir, errorDir });
    } catch (error) {
      this.options.logger?.error('Failed to create watch directories', {
        dir,
        errorDir,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get watcher status
   */
  public getStatus(): {
    isRunning: boolean;
    watchDirectory: string;
    queueSize: number;
  } {
    return {
      isRunning: this.isRunning,
      watchDirectory: this.options.config.fileWatcher.directory,
      queueSize: this.processingQueue.size
    };
  }

  /**
   * Manually process a specific file
   */
  public async processSpecificFile(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      throw new Error(`File should not be processed: ${filePath}`);
    }

    await this.processFile(filePath);
  }
}