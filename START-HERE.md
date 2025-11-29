# 🚀 Start Here - Instagram Bot Fix

**Your bot is not working. Here's how to fix it in 20 minutes.**

---

## ⚡ Quick Start (Do This First)

### Step 1: Generate Instagram Cookies (15 min)

On your Mac, run:

```bash
cd /Users/bobbyc/Desktop/Riona-AI-Agent-main
node generate-cookies.js
```

**What happens:**
- Chrome browser opens
- You log into Instagram manually
- Cookies are saved automatically
- File created: `./cookies/Instagramcookies.json`

**If you get an error:** Make sure you have the dependencies installed:
```bash
npm install
```

### Step 2: Upload to VPS (1 min)

```bash
scp cookies/Instagramcookies.json root@167.88.165.161:/root/Riona-AI-Agent/cookies/
```

**If directory doesn't exist:**
```bash
ssh root@167.88.165.161 "mkdir -p /root/Riona-AI-Agent/cookies && chmod 755 /root/Riona-AI-Agent/cookies"
# Then retry the scp command
```

### Step 3: Restart Bot (1 min)

```bash
ssh root@167.88.165.161 "cd /root/Riona-AI-Agent && pm2 restart riona-bot"
```

### Step 4: Verify It Worked (2 min)

```bash
ssh root@167.88.165.161 "pm2 logs riona-bot --lines 20"
```

**Look for this line:**
```
info: Successfully logged in with cookies.
```

**If you see this instead:**
```
error: Failed to initialize Instagram client Waiting for selector...
```
→ The cookies didn't work. Try generating them again.

---

## ✅ How to Know It's Fixed

### Check the Dashboard
1. Open: http://167.88.165.161
2. Look at the "Account" badge
3. Should show: 🟢 **Online** (green)
4. Should show your Instagram username

### Test a Simple Action
1. In dashboard, go to "Post Engagement"
2. Select "Feed" mode
3. Set "Max Posts" to 1
4. Click "Start Interaction"
5. Check "Activity Logs" for success message

---

## 📚 Documentation

I've created 4 documents for you:

### 1. **AUDIT-SUMMARY.md** ← Start here
- Simple explanation of the problem
- Quick fix steps
- What to do next
- **Read this first if you want the overview**

### 2. **QUICK-FIX.md**
- Detailed step-by-step instructions
- Multiple methods to generate cookies
- Troubleshooting for every possible issue
- **Read this if you need detailed guidance**

### 3. **BOT-AUDIT-REPORT.md**
- Full technical analysis
- Code quality review
- Architecture issues
- Long-term recommendations
- **Read this if you want to understand everything**

### 4. **This file (START-HERE.md)**
- Quickest path to get bot working
- **You're reading it now**

---

## 🔧 Tools Created

### `generate-cookies.js`
Automated script to generate Instagram cookies.

**Usage:**
```bash
node generate-cookies.js
# Or with credentials:
node generate-cookies.js YOUR_USERNAME YOUR_PASSWORD
```

### `diagnose-vps.sh`
Diagnostic script to check all bot components on VPS.

**Usage:**
```bash
ssh root@167.88.165.161
cd /root/Riona-AI-Agent
bash diagnose-vps.sh
```

This will check:
- ✅ Node.js and PM2 installed
- ✅ Environment variables configured
- ✅ Cookies exist and are valid
- ✅ Bot is running
- ✅ No errors in logs
- ✅ Network connectivity

---

## 🆘 If Something Goes Wrong

### Problem: "Permission denied" when uploading cookies
**Solution:**
```bash
# Make sure cookies directory exists on VPS
ssh root@167.88.165.161 "mkdir -p /root/Riona-AI-Agent/cookies && chmod 755 /root/Riona-AI-Agent/cookies"
```

### Problem: generate-cookies.js fails
**Solution:**
```bash
# Install dependencies
npm install

# Try again
node generate-cookies.js
```

### Problem: Chrome doesn't open
**Solution:**
You need Chrome installed. Or use the browser cookie export method (see QUICK-FIX.md).

### Problem: Bot still shows "Offline" after uploading cookies
**Solution:**
```bash
# Check if cookies were uploaded correctly
ssh root@167.88.165.161 "ls -lh /root/Riona-AI-Agent/cookies/"

# Check bot logs
ssh root@167.88.165.161 "pm2 logs riona-bot --lines 50"

# If you see "Cookies are invalid or expired", regenerate them
```

### Problem: "Rate limited" or "429 errors"
**Solution:**
1. Wait 30-60 minutes
2. Set up a proxy (see QUICK-FIX.md section on proxies)
3. Restart bot

---

## 📋 After It's Working

### Immediate Testing (5 min)
- [ ] Dashboard shows "Online"
- [ ] Can like 1 post
- [ ] Can comment on 1 post
- [ ] Can view stories
- [ ] Screenshots show real content (not login page)

### Configuration (30 min)
- [ ] Set up proxy (recommended)
- [ ] Configure rate limits (start conservative)
- [ ] Test DM functionality
- [ ] Review activity logs

### Run Miami Campaign (15 min)
1. Go to "Lead Generation" in dashboard
2. Select "Location Search"
3. Enter: `212941492/miami-florida`
4. Max Posts: 5
5. Enable "Inspect profiles"
6. Enable "Send DMs"
7. Keywords: restaurant, cafe, food, dining, chef
8. Click "Start Campaign"
9. Monitor logs for DM sends

---

## 🎯 Success Criteria

Your bot is fully operational when:

✅ Dashboard shows 🟢 "Online"  
✅ Shows your Instagram username  
✅ Can like posts without errors  
✅ Can comment on posts  
✅ Can view and reply to stories  
✅ Can send DMs  
✅ Screenshots show real Instagram content  
✅ No "Page not initialized" errors  
✅ No login timeout errors  
✅ No 429 rate limit errors  

---

## 🔗 Quick Links

- **Dashboard:** http://167.88.165.161
- **VPS Logs:** `ssh root@167.88.165.161 "pm2 logs riona-bot"`
- **VPS Status:** `ssh root@167.88.165.161 "pm2 status"`
- **Restart Bot:** `ssh root@167.88.165.161 "pm2 restart riona-bot"`

---

## 📞 Need More Help?

1. **Run the diagnostic:** `bash diagnose-vps.sh` (on VPS)
2. **Check full audit:** Read `BOT-AUDIT-REPORT.md`
3. **Detailed fix guide:** Read `QUICK-FIX.md`
4. **Share logs:** `pm2 logs riona-bot --lines 50 --nostream`

---

## ⏱️ Time Estimate

- **Generate cookies:** 15 minutes
- **Upload to VPS:** 1 minute
- **Restart bot:** 1 minute
- **Verify working:** 2 minutes
- **Test features:** 5 minutes
- **Total:** ~25 minutes

---

## 🎉 That's It!

The fix is simple: **Generate cookies locally, upload to VPS, restart bot.**

Everything else (proxy setup, rate limit tuning, campaigns) can wait until after the bot is working.

**Start now:** Run `node generate-cookies.js`

---

**Created:** November 29, 2025  
**Last Updated:** November 29, 2025

