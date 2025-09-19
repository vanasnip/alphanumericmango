/**
 * IPC Protocol Versioning and Negotiation System
 * Handles backward compatibility and protocol evolution
 */

import * as semver from 'semver';

export interface IPCMessage {
  version: string;        // e.g., "2.0.0"
  messageId: string;      // UUID for request tracking
  timestamp: number;      // Unix timestamp
  type: MessageType;      // request | response | event | error
  payload: any;          // Message-specific data
  metadata?: {           // Optional metadata
    correlationId?: string;
    retryCount?: number;
    priority?: 'low' | 'normal' | 'high';
    workerId?: string;
  };
}

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

export interface ProtocolCapabilities {
  version: string;
  features: string[];
  backwardCompatible: string[];
  deprecated?: string[];
}

export interface VersionRange {
  min: string;
  max: string;
  preferred?: string;
}

export class ProtocolNegotiator {
  private supportedVersions: string[] = ['1.0.0', '2.0.0'];
  private currentVersion: string = '2.0.0';
  private capabilities: Map<string, ProtocolCapabilities> = new Map();
  
  constructor() {
    this.initializeCapabilities();
  }
  
  /**
   * Initialize protocol capabilities for each version
   */
  private initializeCapabilities(): void {
    // Version 1.0.0 - Legacy protocol
    this.capabilities.set('1.0.0', {
      version: '1.0.0',
      features: [
        'basic_synthesis',
        'model_switching',
        'simple_error_handling'
      ],
      backwardCompatible: []
    });
    
    // Version 2.0.0 - Enhanced protocol
    this.capabilities.set('2.0.0', {
      version: '2.0.0',
      features: [
        'basic_synthesis',
        'model_switching',
        'simple_error_handling',
        'message_correlation',
        'priority_queuing',
        'health_monitoring',
        'enhanced_error_handling',
        'worker_identification',
        'metrics_collection'
      ],
      backwardCompatible: ['1.0.0'],
      deprecated: []
    });
  }
  
  /**
   * Negotiate protocol version with client
   */
  async negotiateVersion(clientVersionRange: string | VersionRange): Promise<string> {
    let range: VersionRange;
    
    if (typeof clientVersionRange === 'string') {
      range = this.parseVersionString(clientVersionRange);
    } else {
      range = clientVersionRange;
    }
    
    // Find highest mutually supported version
    const compatibleVersions = this.supportedVersions.filter(version => 
      this.isVersionInRange(version, range)
    );
    
    if (compatibleVersions.length === 0) {
      throw new Error(`No compatible protocol version found. Client supports: ${JSON.stringify(range)}, Server supports: ${this.supportedVersions.join(', ')}`);
    }
    
    // Return highest compatible version or preferred if specified
    const negotiatedVersion = range.preferred && compatibleVersions.includes(range.preferred)
      ? range.preferred
      : compatibleVersions[compatibleVersions.length - 1];
    
    console.log(`Protocol negotiated: ${negotiatedVersion} (client requested: ${JSON.stringify(range)})`);
    return negotiatedVersion;
  }
  
  /**
   * Parse version string into range object
   */
  private parseVersionString(versionString: string): VersionRange {
    // Handle simple version (e.g., "2.0.0")
    if (semver.valid(versionString)) {
      return {
        min: versionString,
        max: versionString,
        preferred: versionString
      };
    }
    
    // Handle range syntax (e.g., ">=1.0.0 <3.0.0")
    // This is a simplified parser - in production you'd use a proper semver range parser
    if (versionString.includes('>=') && versionString.includes('<')) {
      const parts = versionString.split(' ');
      const min = parts.find(p => p.startsWith('>='))?.substring(2);
      const max = parts.find(p => p.startsWith('<'))?.substring(1);
      
      if (min && max) {
        return { min, max };
      }
    }
    
    // Default to exact match
    return {
      min: versionString,
      max: versionString,
      preferred: versionString
    };
  }
  
  /**
   * Check if version is within range
   */
  private isVersionInRange(version: string, range: VersionRange): boolean {
    return semver.gte(version, range.min) && semver.lte(version, range.max);
  }
  
  /**
   * Create protocol message with appropriate version
   */
  createMessage(
    type: MessageType,
    payload: any,
    targetVersion: string = this.currentVersion,
    metadata?: any
  ): IPCMessage {
    const message: IPCMessage = {
      version: targetVersion,
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      type,
      payload: this.adaptPayload(payload, targetVersion),
      metadata
    };
    
    return message;
  }
  
