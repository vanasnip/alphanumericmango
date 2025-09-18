import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(spawn);

interface BackupOptions {
  database?: string;
  backupDir?: string;
  retentionDays?: number;
}

interface BackupResult {
  success: boolean;
  filename?: string;
  size?: string;
  error?: string;
  timestamp: Date;
}

export class DatabaseBackup {
  private backupScriptPath: string;
  private restoreScriptPath: string;

  constructor() {
    this.backupScriptPath = path.join(__dirname, 'backup.sh');
    this.restoreScriptPath = path.join(__dirname, 'restore.sh');
  }

  /**
   * Create a database backup
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const {
      database = process.env.POSTGRES_DB || 'voice_terminal_db',
      backupDir = './backups',
      retentionDays = 30,
    } = options;

    const timestamp = new Date();
    const result: BackupResult = {
      success: false,
      timestamp,
    };

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Set environment variable for retention
      process.env.BACKUP_RETENTION_DAYS = retentionDays.toString();

      // Execute backup script
      const backupProcess = spawn('bash', [this.backupScriptPath, database, backupDir]);

      let output = '';
      let errorOutput = '';

      backupProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });

      backupProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });

      await new Promise<void>((resolve, reject) => {
        backupProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Backup process exited with code ${code}`));
          }
        });

        backupProcess.on('error', (err) => {
          reject(err);
        });
      });

      // Extract backup filename from output
      const filenameMatch = output.match(/Backup compressed: (.+\.sql\.gz)/);
      if (filenameMatch) {
        result.filename = filenameMatch[1];
        
        // Get file size
        const stats = fs.statSync(result.filename);
        result.size = this.formatBytes(stats.size);
      }

      result.success = true;
      console.log(`✅ Backup created successfully: ${result.filename}`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Backup failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Restore a database from backup
   */
  async restoreBackup(backupFile: string, database?: string): Promise<BackupResult> {
    const timestamp = new Date();
    const result: BackupResult = {
      success: false,
      timestamp,
    };

    try {
      // Check if backup file exists
      if (!fs.existsSync(backupFile)) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }

      const args = [this.restoreScriptPath, backupFile];
      if (database) {
        args.push(database);
      }

      // Execute restore script with 'yes' confirmation
      const restoreProcess = spawn('bash', args);

      // Automatically confirm the restore
      restoreProcess.stdin.write('yes\n');

      let output = '';
      let errorOutput = '';

      restoreProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });

      restoreProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });

      await new Promise<void>((resolve, reject) => {
        restoreProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Restore process exited with code ${code}`));
          }
        });

        restoreProcess.on('error', (err) => {
          reject(err);
        });
      });

      result.success = true;
      result.filename = backupFile;
      console.log(`✅ Database restored successfully from: ${backupFile}`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Restore failed: ${result.error}`);
    }

    return result;
  }

  /**
   * List available backups
   */
  async listBackups(backupDir = './backups'): Promise<string[]> {
    try {
      if (!fs.existsSync(backupDir)) {
        return [];
      }

      const files = fs.readdirSync(backupDir);
      const backupFiles = files.filter(file => file.match(/backup_.*\.sql\.gz$/));
      
      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(backupDir, a));
        const statB = fs.statSync(path.join(backupDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

      return backupFiles.map(file => path.join(backupDir, file));
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(intervalHours = 24): NodeJS.Timeout {
    console.log(`📅 Scheduling automatic backups every ${intervalHours} hours`);
    
    // Run initial backup
    this.createBackup().catch(console.error);
    
    // Schedule recurring backups
    return setInterval(() => {
      console.log('⏰ Running scheduled backup...');
      this.createBackup().catch(console.error);
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const databaseBackup = new DatabaseBackup();