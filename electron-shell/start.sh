#!/bin/bash

echo "Starting Project X Electron Shell..."
echo ""

# Check if Svelte dev server is running
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "⚠️  Svelte dev server not running!"
    echo ""
    echo "Starting it for you..."
    cd ../voice-terminal-hybrid
    npm run dev &
    SVELTE_PID=$!
    echo "Waiting for server to start..."
    sleep 3
fi

# Build and start Electron
cd "$(dirname "$0")"
echo "Building Electron app..."
npm run build

echo "Starting Electron..."
npm start

# Clean up if we started the dev server
if [ ! -z "$SVELTE_PID" ]; then
    echo "Stopping Svelte dev server..."
    kill $SVELTE_PID
fi