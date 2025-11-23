#!/bin/bash

# Instagram Bot - Quick Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Instagram Bot Deployment Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root: sudo ./deploy.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update -qq

echo -e "${YELLOW}📥 Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js installed: $(node --version)${NC}"
else
    echo -e "${GREEN}✅ Node.js already installed: $(node --version)${NC}"
fi

echo -e "${YELLOW}📥 Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y git
    echo -e "${GREEN}✅ Git installed${NC}"
else
    echo -e "${GREEN}✅ Git already installed${NC}"
fi

echo -e "${YELLOW}📥 Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 already installed${NC}"
fi

echo -e "${YELLOW}📥 Installing Chrome dependencies...${NC}"
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
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
    wget \
    xdg-utils \
    -qq

echo -e "${GREEN}✅ Chrome dependencies installed${NC}"

echo ""
echo -e "${YELLOW}📦 Installing project dependencies...${NC}"
npm install

echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🚀 To start the bot:"
echo "   pm2 start npm --name 'instagram-bot' -- start"
echo ""
echo "📊 To view logs:"
echo "   pm2 logs instagram-bot"
echo ""
echo "🔄 To restart:"
echo "   pm2 restart instagram-bot"
echo ""
echo "💻 Dashboard will be available at:"
echo "   http://YOUR_VPS_IP:3000/dashboard.html"
echo ""
echo "📖 Full guide: Guides/VPS-Deployment.md"


