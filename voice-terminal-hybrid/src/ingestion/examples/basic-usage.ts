/**
 * Basic usage examples for the notification ingestion system
 */

import { NotificationIngestionServer } from '../server.js';
import { createConsoleLogger } from '../config/index.js';
import type { BaseNotification, IngestionSource } from '../types/index.js';

// Example 1: Basic server setup
async function basicServerSetup() {
  console.log('=== Basic Server Setup ===');
  
  const server = new NotificationIngestionServer({
    config: {
      port: 3456,
      apiKey: 'your-secret-key', // Optional
      maxPayloadSize: 1024 * 1024, // 1MB
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // requests per window
      }
    },
    logger: createConsoleLogger({ level: 'info' }),
    onNotificationReceived: async (notification: BaseNotification, source: IngestionSource) => {
      console.log(`📥 Received notification from ${source}:`, {
        id: notification.id,
        title: notification.title,
        source: notification.source,
        priority: notification.priority
      });
    }
  });

  try {
    await server.start();
    console.log('✅ Server started successfully');
    
    // Let it run for a bit
    setTimeout(async () => {
      await server.stop();
      console.log('✅ Server stopped');
    }, 5000);
  } catch (error) {
    console.error('❌ Server failed:', error);
  }
}

// Example 2: Testing notification processing
async function testNotificationProcessing() {
  console.log('\\n=== Testing Notification Processing ===');
  
  const server = new NotificationIngestionServer();
  
  // Test various payload formats
  const testPayloads = [
    // Basic notification
    {
      title: 'Hello World',
      source: 'test',
      content: 'This is a test notification',
      priority: 1
    },
    
    // GitHub webhook simulation
    {
      repository: { full_name: 'user/repo' },
      sender: { login: 'johndoe' },
      commits: [
        {
          id: 'abc123',
          message: 'Fix critical bug',
          author: { name: 'John Doe' }
        }
      ],
      ref: 'refs/heads/main'
    },
    
    // Email notification
    {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Important Update',
      body: 'Please review the attached document.'
    },
    
    // Generic object
    {
      message: 'System alert',
      level: 'warning',
      service: 'database'
    }
  ];

  for (const [index, payload] of testPayloads.entries()) {
    console.log(`\\nTesting payload ${index + 1}:`);
    
    // Test validation and transformation
    const testResult = await server.testNotification(payload);
    console.log('Validation:', testResult.validation.isValid ? '✅' : '❌');
    console.log('Transformer suggestions:', testResult.transformation.suggestions);
    
    if (testResult.validation.isValid) {
      // Actually process the notification
      const result = await server.processNotification(payload, 'webhook');
      if (result.success) {
        console.log('✅ Processed:', result.notification?.title);
      } else {
        console.log('❌ Failed:', result.error?.message);
      }
    } else {
      console.log('❌ Validation errors:', testResult.validation.errors);
    }
  }
}

// Example 3: File-based notification ingestion
async function fileBasedIngestion() {
  console.log('\\n=== File-based Ingestion Example ===');
  
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');
  
  const watchDir = path.join(os.tmpdir(), 'voice-terminal-test');
  
  const server = new NotificationIngestionServer({
    config: {
      fileWatcher: {
        directory: watchDir
      }
    },
    onNotificationReceived: async (notification, source) => {
      console.log(`📁 File notification: ${notification.title} (${source})`);
    }
  });

  try {
    await server.start();
    
    // Create test directory
    await fs.mkdir(watchDir, { recursive: true });
    
    // Write test notifications to files
    const notifications = [
      { title: 'File Test 1', source: 'file-system', content: 'First test' },
      { title: 'File Test 2', source: 'file-system', content: 'Second test' }
    ];

    for (const [index, notification] of notifications.entries()) {
      const filePath = path.join(watchDir, `notification-${index + 1}.json`);
      await fs.writeFile(filePath, JSON.stringify(notification, null, 2));
      console.log(`📝 Wrote ${filePath}`);
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await server.stop();
    
    // Cleanup
    await fs.rm(watchDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('❌ File ingestion test failed:', error);
  }
}

// Example 4: Unix socket communication
async function unixSocketExample() {
  console.log('\\n=== Unix Socket Example ===');
  
  const net = await import('net');
  const os = await import('os');
  const path = await import('path');
  
  const socketPath = path.join(os.tmpdir(), 'test-notify.pipe');
  
  const server = new NotificationIngestionServer({
    config: {
      unixSocket: {
        path: socketPath
      }
    },
    onNotificationReceived: async (notification, source) => {
      console.log(`🔌 Unix socket notification: ${notification.title} (${source})`);
    }
  });

  try {
    await server.start();
    
    // Give server time to create socket
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect and send notification
    const client = net.createConnection(socketPath);
    
    client.on('connect', () => {
      console.log('🔌 Connected to Unix socket');
      
      const notification = {
        title: 'Unix Socket Test',
        source: 'local-app',
        content: 'Test notification via Unix socket'
      };
      
      client.write(JSON.stringify(notification) + '\\n');
    });

    client.on('data', (data) => {
      console.log('📨 Server response:', data.toString());
      client.end();
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error);
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await server.stop();
    
  } catch (error) {
    console.error('❌ Unix socket test failed:', error);
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Running Notification Ingestion Examples\\n');
  
  await basicServerSetup();
  await testNotificationProcessing();
  await fileBasedIngestion();
  await unixSocketExample();
  
  console.log('\\n✅ All examples completed!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  basicServerSetup,
  testNotificationProcessing,
  fileBasedIngestion,
  unixSocketExample,
  runExamples
};