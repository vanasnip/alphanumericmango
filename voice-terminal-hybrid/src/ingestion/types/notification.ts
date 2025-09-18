/**
 * Core notification types for the ingestion system
 */

export interface BaseNotification {
  /** Unique identifier for the notification */
  id: string;
  /** Human-readable title */
  title: string;
  /** Source identifier (e.g., 'github', 'email', 'custom') */
  source: string;
  /** Timestamp when notification was created */
  timestamp: Date;
  /** Optional content/body of the notification */
  content?: string;
  /** Priority level (1-5, where 1 is highest) */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Action buttons/links */
  actions?: NotificationAction[];
  /** Tags for categorization */
  tags?: string[];
}

export interface NotificationAction {
  /** Action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Action type */
  type: 'url' | 'callback' | 'dismiss';
  /** URL for 'url' type actions */
  url?: string;
  /** Callback data for 'callback' type actions */
  callback?: string;
  /** Style variant */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export interface RawNotificationPayload {
  /** Required title */
  title: string;
  /** Required source */
  source: string;
  /** Optional fields that may be provided */
  id?: string;
  timestamp?: string | Date;
  content?: string;
  priority?: number;
  metadata?: Record<string, any>;
  actions?: any[];
  tags?: string[];
  /** Original payload for debugging */
  _original?: any;
}

export interface IngestionResult {
  /** Whether ingestion was successful */
  success: boolean;
  /** Processed notification (if successful) */
  notification?: BaseNotification;
  /** Error details (if failed) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** Source method that ingested this notification */
  source: IngestionSource;
}

export type IngestionSource = 'webhook' | 'file' | 'websocket' | 'unix-socket' | 'named-pipe';

export interface IngestionConfig {
  /** HTTP server port */
  port: number;
  /** API key for webhook authentication (optional) */
  apiKey?: string;
  /** IP allowlist for webhook access */
  ipAllowlist?: string[];
  /** Maximum payload size in bytes */
  maxPayloadSize: number;
  /** Rate limiting configuration */
  rateLimit: {
    windowMs: number;
    max: number;
  };
  /** File watcher configuration */
  fileWatcher: {
    directory: string;
    pollInterval?: number;
  };
  /** Unix socket configuration */
  unixSocket: {
    path: string;
    mode?: number;
  };
  /** WebSocket configuration */
  websocket: {
    enabled: boolean;
    authRequired?: boolean;
  };
}

export interface TransformerResult {
  /** Whether transformation was successful */
  success: boolean;
  /** Transformed notification data */
  data?: RawNotificationPayload;
  /** Error details if transformation failed */
  error?: string;
  /** Confidence score (0-1) for auto-detection */
  confidence: number;
}

export interface NotificationTransformer {
  /** Transformer name */
  name: string;
  /** Detect if this transformer can handle the payload */
  detect(payload: any): boolean;
  /** Transform payload to standardized format */
  transform(payload: any): TransformerResult;
  /** Priority for transformer selection (higher = preferred) */
  priority: number;
}