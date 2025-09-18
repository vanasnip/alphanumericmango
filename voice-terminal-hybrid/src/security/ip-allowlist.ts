/**
 * IP Allowlisting System for Voice Terminal Hybrid
 * 
 * Provides IP address filtering with CIDR notation support,
 * dynamic configuration reload, and flexible policy management
 */

import { readFile, watch } from 'fs';
import { promisify } from 'util';
import { IpAllowlistConfig, IpValidationResult, SecurityEvent, SecurityEventType } from './types.js';

const readFileAsync = promisify(readFile);

interface ParsedCidr {
  network: number;
  mask: number;
  isIPv6: boolean;
  original: string;
}

export class IpAllowlistManager {
  private config: IpAllowlistConfig;
  private allowedNetworks: ParsedCidr[] = [];
  private configFilePath?: string;
  private fileWatcher?: any;
  private reloadInterval?: NodeJS.Timeout;

  constructor(config: IpAllowlistConfig, configFilePath?: string) {
    this.config = config;
    this.configFilePath = configFilePath;
    this.parseCidrList(config.allowedCidrs);
    
    if (config.autoReload && configFilePath) {
      this.setupAutoReload();
    }
  }

  /**
   * Check if an IP address is allowed
   */
  async validateIpAddress(ipAddress: string): Promise<IpValidationResult> {
    if (!this.config.enabled) {
      return { isAllowed: true };
    }

    try {
      // Handle localhost special case
      if (this.config.allowLocalhost && this.isLocalhost(ipAddress)) {
        return { 
          isAllowed: true, 
          matchedCidr: 'localhost' 
        };
      }

      // Check private networks if blocked
      if (this.config.blockPrivateNetworks && this.isPrivateNetwork(ipAddress)) {
        this.logIpEvent(ipAddress, 'blocked', 'private_network');
        return { 
          isAllowed: false, 
          error: 'Private networks are blocked' 
        };
      }

      // Parse IP address
      const parsedIp = this.parseIpAddress(ipAddress);
      if (!parsedIp) {
        this.logIpEvent(ipAddress, 'blocked', 'invalid_format');
        return { 
          isAllowed: false, 
          error: 'Invalid IP address format' 
        };
      }

      // Check against allowed networks
      for (const network of this.allowedNetworks) {
        if (this.isIpInNetwork(parsedIp, network)) {
          return { 
            isAllowed: true, 
            matchedCidr: network.original 
          };
        }
      }

      // No match found
      this.logIpEvent(ipAddress, 'blocked', 'not_in_allowlist');
      return { 
        isAllowed: false, 
        error: 'IP address not in allowlist' 
      };

    } catch (error) {
      console.error('IP validation error:', error);
      this.logIpEvent(ipAddress, 'error', 'validation_failed');
      return { 
        isAllowed: false, 
        error: 'Validation failed' 
      };
    }
  }