  /**
   * Adapt message payload for target version
   */
  private adaptPayload(payload: any, targetVersion: string): any {
    const adapter = new ProtocolAdapter();
    return adapter.adaptToVersion(payload, targetVersion);
  }
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Parse incoming message and validate version
   */
  parseMessage(messageData: string): IPCMessage {
    try {
      const message = JSON.parse(messageData) as IPCMessage;
      
      // Validate message structure
      this.validateMessage(message);
      
      return message;
    } catch (error) {
      throw new Error(`Failed to parse IPC message: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Validate message structure
   */
  private validateMessage(message: any): void {
    if (!message.version) {
      throw new Error('Message missing version field');
    }
    
    if (!this.isSupportedVersion(message.version)) {
      throw new Error(`Unsupported protocol version: ${message.version}`);
    }
    
    if (!message.messageId) {
      throw new Error('Message missing messageId field');
    }
    
    if (!message.type || !Object.values(MessageType).includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
    
    if (message.payload === undefined) {
      throw new Error('Message missing payload field');
    }
  }
  
  /**
   * Check if version is supported
   */
  isSupportedVersion(version: string): boolean {
    return this.supportedVersions.includes(version);
  }
  
  /**
   * Get capabilities for a specific version
   */
  getCapabilities(version: string): ProtocolCapabilities | null {
    return this.capabilities.get(version) || null;
  }
  
  /**
   * Get all supported versions
   */
  getSupportedVersions(): string[] {
    return [...this.supportedVersions];
  }
  
  /**
   * Get current default version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }
  
  /**
   * Check if feature is supported in version
   */
  isFeatureSupported(feature: string, version: string): boolean {
    const capabilities = this.getCapabilities(version);
    return capabilities?.features.includes(feature) || false;
  }
}

/**
 * Protocol Adapter for backward compatibility
 */
export class ProtocolAdapter {
  /**
   * Adapt payload to target version
   */
  adaptToVersion(payload: any, targetVersion: string): any {
    switch (targetVersion) {
      case '1.0.0':
        return this.adaptToV1(payload);
      case '2.0.0':
        return this.adaptToV2(payload);
      default:
        throw new Error(`Unsupported target version: ${targetVersion}`);
    }
  }
  
  /**
   * Adapt to version 1.0.0 format
   */
  private adaptToV1(payload: any): any {
    // V1.0 expects simple structure without metadata
    if (payload.type && payload.data) {
      return {
        type: payload.type,
        ...payload.data
      };
    }
    
    return payload;
  }
  
  /**
   * Adapt to version 2.0.0 format
   */
  private adaptToV2(payload: any): any {
    // V2.0 supports full structure
    return payload;
  }
  
  /**
   * Convert V1 message to V2 format
   */
  upgradeV1ToV2(v1Message: any): IPCMessage {
    return {
      version: '2.0.0',
      messageId: `upgraded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: this.inferMessageType(v1Message),
      payload: v1Message,
      metadata: {
        upgradedFrom: '1.0.0'
      }
    };
  }
  
  /**
   * Infer message type from V1 message
   */
  private inferMessageType(v1Message: any): MessageType {
    if (v1Message.type === 'synthesize') {
      return MessageType.REQUEST;
    }
    if (v1Message.status) {
      return MessageType.RESPONSE;
    }
    if (v1Message.error) {
      return MessageType.ERROR;
    }
    
    return MessageType.EVENT;
  }
}

/**
 * Backward Compatibility Layer for existing clients
 */
export class BackwardCompatibilityLayer {
  private protocolNegotiator: ProtocolNegotiator;
  private adapter: ProtocolAdapter;
  
  constructor() {
    this.protocolNegotiator = new ProtocolNegotiator();
    this.adapter = new ProtocolAdapter();
  }
  
  /**
   * Handle legacy JSON message (V1.0 format)
   */
  handleLegacyMessage(legacyData: string): IPCMessage {
    try {
      const legacyMessage = JSON.parse(legacyData);
      
      // Check if it's already a V2 message
      if (legacyMessage.version) {
        return this.protocolNegotiator.parseMessage(legacyData);
      }
      
      // Convert V1 to V2
      return this.adapter.upgradeV1ToV2(legacyMessage);
    } catch (error) {
      throw new Error(`Failed to handle legacy message: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Send response in client's preferred format
   */
  createResponse(
    originalMessage: IPCMessage,
    responsePayload: any
  ): string {
    const responseMessage = this.protocolNegotiator.createMessage(
      MessageType.RESPONSE,
      responsePayload,
      originalMessage.version,
      {
        correlationId: originalMessage.messageId
      }
    );
    
    // If client is using V1, downgrade the response
    if (originalMessage.version === '1.0.0') {
      const v1Response = this.adapter.adaptToVersion(responsePayload, '1.0.0');
      return JSON.stringify(v1Response);
    }
    
    return JSON.stringify(responseMessage);
  }
}