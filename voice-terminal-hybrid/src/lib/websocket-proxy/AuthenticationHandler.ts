/**
 * CRITICAL SECURITY: Authentication Handler for WebSocket Proxy
 * Manages authentication, authorization, and security token validation
 */

import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../tmux/security/AuditLogger.js';

// Authentication configuration
export interface AuthenticationConfig {
  enableAuditLogging: boolean;
  auditLogger: AuditLogger;
  tokenExpiration: number; // Token expiration in seconds
  maxLoginAttempts: number;
  lockoutDuration: number; // Lockout duration in milliseconds
  secretKey: string;
  allowedOrigins: string[];
  requireHTTPS: boolean;
}

// User authentication data
export interface UserCredentials {
  userId: string;
  username: string;
  hashedPassword: string;
  salt: string;
  permissions: string[];
  groups: string[];
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  isActive: boolean;
  metadata: {
    email?: string;
    fullName?: string;
    department?: string;
  };
}

// Authentication token
export interface AuthToken {
  tokenId: string;
  userId: string;
  username: string;
  permissions: string[];
  groups: string[];
  issuedAt: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
}

// Login attempt tracking
interface LoginAttempt {
  userId: string;
  ipAddress: string;
  timestamp: Date;
  success: boolean;
  userAgent: string;
  reason?: string;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  user?: UserCredentials;
  token?: string;
  error?: string;
  lockoutRemaining?: number;
  requiresMFA?: boolean;
}

// Token validation result
export interface TokenValidationResult {
  valid: boolean;
  token?: AuthToken;
  error?: string;
  shouldRefresh?: boolean;
}

export class AuthenticationHandler extends EventEmitter {
  private config: AuthenticationConfig;
  private userDatabase = new Map<string, UserCredentials>();
  private activeTokens = new Map<string, AuthToken>();
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private lockedAccounts = new Map<string, Date>();
  private tokenBlacklist = new Set<string>();

  constructor(config: Partial<AuthenticationConfig>) {
    super();
    
    this.config = {
      enableAuditLogging: true,
      tokenExpiration: 3600, // 1 hour
      maxLoginAttempts: 5,
      lockoutDuration: 900000, // 15 minutes
      secretKey: this.generateSecretKey(),
      allowedOrigins: ['https://localhost:3000'],
      requireHTTPS: true,
      ...config
    } as AuthenticationConfig;

    this.initializeDefaultUsers();
    this.startCleanupTimer();
  }

