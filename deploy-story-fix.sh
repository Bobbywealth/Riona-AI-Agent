#!/bin/bash

echo "🚀 Deploying Story & DM Timeout Fixes..."
echo ""

# Navigate to project directory
cd /root/Riona-AI-Agent || exit 1

# Pull latest changes
echo "📥 Pulling latest code..."
git pull

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npx tsc

# Restart bot
echo "♻️ Restarting bot..."
pm2 restart riona-bot

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Bot Status:"
pm2 status riona-bot

echo ""
echo "📜 Watching logs (Ctrl+C to exit)..."
echo ""
sleep 2
pm2 logs riona-bot --lines 20

