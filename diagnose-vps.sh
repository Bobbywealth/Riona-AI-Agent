#!/bin/bash

# Instagram Bot VPS Diagnostic Script
# Run this on your VPS to check all critical components

echo "🔍 Instagram Bot Diagnostic Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Generated: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

function check_fail() {
    echo -e "${RED}✗${NC} $1"
}

function check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check if bot directory exists
echo "1️⃣  Checking Bot Installation..."
if [ -d "/root/Riona-AI-Agent" ]; then
    check_pass "Bot directory exists: /root/Riona-AI-Agent"
    cd /root/Riona-AI-Agent
else
    check_fail "Bot directory not found: /root/Riona-AI-Agent"
    exit 1
fi
echo ""

# 2. Check Node.js and npm
echo "2️⃣  Checking Node.js Environment..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not installed"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not installed"
fi
echo ""

# 3. Check PM2
echo "3️⃣  Checking PM2 Process Manager..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    check_pass "PM2 installed: $PM2_VERSION"
    
    # Check if bot is running
    if pm2 list | grep -q "riona-bot"; then
        BOT_STATUS=$(pm2 list | grep "riona-bot" | awk '{print $10}')
        if [ "$BOT_STATUS" == "online" ]; then
            check_pass "Bot process is running (online)"
        else
            check_warn "Bot process exists but status: $BOT_STATUS"
        fi
    else
        check_fail "Bot process not found in PM2"
    fi
else
    check_fail "PM2 not installed"
fi
echo ""

# 4. Check .env file
echo "4️⃣  Checking Environment Configuration..."
if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check critical variables (without showing values)
    if grep -q "IGusername=" .env && ! grep -q "IGusername=default_IGusername" .env; then
        check_pass "IGusername is configured"
    else
        check_fail "IGusername not configured or using default"
    fi
    
    if grep -q "IGpassword=" .env && ! grep -q "IGpassword=default_IGpassword" .env; then
        check_pass "IGpassword is configured"
    else
        check_fail "IGpassword not configured or using default"
    fi
    
    if grep -q "GEMINI_API_KEY_1=" .env && ! grep -q "GEMINI_API_KEY_1=API_KEY_1" .env; then
        check_pass "Gemini API key is configured"
    else
        check_warn "Gemini API key not configured (AI features won't work)"
    fi
    
    if grep -q "PROXY_ENABLED=true" .env; then
        check_warn "Proxy is enabled"
        if grep -q "PROXY_HOST=" .env && ! grep -q "PROXY_HOST=$" .env; then
            check_pass "Proxy host is configured"
        else
            check_fail "Proxy enabled but host not configured"
        fi
    else
        check_warn "Proxy is disabled (using direct connection)"
    fi
else
    check_fail ".env file not found"
fi
echo ""