  /**
   * Add a CIDR to the allowlist
   */
  addCidr(cidr: string): boolean {
    try {
      const parsed = this.parseCidr(cidr);
      if (parsed) {
        this.allowedNetworks.push(parsed);
        this.config.allowedCidrs.push(cidr);
        this.logConfigEvent('cidr_added', { cidr });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to add CIDR:', error);
      return false;
    }
  }

  /**
   * Remove a CIDR from the allowlist
   */
  removeCidr(cidr: string): boolean {
    const index = this.config.allowedCidrs.indexOf(cidr);
    if (index >= 0) {
      this.config.allowedCidrs.splice(index, 1);
      this.allowedNetworks = this.allowedNetworks.filter(n => n.original !== cidr);
      this.logConfigEvent('cidr_removed', { cidr });
      return true;
    }
    return false;
  }

  /**
   * Update the entire CIDR list
   */
  updateCidrList(cidrs: string[]): void {
    this.config.allowedCidrs = [...cidrs];
    this.parseCidrList(cidrs);
    this.logConfigEvent('cidr_list_updated', { count: cidrs.length });
  }

  /**
   * Get current allowlist
   */
  getAllowlist(): string[] {
    return [...this.config.allowedCidrs];
  }

  /**
   * Parse CIDR list into internal format
   */
  private parseCidrList(cidrs: string[]): void {
    this.allowedNetworks = [];
    for (const cidr of cidrs) {
      const parsed = this.parseCidr(cidr);
      if (parsed) {
        this.allowedNetworks.push(parsed);
      } else {
        console.warn(`Invalid CIDR notation: ${cidr}`);
      }
    }
  }

  /**
   * Parse a single CIDR notation
   */
  private parseCidr(cidr: string): ParsedCidr | null {
    try {
      const [ip, prefixStr] = cidr.split('/');
      const prefix = parseInt(prefixStr, 10);

      if (ip.includes(':')) {
        // IPv6
        const ipv6 = this.parseIpv6(ip);
        if (!ipv6 || prefix < 0 || prefix > 128) return null;
        
        const mask = this.createIpv6Mask(prefix);
        return {
          network: ipv6.high & mask.high,
          mask: mask.high,
          isIPv6: true,
          original: cidr
        };
      } else {
        // IPv4
        const ipv4 = this.parseIpv4(ip);
        if (!ipv4 || prefix < 0 || prefix > 32) return null;
        
        const mask = this.createIpv4Mask(prefix);
        return {
          network: ipv4 & mask,
          mask,
          isIPv6: false,
          original: cidr
        };
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse IPv4 address to 32-bit integer
   */
  private parseIpv4(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    
    let result = 0;
    for (let i = 0; i < 4; i++) {
      const part = parseInt(parts[i], 10);
      if (part < 0 || part > 255) return null;
      result = (result << 8) + part;
    }
    return result >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Parse IPv6 address (simplified implementation)
   */
  private parseIpv6(ip: string): { high: number; low: number } | null {
    // This is a simplified IPv6 parser for demonstration
    // In production, use a proper IPv6 library
    try {
      // Remove brackets if present
      ip = ip.replace(/^\[|\]$/g, '');
      
      // Expand :: notation
      if (ip.includes('::')) {
        const parts = ip.split('::');
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - left.length - right.length;
        const expanded = [...left, ...Array(missing).fill('0'), ...right];
        ip = expanded.join(':');
      }
      
      const parts = ip.split(':');
      if (parts.length !== 8) return null;
      
      let high = 0, low = 0;
      for (let i = 0; i < 4; i++) {
        const part = parseInt(parts[i] || '0', 16);
        if (part < 0 || part > 0xFFFF) return null;
        high = (high << 16) + part;
      }
      for (let i = 4; i < 8; i++) {
        const part = parseInt(parts[i] || '0', 16);
        if (part < 0 || part > 0xFFFF) return null;
        low = (low << 16) + part;
      }
      
      return { high: high >>> 0, low: low >>> 0 };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse IP address to internal format
   */
  private parseIpAddress(ip: string): { value: number; isIPv6: boolean } | { high: number; low: number; isIPv6: boolean } | null {
    if (ip.includes(':')) {
      const ipv6 = this.parseIpv6(ip);
      return ipv6 ? { ...ipv6, isIPv6: true } : null;
    } else {
      const ipv4 = this.parseIpv4(ip);
      return ipv4 !== null ? { value: ipv4, isIPv6: false } : null;
    }
  }

  /**
   * Create IPv4 subnet mask
   */
  private createIpv4Mask(prefix: number): number {
    return (0xFFFFFFFF << (32 - prefix)) >>> 0;
  }

  /**
   * Create IPv6 subnet mask (simplified)
   */
  private createIpv6Mask(prefix: number): { high: number; low: number } {
    if (prefix <= 64) {
      return {
        high: (0xFFFFFFFF << (64 - prefix)) >>> 0,
        low: 0
      };
    } else {
      return {
        high: 0xFFFFFFFF,
        low: (0xFFFFFFFF << (128 - prefix)) >>> 0
      };
    }
  }

  /**
   * Check if IP is in network
   */
  private isIpInNetwork(ip: any, network: ParsedCidr): boolean {
    if (network.isIPv6) {
      if (!ip.isIPv6) return false;
      return (ip.high & network.mask) === network.network;
    } else {
      if (ip.isIPv6) return false;
      return (ip.value & network.mask) === network.network;
    }
  }

  /**
   * Check if IP is localhost
   */
  private isLocalhost(ip: string): boolean {
    const localhost = ['127.0.0.1', '::1', 'localhost'];
    return localhost.includes(ip) || ip.startsWith('127.');
  }

  /**
   * Check if IP is in private network range
   */
  private isPrivateNetwork(ip: string): boolean {
    const privateRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      'fc00::/7'  // IPv6 unique local
    ];
    
    for (const range of privateRanges) {
      const network = this.parseCidr(range);
      if (network) {
        const parsedIp = this.parseIpAddress(ip);
        if (parsedIp && this.isIpInNetwork(parsedIp, network)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Setup automatic configuration reload
   */
  private setupAutoReload(): void {
    if (!this.configFilePath) return;

    // File system watcher
    try {
      this.fileWatcher = watch(this.configFilePath, (eventType) => {
        if (eventType === 'change') {
          this.reloadConfiguration();
        }
      });
    } catch (error) {
      console.warn('Failed to setup file watcher:', error);
    }

    // Periodic reload as backup
    if (this.config.reloadIntervalMs > 0) {
      this.reloadInterval = setInterval(() => {
        this.reloadConfiguration();
      }, this.config.reloadIntervalMs);
    }
  }

  /**
   * Reload configuration from file
   */
  private async reloadConfiguration(): Promise<void> {
    if (!this.configFilePath) return;

    try {
      const data = await readFileAsync(this.configFilePath, 'utf8');
      const newConfig = JSON.parse(data);
      
      if (newConfig.allowedCidrs && Array.isArray(newConfig.allowedCidrs)) {
        this.updateCidrList(newConfig.allowedCidrs);
        this.logConfigEvent('config_reloaded', { source: 'file' });
      }
    } catch (error) {
      console.error('Failed to reload IP allowlist configuration:', error);
    }
  }

  /**
   * Log IP-related events
   */
  private logIpEvent(ipAddress: string, action: string, reason: string): void {
    const event: SecurityEvent = {
      type: SecurityEventType.IP_BLOCKED,
      timestamp: new Date(),
      severity: action === 'blocked' ? 'medium' : 'low',
      source: ipAddress,
      details: {
        action,
        reason,
        configEnabled: this.config.enabled
      },
      action
    };
    
    console.log('IP Event:', event);
  }

  /**
   * Log configuration events
   */
  private logConfigEvent(action: string, details: Record<string, any>): void {
    const event: SecurityEvent = {
      type: SecurityEventType.CONFIG_RELOADED,
      timestamp: new Date(),
      severity: 'low',
      source: 'ip-allowlist-manager',
      details: {
        action,
        ...details
      },
      action
    };
    
    console.log('IP Config Event:', event);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }
}

/**
 * Express middleware for IP allowlist filtering
 */
export function createIpAllowlistMiddleware(ipAllowlistManager: IpAllowlistManager) {
  return async (req: any, res: any, next: any) => {
    try {
      const clientIp = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress ||
                      (req.connection.socket && req.connection.socket.remoteAddress) ||
                      'unknown';

      // Clean up IPv6-mapped IPv4 addresses
      const cleanIp = clientIp.replace(/^::ffff:/, '');

      const validation = await ipAllowlistManager.validateIpAddress(cleanIp);
      
      if (!validation.isAllowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: validation.error || 'IP address not allowed'
        });
      }

      // Add IP info to request context
      req.ipValidation = validation;
      
      next();
    } catch (error) {
      console.error('IP allowlist middleware error:', error);
      // In case of error, allow request to proceed (fail open)
      next();
    }
  };
}