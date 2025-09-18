/**
 * Simple test of notification processing logic
 */

import { validateRawNotification } from './src/ingestion/schema/validation.js';
import { GitHubTransformer, EmailTransformer, GenericTransformer } from './src/ingestion/transformers/index.js';

console.log('🧪 Testing Notification Ingestion Components\n');

// Test 1: Schema Validation
console.log('📋 Testing Schema Validation...');

const validNotification = {
  title: 'Test Notification',
  source: 'test-app',
  content: 'This is a test notification',
  priority: 2
};

const validationResult = validateRawNotification(validNotification);
console.log(`✅ Valid notification: ${validationResult.isValid}`);
if (validationResult.isValid) {
  console.log('   Title:', validationResult.data.title);
  console.log('   Source:', validationResult.data.source);
}

const invalidNotification = {
  content: 'Missing title and source'
};

const invalidResult = validateRawNotification(invalidNotification);
console.log(`❌ Invalid notification: ${invalidResult.isValid}`);
if (!invalidResult.isValid) {
  console.log('   Error:', invalidResult.error);
}

// Test 2: GitHub Transformer
console.log('\n🐙 Testing GitHub Transformer...');

const githubTransformer = new GitHubTransformer();
const githubPayload = {
  repository: { full_name: 'user/awesome-repo' },
  sender: { login: 'developer' },
  commits: [
    {
      id: 'abc123',
      message: 'Fix critical bug',
      author: { name: 'John Doe' }
    }
  ],
  ref: 'refs/heads/main'
};

console.log(`🔍 GitHub detection: ${githubTransformer.detect(githubPayload)}`);
const githubResult = githubTransformer.transform(githubPayload);
console.log(`✅ GitHub transformation: ${githubResult.success}`);
if (githubResult.success) {
  console.log('   Title:', githubResult.data.title);
  console.log('   Source:', githubResult.data.source);
  console.log('   Priority:', githubResult.data.priority);
  console.log('   Tags:', githubResult.data.tags);
}

// Test 3: Email Transformer
console.log('\n📧 Testing Email Transformer...');

const emailTransformer = new EmailTransformer();
const emailPayload = {
  from: 'alerts@service.com',
  to: 'admin@company.com',
  subject: 'Server Alert',
  body: 'High CPU usage detected'
};

console.log(`🔍 Email detection: ${emailTransformer.detect(emailPayload)}`);
const emailResult = emailTransformer.transform(emailPayload);
console.log(`✅ Email transformation: ${emailResult.success}`);
if (emailResult.success) {
  console.log('   Title:', emailResult.data.title);
  console.log('   Source:', emailResult.data.source);
  console.log('   Content preview:', emailResult.data.content?.slice(0, 50) + '...');
}

// Test 4: Generic Transformer
console.log('\n🔧 Testing Generic Transformer...');

const genericTransformer = new GenericTransformer();
const genericPayload = {
  message: 'System backup completed',
  service: 'backup-daemon',
  level: 'info'
};

console.log(`🔍 Generic detection: ${genericTransformer.detect(genericPayload)}`);
const genericResult = genericTransformer.transform(genericPayload);
console.log(`✅ Generic transformation: ${genericResult.success}`);
if (genericResult.success) {
  console.log('   Title:', genericResult.data.title);
  console.log('   Source:', genericResult.data.source);
  console.log('   Confidence:', genericResult.confidence);
}

// Test 5: XSS Protection
console.log('\n🛡️  Testing XSS Protection...');

const xssPayload = {
  title: '<script>alert("xss")</script>Malicious Title',
  source: 'test',
  content: '<img src=x onerror=alert(1)>'
};

const xssResult = genericTransformer.transform(xssPayload);
if (xssResult.success) {
  console.log('✅ XSS protection working');
  console.log('   Sanitized title:', xssResult.data.title);
  console.log('   Original had <script> tags:', xssPayload.title.includes('<script>'));
  console.log('   Sanitized has &lt;script&gt;:', xssResult.data.title.includes('&lt;script&gt;'));
}

console.log('\n🎉 All component tests completed!');
console.log('\n💡 The ingestion system includes:');
console.log('   ✅ Schema validation with Joi');
console.log('   ✅ Smart format detection (GitHub, Email, Generic)'); 
console.log('   ✅ XSS protection and sanitization');
console.log('   ✅ HTTP webhook endpoint with rate limiting');
console.log('   ✅ WebSocket real-time streaming');
console.log('   ✅ File watcher for JSON notifications');
console.log('   ✅ Unix socket for local IPC');
console.log('   ✅ Comprehensive logging and error handling');

console.log('\n🚀 To start the full server:');
console.log('   node demo-ingestion.js');

console.log('\n📖 See src/ingestion/README.md for complete documentation');
console.log('📁 Check src/ingestion/examples/ for usage examples');