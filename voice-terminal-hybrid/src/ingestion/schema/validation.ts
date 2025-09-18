/**
 * Schema validation for notification ingestion
 */

import Joi from 'joi';
import type { RawNotificationPayload, BaseNotification } from '../types/index.js';

// Priority enum validation
const prioritySchema = Joi.number().integer().min(1).max(5);

// Action schema for notification actions
const actionSchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  type: Joi.string().valid('url', 'callback', 'dismiss').required(),
  url: Joi.string().uri().when('type', { is: 'url', then: Joi.required() }),
  callback: Joi.string().when('type', { is: 'callback', then: Joi.required() }),
  variant: Joi.string().valid('primary', 'secondary', 'success', 'warning', 'danger').optional()
});

// Base notification schema for raw payloads
export const rawNotificationSchema = Joi.object({
  title: Joi.string().min(1).max(500).required(),
  source: Joi.string().min(1).max(100).required(),
  id: Joi.string().optional(),
  timestamp: Joi.alternatives().try(
    Joi.string().isoDate(),
    Joi.date()
  ).optional(),
  content: Joi.string().max(10000).optional(),
  priority: prioritySchema.optional(),
  metadata: Joi.object().optional(),
  actions: Joi.array().items(actionSchema).max(10).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  _original: Joi.any().optional()
});

// Processed notification schema
export const processedNotificationSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().min(1).max(500).required(),
  source: Joi.string().min(1).max(100).required(),
  timestamp: Joi.date().required(),
  content: Joi.string().max(10000).optional(),
  priority: prioritySchema.optional(),
  metadata: Joi.object().optional(),
  actions: Joi.array().items(actionSchema).max(10).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
});

/**
 * Validate raw notification payload
 */
export function validateRawNotification(payload: unknown): {
  isValid: boolean;
  data?: RawNotificationPayload;
  error?: string;
  details?: any;
} {
  const { error, value } = rawNotificationSchema.validate(payload, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
  });

  if (error) {
    return {
      isValid: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    };
  }

  return {
    isValid: true,
    data: value as RawNotificationPayload
  };
}

/**
 * Validate processed notification
 */
export function validateProcessedNotification(notification: unknown): {
  isValid: boolean;
  data?: BaseNotification;
  error?: string;
  details?: any;
} {
  const { error, value } = processedNotificationSchema.validate(notification, {
    abortEarly: false,
    allowUnknown: false
  });

  if (error) {
    return {
      isValid: false,
      error: 'Processed notification validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    };
  }

  return {
    isValid: true,
    data: value as BaseNotification
  };
}

/**
 * Get human-readable validation error message
 */
export function getValidationErrorMessage(validationResult: ReturnType<typeof validateRawNotification>): string {
  if (validationResult.isValid || !validationResult.details) {
    return 'Unknown validation error';
  }

  const errors = validationResult.details.map((detail: any) => {
    if (detail.field === 'title' && detail.message.includes('required')) {
      return 'Title is required';
    }
    if (detail.field === 'source' && detail.message.includes('required')) {
      return 'Source is required';
    }
    if (detail.field === 'title' && detail.message.includes('empty')) {
      return 'Title cannot be empty';
    }
    if (detail.field === 'priority') {
      return 'Priority must be a number between 1 and 5';
    }
    if (detail.field.includes('actions') && detail.message.includes('type')) {
      return 'Action type must be "url", "callback", or "dismiss"';
    }
    return `${detail.field}: ${detail.message}`;
  });

  return errors.join(', ');
}

/**
 * Sanitize notification content to prevent XSS
 */
export function sanitizeNotification(notification: RawNotificationPayload): RawNotificationPayload {
  return {
    ...notification,
    title: sanitizeString(notification.title),
    content: notification.content ? sanitizeString(notification.content) : undefined,
    tags: notification.tags?.map(tag => sanitizeString(tag)),
    actions: notification.actions?.map(action => ({
      ...action,
      label: sanitizeString(action.label),
      url: action.type === 'url' && action.url ? sanitizeUrl(action.url) : action.url
    }))
  };
}

/**
 * Basic string sanitization
 */
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * URL sanitization
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#';
    }
    return parsed.toString();
  } catch {
    return '#';
  }
}