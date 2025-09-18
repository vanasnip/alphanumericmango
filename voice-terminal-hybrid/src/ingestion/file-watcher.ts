/**
 * Notification File Watcher
 * Monitors directory for JSON files containing notification data
 */

import { watch, FSWatcher, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import Database from 'better-sqlite3';
import Joi from 'joi';
import { nanoid } from 'nanoid';

interface FileProcessingStats {
  filesProcessed: number;
  filesSuccessful: number;
  filesFailed: number;
  notificationsCreated: number;
  lastProcessedAt?: Date;
}

interface ProcessingResult {
  success: boolean;
  notificationsCreated: number;
  error?: string;
  details?: any;
}

// Validation schema for file-based notifications
const notificationSchema = Joi.object({
  user_id: Joi.string().required().trim().min(1).max(255),
  project_id: Joi.string().optional().trim().min(1).max(255),
  template_id: Joi.string().optional().trim().min(1).max(255),
  channel: Joi.string().valid('in_app', 'email', 'sms', 'push', 'webhook').default('in_app'),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  subject: Joi.string().optional().trim().max(500),
  body: Joi.string().required().trim().min(1).max(10000),
  data: Joi.object().optional().default({}),
  scheduled_at: Joi.string().isoDate().optional()
});

const batchSchema = Joi.array().items(notificationSchema).max(100);

export class NotificationFileWatcher {
  private db: Database.Database;
  private watchDir: string;
  private processedDir: string;
  private errorDir: string;
  private watcher?: FSWatcher;
  private running = false;
  private stats: FileProcessingStats = {
    filesProcessed: 0,
    filesSuccessful: 0,
    filesFailed: 0,
    notificationsCreated: 0
  };

  constructor(database: Database.Database, watchDirectory: string) {
    this.db = database;
    this.watchDir = watchDirectory;
    this.processedDir = join(watchDirectory, 'processed');
    this.errorDir = join(watchDirectory, 'errors');

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.processedDir, this.errorDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  public async start(): Promise<void> {
    if (this.running) {
      console.warn('File watcher is already running');
      return;
    }

    console.log(`Starting file watcher on directory: ${this.watchDir}`);

    this.watcher = watch(this.watchDir, { recursive: true }, (eventType, filename) => {
      if (filename && this.shouldProcessFile(filename)) {
        const filePath = join(this.watchDir, filename);
        
        // Only process if file exists and is not in subdirectories we manage
        if (existsSync(filePath) && !this.isInManagedDirectory(filePath)) {
          this.processFile(filePath);
        }
      }
    });

    this.running = true;
    console.log('File watcher started successfully');
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log('Stopping file watcher...');
    
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    this.running = false;
    console.log('File watcher stopped');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getStatistics(): FileProcessingStats {
    return { ...this.stats };
  }

  private shouldProcessFile(filename: string): boolean {
    // Only process JSON files
    if (extname(filename).toLowerCase() !== '.json') {
      return false;
    }

    // Ignore hidden files
    if (basename(filename).startsWith('.')) {
      return false;
    }

    // Ignore temporary files
    const tempExtensions = ['.tmp', '.swp', '.bak'];
    if (tempExtensions.some(ext => filename.includes(ext))) {
      return false;
    }

    return true;
  }

  private isInManagedDirectory(filePath: string): boolean {
    return filePath.includes(this.processedDir) || filePath.includes(this.errorDir);
  }

  private async processFile(filePath: string): Promise<void> {
    const filename = basename(filePath);
    console.log(`Processing file: ${filename}`);

    try {
      // Check file size
      const stats = statSync(filePath);
      const maxFileSize = 5 * 1024 * 1024; // 5MB limit
      
      if (stats.size > maxFileSize) {
        throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${maxFileSize} bytes)`);
      }

      // Read and parse file
      const fileContent = readFileSync(filePath, 'utf8');
      let jsonData: any;

      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON: ${parseError.message}`);
      }

      // Process the data
      const result = await this.processNotificationData(jsonData);

      if (result.success) {
        // Move to processed directory
        this.moveFile(filePath, this.processedDir);
        this.stats.filesSuccessful++;
        this.stats.notificationsCreated += result.notificationsCreated;
        console.log(`Successfully processed ${filename}: ${result.notificationsCreated} notifications created`);
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error(`Error processing file ${filename}:`, error);
      
      // Move to error directory and create error log
      this.moveToErrorDirectory(filePath, error);
      this.stats.filesFailed++;
    }

    this.stats.filesProcessed++;
    this.stats.lastProcessedAt = new Date();
  }

  private async processNotificationData(data: any): Promise<ProcessingResult> {
    try {
      // Determine if this is a single notification or batch
      const isBatch = Array.isArray(data);
      let notifications: any[];

      if (isBatch) {
        // Validate batch
        const { error: batchError, value: batchValue } = batchSchema.validate(data, { abortEarly: false });
        if (batchError) {
          return {
            success: false,
            notificationsCreated: 0,
            error: 'Batch validation failed',
            details: batchError.details
          };
        }
        notifications = batchValue;
      } else {
        // Validate single notification
        const { error: singleError, value: singleValue } = notificationSchema.validate(data, { abortEarly: false });
        if (singleError) {
          return {
            success: false,
            notificationsCreated: 0,
            error: 'Validation failed',
            details: singleError.details
          };
        }
        notifications = [singleValue];
      }

      // Process notifications in transaction
      const transaction = this.db.transaction((notificationsList: any[]) => {
        let createdCount = 0;
        const errors: any[] = [];

        for (const notification of notificationsList) {
          try {
            // Verify user exists (convert external_id to internal id)
            const user = this.db.prepare('SELECT id FROM users WHERE external_id = ? AND is_active = 1')
              .get(notification.user_id);
            
            if (!user) {
              errors.push(`User not found: ${notification.user_id}`);
              continue;
            }

            // Use first active project if not specified
            let projectId = notification.project_id;
            if (!projectId) {
              const defaultProject = this.db.prepare('SELECT id FROM projects WHERE is_active = 1 LIMIT 1').get();
              if (!defaultProject) {
                errors.push('No active project found');
                continue;
              }
              projectId = defaultProject.id;
            }

            // Create notification
            const notificationId = nanoid();
            const now = new Date().toISOString();

            const insertStmt = this.db.prepare(`
              INSERT INTO notifications 
              (id, project_id, user_id, template_id, channel, status, priority, subject, body, data, scheduled_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
            `);

            insertStmt.run(
              notificationId,
              projectId,
              user.id,
              notification.template_id || null,
              notification.channel,
              notification.priority,
              notification.subject || null,
              notification.body,
              JSON.stringify(notification.data),
              notification.scheduled_at || null,
              now,
              now
            );

            // Log event
            const eventStmt = this.db.prepare(`
              INSERT INTO events (notification_id, event_type, event_data, created_at)
              VALUES (?, 'created', ?, ?)
            `);

            eventStmt.run(
              notificationId,
              JSON.stringify({
                source: 'file_watcher',
                batch: isBatch,
                batch_size: notifications.length
              }),
              now
            );

            createdCount++;

          } catch (error) {
            errors.push(`Failed to create notification: ${error.message}`);
          }
        }

        if (errors.length > 0 && createdCount === 0) {
          throw new Error(`All notifications failed: ${errors.join(', ')}`);
        }

        return { createdCount, errors };
      });

      const result = transaction(notifications);

      return {
        success: true,
        notificationsCreated: result.createdCount,
        details: result.errors.length > 0 ? { partialFailures: result.errors } : undefined
      };

    } catch (error) {
      return {
        success: false,
        notificationsCreated: 0,
        error: error.message,
        details: error
      };
    }
  }

  private moveFile(sourcePath: string, destinationDir: string): void {
    try {
      const filename = basename(sourcePath);
      const destinationPath = join(destinationDir, filename);
      
      // Handle filename conflicts
      let finalDestination = destinationPath;
      let counter = 1;
      
      while (existsSync(finalDestination)) {
        const nameWithoutExt = basename(filename, extname(filename));
        const ext = extname(filename);
        finalDestination = join(destinationDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      renameSync(sourcePath, finalDestination);
    } catch (error) {
      console.error(`Failed to move file ${sourcePath}:`, error);
      // If we can't move the file, at least try to delete it to prevent reprocessing
      try {
        require('fs').unlinkSync(sourcePath);
      } catch (deleteError) {
        console.error(`Failed to delete file after move failure:`, deleteError);
      }
    }
  }

  private moveToErrorDirectory(filePath: string, error: any): void {
    try {
      const filename = basename(filePath);
      const errorFilePath = join(this.errorDir, filename);
      
      // Move the original file
      this.moveFile(filePath, this.errorDir);

      // Create error log
      const errorLog = {
        timestamp: new Date().toISOString(),
        file_path: filePath,
        error: error.message || String(error),
        stack: error.stack,
        file_content: existsSync(filePath) ? readFileSync(filePath, 'utf8') : 'File was moved or deleted'
      };

      const errorLogPath = `${errorFilePath}.error`;
      writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));

    } catch (moveError) {
      console.error(`Failed to move file to error directory:`, moveError);
    }
  }

  public async processExistingFiles(): Promise<void> {
    console.log('Processing existing files in watch directory...');
    
    try {
      const files = require('fs').readdirSync(this.watchDir);
      
      for (const filename of files) {
        const filePath = join(this.watchDir, filename);
        
        // Skip directories and files that shouldn't be processed
        if (!require('fs').statSync(filePath).isFile() || !this.shouldProcessFile(filename)) {
          continue;
        }

        await this.processFile(filePath);
      }
      
      console.log(`Finished processing existing files. Stats:`, this.getStatistics());
    } catch (error) {
      console.error('Error processing existing files:', error);
    }
  }

  public resetStatistics(): void {
    this.stats = {
      filesProcessed: 0,
      filesSuccessful: 0,
      filesFailed: 0,
      notificationsCreated: 0
    };
  }
}