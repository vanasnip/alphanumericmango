/**
 * Email notification transformer
 */

import { BaseTransformer } from './base.js';
import type { TransformerResult, RawNotificationPayload } from '../types/index.js';

export class EmailTransformer extends BaseTransformer {
  name = 'email';
  priority = 70;

  detect(payload: any): boolean {
    // Check for email-specific fields
    const hasEmailFields = Boolean(
      payload.from || 
      payload.to || 
      payload.subject ||
      payload.headers?.from ||
      payload.headers?.to ||
      payload.headers?.subject
    );

    if (hasEmailFields) return true;

    // Check for common email webhook formats
    if (payload.Type === 'Notification' && payload.Message) {
      try {
        const message = JSON.parse(payload.Message);
        if (message.mail || message.eventType === 'send' || message.eventType === 'bounce') {
          return true;
        }
      } catch {
        // Not JSON, continue checking
      }
    }

    // Check for SendGrid webhook format
    if (Array.isArray(payload) && payload[0]?.email && payload[0]?.event) {
      return true;
    }

    // Check for Mailgun webhook format
    if (payload['event-data'] && payload['event-data'].event) {
      return true;
    }

    return false;
  }

  transform(payload: any): TransformerResult {
    try {
      // Handle different email formats
      if (Array.isArray(payload)) {
        return this.handleSendGridWebhook(payload);
      }

      if (payload['event-data']) {
        return this.handleMailgunWebhook(payload);
      }

      if (payload.Type === 'Notification') {
        return this.handleAmazonSES(payload);
      }

      // Handle direct email object
      return this.handleDirectEmail(payload);

    } catch (error) {
      return this.failure(`Email transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleDirectEmail(payload: any): TransformerResult {
    const from = this.get(payload, 'from') || this.get(payload, 'headers.from', 'Unknown Sender');
    const to = this.get(payload, 'to') || this.get(payload, 'headers.to', 'Unknown Recipient');
    const subject = this.get(payload, 'subject') || this.get(payload, 'headers.subject', 'No Subject');
    const body = this.get(payload, 'body') || this.get(payload, 'text') || this.get(payload, 'html', '');

    const result: RawNotificationPayload = {
      title: `Email: ${subject}`,
      source: 'email',
      content: this.formatEmailContent(from, to, body),
      priority: this.getEmailPriority(payload),
      tags: ['email', ...this.extractEmailTags(payload)],
      actions: this.getEmailActions(payload),
      metadata: {
        from,
        to,
        subject,
        messageId: this.get(payload, 'messageId') || this.get(payload, 'headers.message-id'),
        timestamp: this.parseDate(this.get(payload, 'date') || this.get(payload, 'headers.date'))
      },
      _original: payload
    };

    return this.success(result, 0.85);
  }

  private handleSendGridWebhook(payload: any[]): TransformerResult {
    const event = payload[0];
    const eventType = this.get(event, 'event', 'unknown');
    const email = this.get(event, 'email', 'Unknown Email');
    const timestamp = this.parseDate(this.get(event, 'timestamp'));

    let title: string;
    let priority: 1 | 2 | 3 | 4 | 5 = 3;
    let tags = ['email', 'sendgrid', eventType];

    switch (eventType) {
      case 'delivered':
        title = `Email delivered to ${email}`;
        priority = 4;
        break;
      case 'bounce':
        title = `Email bounced for ${email}`;
        priority = 2;
        tags.push('bounce');
        break;
      case 'dropped':
        title = `Email dropped for ${email}`;
        priority = 2;
        tags.push('dropped');
        break;
      case 'spam':
        title = `Email marked as spam by ${email}`;
        priority = 2;
        tags.push('spam');
        break;
      case 'unsubscribe':
        title = `${email} unsubscribed`;
        priority = 3;
        tags.push('unsubscribe');
        break;
      default:
        title = `Email event: ${eventType} for ${email}`;
    }

    const result: RawNotificationPayload = {
      title,
      source: 'email',
      content: this.formatSendGridContent(event),
      priority,
      tags,
      metadata: {
        provider: 'sendgrid',
        event: eventType,
        email,
        timestamp,
        sgEventId: this.get(event, 'sg_event_id'),
        sgMessageId: this.get(event, 'sg_message_id')
      },
      _original: payload
    };

    return this.success(result, 0.90);
  }

  private handleMailgunWebhook(payload: any): TransformerResult {
    const eventData = payload['event-data'];
    const eventType = this.get(eventData, 'event', 'unknown');
    const recipient = this.get(eventData, 'recipient', 'Unknown Recipient');
    const timestamp = this.parseDate(this.get(eventData, 'timestamp'));

    let title: string;
    let priority: 1 | 2 | 3 | 4 | 5 = 3;
    let tags = ['email', 'mailgun', eventType];

    switch (eventType) {
      case 'delivered':
        title = `Email delivered to ${recipient}`;
        priority = 4;
        break;
      case 'bounced':
        title = `Email bounced for ${recipient}`;
        priority = 2;
        tags.push('bounce');
        break;
      case 'failed':
        title = `Email failed for ${recipient}`;
        priority = 1;
        tags.push('failed');
        break;
      case 'complained':
        title = `Spam complaint from ${recipient}`;
        priority = 2;
        tags.push('spam');
        break;
      case 'unsubscribed':
        title = `${recipient} unsubscribed`;
        priority = 3;
        tags.push('unsubscribe');
        break;
      default:
        title = `Email event: ${eventType} for ${recipient}`;
    }

    const result: RawNotificationPayload = {
      title,
      source: 'email',
      content: this.formatMailgunContent(eventData),
      priority,
      tags,
      metadata: {
        provider: 'mailgun',
        event: eventType,
        recipient,
        timestamp,
        messageId: this.get(eventData, 'message.headers.message-id'),
        subject: this.get(eventData, 'message.headers.subject')
      },
      _original: payload
    };

    return this.success(result, 0.90);
  }

  private handleAmazonSES(payload: any): TransformerResult {
    try {
      const message = JSON.parse(payload.Message);
      const eventType = this.get(message, 'eventType', 'unknown');
      
      if (eventType === 'send') {
        return this.handleSESMailEvent(message);
      } else if (eventType === 'bounce' || eventType === 'complaint') {
        return this.handleSESBounceEvent(message);
      }

      // Fallback for unknown SES events
      const result: RawNotificationPayload = {
        title: `Amazon SES: ${eventType}`,
        source: 'email',
        content: JSON.stringify(message, null, 2),
        priority: 3,
        tags: ['email', 'ses', eventType],
        metadata: {
          provider: 'ses',
          event: eventType
        },
        _original: payload
      };

      return this.success(result, 0.75);
    } catch (error) {
      return this.failure(`Failed to parse Amazon SES message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleSESMailEvent(message: any): TransformerResult {
    const mail = this.get(message, 'mail', {});
    const destination = this.get(mail, 'destination', []).join(', ');
    const subject = this.get(mail, 'commonHeaders.subject', 'No Subject');

    const result: RawNotificationPayload = {
      title: `Email sent: ${subject}`,
      source: 'email',
      content: `Email sent to: ${destination}`,
      priority: 4,
      tags: ['email', 'ses', 'sent'],
      metadata: {
        provider: 'ses',
        event: 'send',
        messageId: this.get(mail, 'messageId'),
        timestamp: this.parseDate(this.get(mail, 'timestamp')),
        subject,
        destination
      },
      _original: message
    };

    return this.success(result, 0.85);
  }

  private handleSESBounceEvent(message: any): TransformerResult {
    const bounce = this.get(message, 'bounce', {});
    const mail = this.get(message, 'mail', {});
    const bounceType = this.get(bounce, 'bounceType', 'unknown');
    const bounceSubType = this.get(bounce, 'bounceSubType', '');
    const bouncedRecipients = this.get(bounce, 'bouncedRecipients', []);

    const recipients = bouncedRecipients.map((r: any) => r.emailAddress).join(', ');

    const result: RawNotificationPayload = {
      title: `Email bounced: ${bounceType}${bounceSubType ? ` (${bounceSubType})` : ''}`,
      source: 'email',
      content: `Bounced recipients: ${recipients}`,
      priority: bounceType === 'Permanent' ? 1 : 2,
      tags: ['email', 'ses', 'bounce', bounceType.toLowerCase()],
      metadata: {
        provider: 'ses',
        event: 'bounce',
        bounceType,
        bounceSubType,
        messageId: this.get(mail, 'messageId'),
        timestamp: this.parseDate(this.get(bounce, 'timestamp')),
        recipients: bouncedRecipients
      },
      _original: message
    };

    return this.success(result, 0.90);
  }

  private formatEmailContent(from: string, to: string, body: string): string {
    let content = `From: ${from}\nTo: ${to}`;
    
    if (body) {
      const cleanBody = body.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
      const truncatedBody = cleanBody.length > 300 ? cleanBody.slice(0, 300) + '...' : cleanBody;
      content += `\n\n${truncatedBody}`;
    }

    return content;
  }

  private formatSendGridContent(event: any): string {
    const reason = this.get(event, 'reason', '');
    const response = this.get(event, 'response', '');
    const url = this.get(event, 'url', '');

    let content = '';
    if (reason) content += `Reason: ${reason}\n`;
    if (response) content += `Response: ${response}\n`;
    if (url) content += `URL: ${url}\n`;

    return content.trim();
  }

  private formatMailgunContent(eventData: any): string {
    const reason = this.get(eventData, 'reason', '');
    const description = this.get(eventData, 'delivery-status.description', '');
    const code = this.get(eventData, 'delivery-status.code', '');

    let content = '';
    if (reason) content += `Reason: ${reason}\n`;
    if (description) content += `Description: ${description}\n`;
    if (code) content += `Code: ${code}\n`;

    return content.trim();
  }

  private getEmailPriority(payload: any): 1 | 2 | 3 | 4 | 5 {
    const priority = this.get(payload, 'priority') || this.get(payload, 'headers.priority');
    const importance = this.get(payload, 'importance') || this.get(payload, 'headers.importance');

    if (priority === 'urgent' || importance === 'high') return 1;
    if (priority === 'high') return 2;
    if (priority === 'low' || importance === 'low') return 4;

    return 3; // Default medium priority
  }

  private extractEmailTags(payload: any): string[] {
    const tags: string[] = [];
    
    const subject = this.get(payload, 'subject') || this.get(payload, 'headers.subject', '');
    if (subject.toLowerCase().includes('urgent')) tags.push('urgent');
    if (subject.toLowerCase().includes('security')) tags.push('security');
    if (subject.toLowerCase().includes('alert')) tags.push('alert');

    return tags;
  }

  private getEmailActions(payload: any): any[] {
    const actions: any[] = [];
    
    // Add reply action if we have a reply-to address
    const replyTo = this.get(payload, 'replyTo') || this.get(payload, 'headers.reply-to');
    if (replyTo) {
      actions.push({
        id: 'reply',
        label: 'Reply',
        type: 'url',
        url: `mailto:${replyTo}`,
        variant: 'primary'
      });
    }

    return actions;
  }
}