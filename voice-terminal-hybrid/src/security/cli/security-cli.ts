#!/usr/bin/env node
/**
 * Security CLI Utilities for Voice Terminal Hybrid
 * 
 * Command-line tools for managing security features:
 * - API key generation and management
 * - Security configuration validation
 * - Audit log analysis
 * - Certificate management
 * - IP allowlist management
 */

import { program } from 'commander';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createSecurityManager, SecurityManager } from '../index.js';

class SecurityCLI {
  private securityManager: SecurityManager;

  constructor() {
    this.securityManager = createSecurityManager();
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(name: string, scopes: string[], expiresInDays?: number): Promise<void> {
    try {
      const scopeArray = scopes.length > 0 ? scopes : ['notifications:read'];
      const apiKey = await this.securityManager.generateApiKey(name, scopeArray, expiresInDays);

      console.log('✅ API Key generated successfully!');
      console.log('');
      console.log('🔑 API Key Details:');
      console.log(`   ID: ${apiKey.id}`);
      console.log(`   Name: ${apiKey.name}`);
      console.log(`   Scopes: ${apiKey.scopes.join(', ')}`);
      console.log(`   Created: ${apiKey.createdAt.toISOString()}`);
      if (apiKey.expiresAt) {
        console.log(`   Expires: ${apiKey.expiresAt.toISOString()}`);
      }
      console.log('');
      console.log('🚨 IMPORTANT: Save this key securely - it will not be shown again!');
      console.log(`   API Key: ${apiKey.plainKey}`);
      console.log('');
      console.log('💡 Usage:');
      console.log(`   curl -H "X-API-Key: ${apiKey.plainKey}" https://localhost:3443/api/notifications`);
      console.log(`   curl -H "Authorization: Bearer ${apiKey.plainKey}" https://localhost:3443/api/notifications`);

    } catch (error) {
      console.error('❌ Failed to generate API key:', error);
      process.exit(1);
    }
  }

  /**
   * List all API keys
   */
  async listApiKeys(): Promise<void> {
    try {
      const keys = this.securityManager.components.apiKeyManager.listApiKeys();

      if (keys.length === 0) {
        console.log('📝 No API keys found');
        return;
      }

      console.log(`📋 Found ${keys.length} API key(s):`);
      console.log('');

      for (const key of keys) {
        const status = key.isActive ? '🟢 Active' : '🔴 Inactive';
        const expiry = key.expiresAt ? ` (expires ${key.expiresAt.toLocaleDateString()})` : ' (no expiration)';
        
        console.log(`   ${status} ${key.id} - "${key.name}"`);
        console.log(`      Scopes: ${key.scopes.join(', ')}`);
        console.log(`      Created: ${key.createdAt.toLocaleDateString()}${expiry}`);
        if (key.lastUsedAt) {
          console.log(`      Last used: ${key.lastUsedAt.toLocaleDateString()}`);
        }
        console.log('');
      }

    } catch (error) {
      console.error('❌ Failed to list API keys:', error);
      process.exit(1);
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    try {
      await this.securityManager.components.apiKeyManager.revokeApiKey(keyId);
      console.log(`✅ API key ${keyId} has been revoked`);

    } catch (error) {
      console.error('❌ Failed to revoke API key:', error);
      process.exit(1);
    }
  }

  /**
   * Validate security configuration
   */
  validateConfiguration(configPath?: string): void {
    try {
      let config;
      
      if (configPath && existsSync(configPath)) {
        const configFile = readFileSync(configPath, 'utf8');
        config = JSON.parse(configFile);
      } else {
        config = this.securityManager.configuration;
      }

      const { validateSecurityConfig } = require('../config.js');
      const errors = validateSecurityConfig(config);

      if (errors.length === 0) {
        console.log('✅ Security configuration is valid');
        console.log('');
        console.log('📊 Configuration Summary:');
        console.log(`   Rate Limiting: ${config.rateLimit.enabled ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`   API Keys: ${config.apiKeys.enabled ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`   IP Allowlist: ${config.ipAllowlist.enabled ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`   HTTPS: ${config.transport.https.enabled ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`   Audit Logging: ${config.audit.enabled ? '✓ Enabled' : '✗ Disabled'}`);
      } else {
        console.log('❌ Security configuration has errors:');
        errors.forEach(error => console.log(`   • ${error}`));
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Failed to validate configuration:', error);
      process.exit(1);
    }
  }

  /**
   * Generate security configuration template
   */
  generateConfigTemplate(outputPath: string): void {
    try {
      const { createSecurityConfig } = require('../config.js');
      const config = createSecurityConfig();

      const template = {
        ...config,
        // Add comments for documentation
        _comments: {
          rateLimit: 'Configure rate limiting per IP, API key, and endpoint',
          apiKeys: 'API key authentication and rotation settings',
          ipAllowlist: 'IP address filtering with CIDR notation support',
          payloadValidation: 'Request payload size and content validation',
          transport: 'HTTPS, WebSocket, and Unix socket security settings',
          audit: 'Comprehensive logging and retention configuration'
        }
      };

      writeFileSync(outputPath, JSON.stringify(template, null, 2));
      console.log(`✅ Security configuration template written to ${outputPath}`);
      console.log('');
      console.log('💡 Edit the configuration and set environment variables:');
      console.log('   export SECURITY_CONFIG_PATH=/path/to/config.json');

    } catch (error) {
      console.error('❌ Failed to generate configuration template:', error);
      process.exit(1);
    }
  }

  /**
   * Analyze audit logs
   */
  async analyzeAuditLogs(days = 7): Promise<void> {
    try {
      const stats = await this.securityManager.components.auditLogger.getStatistics(
        days <= 1 ? 'day' : days <= 7 ? 'week' : 'month'
      );

      console.log(`📈 Audit Log Analysis (Last ${days} days):`);
      console.log('');
      console.log(`📊 Request Statistics:`);
      console.log(`   Total Requests: ${stats.totalRequests.toLocaleString()}`);
      console.log(`   Successful: ${stats.successfulRequests.toLocaleString()} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%)`);
      console.log(`   Failed: ${stats.failedRequests.toLocaleString()} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(1)}%)`);
      console.log('');

      if (stats.topEndpoints.length > 0) {
        console.log(`🎯 Top Endpoints:`);
        stats.topEndpoints.slice(0, 5).forEach((endpoint, index) => {
          console.log(`   ${index + 1}. ${endpoint.endpoint}: ${endpoint.count.toLocaleString()} requests`);
        });
        console.log('');
      }

      if (stats.topIpAddresses.length > 0) {
        console.log(`🌐 Top IP Addresses:`);
        stats.topIpAddresses.slice(0, 5).forEach((ip, index) => {
          console.log(`   ${index + 1}. ${ip.ip}: ${ip.count.toLocaleString()} requests`);
        });
        console.log('');
      }

      if (stats.errorTypes.length > 0) {
        console.log(`⚠️  Common Errors:`);
        stats.errorTypes.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.error}: ${error.count.toLocaleString()} occurrences`);
        });
      }

    } catch (error) {
      console.error('❌ Failed to analyze audit logs:', error);
      process.exit(1);
    }
  }

  /**
   * Check certificate status
   */
  async checkCertificate(): Promise<void> {
    try {
      const certInfo = this.securityManager.components.transportSecurity.getCertificateInfo();

      if (!certInfo) {
        console.log('📄 No SSL certificate configured');
        return;
      }

      const daysUntilExpiry = Math.ceil((certInfo.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      const needsRenewal = this.securityManager.components.transportSecurity.needsCertificateRenewal();

      console.log('🔒 SSL Certificate Status:');
      console.log('');
      console.log(`   Type: ${certInfo.isGenerated ? 'Self-signed' : 'Provided'}`);
      console.log(`   Certificate: ${certInfo.certPath}`);
      console.log(`   Private Key: ${certInfo.keyPath}`);
      console.log(`   Expires: ${certInfo.expiresAt.toLocaleDateString()} (${daysUntilExpiry} days)`);
      console.log(`   Status: ${needsRenewal ? '⚠️  Needs renewal' : '✅ Valid'}`);

      if (needsRenewal) {
        console.log('');
        console.log('💡 Certificate expires within 30 days. Consider renewing.');
      }

    } catch (error) {
      console.error('❌ Failed to check certificate:', error);
      process.exit(1);
    }
  }

  /**
   * Test security configuration
   */
  async testSecurity(): Promise<void> {
    try {
      console.log('🧪 Testing security configuration...');
      console.log('');

      // Test rate limiting
      console.log('⏱️  Testing rate limiting...');
      const rateLimitResult = await this.securityManager.components.rateLimiter.getRateLimitStatus({
        ipAddress: '127.0.0.1',
        rateLimit: { remaining: 0, resetTime: new Date() },
        transport: 'http',
        validated: false
      });
      console.log(`   Rate limit remaining: ${rateLimitResult.remaining}`);
      console.log(`   Reset time: ${rateLimitResult.resetTime.toLocaleTimeString()}`);

      // Test payload validation
      console.log('');
      console.log('🔍 Testing payload validation...');
      const testPayload = {
        projectId: 'test-project',
        channel: 'email',
        body: 'Test notification',
        priority: 'normal'
      };
      const payloadResult = await this.securityManager.components.payloadValidator.validateNotificationPayload(testPayload);
      console.log(`   Payload validation: ${payloadResult.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!payloadResult.isValid) {
        payloadResult.violations.forEach(violation => console.log(`     • ${violation}`));
      }

      // Test IP allowlist
      console.log('');
      console.log('🌐 Testing IP allowlist...');
      const ipResult = await this.securityManager.components.ipAllowlistManager.validateIpAddress('127.0.0.1');
      console.log(`   Localhost access: ${ipResult.isAllowed ? '✅ Allowed' : '❌ Blocked'}`);

      console.log('');
      console.log('✅ Security test completed');

    } catch (error) {
      console.error('❌ Security test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(startDate: string, endDate: string, format: 'json' | 'csv' = 'json', outputPath?: string): Promise<void> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      console.log(`📥 Exporting audit logs from ${start.toDateString()} to ${end.toDateString()}...`);

      const exportData = await this.securityManager.components.auditLogger.exportLogs(start, end, format);

      if (outputPath) {
        writeFileSync(outputPath, exportData);
        console.log(`✅ Audit logs exported to ${outputPath}`);
      } else {
        console.log(exportData);
      }

    } catch (error) {
      console.error('❌ Failed to export audit logs:', error);
      process.exit(1);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.securityManager.cleanup();
  }
}

// CLI Command Setup
async function main() {
  const cli = new SecurityCLI();

  program
    .name('security-cli')
    .description('Security management CLI for Voice Terminal Hybrid')
    .version('1.0.0');

  // API Key Commands
  const apiKeyCmd = program
    .command('api-key')
    .description('API key management commands');

  apiKeyCmd
    .command('generate')
    .description('Generate a new API key')
    .requiredOption('-n, --name <name>', 'API key name')
    .option('-s, --scopes <scopes...>', 'API key scopes', ['notifications:read'])
    .option('-e, --expires <days>', 'Expiration in days')
    .action(async (options) => {
      await cli.generateApiKey(options.name, options.scopes, options.expires ? parseInt(options.expires) : undefined);
      await cli.cleanup();
    });

  apiKeyCmd
    .command('list')
    .description('List all API keys')
    .action(async () => {
      await cli.listApiKeys();
      await cli.cleanup();
    });

  apiKeyCmd
    .command('revoke')
    .description('Revoke an API key')
    .requiredOption('-i, --id <keyId>', 'API key ID to revoke')
    .action(async (options) => {
      await cli.revokeApiKey(options.id);
      await cli.cleanup();
    });

  // Configuration Commands
  program
    .command('config')
    .description('Validate security configuration')
    .option('-f, --file <path>', 'Configuration file path')
    .action(async (options) => {
      cli.validateConfiguration(options.file);
      await cli.cleanup();
    });

  program
    .command('config-template')
    .description('Generate security configuration template')
    .requiredOption('-o, --output <path>', 'Output file path')
    .action(async (options) => {
      cli.generateConfigTemplate(options.output);
      await cli.cleanup();
    });

  // Audit Commands
  const auditCmd = program
    .command('audit')
    .description('Audit log management commands');

  auditCmd
    .command('analyze')
    .description('Analyze audit logs')
    .option('-d, --days <days>', 'Number of days to analyze', '7')
    .action(async (options) => {
      await cli.analyzeAuditLogs(parseInt(options.days));
      await cli.cleanup();
    });

  auditCmd
    .command('export')
    .description('Export audit logs')
    .requiredOption('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .requiredOption('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('-f, --format <format>', 'Export format (json|csv)', 'json')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options) => {
      await cli.exportAuditLogs(options.startDate, options.endDate, options.format, options.output);
      await cli.cleanup();
    });

  // Certificate Commands
  program
    .command('cert')
    .description('Check SSL certificate status')
    .action(async () => {
      await cli.checkCertificate();
      await cli.cleanup();
    });

  // Test Commands
  program
    .command('test')
    .description('Test security configuration')
    .action(async () => {
      await cli.testSecurity();
      await cli.cleanup();
    });

  program.parse();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ CLI error:', error);
    process.exit(1);
  });
}

export default SecurityCLI;