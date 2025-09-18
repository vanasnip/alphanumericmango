# Notification Ingestion API Examples

This document provides practical examples for sending notifications to the ingestion system using various methods.

## HTTP Webhook Examples

### Basic Notification
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "source": "my-app",
    "content": "This is a test notification",
    "priority": 2
  }'
```

### With API Key Authentication
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "title": "Authenticated Notification",
    "source": "secure-app",
    "content": "This notification requires authentication"
  }'
```

### GitHub Webhook Simulation
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{
    "repository": {
      "full_name": "user/awesome-project"
    },
    "sender": {
      "login": "johndoe"
    },
    "commits": [
      {
        "id": "abc123def456",
        "message": "Fix critical security vulnerability",
        "author": {
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ],
    "ref": "refs/heads/main"
  }'
```

### Email Webhook
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "alerts@myservice.com",
    "to": "admin@company.com",
    "subject": "Server Alert: High CPU Usage",
    "body": "CPU usage has exceeded 90% for the past 5 minutes.",
    "priority": "high"
  }'
```

### Notification with Actions
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pull Request Review Required",
    "source": "github",
    "content": "A new pull request needs your review",
    "priority": 2,
    "actions": [
      {
        "id": "approve",
        "label": "Approve",
        "type": "url",
        "url": "https://github.com/user/repo/pull/123",
        "variant": "primary"
      },
      {
        "id": "decline",
        "label": "Request Changes",
        "type": "callback",
        "callback": "decline_pr_123",
        "variant": "secondary"
      }
    ],
    "tags": ["github", "pr", "review"]
  }'
```

### Batch Notifications
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '[
    {
      "title": "Build Started",
      "source": "ci",
      "content": "Build #123 started for main branch"
    },
    {
      "title": "Tests Passed",
      "source": "ci",
      "content": "All 150 tests passed successfully"
    },
    {
      "title": "Deployment Ready",
      "source": "ci",
      "content": "Build is ready for deployment"
    }
  ]'
```

## File-based Ingestion

### Simple JSON File
Create a file in `~/.voice-terminal/notify/notification.json`:
```json
{
  "title": "File-based Notification",
  "source": "file-system",
  "content": "This notification was created from a file",
  "priority": 3,
  "tags": ["file", "automated"]
}
```

### Multiple Notifications in One File
```json
[
  {
    "title": "System Backup Started",
    "source": "backup-service",
    "content": "Daily backup process has begun"
  },
  {
    "title": "System Backup Completed",
    "source": "backup-service",
    "content": "Daily backup completed successfully in 2h 15m"
  }
]
```

### Newline-Delimited JSON (NDJSON)
```
{"title": "Log Entry 1", "source": "application", "content": "User login successful"}
{"title": "Log Entry 2", "source": "application", "content": "File uploaded: document.pdf"}
{"title": "Log Entry 3", "source": "application", "content": "Session expired"}
```

## Unix Socket Examples

### Using `nc` (netcat)
```bash
echo '{"title": "Unix Socket Test", "source": "cli", "content": "Testing via netcat"}' | nc -U ~/.voice-terminal/notify.pipe
```

### Using Node.js
```javascript
const net = require('net');
const client = net.createConnection('~/.voice-terminal/notify.pipe');

client.on('connect', () => {
  const notification = {
    title: 'Node.js Notification',
    source: 'nodejs-app',
    content: 'Sent via Node.js Unix socket client'
  };
  
  client.write(JSON.stringify(notification) + '\n');
});

client.on('data', (data) => {
  console.log('Response:', data.toString());
  client.end();
});
```

### Using Python
```python
import socket
import json

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.connect('/home/user/.voice-terminal/notify.pipe')

notification = {
    'title': 'Python Notification',
    'source': 'python-script',
    'content': 'Sent from Python application'
}

sock.send(json.dumps(notification).encode() + b'\n')
response = sock.recv(1024)
print('Response:', response.decode())
sock.close()
```

## WebSocket Examples

### JavaScript Client
```javascript
const ws = new WebSocket('ws://localhost:3456/ws');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  
  // Send authentication (if required)
  ws.send(JSON.stringify({
    type: 'auth',
    apiKey: 'your-api-key'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
  
  if (message.type === 'auth_success') {
    // Subscribe to notification channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['github', 'alerts', '*']
    }));
    
    // Send a notification
    ws.send(JSON.stringify({
      type: 'notification',
      id: 'test-123',
      payload: {
        title: 'WebSocket Notification',
        source: 'websocket-client',
        content: 'Real-time notification via WebSocket'
      }
    }));
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## Health Check and Stats

### Health Check
```bash
curl http://localhost:3456/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 145632,
  "stats": {
    "totalNotifications": 42,
    "notificationsBySource": {
      "webhook": 25,
      "file": 8,
      "websocket": 6,
      "unix-socket": 3
    },
    "errors": 2
  },
  "timestamp": "2024-09-18T19:45:00.000Z"
}
```

### Statistics
```bash
curl http://localhost:3456/stats
```

## Error Examples

### Invalid JSON
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '{"title": "Invalid JSON", invalid}'
```

### Missing Required Fields
```bash
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Missing title and source"
  }'
```

### Payload Too Large
```bash
# Create a 2MB payload (assuming 1MB limit)
curl -X POST http://localhost:3456/webhook \
  -H "Content-Type: application/json" \
  -d "$(printf '{"title":"Large payload","source":"test","content":"%*s"}' 2000000 "")"
```

## Environment Configuration

### With Environment Variables
```bash
# Set environment variables
export INGESTION_PORT=4567
export INGESTION_API_KEY=super-secret-key
export INGESTION_IP_ALLOWLIST=127.0.0.1,192.168.1.0/24
export INGESTION_MAX_PAYLOAD_SIZE=2097152
export INGESTION_RATE_LIMIT_MAX=200

# Start your application
node your-app.js
```

### Testing Rate Limiting
```bash
# Send multiple requests quickly to test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3456/webhook \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"Rate test $i\", \"source\": \"test\"}" &
done
wait
```

This should demonstrate the rate limiting in action after the configured threshold is reached.