/**
 * Generic notification transformer for basic JSON payloads
 */

import { BaseTransformer } from './base.js';
import type { TransformerResult, RawNotificationPayload } from '../types/index.js';

export class GenericTransformer extends BaseTransformer {
  name = 'generic';
  priority = 10; // Lowest priority - fallback transformer

  detect(payload: any): boolean {
    // Always returns true as this is the fallback transformer
    // It should be able to handle any object with at least title and source
    return typeof payload === 'object' && payload !== null;
  }

  transform(payload: any): TransformerResult {
    try {
      // Try to extract common notification fields
      const result: RawNotificationPayload = {
        title: this.extractTitle(payload),
        source: this.extractSource(payload),
        content: this.extractContent(payload),
        priority: this.extractPriority(payload),
        tags: this.extractTags(payload),
        actions: this.extractActions(payload),
        metadata: this.extractMetadata(payload),
        _original: payload
      };

      // If we couldn't extract title or source, this is not a valid notification
      if (!result.title || !result.source) {
        return this.failure('Could not extract required title and source fields', 0.1);
      }

      // Confidence depends on how many fields we successfully extracted
      const confidence = this.calculateConfidence(result);

      return this.success(result, confidence);
    } catch (error) {
      return this.failure(`Generic transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private extractTitle(payload: any): string {
    // Try common title field names
    const titleFields = [
      'title', 'subject', 'message', 'summary', 'name', 'text', 'description'
    ];

    for (const field of titleFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 500); // Limit title length
      }
    }

    // Try nested fields
    const nestedTitleFields = [
      'data.title', 'body.title', 'content.title', 'notification.title',
      'data.subject', 'body.subject', 'content.subject',
      'data.message', 'body.message', 'content.message'
    ];

    for (const field of nestedTitleFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 500);
      }
    }

    // If we still don't have a title, try to generate one from the payload structure
    return this.generateTitle(payload);
  }

  private extractSource(payload: any): string {
    // Try common source field names
    const sourceFields = [
      'source', 'from', 'sender', 'origin', 'service', 'app', 'application',
      'system', 'provider', 'platform'
    ];

    for (const field of sourceFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().toLowerCase().slice(0, 100);
      }
    }

    // Try nested fields
    const nestedSourceFields = [
      'data.source', 'body.source', 'content.source', 'notification.source',
      'data.from', 'body.from', 'content.from',
      'headers.source', 'headers.from', 'headers.sender'
    ];

    for (const field of nestedSourceFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().toLowerCase().slice(0, 100);
      }
    }

    // Check for URL-based sources
    const urlFields = ['url', 'webhook_url', 'callback_url', 'origin_url'];
    for (const field of urlFields) {
      const url = this.get(payload, field);
      if (url && typeof url === 'string') {
        try {
          const parsed = new URL(url);
          return parsed.hostname;
        } catch {
          // Invalid URL, continue
        }
      }
    }

    // Default source
    return 'unknown';
  }

  private extractContent(payload: any): string | undefined {
    // Try common content field names
    const contentFields = [
      'content', 'body', 'text', 'description', 'details', 'message_body',
      'html', 'plain_text'
    ];

    for (const field of contentFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 10000); // Limit content length
      }
    }

    // Try nested fields
    const nestedContentFields = [
      'data.content', 'body.content', 'notification.content',
      'data.body', 'notification.body',
      'data.text', 'body.text', 'content.text'
    ];

    for (const field of nestedContentFields) {
      const value = this.get(payload, field);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 10000);
      }
    }

    return undefined;
  }

  private extractPriority(payload: any): 1 | 2 | 3 | 4 | 5 | undefined {
    const priorityFields = [
      'priority', 'importance', 'urgency', 'severity', 'level'
    ];

    for (const field of priorityFields) {
      const value = this.get(payload, field);
      if (value !== undefined) {
        return this.toPriority(value);
      }
    }

    // Check nested fields
    const nestedPriorityFields = [
      'data.priority', 'notification.priority', 'body.priority'
    ];

    for (const field of nestedPriorityFields) {
      const value = this.get(payload, field);
      if (value !== undefined) {
        return this.toPriority(value);
      }
    }

    return undefined;
  }

  private extractTags(payload: any): string[] | undefined {
    const tags: string[] = [];

    // Try common tag field names
    const tagFields = ['tags', 'labels', 'categories', 'keywords'];

    for (const field of tagFields) {
      const value = this.get(payload, field);
      if (Array.isArray(value)) {
        tags.push(...value.filter(tag => typeof tag === 'string').map(tag => tag.trim()));
      } else if (typeof value === 'string') {
        // Handle comma-separated tags
        tags.push(...value.split(',').map(tag => tag.trim()).filter(tag => tag));
      }
    }

    // Try nested fields
    const nestedTagFields = ['data.tags', 'notification.tags', 'body.tags'];
    for (const field of nestedTagFields) {
      const value = this.get(payload, field);
      if (Array.isArray(value)) {
        tags.push(...value.filter(tag => typeof tag === 'string').map(tag => tag.trim()));
      }
    }

    // Auto-generate tags based on payload structure
    if (payload.error || payload.err) tags.push('error');
    if (payload.warning || payload.warn) tags.push('warning');
    if (payload.success) tags.push('success');
    if (payload.alert) tags.push('alert');

    return tags.length > 0 ? [...new Set(tags)].slice(0, 20) : undefined;
  }

  private extractActions(payload: any): any[] | undefined {
    const actionFields = ['actions', 'buttons', 'links', 'urls'];

    for (const field of actionFields) {
      const value = this.get(payload, field);
      if (Array.isArray(value)) {
        const actions = value.map(action => this.normalizeAction(action)).filter(Boolean);
        if (actions.length > 0) return actions.slice(0, 10);
      }
    }

    // Try nested fields
    const nestedActionFields = ['data.actions', 'notification.actions', 'body.actions'];
    for (const field of nestedActionFields) {
      const value = this.get(payload, field);
      if (Array.isArray(value)) {
        const actions = value.map(action => this.normalizeAction(action)).filter(Boolean);
        if (actions.length > 0) return actions.slice(0, 10);
      }
    }

    // Try to create action from single URL
    const url = this.get(payload, 'url') || this.get(payload, 'link') || this.get(payload, 'callback_url');
    if (url && typeof url === 'string') {
      return [{
        id: 'view',
        label: 'View',
        type: 'url',
        url,
        variant: 'primary'
      }];
    }

    return undefined;
  }

  private normalizeAction(action: any): any | null {
    if (!action || typeof action !== 'object') return null;

    const id = action.id || action.name || action.key || 'action';
    const label = action.label || action.text || action.title || action.name || 'Action';
    const url = action.url || action.link || action.href;
    const callback = action.callback || action.action;

    if (url) {
      return {
        id,
        label,
        type: 'url',
        url,
        variant: action.variant || 'primary'
      };
    }

    if (callback) {
      return {
        id,
        label,
        type: 'callback',
        callback,
        variant: action.variant || 'secondary'
      };
    }

    return null;
  }

  private extractMetadata(payload: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract common metadata fields
    const metadataFields = [
      'id', 'uuid', 'timestamp', 'created_at', 'updated_at', 'date',
      'user_id', 'session_id', 'request_id', 'correlation_id',
      'version', 'environment', 'region'
    ];

    for (const field of metadataFields) {
      const value = this.get(payload, field);
      if (value !== undefined && value !== null) {
        metadata[field] = value;
      }
    }

    // Add type information
    if (payload.type || payload.event_type || payload.kind) {
      metadata.type = payload.type || payload.event_type || payload.kind;
    }

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  private generateTitle(payload: any): string {
    // Try to generate a meaningful title from the payload
    if (payload.error || payload.err) {
      return `Error: ${this.toString(payload.error || payload.err).slice(0, 100)}`;
    }

    if (payload.event || payload.event_type) {
      return `Event: ${this.toString(payload.event || payload.event_type)}`;
    }

    if (payload.type) {
      return `Notification: ${this.toString(payload.type)}`;
    }

    // Look for any string values that might be meaningful
    const stringValues = Object.values(payload).filter(value => 
      typeof value === 'string' && value.trim().length > 0
    );

    if (stringValues.length > 0) {
      return `${this.toString(stringValues[0]).slice(0, 100)}`;
    }

    return 'Generic Notification';
  }

  private calculateConfidence(result: RawNotificationPayload): number {
    let confidence = 0.3; // Base confidence for generic transformer

    // Increase confidence based on extracted fields
    if (result.title && result.title !== 'Generic Notification') confidence += 0.2;
    if (result.source && result.source !== 'unknown') confidence += 0.2;
    if (result.content) confidence += 0.1;
    if (result.priority) confidence += 0.1;
    if (result.tags && result.tags.length > 0) confidence += 0.1;
    if (result.actions && result.actions.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.8); // Cap at 0.8 for generic transformer
  }
}