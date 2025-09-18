# Voice Terminal Hybrid - Security Implementation

## Overview

This directory contains a comprehensive security implementation for the Voice Terminal Hybrid notification ingestion system. The security framework implements defense-in-depth strategies with multiple layers of protection.

## 🛡️ Security Features

### 1. Rate Limiting (`rate-limiter.ts`)
- **Tiered rate limiting**: Per IP, per API key, per endpoint
- **Sliding window algorithm**: More accurate than fixed windows
- **Redis/Memory storage**: Configurable storage backend
- **Flexible limits**: Different limits for different endpoints
- **Headers support**: Standard and legacy rate limit headers

```typescript
// Example usage
const rateLimiter = new RateLimiter(config.rateLimit);
const result = await rateLimiter.checkRateLimit(context, '/api/notifications');
```

### 2. API Key Management (`api-keys.ts`)
- **Secure hashing**: bcrypt or argon2 algorithms
- **Automatic rotation**: Configurable rotation periods
- **Scope-based permissions**: Fine-grained access control
- **Key expiration**: Optional expiration dates
- **Audit logging**: All key operations logged

```typescript
// Generate API key
const apiKey = await apiKeyManager.generateApiKey(
  'Client App',
  ['notifications:write', 'templates:read'],
  90 // expires in 90 days
);
```

### 3. IP Allowlisting (`ip-allowlist.ts`)
- **CIDR notation support**: IPv4 and IPv6 networks
- **Dynamic reload**: Configuration updates without restart
- **Private network handling**: Configurable private network blocking
- **Localhost exceptions**: Special handling for development

```typescript
// Check IP address
const result = await ipAllowlistManager.validateIpAddress('192.168.1.100');
if (!result.isAllowed) {
  // Block request
}
```

### 4. Payload Validation (`payload-validator.ts`)
- **Size limits**: Configurable maximum payload size
- **Content sanitization**: HTML/script stripping
- **Threat detection**: Pattern-based malicious content detection
- **JSON validation**: Deep object structure validation
- **Prototype pollution protection**: Prevents object manipulation attacks

```typescript
// Validate notification payload
const result = await payloadValidator.validateNotificationPayload(payload);
if (!result.isValid) {
  return { error: 'Validation failed', violations: result.violations };
}
```

### 5. Transport Security (`transport-security.ts`)
- **HTTPS support**: TLS 1.2+ with secure cipher suites
- **Self-signed certificates**: Automatic certificate generation
- **WebSocket Secure (WSS)**: Encrypted WebSocket connections
- **Unix sockets**: File-based communication with proper permissions
- **Security headers**: HSTS, CSP, and other protective headers

```typescript
// Create HTTPS server
const server = await transportSecurity.createHttpsServer(app);
```

### 6. Audit Logging (`audit-logger.ts`)
- **Comprehensive logging**: All requests and security events
- **GDPR compliance**: Data retention and anonymization
- **Log rotation**: Automatic cleanup of old logs
- **Multiple destinations**: File and database storage
- **Sensitive data masking**: Automatic PII protection

```typescript
// Log security event
await auditLogger.logSecurityEvent({
  type: SecurityEventType.RATE_LIMIT_EXCEEDED,
  severity: 'medium',
  details: { ipAddress, endpoint }
});
```

## 🔧 Configuration

### Environment Variables

```bash
# Rate Limiting
SECURITY_RATE_LIMIT_ENABLED=true
SECURITY_RATE_LIMIT_PER_IP=100
SECURITY_RATE_LIMIT_PER_API_KEY=1000
SECURITY_RATE_LIMIT_WINDOW_MS=60000

# API Keys
SECURITY_API_KEYS_ENABLED=true
SECURITY_API_KEYS_ALGORITHM=bcrypt
SECURITY_API_KEYS_SALT_ROUNDS=12
SECURITY_API_KEYS_ROTATION_DAYS=90

# IP Allowlist
SECURITY_IP_ALLOWLIST_ENABLED=false
SECURITY_IP_ALLOWLIST_CIDRS=127.0.0.1/32,::1/128

# Payload Validation
SECURITY_PAYLOAD_MAX_SIZE=1048576
SECURITY_PAYLOAD_STRIP_HTML=true
SECURITY_PAYLOAD_STRIP_SCRIPTS=true

# Transport Security
SECURITY_HTTPS_ENABLED=true
SECURITY_HTTPS_PORT=3443
SECURITY_HTTPS_SELF_SIGNED=true

# Audit Logging
SECURITY_AUDIT_ENABLED=true
SECURITY_AUDIT_DESTINATION=both
SECURITY_AUDIT_RETENTION_DAYS=90
```

### Configuration File

Generate a configuration template:

```bash
npx tsx src/security/cli/security-cli.ts config-template -o security-config.json
```

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { SecurityManager, createSecurityManager } from './security/index.js';

// Create security manager with defaults
const securityManager = createSecurityManager();

// Initialize
await securityManager.initialize();

// Create Express middleware stack
const middlewares = securityManager.createMiddlewareStack();
middlewares.forEach(middleware => app.use(middleware));
```

### 2. Generate API Keys

```bash
# Generate API key with specific scopes
npx tsx src/security/cli/security-cli.ts api-key generate \
  --name "Mobile App" \
  --scopes notifications:write templates:read \
  --expires 180

