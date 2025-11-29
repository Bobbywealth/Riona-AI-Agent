#!/bin/bash

echo "🔧 Applying Story Timeout & DM Tracking Fixes..."
echo ""

# Backup the current file
echo "📦 Creating backup..."
cp /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts.backup

# Apply the timeout fixes directly to the TypeScript file
echo "🔨 Applying timeout fixes..."

# Fix 1: Story navigation timeout (line ~1585)
sed -i 's/waitUntil: "networkidle2",$/waitUntil: "networkidle2",\n                timeout: 60000,/' /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts

# Fix 2: DM inbox navigation timeout (line ~548)
sed -i 's|await page.goto("https://www.instagram.com/direct/inbox/", {$|await page.goto("https://www.instagram.com/direct/inbox/", {\n                waitUntil: "networkidle2",\n                timeout: 60000,|' /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts

echo "✅ Fixes applied!"
echo ""

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
cd /root/Riona-AI-Agent
npx tsc

# Restart bot
echo "♻️ Restarting bot..."
pm2 restart riona-bot

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Verifying fixes..."
echo ""

# Check if the compiled JavaScript has the timeout
if grep -q "timeout: 60000" /root/Riona-AI-Agent/build/client/IG-bot/IgClient.js; then
    echo "✅ Timeout fix verified in compiled code!"
else
    echo "⚠️ Warning: Timeout fix not found in compiled code"
    echo "   Restoring backup..."
    cp /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts.backup /root/Riona-AI-Agent/src/client/IG-bot/IgClient.ts
fi

echo ""
echo "📜 Watching logs (Ctrl+C to exit)..."
sleep 2
pm2 logs riona-bot --lines 20

