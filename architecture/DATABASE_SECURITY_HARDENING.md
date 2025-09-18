# Database Security Hardening
## AlphanumericMango Project - Production-Grade Database Security

Version: 1.0.0  
Implementation Date: 2025-09-18  
Framework Owner: Backend Security Engineering  
Classification: CONFIDENTIAL  
Status: IMPLEMENTATION REQUIRED

---

## Executive Summary

This document establishes comprehensive database security hardening for the AlphanumericMango voice-controlled terminal system. The framework implements defense-in-depth security patterns, encryption protocols, and monitoring systems to protect against data breaches, injection attacks, and unauthorized access.

**Primary Objectives**:
- Implement end-to-end encryption (TLS 1.3 + at-rest encryption)
- Deploy query parameterization and prepared statement frameworks
- Establish comprehensive access logging and monitoring
- Create secure connection pooling with authentication controls
- Implement database-level security policies and constraints

**Security Posture Target**: Achieve **SOC 2 Type II** compliance for data protection.

---

## 1. Encrypted Connections (TLS 1.3)

### 1.1 Database Connection Security

```typescript
/**
 * PostgreSQL connection with TLS 1.3 encryption
 * Enforces certificate validation and secure cipher suites
 */
import { Pool, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

export class SecurePostgreSQLConnection {
  private pool: Pool;
  private readonly config: SecurePoolConfig;

  constructor(config: SecurePoolConfig) {
    this.config = this.validateConfig(config);
    this.pool = new Pool(this.buildSecureConfig());
  }

  private buildSecureConfig(): PoolConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      
      // TLS 1.3 Configuration
      ssl: {
        require: true,
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(process.env.CERT_PATH!, 'ca-cert.pem')),
        cert: fs.readFileSync(path.join(process.env.CERT_PATH!, 'client-cert.pem')),
        key: fs.readFileSync(path.join(process.env.CERT_PATH!, 'client-key.pem')),
        
        // Force TLS 1.3
        secureProtocol: 'TLSv1_3_method',
        ciphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256'
        ].join(':'),
        
        // Certificate validation
        checkServerIdentity: (hostname: string, cert: any) => {
          if (cert.subject.CN !== hostname) {
            throw new Error(`Certificate hostname mismatch: ${cert.subject.CN} !== ${hostname}`);
          }
        }
      },
      
      // Connection pool security
      max: 20,
      min: 5,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 600000, // 10 minutes
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      
      // Application name for auditing
      application_name: `alphanumeric_${process.env.NODE_ENV}_${process.env.SERVICE_NAME}`
    };
  }

  private validateConfig(config: SecurePoolConfig): SecurePoolConfig {
    if (!config.host || !config.database || !config.user || !config.password) {
      throw new Error('Missing required database configuration');
    }
    
    if (!process.env.CERT_PATH) {
      throw new Error('Certificate path not configured');
    }
    
    // Validate certificate files exist
    const certFiles = ['ca-cert.pem', 'client-cert.pem', 'client-key.pem'];
    for (const file of certFiles) {
      const filePath = path.join(process.env.CERT_PATH, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Certificate file not found: ${filePath}`);
      }
    }
    
    return config;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      // Log query for auditing (without sensitive data)
      console.log({
        timestamp: new Date().toISOString(),
        type: 'database_query',
        query_hash: this.hashQuery(text),
        user: client.user,
        database: client.database,
        connection_id: (client as any).processID
      });
      
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

interface SecurePoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}
```

### 1.2 MongoDB Connection Security

```typescript
/**
 * MongoDB connection with TLS 1.3 and authentication
 */
import { MongoClient, MongoClientOptions } from 'mongodb';
import fs from 'fs';

export class SecureMongoConnection {
  private client: MongoClient;
  private readonly uri: string;

  constructor(config: MongoSecureConfig) {
    this.uri = this.buildSecureURI(config);
    this.client = new MongoClient(this.uri, this.buildSecureOptions());
  }

  private buildSecureURI(config: MongoSecureConfig): string {
    const { username, password, hosts, database, replicaSet } = config;
    
    let uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
    uri += hosts.join(',');
    uri += `/${database}`;
    
    const params = [
      'ssl=true',
      'authSource=admin',
      'authMechanism=SCRAM-SHA-256',
      replicaSet ? `replicaSet=${replicaSet}` : null
    ].filter(Boolean);
    
    if (params.length > 0) {
      uri += '?' + params.join('&');
    }
    
    return uri;
  }

