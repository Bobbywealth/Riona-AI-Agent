#!/usr/bin/env node

/**
 * Cookie Generation Script for Instagram Bot
 * 
 * This script will:
 * 1. Open a Chrome browser window (non-headless)
 * 2. Navigate to Instagram login
 * 3. Let you log in manually
 * 4. Save the cookies to ./cookies/Instagramcookies.json
 * 5. Exit
 * 
 * Usage:
 *   node generate-cookies.js
 * 
 * Or with credentials (will auto-fill):
 *   node generate-cookies.js your_username your_password
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateCookies() {
    const username = process.argv[2];
    const password = process.argv[3];
    
    console.log('🚀 Instagram Cookie Generator');
    console.log('━'.repeat(50));
    
    if (username && password) {
        console.log(`📝 Using credentials: ${username}`);
    } else {
        console.log('ℹ️  No credentials provided - you\'ll need to log in manually');
        console.log('💡 Tip: Run with: node generate-cookies.js USERNAME PASSWORD');
    }
    
    console.log('\n⏳ Launching Chrome...');
    
    const browser = await puppeteer.launch({
        headless: false, // MUST be false so you can see and interact
        args: [
            '--window-size=1280,800',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ],
        defaultViewport: {
            width: 1280,
            height: 800
        }
    });
    
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 Navigating to Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
        timeout: 30000
    });
    
    await delay(3000);
    
    // Check if already logged in (from existing cookies)
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
        console.log('✅ Already logged in! Saving cookies...');
        await saveCookiesAndExit(page, browser);
        return;
    }
    
    // Try to auto-fill credentials if provided
    if (username && password) {
        console.log('⌨️  Auto-filling credentials...');
        try {
            await page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await delay(1000);
            
            await page.type('input[name="username"]', username, { delay: 100 });
            await delay(500);
            await page.type('input[name="password"]', password, { delay: 100 });
            await delay(1000);
            
            console.log('🔐 Submitting login form...');
            await page.click('button[type="submit"]');
            
            console.log('⏳ Waiting for login to complete...');
            console.log('   (If you see a challenge/captcha, solve it in the browser)');
            
            // Wait for navigation or stay on page if challenge appears
            await Promise.race([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                delay(60000)
            ]);
            
        } catch (error) {
            console.log('⚠️  Auto-login failed:', error.message);
            console.log('👉 Please log in manually in the browser window');
        }
    } else {
        console.log('\n👉 Please log in manually in the Chrome window that just opened');
        console.log('   1. Enter your Instagram username');
        console.log('   2. Enter your password');
        console.log('   3. Click "Log In"');
        console.log('   4. Complete any security challenges (2FA, captcha, etc.)');
        console.log('   5. Wait until you see your Instagram feed');
    }
    
    // Wait for user to complete login
    console.log('\n⏳ Waiting for you to complete login...');
    console.log('   Checking every 5 seconds if you\'re logged in...');
    
    let loggedIn = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (!loggedIn && attempts < maxAttempts) {
        await delay(5000);
        attempts++;
        
        const url = page.url();
        const cookies = await page.cookies();
        const hasSessionId = cookies.some(c => c.name === 'sessionid');
        
        if (!url.includes('/login') && hasSessionId) {
            loggedIn = true;
            console.log('✅ Login detected!');
        } else {
            process.stdout.write(`\r   Still waiting... (${attempts * 5}s elapsed)`);
        }
    }
    
    if (!loggedIn) {
        console.log('\n\n❌ Timeout: Login not completed within 5 minutes');
        console.log('   Please try again and log in faster');
        await browser.close();
        process.exit(1);
    }
    
    console.log('\n\n🎉 Login successful!');
    await saveCookiesAndExit(page, browser);
}

async function saveCookiesAndExit(page, browser) {
    console.log('💾 Saving cookies...');
    
    const cookies = await page.cookies();
    const cookiesDir = path.join(__dirname, 'cookies');
    const cookiesPath = path.join(cookiesDir, 'Instagramcookies.json');
    
    // Create cookies directory if it doesn't exist
    try {
        await fs.mkdir(cookiesDir, { recursive: true });
    } catch (error) {
        // Directory already exists, ignore
    }
    
    // Save cookies
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    
    console.log('✅ Cookies saved to:', cookiesPath);
    console.log('\n📊 Cookie Summary:');
    console.log(`   Total cookies: ${cookies.length}`);
    
    const sessionId = cookies.find(c => c.name === 'sessionid');
    if (sessionId) {
        const expiryDate = new Date(sessionId.expires * 1000);
        console.log(`   Session ID: ${sessionId.value.substring(0, 20)}...`);
        console.log(`   Expires: ${expiryDate.toLocaleString()}`);
        
        const daysUntilExpiry = Math.floor((sessionId.expires * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
        console.log(`   Valid for: ${daysUntilExpiry} days`);
    }
    
    console.log('\n📤 Next Steps:');
    console.log('   1. Upload cookies to VPS:');
    console.log(`      scp ${cookiesPath} root@167.88.165.161:/root/Riona-AI-Agent/cookies/`);
    console.log('   2. Restart bot on VPS:');
    console.log('      ssh root@167.88.165.161 "cd /root/Riona-AI-Agent && pm2 restart riona-bot"');
    console.log('   3. Check logs:');
    console.log('      ssh root@167.88.165.161 "pm2 logs riona-bot --lines 20"');
    
    console.log('\n🎉 Done! Closing browser in 3 seconds...');
    await delay(3000);
    await browser.close();
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});

// Run
generateCookies().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});

