# 🔒 Proxy Setup Guide for Instagram Bot

Using a proxy is **highly recommended** when running Instagram bots, especially on VPS servers, to:
- Hide your real IP address
- Avoid Instagram rate limits
- Prevent account bans
- Run multiple accounts safely

---

## **Quick Setup (3 Methods)**

### **Method 1: Dashboard (Easiest)**

1. Open the dashboard: `http://localhost:3000/dashboard.html`
2. Scroll to "🔒 Proxy Settings" card
3. Enter your proxy details:
   - ✅ Enable Proxy checkbox
   - Host: `proxy.example.com`
   - Port: `8080`
   - Username: (if required)
   - Password: (if required)
4. Click "💾 Save Proxy Settings"
5. **Restart the bot** for changes to take effect

### **Method 2: Environment Variables**

Add to your `.env` file:

```env
# Proxy Configuration
PROXY_ENABLED=true
PROXY_HOST=proxy.example.com
PROXY_PORT=8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

Then restart the bot:
```bash
npm start
```

### **Method 3: Command Line**

```bash
export PROXY_ENABLED=true
export PROXY_HOST=proxy.example.com
export PROXY_PORT=8080
npm start
```

---

## **Recommended Proxy Providers**

### **1. Residential Proxies (Best for Instagram)**
- **Bright Data** (formerly Luminati) - $500/month, 40GB
- **Smartproxy** - $75/month, 5GB
- **Oxylabs** - $300/month, 20GB
- **IPRoyal** - $1.75/GB

### **2. Mobile Proxies (Most Reliable)**
- **Proxy-Cheap** - $50/month per proxy
- **Soax** - $99/month, 5GB
- **PacketStream** - $1/GB

### **3. Datacenter Proxies (Cheapest, Higher Risk)**
- **Webshare** - $2.99/month for 10 proxies
- **ProxyEmpire** - $0.04/GB
- **Proxy-Seller** - $1.77/proxy/month

---

## **Free Proxy Options (Not Recommended for Production)**

⚠️ **Warning:** Free proxies are slow, unreliable, and may get your account banned.

If testing only:
- **Free Proxy List**: https://free-proxy-list.net/
- **ProxyScrape**: https://proxyscrape.com/free-proxy-list

---

## **Testing Your Proxy**

### **1. From Dashboard:**
- Enter proxy details
- Click "🧪 Test Proxy"
- Check logs for connection status

### **2. Manual Test:**
```bash
curl --proxy http://username:password@proxy.example.com:8080 https://api.ipify.org
```

This should return your proxy's IP address, not your real IP.

### **3. Check Instagram:**
After starting the bot, check the logs:
```
🔒 Using proxy: http://****@proxy.example.com:8080
```

---

## **Proxy Format Examples**

### **HTTP Proxy (No Auth):**
```
Host: proxy.example.com
Port: 8080
```

### **HTTP Proxy (With Auth):**
```
Host: proxy.example.com
Port: 8080
Username: myuser
Password: mypass123
```

### **SOCKS5 Proxy:**
⚠️ Currently not supported. Use HTTP/HTTPS proxies only.

---

## **Best Practices**

### **✅ DO:**
- Use residential or mobile proxies for Instagram
- Rotate proxies if running multiple accounts
- Test proxy before running bot
- Use proxies from Instagram-friendly providers
- Keep proxy credentials secure

### **❌ DON'T:**
- Use free proxies for production
- Share proxies between too many accounts (max 3-5)
- Use datacenter proxies for aggressive automation
- Forget to restart bot after changing proxy settings

---

## **Troubleshooting**

### **Problem: "Proxy connection failed"**
**Solution:**
- Check proxy host and port are correct
- Verify proxy is online: `ping proxy.example.com`
- Test with curl command above
- Check firewall isn't blocking the connection

### **Problem: "Instagram login failed with proxy"**
**Solution:**
- Try a different proxy (current one may be blacklisted)
- Use residential proxy instead of datacenter
- Check proxy provider's Instagram compatibility

### **Problem: "Bot is slow with proxy"**
**Solution:**
- Use faster proxy provider
- Choose proxy server closer to your location
- Upgrade to premium proxy tier

### **Problem: "Account still got banned"**
**Solution:**
- Reduce bot activity (fewer comments/likes per day)
- Use mobile proxy instead of residential
- Ensure proxy IP matches account's usual location
- Add more random delays between actions

---

## **Proxy Rotation (Advanced)**

For running multiple accounts or high-volume automation:

1. **Get rotating proxy from provider:**
   ```
   Host: rotating.proxy.com
   Port: 8080
   ```

2. **Or use multiple proxies:**
   Create multiple `.env` files:
   - `.env.account1` with PROXY_HOST=proxy1.com
   - `.env.account2` with PROXY_HOST=proxy2.com
   
3. **Run multiple instances:**
   ```bash
   # Terminal 1
   cp .env.account1 .env && npm start
   
   # Terminal 2
   cp .env.account2 .env && PORT=3001 npm start
   ```

---

## **Security Tips**

1. **Never commit proxy credentials to Git:**
   ```bash
   # Already in .gitignore
   .env
   ```

2. **Use environment variables on VPS:**
   ```bash
   # In your VPS
   export PROXY_HOST=your_proxy.com
   export PROXY_PORT=8080
   ```

3. **Rotate passwords regularly**

4. **Monitor proxy usage** (most providers have dashboards)

---

## **Cost Comparison**

| Provider | Type | Price | Best For |
|----------|------|-------|----------|
| Bright Data | Residential | $500/mo | Enterprise |
| Smartproxy | Residential | $75/mo | Small business |
| Proxy-Cheap | Mobile | $50/mo | Single account |
| Webshare | Datacenter | $3/mo | Testing only |

---

## **Need Help?**

- Check logs: `tail -f /tmp/instagram-bot.log`
- Test proxy manually with curl
- Contact your proxy provider's support
- Try a different proxy provider

---

**Pro Tip:** Start with a cheap residential proxy (~$75/month) for testing. If it works well, you can scale up or try mobile proxies for better reliability.


