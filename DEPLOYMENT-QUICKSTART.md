# 🚀 VPS Deployment - Quick Start

## **5-Minute Deployment**

### **1. Get a VPS**
- **DigitalOcean:** https://digitalocean.com ($6/month)
- **Linode:** https://linode.com ($5/month)
- Choose: Ubuntu 22.04, 1GB RAM

### **2. Connect**
```bash
ssh root@YOUR_VPS_IP
```

### **3. Run Deployment Script**
```bash
# Upload your project
scp -r Riona-AI-Agent-main root@YOUR_VPS_IP:/root/

# SSH into VPS
ssh root@YOUR_VPS_IP

# Run deployment
cd /root/Riona-AI-Agent-main
chmod +x deploy.sh
./deploy.sh
```

### **4. Configure**
```bash
nano .env
# Add your Instagram credentials, Gemini API key, MongoDB URI
```

### **5. Start Bot**
```bash
pm2 start npm --name "instagram-bot" -- start
pm2 save
pm2 startup
```

### **6. Access Dashboard**
```
http://YOUR_VPS_IP:3000/dashboard.html
```

---

## **Essential Commands**

```bash
# View logs
pm2 logs instagram-bot

# Restart
pm2 restart instagram-bot

# Stop
pm2 stop instagram-bot

# Status
pm2 status
```

---

## **Full Guide**
See `Guides/VPS-Deployment.md` for complete instructions.

---

## **Cost**
- **VPS:** $6/month (DigitalOcean)
- **MongoDB:** Free (Atlas)
- **Total:** $6/month

---

## **Support**
- Check logs: `pm2 logs instagram-bot`
- Restart: `pm2 restart instagram-bot`
- Full guide: `Guides/VPS-Deployment.md`
