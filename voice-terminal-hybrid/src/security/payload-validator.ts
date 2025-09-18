/**
 * Payload Validation and Sanitization for Voice Terminal Hybrid
 * 
 * Comprehensive payload security including:
 * - Size validation
 * - Content type checking
 * - HTML/script sanitization
 * - Suspicious pattern detection
 * - JSON schema validation
 * - Deep object traversal protection
 */

import { PayloadValidationConfig, PayloadValidationResult, ThreatPattern, ThreatDetectionResult, SecurityEvent, SecurityEventType } from './types.js';

export class PayloadValidator {
  private config: PayloadValidationConfig;
  private threatPatterns: ThreatPattern[];
  private maxDepth = 10; // Maximum object nesting depth
  private maxKeys = 1000; // Maximum number of keys in object

  constructor(config: PayloadValidationConfig) {
    this.config = config;
    this.threatPatterns = this.initializeThreatPatterns();
  }

  /**
   * Validate and sanitize incoming payload
   */
  async validatePayload(
    payload: any,
    contentType: string,
    size: number,
    headers?: Record<string, string>
  ): Promise<PayloadValidationResult> {
    const violations: string[] = [];
    const suspiciousPatterns: string[] = [];
    
    try {
      // 1. Size validation
      if (size > this.config.maxSizeBytes) {
        violations.push(`Payload size ${size} exceeds maximum ${this.config.maxSizeBytes} bytes`);
        this.logSecurityEvent('PAYLOAD_TOO_LARGE', 'high', { size, maxSize: this.config.maxSizeBytes });
        return {
          isValid: false,
          violations,
          suspiciousPatterns
        };
      }

      // 2. Content type validation
      if (!this.isAllowedContentType(contentType)) {
        violations.push(`Content type '${contentType}' not allowed`);
      }

      // 3. Deep object validation
      const depthCheck = this.validateObjectDepth(payload);
      if (!depthCheck.isValid) {
        violations.push(depthCheck.error || 'Object structure validation failed');
      }

      // 4. Sanitize payload
      let sanitizedPayload = payload;
      if (this.config.sanitization.validateJson && typeof payload === 'object') {
        const jsonValidation = this.validateJsonStructure(payload);
        if (!jsonValidation.isValid) {
          violations.push(jsonValidation.error || 'Invalid JSON structure');
        } else {
          sanitizedPayload = jsonValidation.sanitized;
        }
      }

      // 5. Content sanitization
      if (typeof sanitizedPayload === 'string') {
        sanitizedPayload = this.sanitizeString(sanitizedPayload);
      } else if (typeof sanitizedPayload === 'object') {
        sanitizedPayload = this.sanitizeObject(sanitizedPayload);
      }

      // 6. Threat detection
      const threatResult = this.detectThreats(sanitizedPayload, headers);
      if (threatResult.shouldBlock) {
        violations.push('Malicious patterns detected');
        this.logSecurityEvent('THREAT_DETECTED', 'critical', {
          threats: threatResult.threats,
          riskScore: threatResult.riskScore
        });
      }
      suspiciousPatterns.push(...threatResult.threats.map(t => t.pattern.name));

      // 7. Final validation
      const isValid = violations.length === 0 && !threatResult.shouldBlock;

      return {
        isValid,
        sanitizedPayload: isValid ? sanitizedPayload : undefined,
        violations,
        suspiciousPatterns
      };

    } catch (error) {
      console.error('Payload validation error:', error);
      violations.push('Validation process failed');
      return {
        isValid: false,
        violations,
        suspiciousPatterns
      };
    }
  }

  /**
   * Check if content type is allowed
   */
  private isAllowedContentType(contentType: string): boolean {
    const normalizedType = contentType.toLowerCase().split(';')[0].trim();
    return this.config.allowedContentTypes.includes(normalizedType);
  }

  /**
   * Validate object depth and complexity
   */
  private validateObjectDepth(obj: any, depth = 0, keyCount = 0): { isValid: boolean; error?: string; keyCount: number } {
    if (depth > this.maxDepth) {
      return { isValid: false, error: `Object nesting exceeds maximum depth of ${this.maxDepth}`, keyCount };
    }

    if (obj === null || typeof obj !== 'object') {
      return { isValid: true, keyCount };
    }

    const keys = Object.keys(obj);
    keyCount += keys.length;

    if (keyCount > this.maxKeys) {
      return { isValid: false, error: `Object complexity exceeds maximum ${this.maxKeys} keys`, keyCount };
    }

    for (const key of keys) {
      if (key.length > 100) {
        return { isValid: false, error: 'Object key length exceeds maximum', keyCount };
      }

      const result = this.validateObjectDepth(obj[key], depth + 1, keyCount);
      if (!result.isValid) {
        return result;
      }
      keyCount = result.keyCount;
    }

    return { isValid: true, keyCount };
  }

