# 🪟 Windows VPS Deployment Guide - Instagram Bot

Deploy your Instagram bot on Windows VPS (Cloudzy or any Windows Server)

---

## **Quick Start (Windows VPS)**

### **Step 1: Connect to Your Windows VPS**

**Option A: Remote Desktop (Recommended)**
1. Press `Windows + R`
2. Type `mstsc` and press Enter
3. Enter your VPS IP address
4. Enter username (usually `Administrator`) and password
5. Click "Connect"

**Option B: From Mac**
1. Download "Microsoft Remote Desktop" from App Store
2. Add PC with your VPS IP
3. Connect with credentials

---

### **Step 2: Install Node.js**

1. **Download Node.js:**
   - Open browser on VPS
   - Go to: https://nodejs.org
   - Download "LTS" version (20.x)
   - Run installer
   - Click "Next" through all steps
   - ✅ Check "Automatically install necessary tools"

2. **Verify Installation:**
   - Open PowerShell (Right-click Start → Windows PowerShell)
   ```powershell
   node --version
   npm --version
   ```

---

### **Step 3: Install Git (Optional but Recommended)**

1. Download Git: https://git-scm.com/download/win
2. Run installer with default settings
3. Verify:
   ```powershell
   git --version
   ```

---

### **Step 4: Transfer Your Bot**

**Option A: Copy Files Directly (Easiest)**
1. On your Mac, compress the folder:
   ```bash
   cd /Users/bobbyc/Desktop
   zip -r instagram-bot.zip Riona-AI-Agent-main/
   ```

2. On Windows VPS:
   - Open browser
   - Upload `instagram-bot.zip` to Google Drive/Dropbox
   - Download on VPS
   - Right-click → "Extract All"
   - Extract to `C:\instagram-bot`

**Option B: Using Git**
```powershell
# On Windows VPS
cd C:\
git clone https://github.com/YOUR_USERNAME/instagram-bot.git
cd instagram-bot
```

**Option C: Direct Copy via RDP**
1. In Remote Desktop Connection, click "Show Options"
2. Go to "Local Resources" tab
3. Click "More" under "Local devices and resources"
4. Check "Drives"
5. Connect
6. On VPS, open File Explorer
7. You'll see your Mac's drives
8. Copy folder from Mac to `C:\instagram-bot`

---

### **Step 5: Install Dependencies**

Open PowerShell as Administrator:

```powershell
# Navigate to project
cd C:\instagram-bot

# Install dependencies
npm install

# Install PM2 for Windows
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

---

### **Step 6: Configure Environment**

Create `.env` file:

```powershell
# Create .env file
notepad .env
```

Paste this configuration:
```env
# Instagram Credentials
IGusername=your_instagram_username
IGpassword=your_instagram_password

# Gemini API Keys
GEMINI_API_KEY_1=your_gemini_api_key

# MongoDB Atlas (Free tier)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/instagram-bot?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_random_secret_key_here

# Server Port
PORT=3000

# Proxy (Optional)
PROXY_ENABLED=false
PROXY_HOST=
PROXY_PORT=

# Scheduler
ENABLE_SCHEDULER=false
```

**Save:** File → Save, then close Notepad

---

### **Step 7: Build Project**

```powershell
npm run build
```

---

### **Step 8: Start Bot with PM2**

```powershell
# Start bot
pm2 start npm --name "instagram-bot" -- start

# Save configuration
pm2 save

# View status
pm2 status

# View logs
pm2 logs instagram-bot
```

---

### **Step 9: Configure Windows Firewall**

```powershell
# Allow port 3000
New-NetFirewallRule -DisplayName "Instagram Bot" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

Or manually:
1. Open "Windows Defender Firewall with Advanced Security"
2. Click "Inbound Rules" → "New Rule"
3. Select "Port" → Next
4. TCP, Specific local ports: `3000` → Next
5. Allow the connection → Next
6. Check all profiles → Next
7. Name: "Instagram Bot" → Finish

---

### **Step 10: Access Dashboard**

Open browser:
```
http://YOUR_VPS_IP:3000/dashboard.html
```

🎉 **Your bot is now running on Windows!**

---

## **Windows-Specific PM2 Commands**

```powershell
# View logs
pm2 logs instagram-bot

# Restart bot
pm2 restart instagram-bot

# Stop bot
pm2 stop instagram-bot

# Delete bot
pm2 delete instagram-bot

# List all processes
pm2 list

# Monitor
pm2 monit

# Startup on boot (already configured)
pm2 save
```

---

## **Auto-Start on Windows Reboot**

Already configured with `pm2-windows-startup`, but to verify:

```powershell
# Check startup
pm2 startup

# Save current processes
pm2 save
```

---

## **Update Bot**

```powershell
cd C:\instagram-bot

# If using Git
git pull

# Rebuild
npm install
npm run build

# Restart
pm2 restart instagram-bot
```

---

## **Troubleshooting**

### **Problem: "Node not recognized"**
**Solution:**
1. Restart PowerShell
2. Or add to PATH manually:
   - Search "Environment Variables"
   - Edit PATH
   - Add: `C:\Program Files\nodejs\`

### **Problem: "Cannot find Chrome"**
**Solution:**
```powershell
# Install Chrome
# Download from: https://www.google.com/chrome/
# Or use Edge (already installed on Windows)
```

### **Problem: "Port 3000 already in use"**
**Solution:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F

# Or use different port
$env:PORT=3001
pm2 restart instagram-bot
```

### **Problem: "PM2 not starting on reboot"**
**Solution:**
```powershell
# Reinstall startup
pm2 unstartup
pm2-startup install
pm2 save
```

