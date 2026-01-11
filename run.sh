#!/bin/bash
# Simple one-command script to install and run the site

cd "$(dirname "$0")"

echo "🚀 Setting up your site..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Build the project
echo "🔨 Building project..."
npm run build

# Start the server
echo "🌐 Starting server at http://localhost:8000"
echo ""
python3 serve.py