# 5. Check cookies directory and file
echo "5️⃣  Checking Instagram Cookies..."
if [ -d "cookies" ]; then
    check_pass "Cookies directory exists"
    
    if [ -f "cookies/Instagramcookies.json" ]; then
        COOKIE_SIZE=$(stat -f%z "cookies/Instagramcookies.json" 2>/dev/null || stat -c%s "cookies/Instagramcookies.json" 2>/dev/null)
        COOKIE_AGE=$(find cookies/Instagramcookies.json -mtime -7 2>/dev/null)
        
        if [ "$COOKIE_SIZE" -gt 100 ]; then
            check_pass "Cookies file exists (${COOKIE_SIZE} bytes)"
        else
            check_warn "Cookies file exists but seems empty (${COOKIE_SIZE} bytes)"
        fi
        
        if [ -n "$COOKIE_AGE" ]; then
            COOKIE_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "cookies/Instagramcookies.json" 2>/dev/null || stat -c "%y" "cookies/Instagramcookies.json" 2>/dev/null | cut -d'.' -f1)
            check_pass "Cookies are recent (modified: $COOKIE_DATE)"
        else
            check_warn "Cookies are older than 7 days (may be expired)"
        fi
        
        # Check if cookies are valid JSON
        if jq empty cookies/Instagramcookies.json 2>/dev/null; then
            check_pass "Cookies file is valid JSON"
            
            # Check for sessionid
            if jq -e '.[] | select(.name=="sessionid")' cookies/Instagramcookies.json >/dev/null 2>&1; then
                check_pass "Session ID cookie found"
                
                # Check expiry
                EXPIRES=$(jq -r '.[] | select(.name=="sessionid") | .expires' cookies/Instagramcookies.json)
                CURRENT_TIME=$(date +%s)
                if [ "$EXPIRES" -gt "$CURRENT_TIME" ]; then
                    DAYS_LEFT=$(( ($EXPIRES - $CURRENT_TIME) / 86400 ))
                    check_pass "Session cookie is valid (expires in $DAYS_LEFT days)"
                else
                    check_fail "Session cookie is EXPIRED"
                fi
            else
                check_fail "Session ID cookie not found in cookies file"
            fi
        else
            check_fail "Cookies file is not valid JSON"
        fi
    else
        check_fail "Cookies file not found: cookies/Instagramcookies.json"
        echo "   💡 Generate cookies with: node generate-cookies.js"
    fi
else
    check_fail "Cookies directory not found"
    echo "   💡 Create with: mkdir -p cookies && chmod 755 cookies"
fi
echo ""

# 6. Check build directory
echo "6️⃣  Checking Compiled Code..."
if [ -d "build" ]; then
    check_pass "Build directory exists"
    
    if [ -f "build/index.js" ]; then
        check_pass "Main entry point compiled: build/index.js"
    else
        check_fail "build/index.js not found (run: npx tsc)"
    fi
    
    if [ -f "build/client/IG-bot/IgClient.js" ]; then
        check_pass "IgClient compiled: build/client/IG-bot/IgClient.js"
    else
        check_fail "IgClient not compiled"
    fi
else
    check_fail "Build directory not found (run: npx tsc)"
fi
echo ""

