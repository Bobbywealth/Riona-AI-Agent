# Using Proxy Configuration in Dashboard

## ✅ What I Just Added

I've added a **Proxy Settings** section to your dashboard! Now you can configure proxies directly from the web interface instead of manually editing files.

## 🚀 How to Use It

### Step 1: Deploy to Your VPS

Run these commands on your VPS:

```bash
cd /root/Riona-AI-Agent
git pull
npx tsc
pm2 restart riona-bot
```

### Step 2: Access the Dashboard

Open your browser and go to:
```
http://167.88.165.161
```

### Step 3: Configure Proxy

1. **Login** to the dashboard with your Instagram credentials
2. Scroll down to the **"Proxy Settings"** card (🌐 icon)
3. Check the **"Enable Proxy"** checkbox
4. Fill in your proxy details:
   - **Proxy Host**: e.g., `proxy.example.com` or `123.45.67.89`
   - **Proxy Port**: e.g., `8080`
   - **Proxy Username**: (optional, if your proxy requires auth)
   - **Proxy Password**: (optional, if your proxy requires auth)
5. Click **"Save Proxy Settings"**
6. **Restart the bot** from your VPS:
   ```bash
   pm2 restart riona-bot
   ```

### Step 4: Verify Proxy is Working

Check the logs to confirm:
```bash
pm2 logs riona-bot --lines 20
```

You should see:
```
info: 🔒 Using proxy: http://****:****@your-proxy-server.com:8080
```

## 📋 Where to Get Proxies

### Free Proxies (Not Recommended)
- https://www.proxy-list.download/
- https://free-proxy-list.net/

**Example Configuration:**
```
Host: 123.45.67.89
Port: 8080
Username: (leave empty)
Password: (leave empty)
```

### Paid Proxies (Recommended)

#### IPRoyal ($1.75/GB) - Cheapest
- Website: https://iproyal.com/
- Good for: Budget-conscious users
- Setup: Get HTTP proxy credentials from dashboard

#### Smartproxy ($12.5/GB)
- Website: https://smartproxy.com/
- Good for: Reliable residential IPs
- Setup: Create HTTP proxy user in dashboard

#### Bright Data ($5/GB)
- Website: https://brightdata.com/
- Good for: Enterprise-level reliability
- Setup: Create proxy zone and get credentials

#### Oxylabs ($8/GB)
- Website: https://oxylabs.io/
- Good for: High-quality residential proxies
- Setup: Get HTTP proxy credentials from dashboard

## 🔧 Troubleshooting

### Proxy Not Working?

1. **Check the logs:**
   ```bash
   pm2 logs riona-bot --lines 50
   ```

2. **Test your proxy manually:**
   ```bash
   curl -x http://username:password@proxy-host:port https://api.ipify.org
   ```
   This should return your proxy's IP address, not your VPS IP.

3. **Common Issues:**
   - **Wrong credentials**: Double-check username/password
   - **Blocked port**: Some VPS providers block certain ports
   - **Proxy offline**: Try a different proxy server
   - **Format error**: Make sure host doesn't include `http://`

### Still Getting Rate Limited?

Even with a proxy, you might get rate limited if:
- The proxy IP is already flagged by Instagram
- You're making too many requests too quickly
- The proxy is a datacenter proxy (use residential instead)

**Solutions:**
1. Use **residential proxies** instead of datacenter proxies
2. **Rotate proxies** every 10-20 requests
3. **Reduce bot activity** in `src/config/adrian-style.ts`
4. **Add longer delays** between actions

## 💡 Best Practices

1. **Use Residential Proxies**: Instagram trusts residential IPs more than datacenter IPs
2. **Rotate IPs**: Change proxy every few hours or after X requests
3. **One Account Per IP**: Don't use the same proxy for multiple Instagram accounts
4. **Monitor Success Rate**: If actions start failing, switch proxies
5. **Warm Up Proxies**: Start with low activity (5-10 actions/day) for new proxies

## 🔒 Security Note

Your proxy credentials are saved to the `.env` file on your VPS. Make sure:
- Never commit `.env` to Git (it's in `.gitignore`)
- Use strong passwords
- Don't share your VPS access with untrusted users

## 📊 Proxy vs No Proxy Comparison

| Feature | No Proxy | Free Proxy | Paid Residential Proxy |
|---------|----------|------------|------------------------|
| **Cost** | Free | Free | $5-50/month |
| **Rate Limit Risk** | High | Medium-High | Low |
| **Detection Risk** | High | Medium-High | Low |
| **Speed** | Fast | Slow | Medium-Fast |
| **Reliability** | High | Low | High |
| **Recommended For** | Testing | Not recommended | Production use |

## 🎯 Next Steps

After setting up your proxy:
1. Wait 30 minutes from your last rate limit
2. Login to Instagram via the dashboard
3. Start with small actions (5-10 likes/comments)
4. Monitor logs for any issues
5. Gradually increase activity if successful

Need help? Check the logs and let me know what errors you see!

