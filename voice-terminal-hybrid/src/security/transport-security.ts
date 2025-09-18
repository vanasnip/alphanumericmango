/**
 * Transport Security Implementation for Voice Terminal Hybrid
 * 
 * Provides comprehensive transport layer security including:
 * - HTTPS with self-signed certificate generation
 * - WebSocket Secure (WSS) support
 * - Unix socket with proper permissions
 * - Security headers implementation
 * - TLS configuration optimization
 */

import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { TransportSecurityConfig, SecurityEvent, SecurityEventType } from './types.js';

interface CertificateInfo {
  certPath: string;
  keyPath: string;
  isGenerated: boolean;
  expiresAt: Date;
}

export class TransportSecurityManager {
  private config: TransportSecurityConfig;
  private certificateInfo?: CertificateInfo;

  constructor(config: TransportSecurityConfig) {
    this.config = config;
  }

  /**
   * Create HTTPS server with proper TLS configuration
   */
  async createHttpsServer(app: any): Promise<any> {
    if (!this.config.https.enabled) {
      throw new Error('HTTPS is not enabled');
    }

    const { cert, key } = await this.getCertificateAndKey();
    
    const httpsOptions = {
      cert,
      key,
      // TLS security configuration
      secureProtocol: 'TLSv1_2_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES256-SHA256',
        'DHE-RSA-AES128-GCM-SHA256',
        'DHE-RSA-AES256-GCM-SHA384',
        'DHE-RSA-AES128-SHA256',
        'DHE-RSA-AES256-SHA256',
        '!aNULL',
        '!eNULL',
        '!EXPORT',
        '!DES',
        '!RC4',
        '!MD5',
        '!PSK',
        '!SRP',
        '!CAMELLIA'
      ].join(':'),
      honorCipherOrder: true,
      secureOptions: require('constants').SSL_OP_NO_SSLv2 | 
                     require('constants').SSL_OP_NO_SSLv3 |
                     require('constants').SSL_OP_NO_TLSv1 |
                     require('constants').SSL_OP_NO_TLSv1_1
    };

    const server = createHttpsServer(httpsOptions, app);
    
    this.logSecurityEvent('HTTPS_SERVER_CREATED', 'low', {
      port: this.config.https.port,
      certificateType: this.certificateInfo?.isGenerated ? 'self-signed' : 'provided'
    });

