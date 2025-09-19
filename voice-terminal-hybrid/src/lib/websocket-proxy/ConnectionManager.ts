/**
 * CRITICAL SECURITY: Connection Manager for WebSocket Proxy
 * Manages WebSocket connection lifecycle, rate limiting, and resource allocation
 */

import { EventEmitter } from 'events';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../tmux/security/AuditLogger.js';

// Connection configuration
export interface ConnectionManagerConfig {
  maxConnections: number;
  connectionTimeout: number;
  maxConnectionsPerIP: number;
  cleanupInterval: number;
  auditLogger: AuditLogger;
}

// Connection metadata
export interface ConnectionInfo {
  id: string;
  ipAddress: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  errorCount: number;
  isAuthenticated: boolean;
  userId?: string;
  sessionId?: string;
}

// Rate limiting data
interface RateLimitData {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockUntil: number;
}

// Connection statistics
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsByIP: Map<string, number>;
  averageConnectionDuration: number;
  totalMessagesHandled: number;
  averageMessagesPerConnection: number;
  errorRate: number;
  blockedIPs: string[];
}

export class ConnectionManager extends EventEmitter {
  private config: ConnectionManagerConfig;
  private connections = new Map<string, ConnectionInfo>();
  private connectionsByIP = new Map<string, Set<string>>();
  private rateLimitData = new Map<string, RateLimitData>();
  private blockedIPs = new Set<string>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private totalConnectionsHandled = 0;
  private totalMessagesHandled = 0;

  constructor(config: ConnectionManagerConfig) {
    super();
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * CRITICAL: Check if server can accept new connections
   */
  canAcceptConnection(ipAddress?: string): boolean {
    // Check global connection limit
    if (this.connections.size >= this.config.maxConnections) {
      return false;
    }

    // Check per-IP connection limit
    if (ipAddress) {
      const ipConnections = this.connectionsByIP.get(ipAddress);
      if (ipConnections && ipConnections.size >= this.config.maxConnectionsPerIP) {
        return false;
      }

      // Check if IP is blocked
      if (this.blockedIPs.has(ipAddress)) {
        return false;
      }
    }

    return true;
  }

  /**
   * CRITICAL: Register a new connection with security validation
   */
  async registerConnection(
    connectionId: string, 
    connectionData: {
      ipAddress: string;
      userAgent: string;
      connectedAt: Date;
    }
  ): Promise<void> {
    const { ipAddress, userAgent, connectedAt } = connectionData;

    try {
      // Validate connection can be accepted
      if (!this.canAcceptConnection(ipAddress)) {
        await this.config.auditLogger.logEvent({
          eventType: SecurityEventType.ACCESS_DENIED,
          severity: SecuritySeverity.HIGH,
          source: 'ConnectionManager',
          description: 'Connection rejected due to limits',
          metadata: {
            connectionId,
            ipAddress,
            activeConnections: this.connections.size,
            maxConnections: this.config.maxConnections
          },
          clientInfo: {
            sessionId: connectionId,
            ipAddress,
            userAgent
          },
          outcome: 'blocked',
          riskScore: 6
        });
        
        throw new Error('Connection limit exceeded or IP blocked');
      }

      // Create connection record
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        ipAddress,
        userAgent,
        connectedAt,
        lastActivity: connectedAt,
        messageCount: 0,
        errorCount: 0,
        isAuthenticated: false
      };

      // Register connection
      this.connections.set(connectionId, connectionInfo);
      
      // Track by IP
      let ipConnections = this.connectionsByIP.get(ipAddress);
      if (!ipConnections) {
        ipConnections = new Set();
        this.connectionsByIP.set(ipAddress, ipConnections);
      }
      ipConnections.add(connectionId);

      this.totalConnectionsHandled++;

      // Log successful registration
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'ConnectionManager',
        description: 'Connection registered successfully',
        metadata: {
          connectionId,
          ipAddress,
          userAgent,
          activeConnections: this.connections.size,
          connectionsFromIP: ipConnections.size
        },
        clientInfo: {
          sessionId: connectionId,
          ipAddress,
          userAgent
        },
        outcome: 'success',
        riskScore: 2
      });

