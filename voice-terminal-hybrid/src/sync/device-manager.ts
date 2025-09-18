/**
 * Device Management System
 * Handles device registration, identification, and local storage
 */

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { DeviceInfo } from './interfaces.js';

export interface LocalDeviceConfig {
  deviceId: string;
  deviceName: string;
  platform: string;
  created: Date;
  lastUsed: Date;
}

export class DeviceManager {
  private static instance: DeviceManager;
  private configDir: string;
  private configFile: string;
  private deviceConfig: LocalDeviceConfig | null = null;

  private constructor() {
    this.configDir = join(homedir(), '.voice-terminal');
    this.configFile = join(this.configDir, 'device.json');
  }

  static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  /**
   * Initialize device manager and ensure device ID exists
   */
  async initialize(): Promise<void> {
    await this.ensureConfigDirectory();
    await this.loadOrCreateDeviceConfig();
  }

  /**
   * Get current device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.deviceConfig) {
      await this.initialize();
    }

    if (!this.deviceConfig) {
      throw new Error('Failed to initialize device configuration');
    }

    return {
      deviceId: this.deviceConfig.deviceId,
      deviceName: this.deviceConfig.deviceName,
      platform: this.deviceConfig.platform,
      lastSync: new Date(), // Will be updated by sync operations
      syncVersion: 1,
      isActive: true
    };
  }

  /**
   * Get device ID
   */
  async getDeviceId(): Promise<string> {
    const deviceInfo = await this.getDeviceInfo();
    return deviceInfo.deviceId;
  }

  /**
   * Update device name
   */
  async updateDeviceName(newName: string): Promise<void> {
    if (!this.deviceConfig) {
      await this.initialize();
    }

    if (this.deviceConfig) {
      this.deviceConfig.deviceName = newName;
      this.deviceConfig.lastUsed = new Date();
      await this.saveDeviceConfig();
    }
  }

  /**
   * Generate platform-specific device name
   */
  private generateDeviceName(): string {
    const platform = this.getPlatform();
    const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `${platform}-${hostname}-${timestamp}`;
  }

  /**
   * Get platform information
   */
  private getPlatform(): string {
    const platform = process.platform;
    
    switch (platform) {
      case 'darwin':
        return 'macOS';
      case 'win32':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return platform;
    }
  }

  /**
   * Ensure config directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
    }
  }

  /**
   * Load existing device config or create new one
   */
  private async loadOrCreateDeviceConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configFile, 'utf-8');
      this.deviceConfig = JSON.parse(configData);
      
      // Update last used timestamp
      if (this.deviceConfig) {
        this.deviceConfig.lastUsed = new Date();
        await this.saveDeviceConfig();
      }
    } catch {
      // Config doesn't exist, create new one
      await this.createNewDeviceConfig();
    }
  }

  /**
   * Create new device configuration
   */
  private async createNewDeviceConfig(): Promise<void> {
    this.deviceConfig = {
      deviceId: uuidv4(),
      deviceName: this.generateDeviceName(),
      platform: this.getPlatform(),
      created: new Date(),
      lastUsed: new Date()
    };

    await this.saveDeviceConfig();
  }

  /**
   * Save device configuration to file
   */
  private async saveDeviceConfig(): Promise<void> {
    if (!this.deviceConfig) {
      throw new Error('No device configuration to save');
    }

    const configData = JSON.stringify(this.deviceConfig, null, 2);
    await fs.writeFile(this.configFile, configData, 'utf-8');
  }

  /**
   * Reset device configuration (for testing or device migration)
   */
  async resetDevice(): Promise<void> {
    try {
      await fs.unlink(this.configFile);
    } catch {
      // File might not exist
    }
    
    this.deviceConfig = null;
    await this.initialize();
  }

  /**
   * Get config file path (for testing)
   */
  getConfigPath(): string {
    return this.configFile;
  }

  /**
   * Check if device is properly configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      await fs.access(this.configFile);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Utility functions for device management
 */
export const DeviceUtils = {
  /**
   * Generate a unique device identifier
   */
  generateDeviceId(): string {
    return uuidv4();
  },

  /**
   * Validate device ID format
   */
  isValidDeviceId(deviceId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(deviceId);
  },

  /**
   * Get platform-specific information
   */
  getPlatformInfo(): {
    platform: string;
    version: string;
    arch: string;
  } {
    return {
      platform: process.platform,
      version: process.version,
      arch: process.arch
    };
  },

  /**
   * Generate device fingerprint for additional security
   */
  generateDeviceFingerprint(): string {
    const info = this.getPlatformInfo();
    const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
    
    // Create a simple fingerprint based on available system info
    const fingerprint = `${info.platform}-${info.arch}-${hostname}`;
    return Buffer.from(fingerprint).toString('base64');
  }
} as const;