# List all API keys
npx tsx src/security/cli/security-cli.ts api-key list

# Revoke an API key
npx tsx src/security/cli/security-cli.ts api-key revoke --id abc123
```

### 3. Start Secure Server

```bash
# Start the notification server with security
npx tsx src/server/notification-server.ts
```

### 4. Test Security

```bash
# Test with valid API key
curl -H "X-API-Key: your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"projectId":"test","channel":"email","body":"Hello"}' \
     https://localhost:3443/api/notifications

# Test rate limiting
for i in {1..150}; do
  curl -s https://localhost:3443/health > /dev/null
done
# Should get 429 Too Many Requests
```

## 📊 Monitoring and Analysis

### Security Statistics

```bash
# Get security overview
curl -H "X-API-Key: admin-key" https://localhost:3443/api/security/status

# Analyze audit logs
npx tsx src/security/cli/security-cli.ts audit analyze --days 7

# Export audit logs
npx tsx src/security/cli/security-cli.ts audit export \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --format csv \
  --output audit-export.csv
```

### Certificate Management

```bash
# Check certificate status
npx tsx src/security/cli/security-cli.ts cert

# Test security configuration
npx tsx src/security/cli/security-cli.ts test
```

## 🔒 Security Best Practices

### 1. API Key Management
- **Rotate keys regularly**: Set expiration dates and rotate before expiry
- **Use least privilege**: Grant only necessary scopes
- **Secure storage**: Never commit keys to code repositories
- **Monitor usage**: Track key usage patterns for anomalies

### 2. Rate Limiting
- **Tune limits**: Adjust based on legitimate usage patterns
- **Use Redis**: For distributed deployments, use Redis store
- **Monitor patterns**: Watch for unusual traffic spikes
- **Whitelist known good**: Consider exempting trusted sources

### 3. Network Security
- **HTTPS only**: Never use HTTP in production
- **Certificate monitoring**: Set up alerts for certificate expiry
- **IP restrictions**: Use allowlists for known environments
- **Network isolation**: Deploy in private networks when possible

### 4. Audit and Compliance
- **Log everything**: Comprehensive logging helps with forensics
- **Regular review**: Analyze logs for security patterns
- **Data retention**: Follow GDPR and compliance requirements
- **Incident response**: Have procedures for security events

### 5. Payload Security
- **Validate strictly**: Reject malformed or suspicious payloads
- **Sanitize content**: Strip potentially dangerous content
- **Size limits**: Prevent resource exhaustion attacks
- **Schema validation**: Use strict JSON schemas

## 🐛 Troubleshooting

### Common Issues

1. **Rate limit false positives**
   - Check if using proxies (X-Forwarded-For)
   - Verify IP extraction logic
   - Consider exempting health checks

2. **Certificate errors**
   - Ensure OpenSSL is installed for certificate generation
   - Check file permissions on certificate files
   - Verify certificate expiry dates

3. **API key validation failures**
   - Confirm key is active and not expired
   - Verify correct header format (X-API-Key or Authorization)
   - Check scope requirements for endpoints

4. **Payload validation rejections**
   - Review suspicious pattern configuration
   - Check payload size limits
   - Verify content-type headers

### Debug Mode

```bash
# Enable debug logging
export DEBUG=security:*
export SECURITY_AUDIT_LOG_LEVEL=debug

# Run with verbose logging
npx tsx src/server/notification-server.ts
```

## 📚 API Reference

### Security Manager

```typescript
class SecurityManager {
  async initialize(): Promise<void>
  createMiddlewareStack(): Array<Function>
  async validateSecurityContext(/* ... */): Promise<ValidationResult>
  async generateApiKey(/* ... */): Promise<ApiKey>
  async getSecurityStatistics(): Promise<Statistics>
  async updateConfiguration(config: Partial<SecurityConfig>): Promise<void>
  async cleanup(): Promise<void>
}
```

### Middleware Functions

```typescript
// Rate limiting
createRateLimitMiddleware(config: RateLimitConfig): Function

// API key authentication
createApiKeyMiddleware(manager: ApiKeyManager): Function
requireScope(scope: string): Function

// IP filtering
createIpAllowlistMiddleware(manager: IpAllowlistManager): Function

// Payload validation
createPayloadValidationMiddleware(validator: PayloadValidator): Function

// Security headers
createSecurityHeadersMiddleware(config: TransportSecurityConfig): Function

// Audit logging
createAuditMiddleware(logger: AuditLogger): Function
```

## 📄 License

This security implementation is part of the Voice Terminal Hybrid project and follows the same license terms.

## 🤝 Contributing

When contributing to security features:

1. **Security review required**: All security changes need thorough review
2. **Test thoroughly**: Include comprehensive security tests
3. **Document changes**: Update this README and inline documentation
4. **Follow principles**: Maintain defense-in-depth approach
5. **Backward compatibility**: Ensure existing configurations work

## 📞 Support

For security-related questions or issues:

1. Check this documentation first
2. Review the troubleshooting section
3. Use the CLI tools for diagnostics
4. Create issues with security context and logs (sanitized)

---

**⚠️ Security Notice**: This implementation provides multiple layers of security but should be reviewed and tested thoroughly before production deployment. Security is an ongoing process requiring regular updates and monitoring.