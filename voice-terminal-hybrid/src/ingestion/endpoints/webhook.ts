/**
 * HTTP webhook endpoint for notification ingestion
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { IngestionConfig, IngestionResult } from '../types/index.js';

export interface WebhookEndpointOptions {
  config: IngestionConfig;
  processor: (payload: any, source: 'webhook') => Promise<IngestionResult>;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}

/**
 * Create webhook endpoint with rate limiting and authentication
 */
export function createWebhookEndpoint(options: WebhookEndpointOptions): express.Router {
  const { config, processor, logger } = options;
  const router = express.Router();

  // Configure rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger?.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
        }
      });
    }
  });

  // Apply rate limiting
  router.use(limiter);

  // IP allowlist middleware
  if (config.ipAllowlist && config.ipAllowlist.length > 0) {
    router.use(createIPAllowlistMiddleware(config.ipAllowlist, logger));
  }

  // API key authentication middleware
  if (config.apiKey) {
    router.use(createAPIKeyMiddleware(config.apiKey, logger));
  }

  // Body size validation middleware
  router.use(createBodySizeMiddleware(config.maxPayloadSize, logger));

  // JSON body parser with error handling
  router.use(express.json({
    limit: config.maxPayloadSize,
    strict: false,
    type: ['application/json', 'text/json', 'application/*+json']
  }));

  // JSON parsing error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError && 'body' in error) {
      logger?.warn('Invalid JSON payload', {
        error: error.message,
        ip: req.ip,
        contentType: req.get('Content-Type')
      });
      
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON payload',
          details: error.message
        }
      });
    }
    next(error);
  });

  // Webhook endpoint
  router.post('/webhook', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      logger?.info('Webhook request received', {
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        headers: sanitizeHeaders(req.headers)
      });

      // Prepare payload with headers and body
      const payload = {
        headers: req.headers,
        body: req.body,
        query: req.query,
        method: req.method,
        url: req.url,
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      // Process the notification
      const result = await processor(payload, 'webhook');
      const processingTime = Date.now() - startTime;

      if (result.success) {
        logger?.info('Webhook processed successfully', {
          requestId,
          processingTime,
          notificationId: result.notification?.id,
          source: result.notification?.source
        });

        res.status(200).json({
          success: true,
          message: 'Notification processed successfully',
          notificationId: result.notification?.id,
          processingTime
        });
      } else {
        logger?.warn('Webhook processing failed', {
          requestId,
          processingTime,
          error: result.error
        });

        res.status(400).json({
          success: false,
          error: result.error,
          processingTime
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger?.error('Webhook processing error', {
        requestId,
        processingTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        },
        processingTime
      });
    }
  });

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'notification-ingestion-webhook'
    });
  });

  return router;
}

/**
 * Create IP allowlist middleware
 */
function createIPAllowlistMiddleware(allowlist: string[], logger?: WebhookEndpointOptions['logger']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check if IP is in allowlist
    const isAllowed = allowlist.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation - basic implementation
        return isIPInCIDR(clientIP, allowedIP);
      }
      return clientIP === allowedIP;
    });

    if (!isAllowed) {
      logger?.warn('IP not in allowlist', {
        clientIP,
        allowlist
      });

      return res.status(403).json({
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'IP address not in allowlist'
        }
      });
    }

    next();
  };
}

/**
 * Create API key authentication middleware
 */
function createAPIKeyMiddleware(expectedApiKey: string, logger?: WebhookEndpointOptions['logger']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      logger?.warn('Missing API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key required'
        }
      });
    }

    if (apiKey !== expectedApiKey) {
      logger?.warn('Invalid API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        providedKey: apiKey.slice(0, 8) + '...' // Log partial key for debugging
      });

      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
    }

    next();
  };
}

/**
 * Create body size validation middleware
 */
function createBodySizeMiddleware(maxSize: number, logger?: WebhookEndpointOptions['logger']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);

    if (contentLength > maxSize) {
      logger?.warn('Payload too large', {
        contentLength,
        maxSize,
        ip: req.ip
      });

      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Payload size exceeds maximum of ${maxSize} bytes`,
          maxSize,
          actualSize: contentLength
        }
      });
    }

    next();
  };
}

/**
 * Basic CIDR check (simplified implementation)
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    // This is a simplified implementation
    // In production, you might want to use a library like 'ip-range-check'
    if (prefix === 32) {
      return ip === network;
    }
    
    // For now, just do exact match if not /32
    return ip === network;
  } catch {
    return false;
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Sanitize headers for logging (remove sensitive information)
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized['x-api-key'];
  delete sanitized.cookie;
  delete sanitized['x-forwarded-for'];

  return sanitized;
}