### **Problem: "Dashboard not accessible"**
**Solution:**
1. Check firewall (see Step 9)
2. Check if bot is running: `pm2 status`
3. Check logs: `pm2 logs instagram-bot`
4. Restart: `pm2 restart instagram-bot`

---

## **Security (Windows)**

### **1. Windows Firewall Rules**

```powershell
# Allow only specific IP (your home IP)
New-NetFirewallRule -DisplayName "Instagram Bot - Restricted" `
    -Direction Inbound `
    -LocalPort 3000 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress YOUR_HOME_IP
```

### **2. Change Default RDP Port**

```powershell
# Change RDP from 3389 to 33890
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -name "PortNumber" -Value 33890

# Restart
Restart-Computer
```

### **3. Use Strong Passwords**
- For Administrator account
- For dashboard (add authentication)

---

## **Performance Optimization**

### **1. Disable Unnecessary Services**

```powershell
# Disable Windows Search
Stop-Service "WSearch" -Force
Set-Service "WSearch" -StartupType Disabled

# Disable Windows Update (optional)
Stop-Service "wuauserv" -Force
Set-Service "wuauserv" -StartupType Disabled
```

### **2. Increase Virtual Memory**

1. Right-click "This PC" → Properties
2. Advanced system settings
3. Performance → Settings
4. Advanced → Virtual memory → Change
5. Uncheck "Automatically manage"
6. Custom size: 4096 MB (min) - 8192 MB (max)
7. OK → Restart

---

## **Monitoring**

### **Task Manager**
- Press `Ctrl + Shift + Esc`
- Check CPU, Memory usage
- Look for `node.exe` process

### **PM2 Monitoring**
```powershell
pm2 monit
```

### **Logs Location**
```powershell
# PM2 logs
C:\Users\Administrator\.pm2\logs\

# View in real-time
pm2 logs instagram-bot --lines 100
```

---

## **Backup**

```powershell
# Backup important files
cd C:\instagram-bot
Compress-Archive -Path .env,cookies -DestinationPath "C:\backup-$(Get-Date -Format 'yyyyMMdd').zip"
```

---

## **Useful PowerShell Commands**

```powershell
# Check Windows version
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"

# Check disk space
Get-PSDrive C

# Check memory
Get-WmiObject -Class Win32_ComputerSystem | Select-Object TotalPhysicalMemory

# Check network
Test-NetConnection YOUR_VPS_IP -Port 3000

# Restart computer
Restart-Computer

# Shutdown
Stop-Computer
```

---

## **Cloudzy-Specific Tips**

### **1. Access Cloudzy Panel**
- Login to: https://cloudzy.com/client/
- Manage VPS: Start, Stop, Restart
- View IP address
- Change password

### **2. Cloudzy Firewall**
- Check Cloudzy control panel
- Ensure port 3000 is open
- Add firewall rules if needed

### **3. Cloudzy Support**
- 24/7 support available
- Live chat on website
- Ticket system

---

## **Cost (Cloudzy)**

| Plan | RAM | Storage | Price |
|------|-----|---------|-------|
| Basic | 2GB | 40GB | ~$10/mo |
| Standard | 4GB | 80GB | ~$20/mo |
| Premium | 8GB | 160GB | ~$40/mo |

**Recommended:** Basic plan (2GB RAM) is enough

---

## **Alternative: Run Without PM2 (Simple)**

If PM2 gives issues:

### **1. Create Startup Script**

Create `start-bot.bat`:
```batch
@echo off
cd C:\instagram-bot
npm start
```

### **2. Add to Windows Startup**

1. Press `Win + R`
2. Type `shell:startup`
3. Copy `start-bot.bat` here
4. Bot will start on Windows boot

### **3. Run as Windows Service (Advanced)**

```powershell
# Install node-windows
npm install -g node-windows

# Create service script
```

---

## **Quick Commands Cheat Sheet**

```powershell
# Navigate to project
cd C:\instagram-bot

# Start bot
pm2 start npm --name "instagram-bot" -- start

# Stop bot
pm2 stop instagram-bot

# Restart bot
pm2 restart instagram-bot

# View logs
pm2 logs instagram-bot

# Status
pm2 status

# Update bot
git pull
npm install
npm run build
pm2 restart instagram-bot

# Check if port is open
Test-NetConnection localhost -Port 3000
```

---

## **Differences from Linux/Ubuntu**

| Feature | Linux | Windows |
|---------|-------|---------|
| Package Manager | apt | npm/chocolatey |
| Process Manager | PM2 | PM2 (same) |
| Firewall | ufw | Windows Firewall |
| Remote Access | SSH | RDP |
| File Paths | / | \ or / |
| Commands | bash | PowerShell |

---

## **Next Steps**

1. ✅ Bot is running: `pm2 status`
2. ✅ Access dashboard: `http://YOUR_VPS_IP:3000/dashboard.html`
3. ✅ Configure proxy (recommended)
4. ✅ Test commenting feature
5. ✅ Enable scheduler
6. ✅ Monitor logs: `pm2 logs instagram-bot`

---

## **Need Help?**

1. **Check logs:** `pm2 logs instagram-bot`
2. **Restart:** `pm2 restart instagram-bot`
3. **Check status:** `pm2 status`
4. **Cloudzy support:** https://cloudzy.com/support/

---

**🎉 Your Instagram bot is now running 24/7 on Windows VPS!**

**Dashboard:** `http://YOUR_VPS_IP:3000/dashboard.html`

Control from anywhere:
- 💻 Your computer
- 📱 Your phone  
- 🌍 Anywhere with internet


