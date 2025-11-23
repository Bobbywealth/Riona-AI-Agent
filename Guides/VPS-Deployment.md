# 🚀 VPS Deployment Guide - Instagram Bot

Deploy your Instagram bot to run 24/7 from anywhere in the world!

---

## **Quick Start (DigitalOcean - Recommended)**

### **Step 1: Create a VPS (5 minutes)**

1. **Sign up for DigitalOcean:**
   - Go to https://digitalocean.com
   - Get $200 free credit for 60 days (new users)

2. **Create a Droplet:**
   - Click "Create" → "Droplets"
   - **Choose Image:** Ubuntu 22.04 LTS
   - **Choose Plan:** Basic ($6/month - 1GB RAM)
   - **Choose Region:** Closest to you or your target audience
   - **Authentication:** SSH Key (recommended) or Password
   - **Hostname:** `instagram-bot`
   - Click "Create Droplet"

3. **Get Your IP Address:**
   ```
   Example: 142.93.123.456
   ```
   Save this - you'll need it!

---

### **Step 2: Connect to Your VPS**

**From Mac/Linux:**
```bash
ssh root@YOUR_VPS_IP
# Enter password when prompted
```

**From Windows:**
- Download [PuTTY](https://www.putty.org/)
- Enter your VPS IP
- Login as `root`

---

### **Step 3: Install Dependencies (One Command)**

Copy and paste this entire block:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Git
apt-get install -y git

# Install PM2 (keeps bot running)
npm install -g pm2

# Install Chrome dependencies for Puppeteer
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

echo "✅ All dependencies installed!"
```

---

### **Step 4: Deploy Your Bot**

#### **Option A: From GitHub (Recommended)**

1. **Push your code to GitHub:**
   ```bash
   # On your local machine
   cd /Users/bobbyc/Desktop/Riona-AI-Agent-main
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/instagram-bot.git
   git push -u origin main
   ```

2. **Clone on VPS:**
   ```bash
   # On VPS
   cd /root
   git clone https://github.com/YOUR_USERNAME/instagram-bot.git
   cd instagram-bot
   ```

#### **Option B: Upload Directly (Easier)**

**From your Mac:**
```bash
# Compress your project
cd /Users/bobbyc/Desktop
tar -czf bot.tar.gz Riona-AI-Agent-main/

# Upload to VPS
scp bot.tar.gz root@YOUR_VPS_IP:/root/

# On VPS, extract it
ssh root@YOUR_VPS_IP
cd /root
tar -xzf bot.tar.gz
cd Riona-AI-Agent-main
```

---

### **Step 5: Configure Environment**

Create `.env` file on VPS:

```bash
nano .env
```

Paste your configuration:
```env
# Instagram Credentials
IGusername=your_instagram_username
IGpassword=your_instagram_password

# Gemini API Keys
GEMINI_API_KEY_1=your_gemini_api_key
GEMINI_API_KEY_2=your_second_key_optional

# MongoDB (Use MongoDB Atlas - free tier)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/instagram-bot?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_random_secret_key_here

# Server Port
PORT=3000

# Proxy (Optional)
PROXY_ENABLED=false
PROXY_HOST=
PROXY_PORT=

# Scheduler (Optional)
ENABLE_SCHEDULER=false
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

---

### **Step 6: Install & Build**

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test if it works
npm start
```

**Press `Ctrl+C` to stop** once you confirm it works.

---

### **Step 7: Run with PM2 (24/7)**

```bash
# Start bot with PM2
pm2 start npm --name "instagram-bot" -- start

# Make it auto-restart on server reboot
pm2 startup
pm2 save

# Check status
pm2 status

# View logs
pm2 logs instagram-bot
```

---

### **Step 8: Access Your Dashboard**

Open in your browser:
```
http://YOUR_VPS_IP:3000/dashboard.html
```

🎉 **You can now control your bot from anywhere!**

---

## **Useful PM2 Commands**

```bash
# View logs
pm2 logs instagram-bot

# Restart bot
pm2 restart instagram-bot

# Stop bot
pm2 stop instagram-bot

# Delete bot
pm2 delete instagram-bot

# Monitor resources
pm2 monit
```

---

## **Security: Add Password Protection**

### **Option 1: Nginx with Basic Auth (Recommended)**

```bash
# Install Nginx
apt install -y nginx apache2-utils

# Create password
htpasswd -c /etc/nginx/.htpasswd admin
# Enter password when prompted

# Configure Nginx
nano /etc/nginx/sites-available/instagram-bot
```

Paste this:
```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;

    location / {
        auth_basic "Instagram Bot Dashboard";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/instagram-bot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and restart
nginx -t
systemctl restart nginx

# Now access via: http://YOUR_VPS_IP (no :3000 needed)
```

### **Option 2: Firewall (Basic)**

```bash
# Allow only your IP
ufw allow from YOUR_HOME_IP to any port 3000
ufw allow 22  # SSH
ufw enable
```

---

## **Add SSL Certificate (HTTPS)**

```bash
# Get a domain name (e.g., bot.yourdomain.com)
# Point it to your VPS IP

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d bot.yourdomain.com

# Auto-renewal is set up automatically!
```

Now access via: `https://bot.yourdomain.com`

---

## **Monitoring & Maintenance**

### **Check Bot Status**
```bash
pm2 status
pm2 logs instagram-bot --lines 50
```

### **Update Bot**
```bash
cd /root/Riona-AI-Agent-main
git pull  # If using GitHub
npm install
npm run build
pm2 restart instagram-bot
```

### **Check Server Resources**
```bash
htop  # Install: apt install htop
df -h  # Disk space
free -h  # Memory
```

### **Backup**
```bash
# Backup .env and cookies
tar -czf backup-$(date +%Y%m%d).tar.gz .env cookies/
```

---

## **Troubleshooting**

### **Problem: "Cannot connect to dashboard"**
```bash
# Check if bot is running
pm2 status

# Check logs
pm2 logs instagram-bot

# Check firewall
ufw status

# Restart bot
pm2 restart instagram-bot
```

### **Problem: "Puppeteer Chrome not found"**
```bash
# Install Chrome dependencies again
apt-get install -y chromium-browser
```

### **Problem: "Out of memory"**
```bash
# Upgrade to 2GB RAM droplet ($12/month)
# Or add swap space:
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### **Problem: "MongoDB connection failed"**
- Use MongoDB Atlas (free tier): https://www.mongodb.com/cloud/atlas
- Get connection string from Atlas dashboard
- Update `MONGODB_URI` in `.env`

---

## **Cost Breakdown**

| Service | Cost | Purpose |
|---------|------|---------|
| DigitalOcean VPS | $6/mo | Server hosting |
| MongoDB Atlas | Free | Database |
| Domain (optional) | $12/yr | Custom URL |
| Proxy (optional) | $75/mo | Hide IP |
| **Total (Basic)** | **$6/mo** | Fully functional |

---

## **Alternative VPS Providers**

### **Linode** ($5/month)
```bash
# Same setup process as DigitalOcean
# Slightly cheaper
```

### **AWS EC2** (Free tier for 1 year)
```bash
# More complex but free for 12 months
# t2.micro instance
```

### **Vultr** ($6/month)
```bash
# Similar to DigitalOcean
# More server locations
```

---

## **Advanced: Run Multiple Bots**

```bash
# Copy project
cp -r instagram-bot instagram-bot-2

# Update .env with different credentials
cd instagram-bot-2
nano .env

# Run on different port
PORT=3001 pm2 start npm --name "instagram-bot-2" -- start

# Access at: http://YOUR_VPS_IP:3001/dashboard.html
```

---

## **Quick Deployment Script**

Save this as `deploy.sh`:

```bash
#!/bin/bash
echo "🚀 Deploying Instagram Bot..."

# Update code
git pull

# Install dependencies
npm install

# Build
npm run build

# Restart
pm2 restart instagram-bot

echo "✅ Deployment complete!"
pm2 logs instagram-bot --lines 20
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run it:
```bash
./deploy.sh
```

---

## **Need Help?**

1. **Check logs:** `pm2 logs instagram-bot`
2. **Check status:** `pm2 status`
3. **Restart:** `pm2 restart instagram-bot`
4. **View processes:** `htop`

---

## **Next Steps After Deployment:**

1. ✅ Access dashboard: `http://YOUR_VPS_IP:3000/dashboard.html`
2. ✅ Login with Instagram credentials
3. ✅ Configure proxy (recommended)
4. ✅ Test commenting feature
5. ✅ Enable scheduler for automation
6. ✅ Monitor logs regularly
7. ✅ Set up backups

---

**🎉 Congratulations! Your Instagram bot is now running 24/7!**

Access it from anywhere:
- 💻 Your laptop
- 📱 Your phone
- 🌍 Anywhere with internet

**Dashboard:** `http://YOUR_VPS_IP:3000/dashboard.html`


