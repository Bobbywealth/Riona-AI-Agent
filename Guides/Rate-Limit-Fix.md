# Instagram Rate Limit (HTTP 429) - Fix Guide

## What's Happening?

Your bot is getting an **HTTP ERROR 429** from Instagram, which means "Too Many Requests". Instagram has detected automated behavior and is temporarily blocking your IP address.

## Why Is This Happening?

1. **Headless Browser Detection**: Instagram can detect headless browsers (browsers without a GUI)
2. **Too Many Requests**: The bot may have made too many requests too quickly
3. **IP Reputation**: Your VPS IP address may be flagged as suspicious
4. **No Cookies**: Fresh login attempts are more suspicious than cookie-based sessions

## What I've Just Fixed

I've added several improvements to make the bot more stealthy:

### 1. Better Browser Fingerprinting
- Added `--disable-blink-features=AutomationControlled` to hide automation
- Override `navigator.webdriver` property
- Mock plugins, languages, and Chrome runtime
- Better permission handling

### 2. Rate Limit Detection
- New `checkForRateLimit()` method that detects 429 errors
- Automatic detection of challenge/suspension pages
- Clear error messages with suggestions

### 3. Longer Delays
- Added 3-second delay after page load
- Better waiting for Instagram to fully render

## How to Fix This NOW

### Option 1: Wait It Out (Recommended)
Instagram rate limits are usually temporary. Wait **15-30 minutes** before trying again.

### Option 2: Use a Proxy
Add a proxy to your `.env` file:
```env
PROXY_ENABLED=true
PROXY_URL=http://username:password@proxy-server:port
```

### Option 3: Use a Different IP
- Restart your VPS router (if possible)
- Use a VPN
- Switch to a different VPS provider temporarily

### Option 4: Reduce Bot Activity
In `src/config/adrian-style.ts`, reduce the limits:
```typescript
limits: {
  likesPerDay: 20,      // Reduced from 45
  commentsPerDay: 15,   // Reduced from 30
  likesPerHour: 2,      // Reduced from 3
  commentsPerHour: 1,   // Reduced from 2
}
```

## Deploy the Fix to Your VPS

Run these commands on your VPS:

```bash
# Navigate to your project
cd /root/Riona-AI-Agent

# Pull the latest changes
git pull

# Rebuild the project
npx tsc

# Restart the bot
pm2 restart riona-bot

# Check the logs
pm2 logs riona-bot --lines 50
```

## Best Practices to Avoid Rate Limits

1. **Use Cookies**: Always login with cookies instead of credentials
2. **Add Delays**: Increase delays between actions (5-10 seconds minimum)
3. **Vary Behavior**: Don't follow the same pattern every time
4. **Use Proxy Rotation**: Rotate between multiple proxies
5. **Limit Daily Actions**: Stay well below Instagram's limits (aim for 20-30 actions/day max)
6. **Warm Up New Accounts**: Start slow with new accounts (5-10 actions/day for first week)
7. **Human-like Timing**: Only run the bot during normal hours (9 AM - 9 PM)

## Checking If You're Still Rate Limited

After waiting 30 minutes, try accessing Instagram from your VPS browser:

```bash
# Install a text-based browser
apt-get install -y lynx

# Try to access Instagram
lynx https://www.instagram.com
```

If you see "429" or "Too Many Requests", you need to wait longer or change your IP.

## Long-Term Solution

For production use, you should:

1. **Use Residential Proxies**: Services like Bright Data, Smartproxy, or Oxylabs
2. **Implement Proxy Rotation**: Switch IPs every 10-20 requests
3. **Add CAPTCHA Solving**: Use 2Captcha or Anti-Captcha services
4. **Monitor Account Health**: Track action success rates and back off when they drop
5. **Use Multiple Accounts**: Distribute actions across multiple Instagram accounts

## Need Help?

If you're still getting rate limited after trying these solutions:
1. Check the screenshot at `/logs/feed-screens/` to see what Instagram is showing
2. Look at `pm2 logs riona-bot` for detailed error messages
3. Consider using a proxy service (recommended for long-term use)