# 7. Check logs
echo "7️⃣  Checking Logs..."
if [ -d "logs" ]; then
    check_pass "Logs directory exists"
    
    if [ -d "logs/feed-screens" ]; then
        SCREENSHOT_COUNT=$(ls -1 logs/feed-screens/*.png 2>/dev/null | wc -l)
        if [ "$SCREENSHOT_COUNT" -gt 0 ]; then
            check_pass "Found $SCREENSHOT_COUNT screenshots"
            LATEST_SCREENSHOT=$(ls -t logs/feed-screens/*.png 2>/dev/null | head -1)
            if [ -n "$LATEST_SCREENSHOT" ]; then
                SCREENSHOT_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$LATEST_SCREENSHOT" 2>/dev/null || stat -c "%y" "$LATEST_SCREENSHOT" 2>/dev/null | cut -d'.' -f1)
                echo "   Latest: $(basename $LATEST_SCREENSHOT) ($SCREENSHOT_DATE)"
            fi
        else
            check_warn "No screenshots found (bot may not have run yet)"
        fi
    else
        check_warn "feed-screens directory not found"
    fi
else
    check_warn "Logs directory not found"
fi
echo ""

# 8. Check recent PM2 logs
echo "8️⃣  Checking Recent Bot Logs..."
if command -v pm2 &> /dev/null && pm2 list | grep -q "riona-bot"; then
    echo "   Last 10 log lines:"
    echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    pm2 logs riona-bot --lines 10 --nostream 2>/dev/null | tail -10 | sed 's/^/   /'
    echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check for common errors
    if pm2 logs riona-bot --lines 50 --nostream 2>/dev/null | grep -q "Waiting for selector.*failed"; then
        check_fail "Login timeout errors detected"
        echo "   💡 Bot can't find Instagram login form"
    fi
    
    if pm2 logs riona-bot --lines 50 --nostream 2>/dev/null | grep -q "Cookies file does not exist"; then
        check_fail "Bot is trying to use cookies but they don't exist"
        echo "   💡 Generate cookies with: node generate-cookies.js"
    fi
    
    if pm2 logs riona-bot --lines 50 --nostream 2>/dev/null | grep -q "Successfully logged in with cookies"; then
        check_pass "Bot successfully logged in with cookies"
    fi
    
    if pm2 logs riona-bot --lines 50 --nostream 2>/dev/null | grep -q "HTTP ERROR 429"; then
        check_fail "Rate limiting detected (429 errors)"
        echo "   💡 Instagram is blocking requests. Enable proxy or wait 30-60 minutes"
    fi
fi
echo ""

# 9. Check network connectivity
echo "9️⃣  Checking Network..."
if ping -c 1 instagram.com &> /dev/null; then
    check_pass "Can reach instagram.com"
else
    check_fail "Cannot reach instagram.com"
fi

if curl -s -o /dev/null -w "%{http_code}" https://www.instagram.com/ | grep -q "200"; then
    check_pass "Can access Instagram website (HTTP 200)"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.instagram.com/)
    check_warn "Instagram returned HTTP $HTTP_CODE"
fi
echo ""

# 10. Check disk space
echo "🔟 Checking System Resources..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}%"
else
    check_warn "Disk usage is high: ${DISK_USAGE}%"
fi

MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    check_pass "Memory usage: ${MEMORY_USAGE}%"
else
    check_warn "Memory usage is high: ${MEMORY_USAGE}%"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Diagnostic Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count issues
PASS_COUNT=$(grep -c "✓" /tmp/diagnostic_output 2>/dev/null || echo "0")
FAIL_COUNT=$(grep -c "✗" /tmp/diagnostic_output 2>/dev/null || echo "0")
WARN_COUNT=$(grep -c "⚠" /tmp/diagnostic_output 2>/dev/null || echo "0")

echo ""
echo "🎯 Recommended Actions:"
echo ""

# Check if cookies are the issue
if [ ! -f "cookies/Instagramcookies.json" ] || [ ! -s "cookies/Instagramcookies.json" ]; then
    echo "1. 🔴 CRITICAL: Generate Instagram cookies"
    echo "   Run on your local machine (not VPS):"
    echo "   $ node generate-cookies.js"
    echo "   Then upload to VPS:"
    echo "   $ scp cookies/Instagramcookies.json root@167.88.165.161:/root/Riona-AI-Agent/cookies/"
    echo ""
fi

# Check if build is needed
if [ ! -f "build/index.js" ]; then
    echo "2. 🔴 CRITICAL: Compile TypeScript"
    echo "   $ cd /root/Riona-AI-Agent"
    echo "   $ npx tsc"
    echo ""
fi

# Check if bot needs restart
if pm2 list | grep "riona-bot" | grep -q "errored"; then
    echo "3. 🟠 HIGH: Restart bot"
    echo "   $ pm2 restart riona-bot"
    echo "   $ pm2 logs riona-bot --lines 0"
    echo ""
fi

# Check if proxy is needed
if pm2 logs riona-bot --lines 50 --nostream 2>/dev/null | grep -q "429"; then
    echo "4. 🟠 HIGH: Enable proxy (rate limited)"
    echo "   Configure proxy in dashboard: http://167.88.165.161"
    echo "   Or edit .env file and add:"
    echo "   PROXY_ENABLED=true"
    echo "   PROXY_HOST=your.proxy.com"
    echo "   PROXY_PORT=8080"
    echo ""
fi

echo "📖 For detailed troubleshooting, see:"
echo "   - BOT-AUDIT-REPORT.md (full audit)"
echo "   - QUICK-FIX.md (step-by-step fix guide)"
echo ""
echo "🔗 Dashboard: http://167.88.165.161"
echo "📝 Logs: pm2 logs riona-bot --lines 50"
echo ""