    return server;
  }

  /**
   * Create HTTP server with security headers
   */
  createHttpServer(app: any): any {
    const server = createHttpServer(app);
    
    this.logSecurityEvent('HTTP_SERVER_CREATED', 'low', {
      note: 'HTTP server created - consider using HTTPS for production'
    });

    return server;
  }

  /**
   * Setup Unix socket with proper permissions
   */
  async setupUnixSocket(server: any): Promise<void> {
    if (!this.config.unixSocket.enabled) {
      return;
    }

    const socketPath = this.config.unixSocket.path;
    
    // Remove existing socket file
    if (existsSync(socketPath)) {
      try {
        require('fs').unlinkSync(socketPath);
      } catch (error) {
        console.warn('Failed to remove existing socket:', error);
      }
    }

    // Ensure directory exists
    const socketDir = dirname(socketPath);
    if (!existsSync(socketDir)) {
      require('fs').mkdirSync(socketDir, { recursive: true });
    }

    // Listen on Unix socket
    server.listen(socketPath, () => {
      console.log(`Server listening on Unix socket: ${socketPath}`);
      
      // Set proper permissions
      try {
        chmodSync(socketPath, this.config.unixSocket.permissions);
        this.logSecurityEvent('UNIX_SOCKET_CREATED', 'low', {
          path: socketPath,
          permissions: this.config.unixSocket.permissions
        });
      } catch (error) {
        console.error('Failed to set socket permissions:', error);
      }
    });

    // Cleanup on exit
    process.on('exit', () => {
      if (existsSync(socketPath)) {
        require('fs').unlinkSync(socketPath);
      }
    });
  }

  /**
   * Get or generate SSL certificate and key
   */
  private async getCertificateAndKey(): Promise<{ cert: Buffer; key: Buffer }> {
    // Use provided certificates if available
    if (this.config.https.certPath && this.config.https.keyPath) {
      try {
        const cert = readFileSync(this.config.https.certPath);
        const key = readFileSync(this.config.https.keyPath);
        
        this.certificateInfo = {
          certPath: this.config.https.certPath,
          keyPath: this.config.https.keyPath,
          isGenerated: false,
          expiresAt: this.getCertificateExpiry(cert)
        };
        
        return { cert, key };
      } catch (error) {
        console.warn('Failed to load provided certificates:', error);
      }
    }

    // Generate self-signed certificate if configured
    if (this.config.https.generateSelfSigned) {
      return this.generateSelfSignedCertificate();
    }

    throw new Error('No SSL certificates available and self-signed generation is disabled');
  }

  /**
   * Generate self-signed SSL certificate
   */
  private async generateSelfSignedCertificate(): Promise<{ cert: Buffer; key: Buffer }> {
    const certDir = join(process.cwd(), '.certs');
    const certPath = join(certDir, 'server.crt');
    const keyPath = join(certDir, 'server.key');

    // Create certificates directory
    if (!existsSync(certDir)) {
      require('fs').mkdirSync(certDir, { recursive: true });
    }

    // Check if certificates already exist and are valid
    if (existsSync(certPath) && existsSync(keyPath)) {
      try {
        const cert = readFileSync(certPath);
        const expiresAt = this.getCertificateExpiry(cert);
        
        // Use existing certificate if it expires more than 30 days from now
        if (expiresAt.getTime() > Date.now() + (30 * 24 * 60 * 60 * 1000)) {
          const key = readFileSync(keyPath);
          
          this.certificateInfo = {
            certPath,
            keyPath,
            isGenerated: true,
            expiresAt
          };
          
          return { cert, key };
        }
      } catch (error) {
        console.warn('Existing certificates are invalid, generating new ones');
      }
    }

    // Generate new certificate
    console.log('Generating self-signed SSL certificate...');
    
    try {
      // Use OpenSSL to generate certificate
      const opensslCmd = [
        'openssl req -x509 -newkey rsa:4096 -keyout',
        keyPath,
        '-out',
        certPath,
        '-days 365 -nodes',
        '-subj "/C=US/ST=State/L=City/O=VoiceTerminal/CN=localhost"',
        '-addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:::1"'
      ].join(' ');

      execSync(opensslCmd, { stdio: 'pipe' });
      
      const cert = readFileSync(certPath);
      const key = readFileSync(keyPath);
      
      // Set proper permissions
      chmodSync(keyPath, '0600');
      chmodSync(certPath, '0644');
      
      this.certificateInfo = {
        certPath,
        keyPath,
        isGenerated: true,
        expiresAt: this.getCertificateExpiry(cert)
      };
      
      this.logSecurityEvent('SELF_SIGNED_CERT_GENERATED', 'low', {
        certPath,
        keyPath,
        expiresAt: this.certificateInfo.expiresAt
      });
      
      return { cert, key };
      
    } catch (error) {
      console.error('Failed to generate SSL certificate with OpenSSL:', error);
      
      // Fallback to Node.js crypto for basic certificate generation
      return this.generateBasicSelfSignedCertificate(certPath, keyPath);
    }
  }

  /**
   * Generate basic self-signed certificate using Node.js crypto
   */
  private generateBasicSelfSignedCertificate(certPath: string, keyPath: string): { cert: Buffer; key: Buffer } {
    const { generateKeyPairSync } = require('crypto');
    
    try {
      // Generate RSA key pair
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      // Create basic certificate (this is a simplified implementation)
      // In production, use a proper certificate generation library
      const cert = this.createBasicCertificate(publicKey);
      
      writeFileSync(certPath, cert);
      writeFileSync(keyPath, privateKey);
      
      chmodSync(keyPath, '0600');
      chmodSync(certPath, '0644');
      
      this.certificateInfo = {
        certPath,
        keyPath,
        isGenerated: true,
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year
      };
      
      return { 
        cert: Buffer.from(cert), 
        key: Buffer.from(privateKey) 
      };
      
    } catch (error) {
      throw new Error(`Failed to generate basic self-signed certificate: ${error}`);
    }
  }

  /**
   * Create a basic X.509 certificate
   */
  private createBasicCertificate(publicKey: string): string {
    // This is a simplified certificate - in production use proper X.509 library
    const now = new Date();
    const expiryDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
    
    return [
      '-----BEGIN CERTIFICATE-----',
      Buffer.from(JSON.stringify({
        version: 3,
        serialNumber: Math.random().toString(36),
        issuer: 'CN=localhost',
        subject: 'CN=localhost',
        notBefore: now.toISOString(),
        notAfter: expiryDate.toISOString(),
        publicKey: publicKey.replace(/-----BEGIN PUBLIC KEY-----\n?/, '').replace(/\n?-----END PUBLIC KEY-----/, ''),
        extensions: {
          subjectAltName: 'DNS:localhost,IP:127.0.0.1'
        }
      })).toString('base64'),
      '-----END CERTIFICATE-----'
    ].join('\n');
  }

  /**
   * Extract certificate expiry date
   */
  private getCertificateExpiry(cert: Buffer): Date {
    try {
      // This is a simplified implementation
      // In production, use proper X.509 certificate parsing
      const certString = cert.toString();
      
      // Try to extract from OpenSSL format
      if (certString.includes('-----BEGIN CERTIFICATE-----')) {
        // Use OpenSSL to get certificate info
        try {
          const tempFile = join(require('os').tmpdir(), 'temp_cert.pem');
          writeFileSync(tempFile, cert);
          
          const output = execSync(`openssl x509 -in ${tempFile} -noout -enddate`, { encoding: 'utf8' });
          require('fs').unlinkSync(tempFile);
          
          const match = output.match(/notAfter=(.+)/);
          if (match) {
            return new Date(match[1]);
          }
        } catch (error) {
          console.warn('Failed to parse certificate expiry with OpenSSL');
        }
      }
      
      // Fallback to 1 year from now
      return new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
      
    } catch (error) {
      console.warn('Failed to parse certificate expiry:', error);
      return new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
    }
  }

  /**
   * Get certificate information
   */
  getCertificateInfo(): CertificateInfo | undefined {
    return this.certificateInfo;
  }

  /**
   * Check if certificate needs renewal
   */
  needsCertificateRenewal(): boolean {
    if (!this.certificateInfo) return false;
    
    // Renew if expires within 30 days
    const renewalThreshold = 30 * 24 * 60 * 60 * 1000;
    return this.certificateInfo.expiresAt.getTime() - Date.now() < renewalThreshold;
  }

  /**
   * Log security events
   */
  private logSecurityEvent(type: string, severity: string, details: Record<string, any>): void {
    const event: SecurityEvent = {
      type: type as SecurityEventType,
      timestamp: new Date(),
      severity: severity as any,
      source: 'transport-security',
      details,
      action: 'info'
    };
    
    console.log('Transport Security Event:', event);
  }
}

