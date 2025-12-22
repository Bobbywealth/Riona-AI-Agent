#!/bin/bash
# VPS Bot Status Checker
# Run this on your VPS: bash check-vps-status.sh

echo "🔍 Checking Riona Bot Status..."
echo ""

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status | grep riona-bot || echo "❌ Bot not found in PM2"
echo ""

# Check if process is running
echo "🔄 Process Check:"
ps aux | grep -i "riona\|node.*index.js" | grep -v grep || echo "❌ No bot process found"
echo ""

# Check recent logs
echo "📜 Recent Logs (last 20 lines):"
pm2 logs riona-bot --lines 20 --nostream 2>&1 | tail -20
echo ""

# Check for errors
echo "❌ Recent Errors:"
pm2 logs riona-bot --err --lines 10 --nostream 2>&1 | tail -10
echo ""

# Check cookies file
echo "🍪 Instagram Cookies:"
if [ -f "/root/Riona-AI-Agent/cookies/Instagramcookies.json" ]; then
    echo "✅ Cookies file exists"
    ls -lh /root/Riona-AI-Agent/cookies/Instagramcookies.json
else
    echo "❌ Cookies file NOT found"
fi
echo ""

# Check MongoDB connection
echo "🗄️ MongoDB Status:"
pm2 logs riona-bot --lines 50 --nostream 2>&1 | grep -i "mongo\|database" | tail -5
echo ""

# Check Instagram login status
echo "📱 Instagram Login Status:"
pm2 logs riona-bot --lines 100 --nostream 2>&1 | grep -i "login\|logged\|cookie" | tail -5
echo ""

echo "⏰ Scheduler Status:"
if [ -f "/root/Riona-AI-Agent/.env" ]; then
  echo "ENABLE_SCHEDULER in .env:"
  grep -E "^ENABLE_SCHEDULER=" /root/Riona-AI-Agent/.env || echo "(not set)"
else
  echo "⚠️ .env not found at /root/Riona-AI-Agent/.env"
fi
echo ""

echo "Scheduler endpoint (/api/scheduler/status):"
curl -s --max-time 3 http://127.0.0.1:3000/api/scheduler/status || echo "❌ Could not reach http://127.0.0.1:3000 (is the server running?)"
echo ""
echo ""

echo "Scheduler logs (last 20 scheduler lines):"
pm2 logs riona-bot --lines 200 --nostream 2>&1 | grep -i "scheduler" | tail -20 || true
echo ""

echo "✅ Status check complete!"
echo ""
echo "💡 To view live logs: pm2 logs riona-bot"
echo "💡 To restart bot: pm2 restart riona-bot"

