/**
 * Notification Webhook Server
 * HTTP server for receiving notification webhooks
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

// Validation schemas
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

// Sanitize HTML to prevent XSS
const sanitizeHtml = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
};

// Rate limiting configuration
const createRateLimit = () => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => {
    return req.get('X-API-Key') || req.ip;
  },
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API key validation middleware
const validateApiKey = (db: Database.Database) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let apiKey = req.get('X-API-Key');
    
    // Also check Authorization header
    const authHeader = req.get('Authorization');
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    // Check if API key exists in database
    const project = db.prepare('SELECT * FROM projects WHERE api_key = ? AND is_active = 1').get(apiKey);
    
    if (!project) {
      return res.status(403).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Add project info to request
    req.project = project;
    next();
  };
};

// Request validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const contentType = req.get('Content-Type');
  
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json({
      error: 'Content-Type must be application/json',
      code: 'INVALID_CONTENT_TYPE'
    });
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Request body must be valid JSON',
      code: 'INVALID_JSON'
    });
  }

  next();
};

export const createNotificationWebhookServer = (db: Database.Database): express.Application => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: false
  }));

  // Body parser with size limit
  app.use(express.json({ 
    limit: '1mb',
    type: 'application/json'
  }));

  // Rate limiting
  app.use('/webhook', createRateLimit());

  // Health check endpoint
  app.get('/health', (req, res) => {
    try {
      // Simple database check
      db.prepare('SELECT 1').get();
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ 
        status: 'unhealthy', 
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Webhook notification endpoint
  app.post('/webhook/notifications', 
    validateApiKey(db),
    validateRequest,
    async (req, res) => {
      try {
        // Validate payload
        const { error, value } = notificationSchema.validate(req.body, { abortEarly: false });
        
        if (error) {
          return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message,
              value: d.context?.value
            }))
          });
        }

        // Sanitize input
        const sanitizedData = {
          ...value,
          subject: value.subject ? sanitizeHtml(value.subject) : null,
          body: sanitizeHtml(value.body)
        };

        // Use project_id from request if not provided in payload
        const projectId = sanitizedData.project_id || req.project.id;

        // Verify user exists
        const user = db.prepare('SELECT id FROM users WHERE external_id = ? AND is_active = 1').get(sanitizedData.user_id);
        if (!user) {
          return res.status(400).json({
            error: 'User not found or inactive',
            code: 'USER_NOT_FOUND'
          });
        }

        // Verify template if provided
        if (sanitizedData.template_id) {
          const template = db.prepare('SELECT id FROM templates WHERE id = ? AND is_active = 1').get(sanitizedData.template_id);
          if (!template) {
            return res.status(400).json({
              error: 'Template not found or inactive',
              code: 'TEMPLATE_NOT_FOUND'
            });
          }
        }

        // Create notification
        const notificationId = nanoid();
        const now = new Date().toISOString();

        const insertStmt = db.prepare(`
          INSERT INTO notifications 
          (id, project_id, user_id, template_id, channel, status, priority, subject, body, data, scheduled_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insertStmt.run(
          notificationId,
          projectId,
          user.id,
          sanitizedData.template_id || null,
          sanitizedData.channel,
          sanitizedData.priority,
          sanitizedData.subject || null,
          sanitizedData.body,
          JSON.stringify(sanitizedData.data),
          sanitizedData.scheduled_at || null,
          now,
          now
        );

        if (result.changes === 0) {
          throw new Error('Failed to create notification');
        }

        // Log event
        const eventStmt = db.prepare(`
          INSERT INTO events (notification_id, event_type, event_data, created_at)
          VALUES (?, 'created', ?, ?)
        `);

        eventStmt.run(
          notificationId,
          JSON.stringify({
            source: 'webhook',
            user_agent: req.get('User-Agent'),
            ip: req.ip,
            api_key_id: req.project.id
          }),
          now
        );

        res.status(201).json({
          success: true,
          notification_id: notificationId,
          status: 'pending',
          created_at: now
        });

      } catch (error) {
        console.error('Webhook processing error:', error);

        if (error.message.includes('FOREIGN KEY constraint failed')) {
          return res.status(400).json({
            error: 'Invalid reference to project, user, or template',
            code: 'FOREIGN_KEY_VIOLATION'
          });
        }

        if (error.message.includes('database')) {
          return res.status(500).json({
            error: 'Database error occurred',
            code: 'DATABASE_ERROR'
          });
        }

        res.status(500).json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  // Batch webhook endpoint
  app.post('/webhook/notifications/batch',
    validateApiKey(db),
    validateRequest,
    async (req, res) => {
      try {
        if (!Array.isArray(req.body) || req.body.length === 0) {
          return res.status(400).json({
            error: 'Request body must be a non-empty array',
            code: 'INVALID_BATCH_FORMAT'
          });
        }

        if (req.body.length > 100) {
          return res.status(400).json({
            error: 'Batch size cannot exceed 100 notifications',
            code: 'BATCH_SIZE_EXCEEDED'
          });
        }

        const results = [];
        const errors = [];

        // Create batch record
        const batchId = nanoid();
        const now = new Date().toISOString();

        const batchStmt = db.prepare(`
          INSERT INTO batches (id, project_id, name, total_notifications, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'processing', ?, ?)
        `);

        batchStmt.run(batchId, req.project.id, `Webhook Batch ${batchId}`, req.body.length, now, now);

        // Process notifications in transaction
        const transaction = db.transaction((notifications) => {
          for (let i = 0; i < notifications.length; i++) {
            try {
              const { error, value } = notificationSchema.validate(notifications[i]);
              
              if (error) {
                errors.push({
                  index: i,
                  error: 'Validation failed',
                  details: error.details.map(d => d.message)
                });
                continue;
              }

              // Sanitize and create notification (similar logic to single endpoint)
              const sanitizedData = {
                ...value,
                subject: value.subject ? sanitizeHtml(value.subject) : null,
                body: sanitizeHtml(value.body)
              };

              const notificationId = nanoid();
              
              const insertStmt = db.prepare(`
                INSERT INTO notifications 
                (id, project_id, user_id, channel, priority, subject, body, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              // Note: Simplified for batch - would need proper user validation in production
              insertStmt.run(
                notificationId,
                req.project.id,
                sanitizedData.user_id,
                sanitizedData.channel,
                sanitizedData.priority,
                sanitizedData.subject,
                sanitizedData.body,
                JSON.stringify(sanitizedData.data),
                now
              );

              // Link to batch
              const batchLinkStmt = db.prepare(`
                INSERT INTO batch_notifications (batch_id, notification_id) VALUES (?, ?)
              `);
              batchLinkStmt.run(batchId, notificationId);

              results.push({
                index: i,
                notification_id: notificationId,
                status: 'created'
              });

            } catch (err) {
              errors.push({
                index: i,
                error: err.message,
                code: 'CREATION_FAILED'
              });
            }
          }
        });

        transaction(req.body);

        // Update batch status
        const updateBatchStmt = db.prepare(`
          UPDATE batches 
          SET status = 'completed', sent_notifications = ?, failed_notifications = ?, completed_at = ?
          WHERE id = ?
        `);

        updateBatchStmt.run(results.length, errors.length, now, batchId);

        res.status(201).json({
          success: true,
          batch_id: batchId,
          total: req.body.length,
          created: results.length,
          failed: errors.length,
          results: results,
          errors: errors.length > 0 ? errors : undefined
        });

      } catch (error) {
        console.error('Batch webhook processing error:', error);
        res.status(500).json({
          error: 'Batch processing failed',
          code: 'BATCH_ERROR',
          message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Request payload too large',
        code: 'PAYLOAD_TOO_LARGE'
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND'
    });
  });

  return app;
};

// Add types for Express Request extension
declare global {
  namespace Express {
    interface Request {
      project?: any;
    }
  }
}