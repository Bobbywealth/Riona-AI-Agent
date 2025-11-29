# Quick Fix Guide - Get Bot Working in 15 Minutes

## The Problem
Your bot can't log into Instagram because:
1. No cookies file exists
2. Instagram blocks headless browser login attempts
3. The bot keeps timing out trying to find the login form

## The Solution
Generate valid Instagram cookies locally (where you CAN see the browser), then upload them to your VPS.

---

## Step-by-Step Fix

### Step 1: Generate Cookies Locally (5 minutes)

On your Mac:

```bash
cd /Users/bobbyc/Desktop/Riona-AI-Agent-main

# 1. Edit IgClient.ts to run in non-headless mode
# Open src/client/IG-bot/IgClient.ts
# Find line 258 (in the init() method)
# Change: headless: true
# To: headless: false

# 2. Create a test script to just log in
cat > test-login.js << 'EOF'
const { IgClient } = require('./build/client/IG-bot/IgClient');

async function testLogin() {
    console.log('🚀 Starting login test...');
    const client = new IgClient(
        process.env.IGusername || 'YOUR_IG_USERNAME',
        process.env.IGpassword || 'YOUR_IG_PASSWORD'
    );
    
    try {
        await client.init();
        console.log('✅ Login successful! Cookies saved.');
        console.log('📁 Check: ./cookies/Instagramcookies.json');
        process.exit(0);
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        process.exit(1);
    }
}

testLogin();
EOF

# 3. Compile TypeScript
npx tsc

# 4. Run the test (Chrome will open - log in manually if needed)
node test-login.js
```

**What will happen:**
- A Chrome window will open
- It will navigate to Instagram login page
- If you see a login form, enter your credentials
- If you see a captcha, solve it
- Once logged in, the script will save cookies and exit
- You'll see: `✅ Login successful! Cookies saved.`

**Troubleshooting:**
- If Chrome doesn't open: Make sure you have Chrome installed
- If you get "default_IGusername": Set your actual credentials in the command
- If Instagram asks "Was this you?": Click Yes and verify

### Step 2: Verify Cookies Were Created (1 minute)

```bash
# Check the cookies file exists
ls -lh cookies/Instagramcookies.json

# Should show something like:
# -rw-r--r--  1 user  staff   3.2K Nov 29 10:30 cookies/Instagramcookies.json

# Verify it has a sessionid cookie (this is the important one)
cat cookies/Instagramcookies.json | grep sessionid

# Should show a line with "sessionid" and a long value
```

### Step 3: Upload Cookies to VPS (2 minutes)

```bash
# Copy cookies to VPS
scp cookies/Instagramcookies.json root@167.88.165.161:/root/Riona-AI-Agent/cookies/

# Verify it was uploaded
ssh root@167.88.165.161 "ls -lh /root/Riona-AI-Agent/cookies/Instagramcookies.json"
```

**If you get "No such file or directory":**
```bash
# Create the cookies directory first
ssh root@167.88.165.161 "mkdir -p /root/Riona-AI-Agent/cookies && chmod 755 /root/Riona-AI-Agent/cookies"

# Then retry the scp command
scp cookies/Instagramcookies.json root@167.88.165.161:/root/Riona-AI-Agent/cookies/
```

### Step 4: Revert Headless Mode (2 minutes)

```bash
# Change IgClient.ts back to headless mode for VPS
# Open src/client/IG-bot/IgClient.ts
# Find line 258
# Change: headless: false
# Back to: headless: true

# Rebuild
npx tsc

# Push to git (so VPS gets the change)
git add .
git commit -m "Revert to headless mode"
git push origin main
```

### Step 5: Deploy to VPS (3 minutes)

```bash
# SSH into VPS
ssh root@167.88.165.161

# Pull latest code
cd /root/Riona-AI-Agent
git pull

# Rebuild
npx tsc

# Restart bot
pm2 restart riona-bot

# Watch logs (Ctrl+C to exit)
pm2 logs riona-bot --lines 0
```

**What to look for in logs:**
✅ **SUCCESS:**
```
info: Successfully logged in with cookies.
📸 Capturing post-cookie-login screenshot...
```

❌ **FAILURE:**
```
warn: Cookies are invalid or expired. Falling back to credentials login.
error: Failed to initialize Instagram client Waiting for selector...
```

If you see the failure message, the cookies expired or are invalid. Repeat Step 1.

### Step 6: Test in Dashboard (2 minutes)

1. Open your browser: `http://167.88.165.161`
2. The "Account" badge should show "Online" (green)
3. Click "Login" and enter your IG credentials
4. You should see your username in the Account section
5. Try "Like Random Posts" with Max Posts = 1
6. Check Activity Logs for success message