  /**
   * Validate JSON structure against common attack patterns
   */
  private validateJsonStructure(obj: any): { isValid: boolean; sanitized?: any; error?: string } {
    try {
      // Check for prototype pollution attempts
      if (this.hasPrototypePollution(obj)) {
        return { isValid: false, error: 'Prototype pollution attempt detected' };
      }

      // Sanitize and return clean object
      const sanitized = this.deepCleanObject(obj);
      return { isValid: true, sanitized };

    } catch (error) {
      return { isValid: false, error: 'JSON validation failed' };
    }
  }

  /**
   * Check for prototype pollution patterns
   */
  private hasPrototypePollution(obj: any, visited = new WeakSet()): boolean {
    if (obj === null || typeof obj !== 'object' || visited.has(obj)) {
      return false;
    }

    visited.add(obj);

    const dangerousKeys = ['__proto__', 'prototype', 'constructor'];
    
    for (const key in obj) {
      if (dangerousKeys.includes(key)) {
        return true;
      }

      if (typeof obj[key] === 'object' && this.hasPrototypePollution(obj[key], visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Deep clean object by removing dangerous properties
   */
  private deepCleanObject(obj: any, visited = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object' || visited.has(obj)) {
      return obj;
    }

    visited.add(obj);

    const cleaned: any = Array.isArray(obj) ? [] : {};
    const dangerousKeys = ['__proto__', 'prototype', 'constructor'];

    for (const key in obj) {
      if (dangerousKeys.includes(key)) {
        continue; // Skip dangerous keys
      }

      if (typeof obj[key] === 'object') {
        cleaned[key] = this.deepCleanObject(obj[key], visited);
      } else if (typeof obj[key] === 'string') {
        cleaned[key] = this.sanitizeString(obj[key]);
      } else {
        cleaned[key] = obj[key];
      }
    }

    return cleaned;
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    let sanitized = str;

    // Remove HTML if configured
    if (this.config.sanitization.stripHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove script tags and javascript: URLs
    if (this.config.sanitization.stripScripts) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      sanitized = sanitized.replace(/javascript:/gi, '');
      sanitized = sanitized.replace(/data:text\/html/gi, '');
      sanitized = sanitized.replace(/vbscript:/gi, '');
    }

    // Remove comments if configured
    if (this.config.sanitization.removeComments) {
      sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
      sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
      sanitized = sanitized.replace(/\/\/.*$/gm, '');
    }

    // Encode dangerous characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'string' ? this.sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
    }

    return sanitized;
  }

  /**
   * Detect security threats in payload
   */
  private detectThreats(payload: any, headers?: Record<string, string>): ThreatDetectionResult {
    const threats: Array<{
      pattern: ThreatPattern;
      matches: string[];
      location: 'headers' | 'payload' | 'query' | 'path';
    }> = [];

    let riskScore = 0;

    // Check payload content
    const payloadStr = JSON.stringify(payload);
    for (const pattern of this.threatPatterns) {
      const matches = payloadStr.match(pattern.pattern);
      if (matches) {
        threats.push({
          pattern,
          matches: matches.slice(0, 5), // Limit matches for performance
          location: 'payload'
        });
        riskScore += this.getThreatScore(pattern.severity);
      }
    }

    // Check headers if provided
    if (headers) {
      const headerStr = JSON.stringify(headers);
      for (const pattern of this.threatPatterns) {
        const matches = headerStr.match(pattern.pattern);
        if (matches) {
          threats.push({
            pattern,
            matches: matches.slice(0, 5),
            location: 'headers'
          });
          riskScore += this.getThreatScore(pattern.severity);
        }
      }
    }

    const shouldBlock = riskScore >= 50 || threats.some(t => t.pattern.action === 'block');

    return {
      threats,
      riskScore,
      shouldBlock
    };
  }

  /**
   * Initialize threat detection patterns
   */
  private initializeThreatPatterns(): ThreatPattern[] {
    const patterns: ThreatPattern[] = [
      {
        id: 'script-injection',
        name: 'Script Injection',
        pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        severity: 'critical',
        action: 'block',
        description: 'Detects script tag injection attempts'
      },
      {
        id: 'javascript-protocol',
        name: 'JavaScript Protocol',
        pattern: /javascript:/gi,
        severity: 'high',
        action: 'block',
        description: 'Detects javascript: protocol usage'
      },
      {
        id: 'eval-usage',
        name: 'Eval Usage',
        pattern: /\beval\s*\(/gi,
        severity: 'high',
        action: 'block',
        description: 'Detects eval() function usage'
      },
      {
        id: 'function-constructor',
        name: 'Function Constructor',
        pattern: /\bFunction\s*\(/gi,
        severity: 'high',
        action: 'block',
        description: 'Detects Function constructor usage'
      },
      {
        id: 'prototype-pollution',
        name: 'Prototype Pollution',
        pattern: /__proto__|\.prototype\.|\.constructor/gi,
        severity: 'critical',
        action: 'block',
        description: 'Detects prototype pollution attempts'
      },
      {
        id: 'sql-injection',
        name: 'SQL Injection',
        pattern: /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b).*(\bFROM\b|\bWHERE\b|\bUNION\b)/gi,
        severity: 'high',
        action: 'log',
        description: 'Detects potential SQL injection patterns'
      },
      {
        id: 'command-injection',
        name: 'Command Injection',
        pattern: /(\||;|&|\$\(|\`)/g,
        severity: 'medium',
        action: 'log',
        description: 'Detects command injection characters'
      },
      {
        id: 'path-traversal',
        name: 'Path Traversal',
        pattern: /\.\.[\/\\]/g,
        severity: 'medium',
        action: 'log',
        description: 'Detects directory traversal attempts'
      },
      {
        id: 'base64-suspicious',
        name: 'Suspicious Base64',
        pattern: /[A-Za-z0-9+\/]{100,}/g,
        severity: 'low',
        action: 'log',
        description: 'Detects large base64 encoded content'
      }
    ];

    // Add configured suspicious patterns
    for (const patternStr of this.config.suspicious.patterns) {
      try {
        patterns.push({
          id: `custom-${patterns.length}`,
          name: 'Custom Pattern',
          pattern: new RegExp(patternStr, 'gi'),
          severity: 'medium',
          action: 'log',
          description: 'Custom suspicious pattern'
        });
      } catch (error) {
        console.warn(`Invalid regex pattern: ${patternStr}`);
      }
    }

    return patterns;
  }

  /**
   * Get numeric threat score for severity
   */
  private getThreatScore(severity: string): number {
    switch (severity) {
      case 'critical': return 25;
      case 'high': return 15;
      case 'medium': return 8;
      case 'low': return 3;
      default: return 1;
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(type: string, severity: string, details: Record<string, any>): void {
    const event: SecurityEvent = {
      type: type as SecurityEventType,
      timestamp: new Date(),
      severity: severity as any,
      source: 'payload-validator',
      details,
      action: 'blocked'
    };
    
    console.warn('Security Event:', event);
  }

  /**
   * Validate notification-specific payload
   */
  async validateNotificationPayload(payload: any): Promise<PayloadValidationResult & {
    notificationValidation: {
      hasRequiredFields: boolean;
      validPriority: boolean;
      validChannel: boolean;
      templateVariablesValid: boolean;
    }
  }> {
    const baseValidation = await this.validatePayload(
      payload, 
      'application/json', 
      JSON.stringify(payload).length
    );

    // Notification-specific validation
    const notificationValidation = {
      hasRequiredFields: this.hasRequiredNotificationFields(payload),
      validPriority: this.isValidPriority(payload.priority),
      validChannel: this.isValidChannel(payload.channel),
      templateVariablesValid: this.areTemplateVariablesValid(payload.templateVariables)
    };

    const isValidNotification = Object.values(notificationValidation).every(Boolean);
    
    return {
      ...baseValidation,
      isValid: baseValidation.isValid && isValidNotification,
      notificationValidation
    };
  }

  /**
   * Check required notification fields
   */
  private hasRequiredNotificationFields(payload: any): boolean {
    const required = ['projectId', 'channel', 'body'];
    return required.every(field => payload && payload[field]);
  }

  /**
   * Validate notification priority
   */
  private isValidPriority(priority: any): boolean {
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    return !priority || validPriorities.includes(priority);
  }

  /**
   * Validate notification channel
   */
  private isValidChannel(channel: any): boolean {
    const validChannels = ['in_app', 'email', 'sms', 'push', 'webhook'];
    return validChannels.includes(channel);
  }

  /**
   * Validate template variables
   */
  private areTemplateVariablesValid(variables: any): boolean {
    if (!variables) return true;
    if (typeof variables !== 'object') return false;
    
    // Check for dangerous variable names or values
    for (const [key, value] of Object.entries(variables)) {
      if (key.startsWith('__') || key.includes('prototype')) {
        return false;
      }
      if (typeof value === 'string' && value.length > 10000) {
        return false; // Prevent extremely large variable values
      }
    }
    
    return true;
  }
}

/**
 * Express middleware for payload validation
 */
export function createPayloadValidationMiddleware(payloadValidator: PayloadValidator) {
  return async (req: any, res: any, next: any) => {
    try {
      const contentType = req.get('Content-Type') || 'application/json';
      const contentLength = parseInt(req.get('Content-Length') || '0', 10);
      
      // Skip validation for GET requests or empty payloads
      if (req.method === 'GET' || contentLength === 0) {
        return next();
      }

      const validation = await payloadValidator.validatePayload(
        req.body,
        contentType,
        contentLength,
        req.headers
      );

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Payload validation failed',
          violations: validation.violations,
          suspicious: validation.suspiciousPatterns
        });
      }

      // Replace request body with sanitized version
      req.body = validation.sanitizedPayload;
      req.payloadValidation = validation;

      next();
    } catch (error) {
      console.error('Payload validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Payload validation failed'
      });
    }
  };
}