      this.emit('connection-registered', connectionInfo);

    } catch (error) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.HIGH,
        source: 'ConnectionManager',
        description: 'Connection registration failed',
        metadata: {
          connectionId,
          ipAddress,
          error: error.message
        },
        clientInfo: {
          sessionId: connectionId,
          ipAddress,
          userAgent
        },
        outcome: 'blocked',
        riskScore: 7
      });
      
      throw error;
    }
  }

  /**
   * CRITICAL: Unregister connection and cleanup resources
   */
  async unregisterConnection(connectionId: string, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      // Calculate connection duration and statistics
      const duration = Date.now() - connection.connectedAt.getTime();
      
      // Remove from connections map
      this.connections.delete(connectionId);

      // Remove from IP tracking
      const ipConnections = this.connectionsByIP.get(connection.ipAddress);
      if (ipConnections) {
        ipConnections.delete(connectionId);
        if (ipConnections.size === 0) {
          this.connectionsByIP.delete(connection.ipAddress);
        }
      }

      // Log disconnection
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'ConnectionManager',
        description: 'Connection unregistered',
        metadata: {
          connectionId,
          ipAddress: connection.ipAddress,
          duration,
          messageCount: connection.messageCount,
          errorCount: connection.errorCount,
          reason: reason || 'Normal disconnect'
        },
        clientInfo: {
          sessionId: connectionId,
          ipAddress: connection.ipAddress,
          userAgent: connection.userAgent
        },
        outcome: 'success',
        riskScore: 1
      });

      this.emit('connection-unregistered', connection, duration);

    } catch (error) {
      console.error('Error unregistering connection:', error);
    }
  }

  /**
   * CRITICAL: Update connection activity and detect anomalies
   */
  async updateConnectionActivity(
    connectionId: string, 
    activityType: 'message' | 'error' | 'auth',
    metadata?: any
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const now = new Date();
    connection.lastActivity = now;

    switch (activityType) {
      case 'message':
        connection.messageCount++;
        this.totalMessagesHandled++;
        break;
        
      case 'error':
        connection.errorCount++;
        
        // Check for error rate anomaly
        if (connection.errorCount > 10 && 
            connection.errorCount / connection.messageCount > 0.5) {
          await this.handleSuspiciousActivity(connection, 'High error rate detected');
        }
        break;
        
      case 'auth':
        connection.isAuthenticated = true;
        connection.userId = metadata?.userId;
        connection.sessionId = metadata?.sessionId;
        break;
    }

    // Check for message flooding
    const connectionDuration = now.getTime() - connection.connectedAt.getTime();
    if (connectionDuration > 0) {
      const messagesPerMinute = (connection.messageCount / connectionDuration) * 60000;
      
      if (messagesPerMinute > 1000) { // More than 1000 messages per minute
        await this.handleSuspiciousActivity(connection, 'Message flooding detected');
      }
    }
  }

  /**
   * CRITICAL: Handle suspicious activity and apply countermeasures
   */
  private async handleSuspiciousActivity(connection: ConnectionInfo, reason: string): Promise<void> {
    await this.config.auditLogger.logSuspiciousActivity(
      'high_activity_rate',
      reason,
      {
        connectionId: connection.id,
        messageCount: connection.messageCount,
        errorCount: connection.errorCount,
        connectionDuration: Date.now() - connection.connectedAt.getTime()
      },
      {
        sessionId: connection.id,
        ipAddress: connection.ipAddress,
        userAgent: connection.userAgent,
        userId: connection.userId
      }
    );

    // Block IP temporarily
    this.blockIP(connection.ipAddress, 300000); // 5 minutes
    
    this.emit('suspicious-activity', connection, reason);
  }

  /**
   * CRITICAL: Block IP address for security
   */
  blockIP(ipAddress: string, durationMs: number = 600000): void {
    this.blockedIPs.add(ipAddress);
    
    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ipAddress);
    }, durationMs);

    // Disconnect all connections from this IP
    const ipConnections = this.connectionsByIP.get(ipAddress);
    if (ipConnections) {
      for (const connectionId of ipConnections) {
        this.emit('connection-should-close', connectionId, 'IP blocked');
      }
    }
  }

  /**
   * Get connection information
   */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get connections by IP address
   */
  getConnectionsByIP(ipAddress: string): ConnectionInfo[] {
    const connectionIds = this.connectionsByIP.get(ipAddress);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ConnectionInfo => conn !== undefined);
  }

  /**
   * Get comprehensive connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const now = Date.now();
    const totalDuration = now - this.startTime;
    
    // Calculate average connection duration
    let totalConnectionDuration = 0;
    let connectionCount = 0;
    
    for (const connection of this.connections.values()) {
      totalConnectionDuration += now - connection.connectedAt.getTime();
      connectionCount++;
    }
    
    const averageConnectionDuration = connectionCount > 0 
      ? totalConnectionDuration / connectionCount 
      : 0;

    // Calculate error rate
    let totalErrors = 0;
    for (const connection of this.connections.values()) {
      totalErrors += connection.errorCount;
    }
    
    const errorRate = this.totalMessagesHandled > 0 
      ? totalErrors / this.totalMessagesHandled 
      : 0;

    return {
      totalConnections: this.totalConnectionsHandled,
      activeConnections: this.connections.size,
      connectionsByIP: new Map(
        Array.from(this.connectionsByIP.entries())
          .map(([ip, connections]) => [ip, connections.size])
      ),
      averageConnectionDuration,
      totalMessagesHandled: this.totalMessagesHandled,
      averageMessagesPerConnection: this.totalConnectionsHandled > 0 
        ? this.totalMessagesHandled / this.totalConnectionsHandled 
        : 0,
      errorRate,
      blockedIPs: Array.from(this.blockedIPs)
    };
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Force disconnect connection
   */
  async forceDisconnect(connectionId: string, reason: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.MEDIUM,
        source: 'ConnectionManager',
        description: 'Connection force disconnected',
        metadata: {
          connectionId,
          reason
        },
        clientInfo: {
          sessionId: connectionId,
          ipAddress: connection.ipAddress,
          userAgent: connection.userAgent
        },
        outcome: 'blocked',
        riskScore: 5
      });

      this.emit('connection-should-close', connectionId, reason);
      await this.unregisterConnection(connectionId, reason);
    }
  }

  /**
   * Clean up inactive connections
   */
  private async cleanupInactiveConnections(): Promise<void> {
    const now = Date.now();
    const timeoutMs = this.config.connectionTimeout;
    
    for (const [connectionId, connection] of this.connections) {
      const inactiveTime = now - connection.lastActivity.getTime();
      
      if (inactiveTime > timeoutMs) {
        await this.forceDisconnect(connectionId, 'Connection timeout');
      }
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupInactiveConnections();
    }, this.config.cleanupInterval || 60000); // Default 1 minute
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Shutdown connection manager
   */
  async shutdown(): Promise<void> {
    this.stopCleanupTimer();
    
    // Disconnect all connections
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      await this.unregisterConnection(connectionId, 'Server shutdown');
    }
    
    this.connections.clear();
    this.connectionsByIP.clear();
    this.rateLimitData.clear();
    this.blockedIPs.clear();
    
    this.removeAllListeners();
  }
}