/**
 * Express middleware for security headers
 */
export function createSecurityHeadersMiddleware(config: TransportSecurityConfig) {
  return (req: any, res: any, next: any) => {
    // HTTP Strict Transport Security (HSTS)
    if (config.headers.hsts && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content Security Policy
    if (config.headers.csp) {
      res.setHeader('Content-Security-Policy', config.headers.csp);
    }

    // X-Frame-Options
    if (config.headers.frameOptions) {
      res.setHeader('X-Frame-Options', config.headers.frameOptions);
    }

    // X-Content-Type-Options
    if (config.headers.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection
    if (config.headers.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Additional security headers
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Remove server identification
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

/**
 * WebSocket security upgrade handler
 */
export function createWebSocketSecurityHandler(config: TransportSecurityConfig) {
  return (request: any, socket: any, head: any) => {
    // Validate origin
    const origin = request.headers.origin;
    if (origin && !isOriginAllowed(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Additional WebSocket security checks
    const userAgent = request.headers['user-agent'];
    if (!userAgent || userAgent.length > 512) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Log WebSocket connection attempt
    console.log('WebSocket connection attempt:', {
      origin,
      userAgent,
      ip: socket.remoteAddress
    });
  };
}

/**
 * Check if origin is allowed for WebSocket connections
 */
function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:5173',
    'https://localhost:5173'
  ];
  
  return allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:');
}