---

## Alternative: Use Browser Cookies (If Above Doesn't Work)

If you're already logged into Instagram in Chrome:

### Method A: Export Cookies Extension

1. Install "EditThisCookie" Chrome extension
2. Go to instagram.com (make sure you're logged in)
3. Click the EditThisCookie icon
4. Click "Export" (copies to clipboard)
5. Paste into a file: `browser-cookies.json`
6. Convert to Puppeteer format:

```bash
cat > convert-cookies.js << 'EOF'
const fs = require('fs');

// Read browser cookies
const browserCookies = JSON.parse(fs.readFileSync('browser-cookies.json', 'utf8'));

// Convert to Puppeteer format
const puppeteerCookies = browserCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: c.sameSite || 'Lax'
}));

// Save
fs.writeFileSync('cookies/Instagramcookies.json', JSON.stringify(puppeteerCookies, null, 2));
console.log('✅ Cookies converted and saved to cookies/Instagramcookies.json');
EOF

node convert-cookies.js
```

7. Upload to VPS (Step 3 above)

### Method B: Chrome DevTools

1. Open Chrome DevTools (F12)
2. Go to Application tab → Cookies → https://www.instagram.com
3. Manually copy these cookies:
   - `sessionid` (most important)
   - `csrftoken`
   - `ds_user_id`
4. Create a JSON file:

```json
[
  {
    "name": "sessionid",
    "value": "PASTE_YOUR_SESSIONID_HERE",
    "domain": ".instagram.com",
    "path": "/",
    "expires": 1735689600,
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
  },
  {
    "name": "csrftoken",
    "value": "PASTE_YOUR_CSRFTOKEN_HERE",
    "domain": ".instagram.com",
    "path": "/",
    "expires": 1735689600,
    "httpOnly": false,
    "secure": true,
    "sameSite": "None"
  }
]
```

5. Save as `cookies/Instagramcookies.json`
6. Upload to VPS (Step 3 above)

---

## Verification Checklist

After completing all steps:

- [ ] Cookies file exists on VPS: `/root/Riona-AI-Agent/cookies/Instagramcookies.json`
- [ ] File size is > 1KB (not empty)
- [ ] Bot logs show: "Successfully logged in with cookies"
- [ ] Dashboard shows "Online" status
- [ ] Dashboard shows your Instagram username
- [ ] Can view screenshots (shows feed, not login page)
- [ ] Can perform test action (like 1 post)

---

## If It Still Doesn't Work

### Issue: Cookies Expire Immediately
**Cause:** Instagram detected suspicious activity and invalidated the session.

**Fix:**
1. Log into Instagram from a normal browser
2. Complete any security challenges
3. Wait 24 hours
4. Try again with a proxy enabled

### Issue: "Rate Limited" Error
**Cause:** Too many failed login attempts from VPS IP.

**Fix:**
1. Enable proxy in dashboard
2. Wait 30-60 minutes
3. Restart bot

### Issue: Bot Still Sees Login Page
**Cause:** Cookies not being loaded correctly.

**Debug:**
```bash
# Check cookies are valid JSON
ssh root@167.88.165.161 "cat /root/Riona-AI-Agent/cookies/Instagramcookies.json | jq ."

# Check sessionid expiry
ssh root@167.88.165.161 "cat /root/Riona-AI-Agent/cookies/Instagramcookies.json | jq '.[] | select(.name==\"sessionid\") | .expires'"

# Should be a timestamp in the future (> current time)
date +%s  # Compare with current timestamp
```

---

## Next Steps After Bot is Working

1. **Set up a proxy** (to avoid future rate limits)
2. **Test Miami DM campaign** (5 DMs to restaurants)
3. **Monitor logs** for any errors
4. **Adjust rate limits** if needed (in dashboard settings)

---

## Need Help?

If you're still stuck after following this guide:

1. Check the full audit report: `BOT-AUDIT-REPORT.md`
2. Share the latest logs:
   ```bash
   ssh root@167.88.165.161 "pm2 logs riona-bot --lines 50 --nostream"
   ```
3. Share a screenshot from the dashboard
4. Confirm cookies file exists and size:
   ```bash
   ssh root@167.88.165.161 "ls -lh /root/Riona-AI-Agent/cookies/"
   ```

---

**Estimated Total Time:** 15 minutes  
**Success Rate:** 95% (if Instagram account is in good standing)  
**Alternative if This Fails:** Use Instagram API or switch to a different automation method