  /**
   * CRITICAL: Authenticate user with credentials
   */
  async authenticateUser(
    username: string,
    password: string,
    clientInfo: {
      ipAddress: string;
      userAgent: string;
      origin?: string;
    }
  ): Promise<AuthResult> {
    const startTime = performance.now();
    
    try {
      // Check origin if specified
      if (clientInfo.origin && !this.isOriginAllowed(clientInfo.origin)) {
        await this.logSecurityEvent('ORIGIN_NOT_ALLOWED', 'critical', {
          origin: clientInfo.origin,
          allowedOrigins: this.config.allowedOrigins
        }, clientInfo);
        
        return {
          success: false,
          error: 'Origin not allowed'
        };
      }

      // Find user
      const user = this.findUserByUsername(username);
      if (!user) {
        await this.recordLoginAttempt(username, clientInfo, false, 'User not found');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check if account is locked
      const lockoutCheck = await this.checkAccountLockout(user.userId, clientInfo.ipAddress);
      if (!lockoutCheck.allowed) {
        return {
          success: false,
          error: 'Account temporarily locked',
          lockoutRemaining: lockoutCheck.remainingTime
        };
      }

      // Check if user is active
      if (!user.isActive) {
        await this.recordLoginAttempt(user.userId, clientInfo, false, 'Account disabled');
        return {
          success: false,
          error: 'Account disabled'
        };
      }

      // Validate password
      const passwordValid = await this.validatePassword(password, user.hashedPassword, user.salt);
      if (!passwordValid) {
        await this.recordLoginAttempt(user.userId, clientInfo, false, 'Invalid password');
        await this.handleFailedLogin(user.userId, clientInfo);
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Generate authentication token
      const token = await this.generateAuthToken(user, clientInfo);
      
      // Update user last login
      user.lastLogin = new Date();
      user.failedLoginAttempts = 0;

      // Record successful login
      await this.recordLoginAttempt(user.userId, clientInfo, true);
      
      const authTime = performance.now() - startTime;
      
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'AuthenticationHandler',
        description: 'User authenticated successfully',
        metadata: {
          userId: user.userId,
          username: user.username,
          authenticationTime: authTime,
          permissions: user.permissions,
          groups: user.groups
        },
        clientInfo: {
          sessionId: token.tokenId,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          userId: user.userId
        },
        outcome: 'success',
        riskScore: 2
      });

      return {
        success: true,
        user,
        token: this.encodeToken(token)
      };

    } catch (error) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.HIGH,
        source: 'AuthenticationHandler',
        description: 'Authentication error',
        metadata: {
          username,
          error: error.message
        },
        clientInfo: {
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent
        },
        outcome: 'failure',
        riskScore: 7
      });

      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * CRITICAL: Validate authentication token
   */
  async validateToken(tokenString: string, clientInfo?: {
    ipAddress: string;
    userAgent: string;
  }): Promise<TokenValidationResult> {
    try {
      // Check if token is blacklisted
      if (this.tokenBlacklist.has(tokenString)) {
        return {
          valid: false,
          error: 'Token revoked'
        };
      }

      // Decode and validate token
      const token = this.decodeToken(tokenString);
      if (!token) {
        return {
          valid: false,
          error: 'Invalid token format'
        };
      }

      // Check if token exists in active tokens
      const activeToken = this.activeTokens.get(token.tokenId);
      if (!activeToken) {
        return {
          valid: false,
          error: 'Token not found'
        };
      }

      // Check expiration
      if (new Date() > token.expiresAt) {
        this.activeTokens.delete(token.tokenId);
        return {
          valid: false,
          error: 'Token expired',
          shouldRefresh: true
        };
      }

      // Validate client information if provided
      if (clientInfo) {
        if (token.ipAddress !== clientInfo.ipAddress) {
          await this.logSecurityEvent('TOKEN_IP_MISMATCH', 'high', {
            tokenIp: token.ipAddress,
            clientIp: clientInfo.ipAddress,
            tokenId: token.tokenId
          }, clientInfo);

          return {
            valid: false,
            error: 'Token IP mismatch'
          };
        }
      }

      // Check if user is still active
      const user = this.userDatabase.get(token.userId);
      if (!user || !user.isActive) {
        this.activeTokens.delete(token.tokenId);
        return {
          valid: false,
          error: 'User account disabled'
        };
      }

      return {
        valid: true,
        token
      };

    } catch (error) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.INPUT_VALIDATION_FAILED,
        severity: SecuritySeverity.MEDIUM,
        source: 'AuthenticationHandler',
        description: 'Token validation error',
        metadata: {
          error: error.message
        },
        clientInfo: clientInfo ? {
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent
        } : undefined,
        outcome: 'blocked',
        riskScore: 5
      });

      return {
        valid: false,
        error: 'Token validation failed'
      };
    }
  }

  /**
   * CRITICAL: Revoke authentication token
   */
  async revokeToken(tokenString: string, reason: string = 'Manual revocation'): Promise<void> {
    try {
      const token = this.decodeToken(tokenString);
      if (token) {
        this.activeTokens.delete(token.tokenId);
        this.tokenBlacklist.add(tokenString);

        await this.config.auditLogger.logEvent({
          eventType: SecurityEventType.ACCESS_DENIED,
          severity: SecuritySeverity.INFO,
          source: 'AuthenticationHandler',
          description: 'Authentication token revoked',
          metadata: {
            tokenId: token.tokenId,
            userId: token.userId,
            reason
          },
          clientInfo: {
            sessionId: token.tokenId,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent,
            userId: token.userId
          },
          outcome: 'success',
          riskScore: 3
        });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }

  /**
   * CRITICAL: Check user permissions
   */
  hasPermission(token: AuthToken, requiredPermission: string): boolean {
    return token.permissions.includes(requiredPermission) || 
           token.permissions.includes('admin') ||
           token.groups.includes('admins');
  }

  /**
   * CRITICAL: Check if user is in required group
   */
  inGroup(token: AuthToken, requiredGroup: string): boolean {
    return token.groups.includes(requiredGroup) || 
           token.groups.includes('admins');
  }

  /**
   * Generate secure authentication token
   */
  private async generateAuthToken(
    user: UserCredentials, 
    clientInfo: { ipAddress: string; userAgent: string }
  ): Promise<AuthToken> {
    const tokenId = this.generateTokenId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.tokenExpiration * 1000);

    const token: AuthToken = {
      tokenId,
      userId: user.userId,
      username: user.username,
      permissions: [...user.permissions],
      groups: [...user.groups],
      issuedAt: now,
      expiresAt,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    };

    this.activeTokens.set(tokenId, token);
    return token;
  }

  /**
   * Encode token as JWT-like string
   */
  private encodeToken(token: AuthToken): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      tokenId: token.tokenId,
      userId: token.userId,
      username: token.username,
      permissions: token.permissions,
      groups: token.groups,
      iat: Math.floor(token.issuedAt.getTime() / 1000),
      exp: Math.floor(token.expiresAt.getTime() / 1000),
      ip: token.ipAddress
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = createHmac('sha256', this.config.secretKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Decode and verify token
   */
  private decodeToken(tokenString: string): AuthToken | null {
    try {
      const parts = tokenString.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      
      // Verify signature
      const expectedSignature = createHmac('sha256', this.config.secretKey)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

      return {
        tokenId: payload.tokenId,
        userId: payload.userId,
        username: payload.username,
        permissions: payload.permissions || [],
        groups: payload.groups || [],
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
        ipAddress: payload.ip,
        userAgent: '' // Not stored in token for size reasons
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Validate password against hash
   */
  private async validatePassword(password: string, hashedPassword: string, salt: string): Promise<boolean> {
    const hash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    
    return timingSafeEqual(Buffer.from(hash), Buffer.from(hashedPassword));
  }

  /**
   * Hash password with salt
   */
  private hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || randomBytes(32).toString('hex');
    const hash = createHash('sha256')
      .update(password + actualSalt)
      .digest('hex');
    
    return { hash, salt: actualSalt };
  }

  /**
   * Check account lockout status
   */
  private async checkAccountLockout(
    userId: string, 
    ipAddress: string
  ): Promise<{ allowed: boolean; remainingTime?: number }> {
    const user = this.userDatabase.get(userId);
    if (!user) {
      return { allowed: false };
    }

    // Check user-level lockout
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingTime = user.lockedUntil.getTime() - Date.now();
      return { allowed: false, remainingTime };
    }

    // Check failed login attempts
    if (user.failedLoginAttempts >= this.config.maxLoginAttempts) {
      const lockoutUntil = new Date(Date.now() + this.config.lockoutDuration);
      user.lockedUntil = lockoutUntil;
      
      await this.logSecurityEvent('ACCOUNT_LOCKED', 'high', {
        userId,
        failedAttempts: user.failedLoginAttempts,
        lockoutDuration: this.config.lockoutDuration
      }, { ipAddress, userAgent: 'unknown' });

      return { allowed: false, remainingTime: this.config.lockoutDuration };
    }

    return { allowed: true };
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(
    userId: string,
    clientInfo: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const user = this.userDatabase.get(userId);
    if (user) {
      user.failedLoginAttempts++;

      if (user.failedLoginAttempts >= this.config.maxLoginAttempts) {
        await this.logSecurityEvent('MAX_LOGIN_ATTEMPTS', 'high', {
          userId,
          attempts: user.failedLoginAttempts
        }, clientInfo);
      }
    }
  }

  /**
   * Record login attempt
   */
  private async recordLoginAttempt(
    userId: string,
    clientInfo: { ipAddress: string; userAgent: string },
    success: boolean,
    reason?: string
  ): Promise<void> {
    const attempt: LoginAttempt = {
      userId,
      ipAddress: clientInfo.ipAddress,
      timestamp: new Date(),
      success,
      userAgent: clientInfo.userAgent,
      reason
    };

    const key = `${userId}:${clientInfo.ipAddress}`;
    let attempts = this.loginAttempts.get(key) || [];
    attempts.push(attempt);

    // Keep only last 100 attempts
    if (attempts.length > 100) {
      attempts = attempts.slice(-100);
    }

    this.loginAttempts.set(key, attempts);

    if (!success) {
      await this.logSecurityEvent('LOGIN_FAILED', 'medium', {
        userId,
        reason: reason || 'Unknown'
      }, clientInfo);
    }
  }

  /**
   * Find user by username
   */
  private findUserByUsername(username: string): UserCredentials | undefined {
    for (const user of this.userDatabase.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin) || 
           this.config.allowedOrigins.includes('*');
  }

  /**
   * Generate secure token ID
   */
  private generateTokenId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate secret key
   */
  private generateSecretKey(): string {
    return randomBytes(64).toString('hex');
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata: any,
    clientInfo: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    const severityMap = {
      low: SecuritySeverity.LOW,
      medium: SecuritySeverity.MEDIUM,
      high: SecuritySeverity.HIGH,
      critical: SecuritySeverity.CRITICAL
    };

    await this.config.auditLogger.logEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: severityMap[severity],
      source: 'AuthenticationHandler',
      description: `Authentication security event: ${eventType}`,
      metadata,
      clientInfo: {
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent
      },
      outcome: 'blocked',
      riskScore: severity === 'critical' ? 9 : severity === 'high' ? 7 : severity === 'medium' ? 5 : 3
    });
  }

  /**
   * Initialize default users for testing
   */
  private initializeDefaultUsers(): void {
    const defaultPassword = 'admin123';
    const { hash, salt } = this.hashPassword(defaultPassword);

    const adminUser: UserCredentials = {
      userId: 'admin-001',
      username: 'admin',
      hashedPassword: hash,
      salt,
      permissions: ['admin', 'read', 'write', 'execute'],
      groups: ['admins'],
      failedLoginAttempts: 0,
      isActive: true,
      metadata: {
        email: 'admin@example.com',
        fullName: 'System Administrator',
        department: 'IT'
      }
    };

    this.userDatabase.set(adminUser.userId, adminUser);
  }

  /**
   * Start cleanup timer for expired tokens and attempts
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredTokens();
      this.cleanupOldLoginAttempts();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [tokenId, token] of this.activeTokens) {
      if (now > token.expiresAt) {
        this.activeTokens.delete(tokenId);
      }
    }
  }

  /**
   * Clean up old login attempts
   */
  private cleanupOldLoginAttempts(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, attempts] of this.loginAttempts) {
      const recent = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (recent.length === 0) {
        this.loginAttempts.delete(key);
      } else {
        this.loginAttempts.set(key, recent);
      }
    }
  }

  /**
   * Get authentication statistics
   */
  getAuthStats(): {
    activeTokens: number;
    totalUsers: number;
    activeUsers: number;
    lockedUsers: number;
    recentLoginAttempts: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let activeUsers = 0;
    let lockedUsers = 0;
    
    for (const user of this.userDatabase.values()) {
      if (user.isActive) activeUsers++;
      if (user.lockedUntil && now < user.lockedUntil) lockedUsers++;
    }

    let recentAttempts = 0;
    for (const attempts of this.loginAttempts.values()) {
      recentAttempts += attempts.filter(a => a.timestamp > oneHourAgo).length;
    }

    return {
      activeTokens: this.activeTokens.size,
      totalUsers: this.userDatabase.size,
      activeUsers,
      lockedUsers,
      recentLoginAttempts: recentAttempts
    };
  }

  /**
   * Create new user (admin function)
   */
  async createUser(userData: {
    username: string;
    password: string;
    permissions: string[];
    groups: string[];
    metadata?: any;
  }): Promise<string> {
    const userId = `user-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const { hash, salt } = this.hashPassword(userData.password);

    const user: UserCredentials = {
      userId,
      username: userData.username,
      hashedPassword: hash,
      salt,
      permissions: userData.permissions,
      groups: userData.groups,
      failedLoginAttempts: 0,
      isActive: true,
      metadata: userData.metadata || {}
    };

    this.userDatabase.set(userId, user);
    return userId;
  }

  /**
   * Shutdown authentication handler
   */
  async shutdown(): Promise<void> {
    this.activeTokens.clear();
    this.loginAttempts.clear();
    this.lockedAccounts.clear();
    this.tokenBlacklist.clear();
    this.removeAllListeners();
  }
}