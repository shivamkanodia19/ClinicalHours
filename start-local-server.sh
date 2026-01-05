#!/bin/bash
# Simple script to start a local server
# Usage: ./start-local-server.sh

PORT=8000

echo "🚀 Starting local server..."

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3"
    python3 serve.py
elif command -v python &> /dev/null; then
    echo "✅ Using Python"
    python serve.py
# Check if Node.js is available
elif command -v node &> /dev/null; then
    echo "✅ Using Node.js"
    if command -v npm &> /dev/null; then
        echo "📦 Installing dependencies..."
        npm install
        echo "🚀 Starting Vite dev server..."
        npm run dev
    else
        echo "❌ npm not found. Please install Node.js"
        exit 1
    fi
# Check if Bun is available
elif command -v bun &> /dev/null; then
    echo "✅ Using Bun"
    echo "📦 Installing dependencies..."
    bun install
    echo "🚀 Starting Vite dev server..."
    bun dev
else
    echo "❌ No suitable runtime found!"
    echo ""
    echo "Please install one of the following:"
    echo "  - Python 3 (usually pre-installed on macOS)"
    echo "  - Node.js (https://nodejs.org/)"
    echo "  - Bun (https://bun.sh/)"
    exit 1
fi

