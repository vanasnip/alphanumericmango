/**
 * Simple demo of the notification ingestion system
 */

import { NotificationIngestionServer } from './src/ingestion/index.js';
import { createConsoleLogger } from './src/ingestion/config/index.js';

console.log('🚀 Starting Notification Ingestion Demo\n');

// Create server with demo configuration
const server = new NotificationIngestionServer({
  config: {
    port: 3456,
    maxPayloadSize: 1024 * 1024, // 1MB
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per window
    }
  },
  logger: createConsoleLogger({ level: 'info', colorize: true }),
  onNotificationReceived: async (notification, source) => {
    console.log(`\n📥 NOTIFICATION RECEIVED`);
    console.log(`   Source: ${source}`);
    console.log(`   ID: ${notification.id}`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   From: ${notification.source}`);
    console.log(`   Priority: ${notification.priority}/5`);
    if (notification.content) {
      console.log(`   Content: ${notification.content.slice(0, 100)}${notification.content.length > 100 ? '...' : ''}`);
    }
    if (notification.tags && notification.tags.length > 0) {
      console.log(`   Tags: ${notification.tags.join(', ')}`);
    }
    console.log('');
  },
  onError: async (error, source) => {
    console.error(`❌ Error from ${source}:`, error.message);
  }
});

// Demo notification payloads to test
const demoPayloads = [
  {
    title: 'Simple Test Notification',
    source: 'demo',
    content: 'This is a basic test notification to verify the system works.',
    priority: 3
  },
  {
    // GitHub-style payload
    repository: { full_name: 'user/awesome-project' },
    sender: { login: 'developer' },
    commits: [
      {
        id: 'abc123def456',
        message: 'Fix critical security vulnerability',
        author: { name: 'John Developer' }
      }
    ],
    ref: 'refs/heads/main'
  },
  {
    // Email-style payload
    from: 'alerts@myservice.com',
    to: 'admin@company.com',
    subject: 'Server Alert: High Memory Usage',
    body: 'Memory usage has exceeded 85% on server web-01. Please investigate.'
  },
  {
    // Generic payload
    message: 'Database backup completed successfully',
    service: 'backup-service',
    level: 'info',
    duration: '2h 15m'
  }
];

async function runDemo() {
  try {
    // Start the server
    await server.start();
    console.log('✅ Ingestion server started successfully');
    console.log(`📡 Webhook endpoint: http://localhost:3456/webhook`);
    console.log(`🔍 Health check: http://localhost:3456/health`);
    console.log(`📊 Statistics: http://localhost:3456/stats`);
    console.log(`🔌 WebSocket: ws://localhost:3456/ws`);
    console.log(`📁 File watcher: ~/.voice-terminal/notify/`);
    console.log(`🔌 Unix socket: ~/.voice-terminal/notify.pipe`);
    console.log('\n--- Testing Notification Processing ---\n');

    // Process demo notifications
    for (const [index, payload] of demoPayloads.entries()) {
      console.log(`🧪 Testing payload ${index + 1}/${demoPayloads.length}`);
      
      try {
        const result = await server.processNotification(payload, 'webhook');
        if (!result.success) {
          console.error(`❌ Failed to process payload ${index + 1}:`, result.error?.message);
        }
      } catch (error) {
        console.error(`❌ Error processing payload ${index + 1}:`, error.message);
      }
      
      // Small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Show final stats
    console.log('\n--- Final Statistics ---');
    const stats = server.getStats();
    console.log(`📈 Total notifications: ${stats.totalNotifications}`);
    console.log(`📊 By source:`, stats.notificationsBySource);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`⏱️  Uptime: ${Math.round(stats.uptime / 1000)}s`);

    console.log('\n🎉 Demo completed! Server is still running...');
    console.log('💡 Try sending notifications:');
    console.log('   curl -X POST http://localhost:3456/webhook \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"title": "Hello World", "source": "curl"}\'');
    console.log('\n⏹️  Press Ctrl+C to stop the server');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await server.stop();
    console.log('✅ Server stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Run the demo
runDemo().catch(console.error);