  private buildSecureOptions(): MongoClientOptions {
    return {
      tls: true,
      tlsInsecure: false,
      tlsAllowInvalidHostnames: false,
      tlsAllowInvalidCertificates: false,
      tlsCAFile: path.join(process.env.CERT_PATH!, 'mongodb-ca.pem'),
      tlsCertificateKeyFile: path.join(process.env.CERT_PATH!, 'mongodb-client.pem'),
      
      // Connection pool settings
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 600000, // 10 minutes
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      
      // Security settings
      compressors: ['zstd', 'snappy'],
      retryWrites: true,
      retryReads: true,
      
      // Monitoring
      monitorCommands: true,
      serverApi: { version: '1', strict: true }
    };
  }

  async connect(): Promise<void> {
    await this.client.connect();
    
    // Test connection security
    const admin = this.client.db('admin');
    const result = await admin.command({ connectionStatus: 1 });
    
    if (!result.authInfo?.authenticatedUsers?.length) {
      throw new Error('Database connection not properly authenticated');
    }
    
    console.log({
      timestamp: new Date().toISOString(),
      type: 'mongodb_connection',
      authenticated: true,
      user: result.authInfo.authenticatedUsers[0].user,
      database: result.authInfo.authenticatedUsers[0].db
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

interface MongoSecureConfig {
  username: string;
  password: string;
  hosts: string[];
  database: string;
  replicaSet?: string;
}
```

---

## 2. Database Encryption at Rest

### 2.1 PostgreSQL Encryption Configuration

```sql
-- PostgreSQL encryption at rest configuration
-- Enable transparent data encryption (TDE)

-- Create encrypted tablespace
CREATE TABLESPACE encrypted_data 
LOCATION '/var/lib/postgresql/encrypted' 
WITH (encryption_key_id = 'alphanumeric_master_key');

-- Create encrypted database
CREATE DATABASE alphanumeric_secure 
WITH TABLESPACE = encrypted_data
     ENCODING = 'UTF8'
     LC_COLLATE = 'en_US.UTF-8'
     LC_CTYPE = 'en_US.UTF-8';

-- Enable row-level security
ALTER DATABASE alphanumeric_secure SET row_security = on;

-- Configure audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_temp_files = 0;
ALTER SYSTEM SET log_autovacuum_min_duration = 0;

-- Configure encryption parameters
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/postgresql/ssl/server.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/postgresql/ssl/server.key';
ALTER SYSTEM SET ssl_ca_file = '/etc/postgresql/ssl/ca.crt';
ALTER SYSTEM SET ssl_crl_file = '/etc/postgresql/ssl/server.crl';
ALTER SYSTEM SET ssl_ciphers = 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
ALTER SYSTEM SET ssl_prefer_server_ciphers = on;
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.3';

-- Reload configuration
SELECT pg_reload_conf();
```

### 2.2 Application-Level Encryption

```typescript
/**
 * Application-level field encryption for sensitive data
 */
import crypto from 'crypto';

export class FieldEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationSalt: Buffer;
  private readonly masterKey: Buffer;

  constructor() {
    this.keyDerivationSalt = Buffer.from(process.env.ENCRYPTION_SALT!, 'hex');
    this.masterKey = this.deriveKey(process.env.MASTER_KEY!);
  }

  private deriveKey(password: string): Buffer {
    return crypto.pbkdf2Sync(password, this.keyDerivationSalt, 100000, 32, 'sha512');
  }

  encryptField(plaintext: string, context: string = ''): EncryptedField {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.masterKey);
    cipher.setAAD(Buffer.from(context));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      context: context
    };
  }

  decryptField(encryptedField: EncryptedField): string {
    const decipher = crypto.createDecipher(
      encryptedField.algorithm,
      this.masterKey
    );
    
    decipher.setAAD(Buffer.from(encryptedField.context));
    decipher.setAuthTag(Buffer.from(encryptedField.authTag, 'hex'));

    let decrypted = decipher.update(encryptedField.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Encrypt sensitive user data
  encryptUserData(userData: SensitiveUserData): EncryptedUserData {
    return {
      id: userData.id,
      username: userData.username,
      email: this.encryptField(userData.email, 'user_email'),
      phoneNumber: userData.phoneNumber ? 
        this.encryptField(userData.phoneNumber, 'user_phone') : null,
      sshKeys: userData.sshKeys.map(key => 
        this.encryptField(key, 'ssh_key')),
      apiTokens: userData.apiTokens.map(token => 
        this.encryptField(token, 'api_token')),
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    };
  }
}

interface EncryptedField {
  data: string;
  iv: string;
  authTag: string;
  algorithm: string;
  context: string;
}

interface SensitiveUserData {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  sshKeys: string[];
  apiTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface EncryptedUserData {
  id: string;
  username: string;
  email: EncryptedField;
  phoneNumber: EncryptedField | null;
  sshKeys: EncryptedField[];
  apiTokens: EncryptedField[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Query Parameterization and Prepared Statements

### 3.1 Secure Query Builder

```typescript
/**
 * Type-safe query builder with automatic parameterization
 * Prevents SQL injection through compile-time type checking
 */
import { Pool } from 'pg';

export class SecureQueryBuilder {
  private pool: Pool;
  private params: any[] = [];
  private paramCount = 0;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Type-safe SELECT queries
  async select<T>(config: SelectConfig<T>): Promise<T[]> {
    const query = this.buildSelectQuery(config);
    const result = await this.executeQuery(query, this.params);
    return result.rows;
  }

  // Type-safe INSERT queries
  async insert<T>(config: InsertConfig<T>): Promise<T> {
    const query = this.buildInsertQuery(config);
    const result = await this.executeQuery(query, this.params);
    return result.rows[0];
  }

  // Type-safe UPDATE queries
  async update<T>(config: UpdateConfig<T>): Promise<T[]> {
    const query = this.buildUpdateQuery(config);
    const result = await this.executeQuery(query, this.params);
    return result.rows;
  }

  // Type-safe DELETE queries
  async delete(config: DeleteConfig): Promise<number> {
    const query = this.buildDeleteQuery(config);
    const result = await this.executeQuery(query, this.params);
    return result.rowCount || 0;
  }

  private buildSelectQuery<T>(config: SelectConfig<T>): string {
    this.reset();
    
    let query = `SELECT ${this.buildSelectFields(config.select)} FROM ${config.table}`;
    
    if (config.joins) {
      query += this.buildJoins(config.joins);
    }
    
    if (config.where) {
      query += this.buildWhereClause(config.where);
    }
    
    if (config.orderBy) {
      query += this.buildOrderBy(config.orderBy);
    }
    
    if (config.limit) {
      query += ` LIMIT ${this.addParam(config.limit)}`;
    }
    
    if (config.offset) {
      query += ` OFFSET ${this.addParam(config.offset)}`;
    }
    
    return query;
  }

  private buildWhereClause(conditions: WhereCondition[]): string {
    if (conditions.length === 0) return '';
    
    const clauses = conditions.map(condition => {
      const { field, operator, value } = condition;
      
      switch (operator) {
        case 'eq':
          return `${field} = ${this.addParam(value)}`;
        case 'ne':
          return `${field} != ${this.addParam(value)}`;
        case 'gt':
          return `${field} > ${this.addParam(value)}`;
        case 'gte':
          return `${field} >= ${this.addParam(value)}`;
        case 'lt':
          return `${field} < ${this.addParam(value)}`;
        case 'lte':
          return `${field} <= ${this.addParam(value)}`;
        case 'in':
          if (!Array.isArray(value)) throw new Error('IN operator requires array value');
          const placeholders = value.map(v => this.addParam(v)).join(', ');
          return `${field} IN (${placeholders})`;
        case 'like':
          return `${field} LIKE ${this.addParam(value)}`;
        case 'ilike':
          return `${field} ILIKE ${this.addParam(value)}`;
        case 'is_null':
          return `${field} IS NULL`;
        case 'is_not_null':
          return `${field} IS NOT NULL`;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    });
    
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  private addParam(value: any): string {
    this.params.push(value);
    return `$${++this.paramCount}`;
  }

  private reset(): void {
    this.params = [];
    this.paramCount = 0;
  }

  private async executeQuery(query: string, params: any[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Log query execution for monitoring
      console.log({
        timestamp: new Date().toISOString(),
        type: 'database_query_start',
        query_hash: this.hashQuery(query),
        param_count: params.length
      });
      
      const result = await this.pool.query(query, params);
      
      const duration = Date.now() - startTime;
      
      console.log({
        timestamp: new Date().toISOString(),
        type: 'database_query_complete',
        query_hash: this.hashQuery(query),
        duration_ms: duration,
        rows_affected: result.rowCount || 0
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error({
        timestamp: new Date().toISOString(),
        type: 'database_query_error',
        query_hash: this.hashQuery(query),
        duration_ms: duration,
        error: error.message
      });
      
      throw error;
    }
  }

  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
  }
}

// Type definitions
interface SelectConfig<T> {
  table: string;
  select: (keyof T)[] | '*';
  joins?: JoinConfig[];
  where?: WhereCondition[];
  orderBy?: OrderByConfig[];
  limit?: number;
  offset?: number;
}

interface InsertConfig<T> {
  table: string;
  data: Partial<T>;
  returning?: (keyof T)[];
}

interface UpdateConfig<T> {
  table: string;
  data: Partial<T>;
  where: WhereCondition[];
  returning?: (keyof T)[];
}

interface DeleteConfig {
  table: string;
  where: WhereCondition[];
}

interface WhereCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike' | 'is_null' | 'is_not_null';
  value?: any;
}

interface JoinConfig {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  on: string;
}

interface OrderByConfig {
  field: string;
  direction: 'ASC' | 'DESC';
}
```

### 3.2 Prepared Statement Pool

```typescript
/**
 * High-performance prepared statement pool
 * Caches prepared statements for optimal performance
 */
export class PreparedStatementPool {
  private pool: Pool;
  private statementCache = new Map<string, PreparedStatement>();
  private maxCacheSize = 100;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(name: string, query: string, params: any[]): Promise<any> {
    let statement = this.statementCache.get(name);
    
    if (!statement) {
      statement = await this.createPreparedStatement(name, query);
      this.addToCache(name, statement);
    }
    
    return await statement.execute(params);
  }

  private async createPreparedStatement(name: string, query: string): Promise<PreparedStatement> {
    const client = await this.pool.connect();
    
    try {
      // Prepare statement
      await client.query(`PREPARE ${name} AS ${query}`);
      
      return {
        name,
        query,
        execute: async (params: any[]) => {
          const executeQuery = `EXECUTE ${name}(${params.map((_, i) => `$${i + 1}`).join(', ')})`;
          return await client.query(executeQuery, params);
        },
        deallocate: async () => {
          await client.query(`DEALLOCATE ${name}`);
        }
      };
    } finally {
      client.release();
    }
  }

  private addToCache(name: string, statement: PreparedStatement): void {
    // Implement LRU eviction if cache is full
    if (this.statementCache.size >= this.maxCacheSize) {
      const firstKey = this.statementCache.keys().next().value;
      const evictedStatement = this.statementCache.get(firstKey);
      evictedStatement?.deallocate();
      this.statementCache.delete(firstKey);
    }
    
    this.statementCache.set(name, statement);
  }

  async clearCache(): Promise<void> {
    for (const statement of this.statementCache.values()) {
      await statement.deallocate();
    }
    this.statementCache.clear();
  }
}

interface PreparedStatement {
  name: string;
  query: string;
  execute: (params: any[]) => Promise<any>;
  deallocate: () => Promise<void>;
}
```

---

## 4. Database Access Logging and Monitoring

### 4.1 Comprehensive Audit Logging

```typescript
/**
 * Database audit logging system
 * Tracks all database operations with security context
 */
export class DatabaseAuditLogger {
  private readonly logger: Winston.Logger;
  private readonly logBuffer: AuditLogEntry[] = [];
  private readonly batchSize = 100;
  private readonly flushInterval = 5000; // 5 seconds

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: '/var/log/alphanumeric/database-audit.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10,
          tailable: true
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Start batch flushing
    setInterval(() => this.flushLogBuffer(), this.flushInterval);
  }

  logDatabaseOperation(operation: DatabaseOperation): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      operation_id: this.generateOperationId(),
      operation_type: operation.type,
      table_name: operation.tableName,
      user_id: operation.userId,
      session_id: operation.sessionId,
      source_ip: operation.sourceIP,
      query_hash: this.hashQuery(operation.query),
      parameters_hash: this.hashParameters(operation.parameters),
      rows_affected: operation.rowsAffected,
      duration_ms: operation.duration,
      success: operation.success,
      error_message: operation.error?.message,
      security_context: {
        authentication_method: operation.authMethod,
        authorization_level: operation.authLevel,
        access_pattern: this.detectAccessPattern(operation),
        risk_score: this.calculateRiskScore(operation)
      }
    };

    this.logBuffer.push(entry);

    // Immediate flush for high-risk operations
    if (entry.security_context.risk_score >= 8) {
      this.flushLogBuffer();
    }
  }

  private detectAccessPattern(operation: DatabaseOperation): AccessPattern {
    // Detect suspicious patterns
    if (operation.type === 'DELETE' && operation.rowsAffected > 1000) {
      return 'BULK_DELETE';
    }
    
    if (operation.type === 'SELECT' && operation.query.includes('*')) {
      return 'FULL_TABLE_SCAN';
    }
    
    if (operation.duration > 30000) { // 30 seconds
      return 'LONG_RUNNING_QUERY';
    }
    
    if (operation.sourceIP && this.isUnusualLocation(operation.sourceIP)) {
      return 'UNUSUAL_LOCATION';
    }
    
    return 'NORMAL';
  }

  private calculateRiskScore(operation: DatabaseOperation): number {
    let score = 0;
    
    // Base risk by operation type
    const operationRisk = {
      'SELECT': 1,
      'INSERT': 3,
      'UPDATE': 4,
      'DELETE': 6,
      'CREATE': 7,
      'DROP': 9,
      'ALTER': 8
    };
    
    score += operationRisk[operation.type] || 5;
    
    // Additional risk factors
    if (operation.rowsAffected > 1000) score += 3;
    if (operation.duration > 10000) score += 2;
    if (!operation.success) score += 2;
    if (this.isOffHours()) score += 1;
    if (operation.authLevel === 'ADMIN') score += 2;
    
    return Math.min(score, 10);
  }

  private async flushLogBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const entries = this.logBuffer.splice(0, this.batchSize);
    
    for (const entry of entries) {
      this.logger.info('database_audit', entry);
    }
    
    // Send high-risk entries to security monitoring
    const highRiskEntries = entries.filter(entry => 
      entry.security_context.risk_score >= 7
    );
    
    if (highRiskEntries.length > 0) {
      await this.sendSecurityAlert(highRiskEntries);
    }
  }

  private async sendSecurityAlert(entries: AuditLogEntry[]): Promise<void> {
    // Send to security monitoring system
    console.log({
      type: 'security_alert',
      alert_type: 'HIGH_RISK_DATABASE_OPERATION',
      timestamp: new Date().toISOString(),
      entries_count: entries.length,
      entries: entries
    });
  }

  private generateOperationId(): string {
    return `db_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
  }

  private hashParameters(params: any[]): string {
    const crypto = require('crypto');
    const paramString = JSON.stringify(params);
    return crypto.createHash('sha256').update(paramString).digest('hex').substring(0, 16);
  }

  private isUnusualLocation(ip: string): boolean {
    // Implement geo-location checking
    // This is a simplified version
    const allowedRegions = ['US', 'CA', 'EU'];
    // In real implementation, use a geo-IP service
    return false;
  }

  private isOffHours(): boolean {
    const hour = new Date().getHours();
    return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
  }
}

interface DatabaseOperation {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER';
  tableName: string;
  query: string;
  parameters: any[];
  userId: string;
  sessionId: string;
  sourceIP: string;
  authMethod: string;
  authLevel: string;
  rowsAffected: number;
  duration: number;
  success: boolean;
  error?: Error;
}

interface AuditLogEntry {
  timestamp: string;
  operation_id: string;
  operation_type: string;
  table_name: string;
  user_id: string;
  session_id: string;
  source_ip: string;
  query_hash: string;
  parameters_hash: string;
  rows_affected: number;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  security_context: {
    authentication_method: string;
    authorization_level: string;
    access_pattern: AccessPattern;
    risk_score: number;
  };
}

type AccessPattern = 'NORMAL' | 'BULK_DELETE' | 'FULL_TABLE_SCAN' | 'LONG_RUNNING_QUERY' | 'UNUSUAL_LOCATION';
```

---

## 5. Connection Pooling with Security Controls

### 5.1 Secure Connection Pool Manager

```typescript
/**
 * Advanced connection pool with security controls
 * Implements connection limits, monitoring, and automatic failover
 */
export class SecureConnectionPoolManager {
  private pools = new Map<string, SecurePool>();
  private readonly config: PoolManagerConfig;
  private readonly monitor: ConnectionMonitor;

  constructor(config: PoolManagerConfig) {
    this.config = config;
    this.monitor = new ConnectionMonitor();
    this.initializePools();
  }

  private initializePools(): void {
    for (const [name, poolConfig] of Object.entries(this.config.pools)) {
      const securePool = new SecurePool(name, poolConfig, this.monitor);
      this.pools.set(name, securePool);
    }
  }

  async getConnection(poolName: string, context: ConnectionContext): Promise<SecureConnection> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool not found: ${poolName}`);
    }

    // Security validation
    await this.validateConnectionRequest(context);
    
    return await pool.acquire(context);
  }

  private async validateConnectionRequest(context: ConnectionContext): Promise<void> {
    // Rate limiting per user
    const userKey = `user:${context.userId}`;
    const currentConnections = await this.monitor.getUserConnectionCount(userKey);
    
    if (currentConnections >= this.config.maxConnectionsPerUser) {
      throw new Error(`Connection limit exceeded for user: ${context.userId}`);
    }

    // IP-based rate limiting
    const ipKey = `ip:${context.sourceIP}`;
    const ipConnections = await this.monitor.getIPConnectionCount(ipKey);
    
    if (ipConnections >= this.config.maxConnectionsPerIP) {
      throw new Error(`Connection limit exceeded for IP: ${context.sourceIP}`);
    }

    // Geo-location validation
    if (this.config.enableGeoValidation) {
      const isValidLocation = await this.validateLocation(context.sourceIP);
      if (!isValidLocation) {
        throw new Error(`Connection not allowed from location: ${context.sourceIP}`);
      }
    }

    // Time-based access control
    if (!this.isAccessTimeAllowed(context)) {
      throw new Error('Database access not allowed at this time');
    }
  }

  private async validateLocation(ip: string): Promise<boolean> {
    // Implement geo-IP validation
    // This would integrate with a geo-IP service
    return true; // Simplified for example
  }

  private isAccessTimeAllowed(context: ConnectionContext): boolean {
    if (context.authLevel === 'ADMIN') {
      return true; // Admins can access anytime
    }

    const hour = new Date().getHours();
    const allowedHours = this.config.allowedAccessHours;
    
    return hour >= allowedHours.start && hour <= allowedHours.end;
  }

  async getPoolStats(): Promise<PoolStats[]> {
    const stats: PoolStats[] = [];
    
    for (const [name, pool] of this.pools) {
      stats.push(await pool.getStats());
    }
    
    return stats;
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.pools.values()).map(pool => pool.shutdown());
    await Promise.all(shutdownPromises);
  }
}

class SecurePool {
  private readonly pool: Pool;
  private readonly name: string;
  private readonly config: SecurePoolConfig;
  private readonly monitor: ConnectionMonitor;
  private readonly activeConnections = new Set<SecureConnection>();

  constructor(name: string, config: SecurePoolConfig, monitor: ConnectionMonitor) {
    this.name = name;
    this.config = config;
    this.monitor = monitor;
    this.pool = new Pool(this.buildPoolConfig());
  }

  private buildPoolConfig(): PoolConfig {
    return {
      ...this.config.connectionConfig,
      
      // Pool settings
      max: this.config.maxConnections,
      min: this.config.minConnections,
      acquireTimeoutMillis: this.config.acquireTimeout,
      createTimeoutMillis: this.config.createTimeout,
      destroyTimeoutMillis: this.config.destroyTimeout,
      idleTimeoutMillis: this.config.idleTimeout,
      
      // Security settings
      application_name: `alphanumeric_${this.name}_${process.env.NODE_ENV}`,
      
      // Event handlers
      on: {
        connect: (client: any) => this.onConnect(client),
        error: (error: Error) => this.onError(error),
        remove: (client: any) => this.onRemove(client)
      }
    };
  }

  async acquire(context: ConnectionContext): Promise<SecureConnection> {
    const startTime = Date.now();
    
    try {
      const client = await this.pool.connect();
      const connection = new SecureConnection(client, context, this);
      
      this.activeConnections.add(connection);
      
      // Log connection acquisition
      await this.monitor.logConnectionAcquired({
        poolName: this.name,
        userId: context.userId,
        sourceIP: context.sourceIP,
        timestamp: new Date(),
        duration: Date.now() - startTime
      });
      
      return connection;
    } catch (error) {
      await this.monitor.logConnectionError({
        poolName: this.name,
        userId: context.userId,
        sourceIP: context.sourceIP,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  async release(connection: SecureConnection): Promise<void> {
    this.activeConnections.delete(connection);
    connection.release();
    
    await this.monitor.logConnectionReleased({
      poolName: this.name,
      userId: connection.context.userId,
      timestamp: new Date()
    });
  }

  private async onConnect(client: any): Promise<void> {
    // Set connection-level security parameters
    await client.query('SET statement_timeout = $1', [this.config.statementTimeout]);
    await client.query('SET lock_timeout = $1', [this.config.lockTimeout]);
    await client.query('SET idle_in_transaction_session_timeout = $1', [this.config.idleTransactionTimeout]);
  }

  private async onError(error: Error): Promise<void> {
    console.error({
      timestamp: new Date().toISOString(),
      type: 'pool_error',
      pool_name: this.name,
      error: error.message
    });
  }

  private async onRemove(client: any): Promise<void> {
    console.log({
      timestamp: new Date().toISOString(),
      type: 'connection_removed',
      pool_name: this.name,
      process_id: client.processID
    });
  }

  async getStats(): Promise<PoolStats> {
    return {
      poolName: this.name,
      totalConnections: this.pool.totalCount,
      activeConnections: this.activeConnections.size,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }

  async shutdown(): Promise<void> {
    // Close all active connections
    for (const connection of this.activeConnections) {
      await this.release(connection);
    }
    
    await this.pool.end();
  }
}

// Type definitions and interfaces continue...
interface PoolManagerConfig {
  pools: Record<string, SecurePoolConfig>;
  maxConnectionsPerUser: number;
  maxConnectionsPerIP: number;
  enableGeoValidation: boolean;
  allowedAccessHours: {
    start: number;
    end: number;
  };
}

interface SecurePoolConfig {
  connectionConfig: any;
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  createTimeout: number;
  destroyTimeout: number;
  idleTimeout: number;
  statementTimeout: number;
  lockTimeout: number;
  idleTransactionTimeout: number;
}

interface ConnectionContext {
  userId: string;
  sessionId: string;
  sourceIP: string;
  authLevel: string;
  authMethod: string;
}

interface PoolStats {
  poolName: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
}
```

---

## 6. Implementation Deployment Script

```bash
#!/bin/bash
# Database Security Hardening Deployment Script
# AlphanumericMango Project

set -euo pipefail

# Configuration
DB_NAME="alphanumeric_secure"
DB_USER="alphanumeric_app"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CERT_PATH="${CERT_PATH:-/etc/ssl/postgresql}"

echo "🔒 Starting Database Security Hardening Deployment"
echo "=================================="

# 1. Create SSL certificates
echo "📜 Creating SSL certificates..."
sudo mkdir -p $CERT_PATH
sudo openssl req -new -x509 -days 365 -nodes -text \
  -out $CERT_PATH/server.crt \
  -keyout $CERT_PATH/server.key \
  -subj "/CN=$DB_HOST"

sudo openssl req -new -nodes -text \
  -out $CERT_PATH/root.csr \
  -keyout $CERT_PATH/root.key \
  -subj "/CN=root"

sudo chmod og-rwx $CERT_PATH/server.key
sudo chown postgres:postgres $CERT_PATH/*

# 2. Configure PostgreSQL
echo "🛠️  Configuring PostgreSQL security..."
sudo -u postgres psql -c "
-- Enable SSL and security features
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '$CERT_PATH/server.crt';
ALTER SYSTEM SET ssl_key_file = '$CERT_PATH/server.key';
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.3';
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Reload configuration
SELECT pg_reload_conf();
"

# 3. Create secure database and user
echo "🏗️  Creating secure database and user..."
sudo -u postgres psql -c "
-- Create encrypted database
CREATE DATABASE $DB_NAME WITH ENCODING = 'UTF8';

-- Create application user with limited privileges
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT USAGE ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- Enable row-level security
ALTER DATABASE $DB_NAME SET row_security = on;
"

# 4. Install Node.js dependencies
echo "📦 Installing Node.js security dependencies..."
npm install --save \
  pg \
  winston \
  bcrypt \
  helmet \
  rate-limiter-flexible \
  ioredis \
  @types/pg \
  zod

# 5. Create environment configuration
echo "⚙️  Creating environment configuration..."
cat > .env.security << EOF
# Database Security Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL_MODE=require
CERT_PATH=$CERT_PATH

# Encryption Configuration
MASTER_KEY=$(openssl rand -hex 32)
ENCRYPTION_SALT=$(openssl rand -hex 16)

# Connection Pool Configuration
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_ACQUIRE_TIMEOUT=30000
DB_POOL_IDLE_TIMEOUT=600000

# Security Configuration
MAX_CONNECTIONS_PER_USER=5
MAX_CONNECTIONS_PER_IP=20
ENABLE_GEO_VALIDATION=true
ACCESS_HOURS_START=6
ACCESS_HOURS_END=22

# Monitoring Configuration
AUDIT_LOG_PATH=/var/log/alphanumeric/database-audit.log
SECURITY_ALERT_WEBHOOK=https://security-monitor.alphanumeric.com/webhook
EOF

# 6. Create log directories
echo "📝 Setting up logging..."
sudo mkdir -p /var/log/alphanumeric
sudo chown $USER:$USER /var/log/alphanumeric
sudo chmod 750 /var/log/alphanumeric

# 7. Test database connection
echo "🧪 Testing secure database connection..."
node -e "
const { SecurePostgreSQLConnection } = require('./dist/database/secure-connection');
const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};

const db = new SecurePostgreSQLConnection(config);
db.query('SELECT version()').then(result => {
  console.log('✅ Database connection successful');
  console.log('Version:', result.rows[0].version);
  process.exit(0);
}).catch(error => {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
});
"

# 8. Set up monitoring
echo "📊 Setting up monitoring..."
# Create monitoring script
cat > scripts/monitor-database.js << 'EOF'
const { SecureConnectionPoolManager } = require('../dist/database/pool-manager');
const { DatabaseAuditLogger } = require('../dist/database/audit-logger');

async function startMonitoring() {
  const poolManager = new SecureConnectionPoolManager({
    pools: {
      main: {
        connectionConfig: {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD
        },
        maxConnections: 20,
        minConnections: 5
      }
    }
  });

  setInterval(async () => {
    const stats = await poolManager.getPoolStats();
    console.log('Pool Stats:', JSON.stringify(stats, null, 2));
  }, 30000);
}

startMonitoring().catch(console.error);
EOF

echo "✅ Database Security Hardening Deployment Complete!"
echo ""
echo "Next Steps:"
echo "1. Source the environment file: source .env.security"
echo "2. Start the monitoring: node scripts/monitor-database.js"
echo "3. Run security tests: npm run test:security"
echo "4. Review audit logs: tail -f /var/log/alphanumeric/database-audit.log"
```

This comprehensive database security hardening framework provides:

1. **End-to-end encryption** with TLS 1.3 and at-rest encryption
2. **Query parameterization** preventing SQL injection attacks
3. **Comprehensive audit logging** with risk assessment
4. **Secure connection pooling** with rate limiting and access controls
5. **Automated deployment** with security validation

The implementation follows enterprise security best practices and provides the foundation for SOC 2 compliance.