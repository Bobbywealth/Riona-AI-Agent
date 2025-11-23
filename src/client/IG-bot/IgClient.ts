import * as puppeteer from 'puppeteer';
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import UserAgent from "user-agents";
import { Server } from "proxy-chain";
import { IGpassword, IGusername, getProxyUrl, PROXY_ENABLED } from "../../secret";
import logger from "../../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../../utils";
import { runAgent } from "../../Agent";
import { getInstagramCommentSchema } from "../../Agent/schema";
import readline from "readline";
import fs from "fs/promises";
import path from "path";
import { getShouldExitInteractions } from '../../api/agent';
import { InteractionOptions, InteractionMode, EngagementMetrics, StoryOptions } from './types';
import CommentedPost from "../../models/CommentedPost";
import LanguageDetect from 'languagedetect';
import mongoose from 'mongoose';

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(
  AdblockerPlugin({
    // Optionally enable Cooperative Mode for several request interceptors
    interceptResolutionPriority: puppeteer.DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const languageDetector = new LanguageDetect();
languageDetector.setLanguageType('iso2');

type ProfileInspectionResult = {
    approved: boolean;
    username?: string;
    profileUrl?: string;
    bio?: string;
    screenshotPath?: string;
    category?: 'restaurant' | 'foodie' | 'other';
};

export class IgClient {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private username: string;
    private password: string;
    private restaurantKeywords = [
        'restaurant',
        'cafe',
        'bistro',
        'kitchen',
        'chef',
        'barbecue',
        'bbq',
        'food',
        'dining',
        'eatery',
        'grill',
        'steakhouse',
        'pizzeria',
        'bakery',
        'catering',
        'drink',
        'coffee',
        'brunch',
        'sushi',
        'tapas',
        'mexican',
        'italian',
        'thai',
        'indian',
        'seafood'
    ];
    private foodieKeywords = [
        'foodie',
        'food lover',
        'food blog',
        'food blogger',
        'recipes',
        'home cook',
        'food content',
        'food photography',
        'food review',
        'food critic',
        'food memes',
        'chef mode',
        'food adventures',
        'eater',
        'yummy',
        'delish',
        'taste tester'
    ];
    private marketingValueProp = `Marketing Team App is your remote digital marketing team. We deliver full-funnel strategy, daily content production, paid ads, AI automation, and a 30-day money-back guarantee with no long-term contracts. Packages start at $249/mo and average 310% ROI for 500+ clients.`;
    private contactedUsers = new Set<string>();

    constructor(username?: string, password?: string) {
        this.username = username || '';
        this.password = password || '';
    }

    private async lookupLocationPath(
        query: string,
        coords?: { latitude: number; longitude: number }
    ): Promise<string | null> {
        if (!this.page) return null;
        try {
            const encoded = encodeURIComponent(query.trim());
            const response = await this.page.evaluate(
                ({ q, coords, token }) => {
                    const params = new URLSearchParams({
                        context: 'location',
                        query: q,
                        rank_token: token,
                    });
                    if (coords?.latitude && coords?.longitude) {
                        params.append('latitude', String(coords.latitude));
                        params.append('longitude', String(coords.longitude));
                    }
                    const url = `https://www.instagram.com/web/search/topsearch/?${params.toString()}`;
                    return fetch(url, {
                    credentials: 'include',
                    headers: {
                        'x-ig-app-id': '936619743392459',
                    },
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .catch(() => null);
                },
                { q: encoded, coords, token: `${Date.now()}` }
            );
            const places: any[] = response?.places || [];
            if (!places.length) {
                console.log(`⚠️ No places returned for "${query}" via API. Falling back to UI search...`);
                return await this.lookupLocationPathViaUi(query);
            }
            const best = places
                .map((entry) => entry.place?.location)
                .filter(Boolean)
                .find((loc: any) => {
                    const name = (loc?.name || '').toLowerCase();
                    return query.toLowerCase().split(/\s+/).every((word) => name.includes(word));
                }) || places[0]?.place?.location;
            if (!best?.pk) {
                return null;
            }
            const slug = (best?.slug || best?.name || query)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'location';
            return `${best.pk}/${slug}/`;
        } catch (error) {
            console.warn('Location lookup failed:', error);
            return null;
        }
    }

    private async lookupLocationPathViaUi(query: string): Promise<string | null> {
        if (!this.page) return null;
        const page = this.page;
        const originalUrl = page.url();
        try {
            await page.goto('https://www.instagram.com/', {
                waitUntil: 'networkidle2',
            });
            await delay(2000);
            await this.handleNotificationPopup();

            const searchButton =
                (await page.$('svg[aria-label="Search"]')) ||
                (await page.$('a[href="/explore/search/"]'));
            if (searchButton) {
                try {
                    await searchButton.click();
                    await delay(800);
                } catch {
                    // ignore
                }
            }

            const input = await page
                .waitForSelector('input[aria-label="Search input"]', { timeout: 5000 })
                .catch(() => null);
            if (!input) {
                console.log('⚠️ Location search input not found.');
                return null;
            }
            await input.click({ clickCount: 3 });
            await input.press('Backspace');
            await input.type(query, { delay: 80 });
            await delay(1500);

            const resultLink = await page
                .waitForSelector('a[href*="/explore/locations/"]', { timeout: 7000 })
                .catch(() => null);
            if (!resultLink) {
                console.log('⚠️ No location results visible in UI.');
                return null;
            }
            const href = await resultLink.evaluate((el) => (el as HTMLAnchorElement).getAttribute('href') || '');
            if (!href) return null;
            const resolved = href.startsWith('http') ? new URL(href).pathname : href;
            const trimmed = resolved.replace(/^\/+|\/+$/g, '');
            return trimmed ? `${trimmed}/` : null;
        } catch (error) {
            console.warn('UI location search failed:', error);
            return null;
        } finally {
            try {
                await page.goto(originalUrl, { waitUntil: 'networkidle2' });
                await delay(1000);
            } catch {
                // ignore
            }
        }
    }

    async init() {
        // Center the window on a 1920x1080 screen
        const width = 1280;
        const height = 800;
        const screenWidth = 1920;
        const screenHeight = 1080;
        const left = Math.floor((screenWidth - width) / 2);
        const top = Math.floor((screenHeight - height) / 2);
        
        // Prepare launch args
        const launchArgs = [
            `--window-size=${width},${height}`,
            `--window-position=${left},${top}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ];
        
        // Add proxy if enabled
        const proxyUrl = getProxyUrl();
        if (PROXY_ENABLED && proxyUrl) {
            launchArgs.push(`--proxy-server=${proxyUrl}`);
            logger.info(`🔒 Using proxy: ${proxyUrl.replace(/:[^:]*@/, ':****@')}`); // Hide password in logs
        } else {
            logger.info('📡 No proxy configured, using direct connection');
        }
        
        this.browser = await puppeteerExtra.launch({
            headless: true, // Run in headless mode (no GUI needed on server)
            args: launchArgs,
        });
        this.page = await this.browser.newPage();
        const userAgent = new UserAgent({ deviceCategory: "desktop" });
        await this.page.setUserAgent(userAgent.toString());
        await this.page.setViewport({ width, height });

        if (await Instagram_cookiesExist()) {
            await this.loginWithCookies();
        } else {
            await this.loginWithCredentials();
        }
    }

    private async loginWithCookies() {
        if (!this.page) throw new Error("Page not initialized");
        const cookies = await loadCookies("./cookies/Instagramcookies.json");
        if(cookies.length > 0) {
            await this.page.setCookie(...cookies);
        }
        
        logger.info("Loaded cookies. Navigating to Instagram home page.");
        await this.page.goto("https://www.instagram.com/", {
            waitUntil: "networkidle2",
        });
        const url = this.page.url();
        if (url.includes("/login/")) {
            logger.warn("Cookies are invalid or expired. Falling back to credentials login.");
            await this.loginWithCredentials();
        } else {
            logger.info("Successfully logged in with cookies.");
            // Capture screenshot after cookie login
            console.log(`📸 Capturing post-cookie-login screenshot...`);
            await this.captureGenericPageScreenshot(this.page, 'feed-screens', 'after-cookie-login');
        }
    }

    private async loginWithCredentials() {
        if (!this.page || !this.browser) throw new Error("Browser/Page not initialized");
        logger.info("Logging in with credentials...");
        await this.page.goto("https://www.instagram.com/accounts/login/", {
            waitUntil: "networkidle2",
        });
        await delay(3000); // Wait for page to fully render
        await this.page.waitForSelector('input[name="username"]', { timeout: 60000 });
        await delay(1000);
        await this.page.type('input[name="username"]', this.username, { delay: 100 });
        await delay(500);
        await this.page.type('input[name="password"]', this.password, { delay: 100 });
        await delay(1000);
        await this.page.click('button[type="submit"]');
        await this.page.waitForNavigation({ waitUntil: "networkidle2" });
        const cookies = await this.page.cookies();
        await saveCookies("./cookies/Instagramcookies.json", cookies);
        logger.info("Successfully logged in and saved cookies.");
        await this.handleNotificationPopup();
        
        // Capture screenshot after login
        console.log(`📸 Capturing post-login screenshot...`);
        await this.captureGenericPageScreenshot(this.page, 'feed-screens', 'after-login');
    }

    async handleNotificationPopup(): Promise<boolean> {
        if (!this.page) throw new Error("Page not initialized");
        console.log("Checking for notification popup...");

        try {
            const dialogSelector = 'div[role="dialog"]';
            const dialog =
                (await this.page.$(dialogSelector)) ||
                (await this.page.waitForSelector(dialogSelector, { timeout: 2500 }).catch(() => null));

            if (!dialog) {
                console.log("No notification dialog detected.");
                return false;
            }

            console.log("Notification dialog found. Searching for dismissal controls.");
            const dismissalPhrases = [
                "not now",
                "cancel",
                "maybe later",
                "remind me later",
                "close",
                "no thanks",
                "skip",
                "x"
            ];
            const notNowButtonSelectors = ["button", `div[role="button"]`];
            let dismissalButton: puppeteer.ElementHandle<Element> | null = null;

            for (const selector of notNowButtonSelectors) {
                const elements = await dialog.$$(selector);
                for (const element of elements) {
                    try {
                        const text = await element.evaluate((el) => el.textContent?.trim().toLowerCase() || '');
                        if (text && dismissalPhrases.includes(text)) {
                            dismissalButton = element;
                            console.log(`Found dismissal button "${text}" with selector ${selector}`);
                            break;
                        }
                    } catch {
                        // Ignore stale element exceptions
                    }
                }
                if (dismissalButton) break;
            }

            if (!dismissalButton) {
                dismissalButton =
                    (await dialog.$('svg[aria-label="Close"]')) ||
                    (await dialog.$('button[aria-label="Close"]')) ||
                    (await dialog.$('button:last-of-type'));
            }

            if (dismissalButton) {
                console.log("Dismissing notification popup...");
                await this.showOverlayMessage('Dismissing popup…', 'warning');
                await dismissalButton.evaluate((btn: any) => btn.click());
                await delay(1500);
                console.log("Notification popup dismissed.");
                return true;
            }

            console.log("No dismissal control matched known selectors.");
            return false;
        } catch (error) {
            if ((error as Error)?.name === 'TimeoutError') {
                console.log("No notification popup appeared within the timeout period.");
            } else {
                console.error("Error handling notification popup:", error);
            }
            return false;
        }
    }

    async dismissAllPopups() {
        if (!this.page) return;
        try {
            // Look for notification popup specifically
            const buttons = await this.page.$$('button');
            for (const button of buttons) {
                try {
                    const text = await button.evaluate((el: Element) => el.textContent?.trim().toLowerCase() || '');
                    // Only click "Not Now" - be very specific
                    if (text === 'not now') {
                        console.log(`Dismissing notification popup: "${text}"`);
                        await button.click();
                        await delay(1000);
                        console.log(`Popup dismissed, current URL: ${this.page?.url()}`);
                        return true;
                    }
                } catch (e) {
                    // Button might be stale, continue
                }
            }
        } catch (error) {
            // Silently fail
        }
        return false;
    }

    async sendDirectMessage(username: string, message: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.sendDirectMessageWithMedia(username, message);
        } catch (error) {
            logger.error("Failed to send direct message", error);
            throw error;
        }
    }

    async monitorAndReplyToDMs(maxConversations: number = 5) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        
        try {
            console.log("Checking DMs for new messages...");
            
            // Navigate to DMs page
            await page.goto("https://www.instagram.com/direct/inbox/", {
                waitUntil: "networkidle2",
            });
            await delay(5000); // Give more time for conversations to load
            
            // Dismiss any popups immediately
            const dismissed = await this.dismissAllPopups();
            
            if (dismissed) {
                console.log("Waiting for page to stabilize after popup dismissal...");
                await delay(5000); // Wait longer after dismissing popup for page to reload
            } else {
                await delay(2000);
            }
            
            // Instead of looking for links, click on conversation items directly
            const batchSize = Math.min(20, maxConversations);
            let processed = 0;
            let offset = 0;
            
            while (processed < maxConversations) {
                const remaining = maxConversations - processed;
                const target = Math.min(batchSize, remaining);
                const conversationItems = await this.loadConversationItems(target, 4, offset);
                if (!conversationItems.length) {
                    console.log("No additional conversation items found. Current URL:", page.url());
                    break;
                }
                console.log(`Loaded ${conversationItems.length} conversation items for batch starting at row ${offset + 1}`);
                
                for (let index = 0; index < conversationItems.length && processed < maxConversations; index++) {
                try {
                    console.log(`\n=== Checking conversation ${processed + 1}/${maxConversations} (row ${offset + index + 1}) ===`);
                    
                    // Go back to inbox before clicking next conversation
                    if (processed > 0) {
                        await page.goto("https://www.instagram.com/direct/inbox/", {
                            waitUntil: "networkidle2",
                        });
                        await delay(3000);
                        await this.dismissAllPopups();
                        await delay(2000);
                        
                        // Re-query conversation items
                        const freshItems = await this.loadConversationItems(target, 2, offset);
                        if (index >= freshItems.length) {
                            console.log(`Conversation row ${offset + index + 1} no longer available`);
                            continue;
                        }
                        await freshItems[index].click();
                    } else {
                        // First conversation - just click it
                        await conversationItems[index].click();
                    }
                    
                    await delay(3000);
                    await this.dismissAllPopups();
                    
                    const conversationTitle = await page.evaluate(() => {
                        const selectors = ['header h2', 'header h1', 'header span'];
                        for (const selector of selectors) {
                            const el = document.querySelector(selector);
                            if (el && el.textContent && el.textContent.trim().length) {
                                return el.textContent.trim();
                            }
                        }
                        return 'conversation';
                    });
                    
                    const fetchSnapshot = () =>
                        page.evaluate(() => {
                            const selectors = [
                                '[data-testid="message-bubble"]',
                                'div[role="row"]',
                                'div[aria-label="Message"]',
                                'div[dir="auto"]'
                            ];
                            const texts: string[] = [];

                            for (const selector of selectors) {
                                const nodes = Array.from(document.querySelectorAll(selector));
                                if (!nodes.length) continue;
                                nodes.slice(-12).forEach((node) => {
                                    const text = node.textContent?.trim();
                                    if (text && text.length > 1 && text.length < 600) {
                                        texts.push(text);
                                    }
                                });
                                if (texts.length) break;
                            }

                            if (!texts.length) {
                                const fallback = document.body.innerText.split('\n').slice(-12).join(' | ').trim();
                                return {
                                    texts: fallback.length ? [fallback] : [],
                                    lastIsSelf: fallback.toLowerCase().startsWith('you ') || fallback.toLowerCase().includes('you sent')
                                };
                            }

                            const trimmed = texts.slice(-12);
                            const lastText = trimmed[trimmed.length - 1] || '';
                            const lowered = lastText.trim().toLowerCase();
                            const lastIsSelf =
                                lowered.startsWith('you ') ||
                                lowered.startsWith('you:') ||
                                lowered.includes('you sent');

                            return {
                                texts: trimmed,
                                lastIsSelf
                            };
                        });

                    let snapshot = await fetchSnapshot();
                    
                    const placeholderPhrases = [
                        'send a message to start a chat',
                        'your messages',
                        'share a thought',
                        'send message'
                    ];

                    const isPlaceholderOnly = (texts: string[]) =>
                        texts.length > 0 &&
                        texts.every((text) => {
                            const normalized = text.toLowerCase();
                            return placeholderPhrases.some((phrase) => normalized.includes(phrase));
                        });

                    let messageTexts = snapshot?.texts ?? [];
                    let lastMessageText = messageTexts.length ? messageTexts[messageTexts.length - 1] : null;
                    
                    console.log(`Last messages: "${messageTexts.join(' | ')}"`);
                    
                    if (!lastMessageText || lastMessageText.length < 2) {
                        console.log(`No valid message text found in conversation ${index + 1}`);
                        index++;
                        continue;
                    }
                    
                    if (snapshot?.lastIsSelf) {
                        console.log('Skipped: last message was sent by the bot.');
                        index++;
                        continue;
                    }

                    if (isPlaceholderOnly(messageTexts)) {
                        console.log('Detected placeholder-only content, reloading conversation...');
                        await delay(2000);
                        snapshot = await fetchSnapshot();
                        messageTexts = snapshot?.texts ?? [];
                        lastMessageText = messageTexts.length ? messageTexts[messageTexts.length - 1] : null;
                        console.log(`Refreshed messages: "${messageTexts.join(' | ')}"`);

                        if (!lastMessageText || isPlaceholderOnly(messageTexts)) {
                            console.log('Still placeholder content after refresh. Skipping.');
                            index++;
                            continue;
                        }
                    }

                    // Check if we should reply
                    const normalizedLastText = lastMessageText.toLowerCase();
                    const containsAttachment = normalizedLastText.includes('sent an attachment');
                    if (containsAttachment) {
                        console.log('Skipped: last message appears to be an attachment without text.');
                        index++;
                        continue;
                    }
                    
                    const shouldReply = true;
                    
                    if (shouldReply) {
                        console.log(`✅ Message needs a reply!`);
                        
                        // Generate AI reply based on the conversation
                        const { runAgent } = await import('../../Agent');
                        const { getInstagramCommentSchema } = await import('../../Agent/schema');
                        
                        const conversationHistory = messageTexts.join(' | ');
                        const prompt = `You received an Instagram DM conversation. Recent messages: "${conversationHistory}". 
Generate a friendly, helpful reply that:
- Answers any questions they asked
- Is conversational and natural (1-2 sentences max)
- Matches their tone and energy
- Uses appropriate emojis sparingly
- Sounds like a real person, not a bot
- Is relevant to what they said`;
                        
                        const schema = getInstagramCommentSchema();
                        const result = await runAgent(schema, prompt);
                        const reply = (result[0]?.comment ?? "Thanks for reaching out! 😊") as string;
                        
                        console.log(`Generated AI reply: "${reply}"`);
                        
                        const screenshotPath = await this.captureConversationScreenshot(conversationTitle || `conversation-${processed + 1}`);
                        if (screenshotPath) {
                            console.log(`📸 Conversation screenshot saved to ${screenshotPath}`);
                        }
                        
                        // Type and send reply
                        const messageInput = await page.$('div[contenteditable="true"]');
                        if (messageInput) {
                            await messageInput.click();
                            await delay(500);
                            
                            // Type slowly and naturally
                            for (const char of reply) {
                                await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
                            }
                            
                            await delay(1000);
                            await page.keyboard.press('Enter');
                            console.log(`Reply sent successfully`);
                            
                            // Wait before checking next conversation
                            await delay(Math.random() * 5000 + 3000);
                        }
                    } else {
                        console.log(`Message doesn't need a reply (no greeting/question detected)`);
                    }
                    
                    processed++;
                } catch (convError) {
                    console.error(`Error processing conversation ${offset + index + 1}:`, convError);
                }
                }
                
                offset += conversationItems.length;
                
                if (processed < maxConversations) {
                    console.log(`Processed ${processed}/${maxConversations}. Loading next batch...`);
                    await delay(3000);
                }
            }

            if (!processed) {
                try {
                    await page.screenshot({ path: '/tmp/dm-inbox-debug.png' });
                    console.log("Screenshot saved to /tmp/dm-inbox-debug.png");
                } catch (e) {
                    console.error("Failed to take screenshot");
                }
            }
            
            console.log("Finished checking DMs");
            
        } catch (error) {
            logger.error("Error monitoring DMs:", error);
            throw error;
        }
    }

    async sendDirectMessageWithMedia(username: string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            console.log("Navigated to user profile");
            await delay(3000);

            const messageButtonSelectors = ['div[role="button"]', "button", 'a[href*="/direct/t/"]', 'div[role="button"] span', 'div[role="button"] div'];
            let messageButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Message") {
                        messageButton = element;
                        break;
                    }
                }
                if (messageButton) break;
            }
            if (!messageButton) throw new Error("Message button not found.");
            await messageButton.click();
            await delay(2000); // Wait for message modal to open
            await this.handleNotificationPopup();

            if (mediaPath) {
                const fileInput = await this.page.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(mediaPath);
                    await this.handleNotificationPopup();
                    await delay(2000); // wait for upload
                } else {
                    logger.warn("File input for media not found.");
                }
            }

            const messageInputSelectors = ['textarea[placeholder="Message..."]', 'div[role="textbox"]', 'div[contenteditable="true"]', 'textarea[aria-label="Message"]'];
            let messageInput: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageInputSelectors) {
                messageInput = await this.page.$(selector);
                if (messageInput) break;
            }
            if (!messageInput) throw new Error("Message input not found.");
            await messageInput.type(message);
            await this.handleNotificationPopup();
            await delay(2000);

            const sendButtonSelectors = ['div[role="button"]', "button"];
            let sendButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of sendButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Send") {
                        sendButton = element;
                        break;
                    }
                }
                if (sendButton) break;
            }
            if (!sendButton) throw new Error("Send button not found.");
            await sendButton.click();
            await this.handleNotificationPopup();
            console.log("Message sent successfully");
        } catch (error) {
            logger.error(`Failed to send DM to ${username}`, error);
            throw error;
        }
    }

    async sendDirectMessagesFromFile(file: Buffer | string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Sending DMs from provided file content`);
        let fileContent: string;
        if (Buffer.isBuffer(file)) {
            fileContent = file.toString('utf-8');
        } else {
            fileContent = file;
        }
        const usernames = fileContent.split("\n");
        for (const username of usernames) {
            if (username.trim()) {
                await this.handleNotificationPopup();
                await this.sendDirectMessageWithMedia(username.trim(), message, mediaPath);
                await this.handleNotificationPopup();
                // add delay to avoid being flagged
                await delay(30000);
            }
        }
    }

    async interactWithPosts(targetUsername?: string, maxPosts: number = 15, options?: InteractionOptions) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        const commentedPosts = new Set<string>(); // Track commented posts to prevent duplicates this session
        const resolvedOptions: InteractionOptions = options || {};
        const activeMode: InteractionMode = resolvedOptions.mode || this.inferModeFromTarget(targetUsername);
        
        if (activeMode === 'competitor_followers') {
            const competitorUsername = this.normalizeUsername(resolvedOptions.competitorUsername);
            if (!competitorUsername) {
                console.log('❌ competitorUsername is required for competitor follower targeting.');
                return;
            }
            const postsPerFollower = Math.max(1, resolvedOptions.postsPerFollower || 1);
            const followersToEngage = Math.max(
                1,
                resolvedOptions.followersToEngage || Math.min(maxPosts, 5)
            );
            console.log(
                `🤝 Targeting ${followersToEngage} followers of @${competitorUsername} (${postsPerFollower} post(s) each)`
            );
            const followers = await this.scrapeFollowers(
                competitorUsername,
                followersToEngage * 4
            );
            const selectedFollowers = followers.slice(0, followersToEngage);
            if (!selectedFollowers.length) {
                console.log('⚠️ No followers available to engage.');
                return;
            }
            for (const follower of selectedFollowers) {
                console.log(`➡️ Engaging follower @${follower}`);
                await this.interactWithPosts(follower, postsPerFollower, {
                    ...resolvedOptions,
                    mode: 'user',
                    competitorUsername: undefined,
                    followersToEngage: undefined,
                    postsPerFollower: undefined,
                });
            }
            return;
        }

        if (activeMode === 'stories') {
            await this.watchStories({
                targetUsername,
                storyCount: maxPosts,
            });
            return;
        }
        
        // Navigate based on targeting mode
        if (activeMode === 'feed') {
            console.log(`📰 Staying on Home Feed for recent posts...`);
            // Already on home page from login, just wait a bit
            await delay(3000);
            await this.handleNotificationPopup();
            
            // Capture screenshot of feed
            console.log(`📸 Capturing feed screenshot...`);
            await this.captureGenericPageScreenshot(page, 'feed-screens', 'home-feed-loaded');
            
            console.log(`Ready to interact with feed posts...`);
            await this.showOverlayMessage('Interacting with your home feed…', 'info');
            // Don't click on any post, just scroll through feed
        } else if (activeMode === 'explore') {
            console.log(`🌍 Navigating to Explore page...`);
            await page.goto(`https://www.instagram.com/explore/`, {
                waitUntil: "networkidle2",
            });
            await delay(3000);
            await this.handleNotificationPopup();
            
            // Capture screenshot of explore page
            console.log(`📸 Capturing explore page screenshot...`);
            await this.captureGenericPageScreenshot(page, 'feed-screens', 'explore-page-loaded');
            
            // Click on the first post from explore
            console.log(`Opening first post from Explore...`);
            await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 10000 }).catch(() => null);
            
            // Try multiple selectors for finding posts
            let firstPost = await page.$('a[href*="/p/"]');
            if (!firstPost) firstPost = await page.$('a[href*="/reel/"]');
            if (!firstPost) firstPost = await page.$('article a[role="link"]');
            if (!firstPost) firstPost = await page.$('div[role="button"] a');
            
            if (firstPost) {
                console.log(`Found post, clicking...`);
                await firstPost.click();
                await delay(4000);
                await this.handleNotificationPopup();
                console.log(`Post opened, starting interactions...`);
            } else {
                console.log(`No posts found on Explore page.`);
                // Capture screenshot for debugging
                await this.captureGenericPageScreenshot(page, 'feed-screens', 'explore-no-posts');
                
                // Log what's on the page
                const pageContent = await page.evaluate(() => {
                    const links = document.querySelectorAll('a');
                    const postLinks = Array.from(links).filter(a => 
                        a.href.includes('/p/') || a.href.includes('/reel/')
                    );
                    return {
                        totalLinks: links.length,
                        postLinks: postLinks.length,
                        bodyText: document.body.innerText.substring(0, 500)
                    };
                });
                console.log('📊 Page analysis:', JSON.stringify(pageContent, null, 2));
                return;
            }
        } else if (activeMode === 'hashtag') {
            const hashtag = this.resolveHashtag(targetUsername, resolvedOptions.hashtags);
            if (!hashtag) {
                console.log('❌ No hashtag provided. Please supply one via dashboard or API.');
                return;
            }
            console.log(`🔖 Targeting #${hashtag}...`);
            await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                waitUntil: "networkidle2",
            });
            await delay(3000);
            await this.handleNotificationPopup();
            await this.captureGenericPageScreenshot(page, 'feed-screens', `hashtag-${hashtag}`);
            console.log(`Opening first post from #${hashtag}...`);
            await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 10000 }).catch(() => null);
            const firstPost = await page.$('a[href*="/p/"]') || await page.$('a[href*="/reel/"]');
            if (firstPost) {
                console.log(`Found post, clicking...`);
                await firstPost.click();
                await delay(4000);
                await this.handleNotificationPopup();
                console.log(`Post opened, starting interactions...`);
            } else {
                console.log(`No posts found for hashtag #${hashtag}.`);
                return;
            }
        } else if (activeMode === 'location') {
            let locationPath = this.resolveLocationPath(targetUsername, resolvedOptions.locationPath);
            if (!locationPath && resolvedOptions.locationQuery) {
                console.log(`🔍 Searching for location "${resolvedOptions.locationQuery}"...`);
                locationPath = await this.lookupLocationPath(
                    resolvedOptions.locationQuery,
                    resolvedOptions.locationCoordinates
                );
                if (locationPath) {
                    console.log(`✅ Found location path: ${locationPath}`);
                }
            }
            if (!locationPath) {
                console.log('❌ Location path required. Example format: 212988663/new-york-new-york/');
                return;
            }
            console.log(`📍 Targeting location ${locationPath}...`);
            await page.goto(`https://www.instagram.com/explore/locations/${locationPath}/`, {
                waitUntil: "networkidle2",
            });
            await delay(3000);
            await this.handleNotificationPopup();
            const locName = locationPath.split('/').filter(Boolean).pop() || 'location';
            await this.captureGenericPageScreenshot(page, 'feed-screens', `location-${locName}`);
            console.log(`Opening first post from location ${locationPath}...`);
            await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 10000 }).catch(() => null);
            const firstPost = await page.$('a[href*="/p/"]') || await page.$('a[href*="/reel/"]');
            if (firstPost) {
                await firstPost.click();
                await delay(4000);
                await this.handleNotificationPopup();
                console.log(`Post opened, starting interactions...`);
            } else {
                console.log(`No posts found for location ${locationPath}.`);
                return;
            }
        } else if (targetUsername) {
            const normalizedUsername = this.normalizeUsername(targetUsername);
            if (!normalizedUsername) {
                console.log('❌ Username is required for direct profile targeting.');
                return;
            }
            targetUsername = normalizedUsername;
            console.log(`Navigating to @${targetUsername}'s profile...`);
            await page.goto(`https://www.instagram.com/${targetUsername}/`, {
                waitUntil: "networkidle2",
            });
            await delay(3000);
            await this.handleNotificationPopup();
            
            // Click on the first post to open it
            console.log(`Opening first post from @${targetUsername}...`);
            // Try multiple selectors for posts
            await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 10000 }).catch(() => null);
            const firstPost = await page.$('a[href*="/p/"]') || await page.$('a[href*="/reel/"]');
            if (firstPost) {
                console.log(`Found post, clicking...`);
                await firstPost.click();
                await delay(4000);
                await this.handleNotificationPopup();
                console.log(`Post opened, starting interactions...`);
            } else {
                console.log(`No posts found on @${targetUsername}'s profile. May be private or empty.`);
                return;
            }
        }
        
        let postIndex = 1; // Start with the first post
        const isSinglePostView = activeMode !== 'feed'; // Profile/Explore/Hashtag/Location views open single posts
        const engagementFilters = resolvedOptions.engagement;
        const dynamicEngagement = engagementFilters ? { ...engagementFilters } : undefined;
        const englishOnly = resolvedOptions.englishOnly ?? true;
        const imagesOnly = resolvedOptions.imagesOnly ?? true;
        const requireCaption = resolvedOptions.requireCaption ?? true;
        let consecutiveFilterSkips = 0;
        let filterRelaxations = 0;
        const MAX_FILTER_RELAXATIONS = 3;
        let outboundDMsSent = 0;
        let recentCaptionCache: string | null = null;
        
        while (postIndex <= maxPosts) {
            // Check for exit flag
            if (typeof getShouldExitInteractions === 'function' && getShouldExitInteractions()) {
                console.log('Exit from interactions requested. Stopping loop.');
                break;
            }
            const canUseDatabase = mongoose.connection.readyState === 1;
            try {
                // In single-post view, always use article:nth-of-type(1) since there's only one article per page
                const postSelector = isSinglePostView ? `article:nth-of-type(1)` : `article:nth-of-type(${postIndex})`;
                // Check if the post exists
                if (!(await page.$(postSelector))) {
                    console.log(`No post found at selector: ${postSelector}`);
                    
                    // Debug: Check what articles exist on the page
                    const articleCount = await page.evaluate(() => {
                        const articles = document.querySelectorAll('article');
                        return {
                            count: articles.length,
                            hasMain: !!document.querySelector('main'),
                            hasRole: !!document.querySelector('[role="main"]'),
                            bodyText: document.body.innerText.substring(0, 300)
                        };
                    });
                    console.log('📊 Page article analysis:', JSON.stringify(articleCount, null, 2));
                    
                    // Capture screenshot for debugging
                    await this.captureGenericPageScreenshot(page, 'feed-screens', `no-posts-index-${postIndex}`);
                    
                    console.log("No more posts found. Ending iteration...");
                    return;
                }
                
                // Capture screenshot of found post (every 3rd post to avoid too many screenshots)
                if (postIndex % 3 === 1) {
                    console.log(`📸 Capturing post ${postIndex} screenshot...`);
                    const auditLabel = `${resolvedOptions.mode || 'feed'}-post-${postIndex}-found`;
                    await this.capturePostScreenshot(postSelector, auditLabel);
                }
                
                // Add random mouse movement before liking
                await page.mouse.move(Math.random() * 200 + 100, Math.random() * 200 + 100);
                await delay(Math.random() * 500 + 200);

                let shouldInteract = true;
                let skipReason: string | null = null;
                let currentPostUrl = isSinglePostView ? page.url() : await this.getPostPermalink(postSelector);
                if (!currentPostUrl) {
                    console.log('⚠️ Unable to determine permalink for this post. Duplicate protection will be limited.');
                    currentPostUrl = `${page.url()}?postIndex=${postIndex}&ts=${Date.now()}`;
                }

                if (dynamicEngagement && (dynamicEngagement.minLikes || dynamicEngagement.minComments)) {
                    const metrics = await this.getEngagementMetrics(postSelector);
                    if (dynamicEngagement.minLikes && (metrics.likes === null || metrics.likes < dynamicEngagement.minLikes)) {
                        shouldInteract = false;
                        skipReason = `likes ${metrics.likes ?? 'unknown'} < ${dynamicEngagement.minLikes}`;
                    }
                    if (shouldInteract && dynamicEngagement.minComments && (metrics.comments === null || metrics.comments < dynamicEngagement.minComments)) {
                        shouldInteract = false;
                        skipReason = `comments ${metrics.comments ?? 'unknown'} < ${dynamicEngagement.minComments}`;
                    }
                }

                if (shouldInteract) {
                    if (commentedPosts.has(currentPostUrl)) {
                        shouldInteract = false;
                        skipReason = 'duplicate in this session';
                    } else if (canUseDatabase) {
                        const existingComment = await CommentedPost.findOne({ postUrl: currentPostUrl });
                        if (existingComment) {
                            shouldInteract = false;
                            skipReason = `previously commented ${existingComment.commentedAt.toLocaleString()}`;
                            commentedPosts.add(currentPostUrl);
                        }
                    }
                }

                let profileInsights: ProfileInspectionResult = { approved: true };

                if (shouldInteract) {
                    profileInsights = await this.inspectProfile(postSelector, resolvedOptions.inspectProfile ?? false, {
                        requiredKeywords: resolvedOptions.requiredBioKeywords,
                    });
                    if (!profileInsights.approved) {
                        console.log(`⏩ Skipping post ${postIndex}: profile not restaurant-themed`);
                        if (isSinglePostView) {
                            const nextButton = await page.$('button[aria-label="Next"], svg[aria-label="Next"]').catch(() => null);
                            if (nextButton) {
                                await nextButton.click();
                                await delay(3000);
                                console.log('Moved to next post after profile skip.');
                            } else {
                                console.log('No Next button after profile skip; ending session.');
                                break;
                            }
                        } else {
                            await page.evaluate(() => {
                                window.scrollBy(0, window.innerHeight * 0.8);
                            });
                            await delay(2000);
                        }
                        postIndex++;
                        continue;
                    }
                    
                    const alreadyCommented = await this.hasExistingComment(postSelector);
                    if (alreadyCommented) {
                        console.log(`⏭️ Already commented on this post earlier. Skipping.`);
                        shouldInteract = false;
                        skipReason = 'already commented';
                    }
                }

                if (shouldInteract) {
                    const auditLabel = `${resolvedOptions.mode || 'feed'}-${resolvedOptions.hashtags?.[0] || targetUsername || 'post'}-${postIndex}`;
                    await this.capturePostScreenshot(postSelector, auditLabel);

                    const likeButtonSelector = `${postSelector} svg[aria-label="Like"]`;
                    const likeButton = await page.$(likeButtonSelector);
                    let ariaLabel = null;
                    if (likeButton) {
                        ariaLabel = await likeButton.evaluate((el: Element) => el.getAttribute("aria-label"));
                    }
                
                // Don't always like - skip 20% of posts to look more natural
                const shouldLike = Math.random() > 0.2;
                
                if (ariaLabel === "Like" && likeButton && shouldLike) {
                    console.log(`Liking post ${postIndex}...`);
                    await delay(Math.random() * 1000 + 500); // Random delay before clicking
                    await likeButton.click();
                    await page.keyboard.press("Enter");
                    console.log(`Post ${postIndex} liked.`);
                    await this.showOverlayMessage(`❤️ Liked post ${postIndex}`, 'success');
                } else if (ariaLabel === "Unlike") {
                    console.log(`Post ${postIndex} is already liked.`);
                } else if (!shouldLike) {
                    console.log(`Skipping like for post ${postIndex} (random variation).`);
                } else {
                    console.log(`Like button not found for post ${postIndex}.`);
                }
                // Extract and log the post caption
                    const captionSelector = `${postSelector} div.x9f619 span._ap3a div span._ap3a`;
                    const captionElement = await page.$(captionSelector);
                    let caption = '';
                    if (captionElement) {
                        caption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                        console.log(`Caption for post ${postIndex}: ${caption}`);
                        recentCaptionCache = caption;
                    } else {
                        caption = await this.extractFallbackCaption(postSelector);
                        if (caption) {
                            console.log(`Fallback caption for post ${postIndex}: ${caption}`);
                            recentCaptionCache = caption;
                        } else {
                            console.log(`No caption found for post ${postIndex}.`);
                            recentCaptionCache = null;
                        }
                    }

                    if (captionElement) {
                        const moreLinkSelector = `${postSelector} div.x9f619 span._ap3a span div span.x1lliihq`;
                        const moreLink = await page.$(moreLinkSelector);
                        if (moreLink) {
                            console.log(`Expanding caption for post ${postIndex}...`);
                            await moreLink.click();
                            const expandedCaption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                            console.log(`Expanded Caption for post ${postIndex}: ${expandedCaption}`);
                            caption = expandedCaption;
                            recentCaptionCache = caption;
                        }
                    }

                    if (requireCaption && (!caption || !caption.trim())) {
                        shouldInteract = false;
                        skipReason = 'missing caption';
                    }

                if (shouldInteract && englishOnly) {
                    let languageSample = caption;
                    if (!languageSample || !languageSample.trim()) {
                        languageSample = await page.evaluate((selector) => {
                            const container = document.querySelector(selector);
                            const altImg = container?.querySelector('img[alt]');
                            return altImg?.getAttribute('alt') || '';
                        }, postSelector);
                    }
                    if (!this.isEnglishText(languageSample)) {
                        shouldInteract = false;
                        skipReason = 'non-English caption detected';
                    }
                }

                if (!shouldInteract) {
                    if (skipReason && /likes|comments/i.test(skipReason)) {
                        consecutiveFilterSkips++;
                        if (
                            dynamicEngagement &&
                            filterRelaxations < MAX_FILTER_RELAXATIONS &&
                            consecutiveFilterSkips >= 3 &&
                            this.relaxEngagementFilters(dynamicEngagement)
                        ) {
                            filterRelaxations++;
                            consecutiveFilterSkips = 0;
                            console.log(
                                `🔄 Loosening engagement filters -> likes ≥ ${dynamicEngagement.minLikes ?? 'any'}, comments ≥ ${dynamicEngagement.minComments ?? 'any'}`
                            );
                            await this.showOverlayMessage(
                                `Loosening filters: ❤️ ${dynamicEngagement.minLikes ?? 'any'} / 💬 ${dynamicEngagement.minComments ?? 'any'}`,
                                'warning'
                            );
                        }
                    } else {
                        consecutiveFilterSkips = 0;
                    }
                    console.log(`⏩ Skipping post ${postIndex}: ${skipReason || 'filters triggered'}`);
                    if (skipReason) {
                        await this.showOverlayMessage(`Skipping post ${postIndex}: ${skipReason}`, 'warning');
                    }
                } else {
                    consecutiveFilterSkips = 0;
                    // Detect if this is a video post
                    const videoSelector = `${postSelector} video`;
                    const isVideo = await page.$(videoSelector) !== null;
                    if (imagesOnly && isVideo) {
                        console.log(`⏭️ Skipping post ${postIndex}: video detected (imagesOnly enabled).`);
                        shouldInteract = false;
                        skipReason = 'video post';
                    }
                    
                    // Get video URL if it's a video
                    let videoUrl: string | undefined;
                    let videoInfo = '';
                    
                    if (isVideo) {
                        console.log(`Post ${postIndex} is a VIDEO/REEL`);
                        
                        // Try to get video source URL
                        videoUrl = await page.evaluate((selector) => {
                            const video = document.querySelector(selector) as HTMLVideoElement;
                            return video?.src || video?.currentSrc;
                        }, videoSelector);
                        
                        if (videoUrl) {
                            console.log(`Video URL found: ${videoUrl.substring(0, 100)}...`);
                            videoInfo = `\n[VIDEO POST - URL: ${videoUrl}]`;
                        }
                        
                        // For videos, wait a moment to let it load
                        await delay(2000);
                    }
                    
                    // Screenshot the post (image or video thumbnail)
                    let imageBase64: string | undefined;
                    try {
                        const imageSelector = `${postSelector} img[alt]`;
                        const imageElement = await page.$(imageSelector);
                        if (imageElement) {
                            const screenshot = await imageElement.screenshot({ encoding: 'base64' });
                            imageBase64 = screenshot as string;
                            console.log(`Screenshot captured for post ${postIndex} ${isVideo ? '(video thumbnail)' : '(image)'}`);
                        }
                    } catch (screenshotError) {
                        console.log(`Could not capture screenshot for post ${postIndex}:`, screenshotError);
                    }
                    
                    // Comment on the post
                    const commentBoxSelector = `${postSelector} textarea`;
                    const commentBox = await page.$(commentBoxSelector);
                    if (commentBox) {
                        console.log(`Commenting on post ${postIndex}...`);
                        
                        // Build context-aware prompt
                        const postType = isVideo ? 'VIDEO/REEL' : 'IMAGE';
                        const visualContext = isVideo 
                            ? 'This is a VIDEO post. The image shows the video thumbnail. Focus more on the caption since you cannot watch the video.'
                            : 'This is an IMAGE post. Analyze both the visual content and caption.';
                        
                        const prompt = `Generate a human-like Instagram comment for this ${postType} post.
Caption: "${caption}"${videoInfo}

${visualContext}

CRITICAL REQUIREMENTS:
- MUST be in ENGLISH ONLY - no gibberish, no random characters
- MUST use proper English words and grammar
- MUST be readable and make sense
- Match the tone (casual, funny, serious, sarcastic)
- Sound organic - avoid robotic phrasing
- Use relatable language, light slang, emojis (if appropriate)
- Reference specific details from the caption${isVideo ? '' : ' and image'}
- If humorous, play along naturally
- If serious, respond with empathy
- ${isVideo ? 'For videos, comment on what the caption suggests the video shows' : 'React to what you see in the image'}
- Keep it concise (1-2 sentences max)
- Be genuine and specific, avoid generic praise

Create a comment that feels like it came from a real person who ${isVideo ? 'watched the video' : 'saw the image'}.
IMPORTANT: Write in clear, proper English only. No typos, no gibberish, no random characters.`;
                    
                        const schema = getInstagramCommentSchema();
                        const result = await runAgent(schema, prompt, undefined, imageBase64);
                        const comment = (result[0]?.comment ?? "") as string;
                        console.log(`Generated comment for post ${postIndex}: "${comment}"`);
                        
                        // Type slower and more human-like with random delays between characters
                        await commentBox.click();
                        await delay(Math.random() * 1000 + 500); // Random pause before typing
                        for (const char of comment) {
                            await page.keyboard.type(char, { delay: Math.random() * 150 + 50 }); // 50-200ms per character
                            if (Math.random() < 0.1) { // 10% chance of random pause mid-typing
                                await delay(Math.random() * 800 + 200);
                            }
                        }
                        await delay(Math.random() * 1500 + 500); // Random pause after typing
                        // New selector approach for the post button
                        const postButton = await page.evaluateHandle(() => {
                            const buttons = Array.from(
                                document.querySelectorAll('div[role="button"]')
                            );
                            return buttons.find(
                                (button) =>
                                    button.textContent === "Post" && !button.hasAttribute("disabled")
                            );
                        });
                        // Only click if postButton is an ElementHandle and not null
                        const postButtonElement = postButton && postButton.asElement ? postButton.asElement() : null;
                        if (postButtonElement) {
                            console.log(`Posting comment on post ${postIndex}...`);
                            await (postButtonElement as puppeteer.ElementHandle<Element>).click();
                            console.log(`Comment posted on post ${postIndex}.`);
                            await this.showOverlayMessage(`💬 Commented on post ${postIndex}`, 'success');
                            
                            // Mark this post as commented (in-memory)
                            commentedPosts.add(currentPostUrl);
                            
                            // Save to database for permanent tracking
                            if (canUseDatabase) {
                                try {
                                    await CommentedPost.create({
                                        postUrl: currentPostUrl,
                                        username: this.username,
                                        commentedAt: new Date()
                                    });
                                    console.log(`✅ Saved to database: ${currentPostUrl}`);
                                } catch (dbError: any) {
                                    if (dbError.code === 11000) {
                                        console.log(`Post already in database (duplicate key)`);
                                    } else {
                                        console.error(`Failed to save to database:`, dbError);
                                    }
                                }
                            } else {
                                console.warn('⚠️ MongoDB not connected; skipping duplicate tracking for this comment.');
                            }
                            
                            // Wait for comment to be posted and UI to update
                            await delay(2000);

                            if (
                                resolvedOptions.sendDMs &&
                                profileInsights.username &&
                                profileInsights.category === 'restaurant' &&
                                outboundDMsSent < (resolvedOptions.maxOutboundDMs ?? 10)
                            ) {
                                const dmSent = await this.sendLeadGenerationDM(
                                    profileInsights,
                                    recentCaptionCache || caption,
                                    currentPostUrl
                                );
                                if (dmSent) {
                                    outboundDMsSent++;
                                    await this.showOverlayMessage(`📨 DM sent to @${profileInsights.username}`, 'success');
                                }
                            }
                        } else {
                            console.log("Post button not found.");
                        }
                    } else {
                        console.log("Comment box not found.");
                    }
                }
                }
                console.log(`Taking a human-like pause before the next post...`);
                await this.humanLikePause(10000, 25000);
                
                // If we're viewing a single post (from profile/explore), click Next button
                if (isSinglePostView) {
                    console.log(`Looking for Next button to move to post ${postIndex + 1}...`);
                    // Try to find and click the Next button
                    const nextButton = await page.$('button[aria-label="Next"], svg[aria-label="Next"]').catch(() => null);
                    if (nextButton) {
                        await nextButton.click();
                        await delay(3000);
                        console.log(`Navigated to next post`);
                        await this.showOverlayMessage(`Next post ➡️`, 'info');
                    } else {
                        console.log(`No Next button found. Reached end of posts.`);
                        break;
                    }
                } else {
                    // Scroll to the next post (feed view)
                    console.log(`Scrolling to next post in feed...`);
                    await page.evaluate(() => {
                        window.scrollBy(0, window.innerHeight);
                    });
                    await delay(2000); // Wait for new posts to load
                    await this.showOverlayMessage(`Scrolling feed for more posts…`, 'info');
                }
                postIndex++;
            } catch (error) {
                console.error(`Error interacting with post ${postIndex}:`, error);
                break;
            }
        }
    }

    async watchStories(options: StoryOptions = {}) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        const normalizedTarget = this.normalizeUsername(options.targetUsername);
        const source = options.source || (normalizedTarget ? 'user' : 'feed');
        const storyCount = Math.max(1, options.storyCount ?? 10);

        let minWatchTimeMs = options.minWatchTimeMs ?? 5000;
        let maxWatchTimeMs = options.maxWatchTimeMs ?? 9000;
        if (maxWatchTimeMs < minWatchTimeMs) {
            [minWatchTimeMs, maxWatchTimeMs] = [maxWatchTimeMs, minWatchTimeMs];
        }
        minWatchTimeMs = Math.max(2000, minWatchTimeMs);
        maxWatchTimeMs = Math.max(minWatchTimeMs + 500, maxWatchTimeMs);

        const likeProbability = Math.min(1, Math.max(0, options.likeProbability ?? 0.25));
        const reactionProbability = Math.min(1, Math.max(0, options.reactionProbability ?? 0.2));
        const reactionEmoji = options.reactionEmoji && options.reactionEmoji.trim()
            ? options.reactionEmoji.trim()
            : '🔥';

        console.log(`🎞️ Starting story session (${storyCount} stories)`);
        await this.showOverlayMessage('Opening stories…', 'info');

        if (source === 'user' && normalizedTarget) {
            await page.goto(`https://www.instagram.com/stories/${normalizedTarget}/`, {
                waitUntil: "networkidle2",
            });
            await delay(3000);
        } else {
            await page.goto("https://www.instagram.com/", {
                waitUntil: "networkidle2",
            });
            await delay(3000);
        }
        await this.handleNotificationPopup();

        const viewerReady = await this.ensureStoryViewerOpen(normalizedTarget);
        if (!viewerReady) {
            console.log('⚠️ Unable to open story viewer. No stories available.');
            await this.showOverlayMessage('No stories available right now', 'warning');
            return;
        }

        for (let index = 1; index <= storyCount; index++) {
            await this.showOverlayMessage(`👀 Viewing story ${index}/${storyCount}`, 'info');
            const watchTime = Math.floor(Math.random() * (maxWatchTimeMs - minWatchTimeMs)) + minWatchTimeMs;
            await this.humanLikePause(Math.max(1500, watchTime - 1500), watchTime + 500);

            if (Math.random() < likeProbability) {
                const liked = await this.tryLikeCurrentStory();
                if (liked) {
                    console.log(`❤️ Liked story ${index}`);
                    await this.showOverlayMessage(`❤️ Liked story ${index}`, 'success');
                }
            } else if (Math.random() < reactionProbability) {
                const reacted = await this.tryReactToStory(reactionEmoji);
                if (reacted) {
                    console.log(`💬 Reacted to story ${index} with ${reactionEmoji}`);
                    await this.showOverlayMessage(`💬 Reacted with ${reactionEmoji}`, 'success');
                }
            }

            const advanced = await this.goToNextStory();
            if (!advanced) {
                console.log('Reached the end of available stories.');
                break;
            }
            await delay(1200);
        }

        await this.showOverlayMessage('Stories session complete ✅', 'success');
        await page.keyboard.press('Escape').catch(() => undefined);
    }

    private inferModeFromTarget(target?: string): InteractionMode {
        if (!target) return 'feed';
        const trimmed = target.trim().toLowerCase();
        if (trimmed === 'explore') return 'explore';
        if (trimmed === 'feed' || trimmed === 'recent') return 'feed';
        if (trimmed.startsWith('#')) return 'hashtag';
        if (trimmed.startsWith('location:')) return 'location';
        if (trimmed === 'stories') return 'stories';
        return 'user';
    }

    private normalizeUsername(value?: string): string | undefined {
        if (!value) return undefined;
        const cleaned = value.replace(/^@/, '').trim();
        return cleaned.length ? cleaned : undefined;
    }

    private resolveHashtag(target?: string, hashtags?: string[]): string | null {
        const normalizedList =
            hashtags
                ?.map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
                .filter(Boolean) || [];
        if (normalizedList.length) {
            const index = Math.floor(Math.random() * normalizedList.length);
            return normalizedList[index];
        }
        if (target && target.startsWith('#')) {
            const cleaned = target.replace(/^#/, '').trim().toLowerCase();
            return cleaned.length ? cleaned : null;
        }
        return null;
    }

    private resolveLocationPath(target?: string, provided?: string): string | null {
        const raw =
            provided ||
            (target && target.startsWith('location:')
                ? target.split('location:')[1]
                : undefined);
        if (!raw) return null;
        return raw.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    private async getPostPermalink(postSelector: string): Promise<string | null> {
        if (!this.page) throw new Error("Page not initialized");
        return this.page.evaluate((selector) => {
            const article = document.querySelector(selector);
            if (!article) return null;
            const link = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
            return link ? (link as HTMLAnchorElement).href : null;
        }, postSelector);
    }

    private async getEngagementMetrics(postSelector: string): Promise<EngagementMetrics> {
        if (!this.page) throw new Error("Page not initialized");
        return this.page.evaluate((selector) => {
            const article = document.querySelector(selector);
            if (!article) return { likes: null, comments: null };

            const parseValue = (value: string | null) => {
                if (!value) return null;
                const lower = value.trim().toLowerCase();
                let multiplier = 1;
                if (lower.endsWith('m')) multiplier = 1_000_000;
                else if (lower.endsWith('k')) multiplier = 1_000;
                const numeric = parseFloat(lower.replace(/[^0-9.]/g, ''));
                if (Number.isNaN(numeric)) return null;
                return Math.round(numeric * multiplier);
            };

            const text = (article as HTMLElement).innerText || '';
            const likeMatch = text.match(/([\d.,]+[kKmM]?)\s+likes/);
            const commentsMatch =
                text.match(/view all\s+([\d.,]+[kKmM]?)\s+comments/i) ||
                text.match(/([\d.,]+[kKmM]?)\s+comments/i);

            return {
                likes: parseValue(likeMatch ? likeMatch[1] : null),
                comments: parseValue(commentsMatch ? commentsMatch[1] : null),
            };
        }, postSelector);
    }

    private isEnglishText(text: string | null | undefined): boolean {
        if (!text) return true; // treat unknown/empty as acceptable
        const cleaned = text
            .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // remove regional indicator emojis
            .replace(/[^\p{L}\p{N}\s'.,!?-]/gu, '')
            .trim();
        if (cleaned.length < 8) {
            // text too short to classify reliably; assume ok
            return true;
        }
        try {
            const result = languageDetector.detect(cleaned, 1);
            if (!result.length) return true;
            const [language, probability] = result[0];
            if (language === 'english') return true;
            if (probability < 0.35) return true; // low confidence -> allow
            return false;
        } catch (error) {
            console.warn('Language detection failed:', error);
            return true;
        }
    }

    private relaxEngagementFilters(filters: { minLikes?: number; minComments?: number }): boolean {
        let changed = false;
        const MIN_LIKES_FLOOR = 5;
        const MIN_COMMENTS_FLOOR = 1;

        if (typeof filters.minLikes === 'number') {
            const next = Math.floor(filters.minLikes * 0.8);
            if (next < MIN_LIKES_FLOOR) {
                delete filters.minLikes;
                changed = true;
            } else if (next < filters.minLikes) {
                filters.minLikes = next;
                changed = true;
            }
        }

        if (typeof filters.minComments === 'number') {
            const next = Math.floor(filters.minComments * 0.8);
            if (next < MIN_COMMENTS_FLOOR) {
                delete filters.minComments;
                changed = true;
            } else if (next < filters.minComments) {
                filters.minComments = next;
                changed = true;
            }
        }

        return changed;
    }

    private async showOverlayMessage(
        message: string,
        variant: 'info' | 'success' | 'warning' | 'error' = 'info'
    ) {
        if (!this.page) return;
        try {
            await this.page.evaluate(({ message, variant }) => {
                const overlayId = 'riona-ig-overlay';
                let overlay = document.getElementById(overlayId);
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = overlayId;
                    const style = overlay.style;
                    style.position = 'fixed';
                    style.top = '16px';
                    style.right = '16px';
                    style.zIndex = '2147483647';
                    style.padding = '10px 16px';
                    style.borderRadius = '999px';
                    style.background = 'rgba(12, 12, 12, 0.85)';
                    style.color = '#fff';
                    style.fontSize = '14px';
                    style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                    style.transition = 'opacity 0.3s ease';
                    style.opacity = '0';
                    style.pointerEvents = 'none';
                    style.border = '1px solid rgba(255,255,255,0.3)';
                    document.body.appendChild(overlay);
                }

                overlay.textContent = message;
                const palette: Record<string, string> = {
                    info: '#4da3ff',
                    success: '#4caf50',
                    warning: '#ff9800',
                    error: '#f44336'
                };
                const color = palette[variant] || palette.info;
                overlay.style.boxShadow = `0 0 18px ${color}55`;
                overlay.style.borderColor = `${color}aa`;
                overlay.style.opacity = '1';

                const win = window as typeof window & { __rionaOverlayTimeout?: number };
                if (win.__rionaOverlayTimeout) {
                    window.clearTimeout(win.__rionaOverlayTimeout);
                }
                win.__rionaOverlayTimeout = window.setTimeout(() => {
                    const currentOverlay = document.getElementById(overlayId);
                    if (currentOverlay) {
                        currentOverlay.style.opacity = '0';
                    }
                }, 2200);
            }, { message, variant });
        } catch (error) {
            console.debug('Overlay update failed', error);
        }
    }

    private async humanLikePause(minMs: number, maxMs: number) {
        if (!this.page) return;
        if (maxMs < minMs) {
            [minMs, maxMs] = [maxMs, minMs];
        }
        const total = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        let elapsed = 0;

        while (elapsed < total) {
            const segment = Math.min(total - elapsed, Math.floor(Math.random() * 2500) + 1200);
            await delay(segment);
            elapsed += segment;

            if (Math.random() < 0.4) {
                const x = Math.floor(Math.random() * 800) + 200;
                const y = Math.floor(Math.random() * 500) + 200;
                await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 4) + 1 });
            }

            if (Math.random() < 0.3) {
                const delta = (Math.random() - 0.5) * 300;
                await this.page.evaluate((offset) => window.scrollBy(0, offset), delta);
            }
        }
    }

    private async ensureStoryViewerOpen(targetUsername?: string | null): Promise<boolean> {
        if (!this.page) return false;
        const page = this.page;
        const viewerSelector = 'div[role="presentation"] video, div[role="presentation"] img';

        if (await page.$(viewerSelector)) {
            return true;
        }

        if (targetUsername) {
            await page.goto(`https://www.instagram.com/stories/${targetUsername}/`, {
                waitUntil: "networkidle2",
            });
            await delay(2500);
            await this.handleNotificationPopup();
            return (await page.$(viewerSelector)) !== null;
        }

        const triggerSelectors = [
            'button[aria-label*="story"]',
            'button[aria-label*="Story"]',
            'div[role="button"][aria-label*="story"]',
            'div[role="button"][aria-label*="Story"]',
            'canvas[aria-label*="story"]',
            'canvas[aria-label*="Story"]',
            'a[href^="/stories/"]',
            'svg[aria-label="Stories"]',
        ];

        for (const selector of triggerSelectors) {
            const element = await page.$(selector);
            if (!element) continue;
            try {
                await element.click();
                await delay(2500);
                if (await page.$(viewerSelector)) {
                    return true;
                }
            } catch {
                continue;
            }
        }

        const clicked = await page.evaluate(() => {
            const link = document.querySelector('a[href^="/stories/"]');
            if (link) {
                (link as HTMLElement).click();
                return true;
            }
            return false;
        });
        if (clicked) {
            await delay(2500);
            return (await page.$(viewerSelector)) !== null;
        }

        return false;
    }

    private async tryLikeCurrentStory(): Promise<boolean> {
        if (!this.page) return false;
        const selectors = [
            'button[aria-label="Like"]',
            'div[aria-label="Like"]',
            'svg[aria-label="Like"]',
        ];

        for (const selector of selectors) {
            const handle = await this.page.$(selector);
            if (!handle) continue;
            try {
                const label = await handle.evaluate((el) => el.getAttribute('aria-label')?.toLowerCase());
                if (label === 'like') {
                    await handle.click();
                    await delay(600);
                    return true;
                }
            } catch {
                continue;
            }
        }
        return false;
    }

    private async tryReactToStory(emoji: string): Promise<boolean> {
        if (!this.page) return false;
        const inputSelectors = [
            'textarea[placeholder^="Reply"]',
            'textarea[aria-label="Message"]',
            'input[placeholder^="Reply"]',
            'div[contenteditable="true"][role="textbox"]',
        ];

        for (const selector of inputSelectors) {
            const input = await this.page.$(selector);
            if (!input) continue;

            try {
                await input.click({ clickCount: 1 });
                await delay(200);
                await this.page.keyboard.type(emoji, { delay: 120 });
                await delay(200);
                await this.page.keyboard.press('Enter');
                await delay(400);
                return true;
            } catch {
                continue;
            }
        }
        return false;
    }

    private async goToNextStory(): Promise<boolean> {
        if (!this.page) return false;
        const selectors = [
            'button[aria-label="Next"]',
            'div[aria-label="Next"]',
            'svg[aria-label="Next"]',
        ];

        for (const selector of selectors) {
            const button = await this.page.$(selector);
            if (!button) continue;
            try {
                await button.click();
                await delay(1500);
                return true;
            } catch {
                continue;
            }
        }

        const viewport = this.page.viewport();
        if (viewport) {
            try {
                await this.page.mouse.click(Math.max(1, viewport.width - 30), viewport.height / 2);
                await delay(1500);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    private sanitizeFilename(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'conversation';
    }

    private async captureConversationScreenshot(conversationTitle: string): Promise<string | null> {
        if (!this.page) return null;
        try {
            const screenshotDir = path.join(process.cwd(), 'logs', 'dm-screens');
            await fs.mkdir(screenshotDir, { recursive: true });
            const filename = `${Date.now()}-${this.sanitizeFilename(conversationTitle)}.png`;
            const filePath = path.join(screenshotDir, filename);
            await this.page.screenshot({ path: filePath });
            return filePath;
        } catch (error) {
            console.warn('Failed to capture DM screenshot:', error);
            return null;
        }
    }

    private async capturePostScreenshot(postSelector: string, identifier: string): Promise<string | null> {
        if (!this.page) return null;
        try {
            const postHandle = await this.page.$(postSelector);
            if (!postHandle) return null;
            const screenshotDir = path.join(process.cwd(), 'logs', 'post-screens');
            await fs.mkdir(screenshotDir, { recursive: true });
            const filename = `${Date.now()}-${this.sanitizeFilename(identifier)}.png`;
            const filePath = path.join(screenshotDir, filename);
            await postHandle.screenshot({ path: filePath });
            console.log(`📷 Post screenshot saved to ${filePath}`);
            await postHandle.dispose();
            return filePath;
        } catch (error) {
            console.warn('Failed to capture post screenshot:', error);
            return null;
        }
    }

    private async captureGenericPageScreenshot(page: puppeteer.Page, dirName: string, prefix: string): Promise<string | null> {
        try {
            const screenshotDir = path.join(process.cwd(), 'logs', dirName);
            await fs.mkdir(screenshotDir, { recursive: true });
            const filename = `${Date.now()}-${this.sanitizeFilename(prefix)}.png`;
            const filePath = path.join(screenshotDir, filename);
            await page.screenshot({ path: filePath });
            console.log(`📸 Saved screenshot to ${filePath}`);
            return filePath;
        } catch (error) {
            console.warn('Failed to capture page screenshot:', error);
            return null;
        }
    }

    private async extractFallbackCaption(postSelector: string): Promise<string> {
        if (!this.page) return '';
        try {
            return await this.page.evaluate((selector) => {
                const article = document.querySelector(selector);
                if (!article) return '';

                const results: string[] = [];
                const seen = new Set<string>();
                const pushText = (text: string | null | undefined) => {
                    const cleaned = (text || '').trim();
                    if (
                        cleaned.length >= 4 &&
                        /[a-zA-Z]/.test(cleaned) &&
                        !seen.has(cleaned.toLowerCase())
                    ) {
                        seen.add(cleaned.toLowerCase());
                        results.push(cleaned);
                    }
                };

                const preferredSelectors = [
                    'ul li div[dir="auto"] span[dir="auto"]',
                    'div[role="presentation"] span[dir="auto"]',
                    'header + div span[dir="auto"]',
                    'span[dir="auto"]',
                ];

                for (const sel of preferredSelectors) {
                    const nodes = article.querySelectorAll(sel);
                    nodes.forEach((node) => pushText(node.textContent));
                    if (results.length) break;
                }

                if (!results.length) {
                    const fallbackText = (article.textContent || '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line.length >= 4 && /[a-zA-Z]/.test(line));
                    if (fallbackText.length) {
                        results.push(fallbackText[0]);
                    }
                }

                return results[0] || '';
            }, postSelector);
        } catch (error) {
            console.warn('Fallback caption extraction failed:', error);
            return '';
        }
    }

    private classifyProfile(bioText: string): 'restaurant' | 'foodie' | 'other' {
        const normalized = bioText.toLowerCase();
        const isRestaurant = this.restaurantKeywords.some((keyword) => normalized.includes(keyword));
        if (isRestaurant) return 'restaurant';
        const isFoodie = this.foodieKeywords.some((keyword) => normalized.includes(keyword));
        return isFoodie ? 'foodie' : 'other';
    }

    private buildLeadPrompt(username: string, bio?: string, caption?: string): string {
        const bioText = bio && bio.trim().length ? bio.trim() : 'Not provided';
        const captionText = caption && caption.trim().length ? caption.trim() : 'Not provided';
        return `You are a marketing strategist from Marketing Team App. ${this.marketingValueProp} Write a short Instagram DM to @${username}.

Prospect bio: ${bioText}
Recent caption: ${captionText}

Requirements:
- 2 sentences max (~250 characters total)
- Friendly, confident tone, light emoji use ok
- Reference something relevant from their bio/caption if possible
- Mention that we deliver done-for-you marketing with guaranteed results and no long-term contracts
- End with a clear CTA (book a strategy call or reply to chat)

Return only the DM text.`;
    }

    private async sendLeadGenerationDM(
        profile: ProfileInspectionResult,
        caption?: string,
        returnUrl?: string
    ): Promise<boolean> {
        if (!this.page || !profile.username) return false;
        const page = this.page;
        const username = profile.username;
        if (this.contactedUsers.has(username)) {
            console.log(`ℹ️ Skipping DM to @${username}: already contacted this session.`);
            return false;
        }

        const targetUrl = profile.profileUrl || `https://www.instagram.com/${username}/`;
        const fallbackUrl = returnUrl || page.url();
        let navigated = false;

        try {
            await page.goto(targetUrl, {
                waitUntil: 'networkidle2',
                timeout: 35000,
            });
            navigated = true;
            await delay(2500);
            await this.handleNotificationPopup();
            await this.captureGenericPageScreenshot(page, 'dm-outreach', `${username}-profile`);

            const messageButtonHandle = await page.evaluateHandle(() => {
                const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a'));
                return (
                    candidates.find((el) => {
                        const text = (el.textContent || '').trim().toLowerCase();
                        return text === 'message' || text === 'send message';
                    }) || null
                );
            });

            const messageButton = messageButtonHandle?.asElement();
            if (!messageButton) {
                console.log(`⚠️ Unable to find Message button for @${username}`);
                return false;
            }

            await (messageButton as puppeteer.ElementHandle<Element>).click();
            const composerSelectors = [
                'div[role="dialog"] div[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                'textarea[placeholder][name]',
                'textarea[placeholder="Message..."]',
                'textarea',
            ];
            let input: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of composerSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 6000 });
                    input = await page.$(selector);
                    if (input) break;
                } catch {
                    continue;
                }
            }

            if (!input) {
                console.log(`⚠️ DM input not found for @${username}. Composer selectors failed.`);
                return false;
            }

            await this.captureGenericPageScreenshot(page, 'dm-outreach', `${username}-before`);

            const snapshot = await this.scrapeConversationSnapshotFromPage(page);
            if (snapshot.lastIsSelf) {
                console.log(`ℹ️ Skipping DM to @${username}: last message already sent by us.`);
                return false;
            }

            const prompt = this.buildLeadPrompt(username, profile.bio, caption);
            const schema = getInstagramCommentSchema();
            const result = await runAgent(schema, prompt);
            const outreachMessage = (
                result[0]?.comment ||
                'Hey! We help restaurants with full-service marketing that guarantees results. Want me to send our plan? 😊'
            ).trim();
            const snippet = outreachMessage.slice(0, 40);

            const typeAndSend = async () => {
                await input!.click({ clickCount: 1 });
                await delay(400);
                await page.keyboard.down('Control');
                await page.keyboard.press('A');
                await page.keyboard.up('Control');
                await page.keyboard.press('Backspace');
                await delay(200);
                await (input as puppeteer.ElementHandle<Element>).type(outreachMessage, {
                    delay: Math.random() * 120 + 40,
                });
                await delay(400);
                await page.keyboard.press('Enter');
            };

            await typeAndSend();

            let delivered = await this.waitForDMDelivery(page, snippet);
            if (!delivered) {
                console.log(`⚠️ First DM send attempt failed for @${username}, retrying...`);
                await delay(1200);
                await typeAndSend();
                delivered = await this.waitForDMDelivery(page, snippet, 10000);
            }

            if (!delivered) {
                console.log(`⚠️ DM delivery verification failed for @${username}`);
                return false;
            }

            console.log(`📨 Sent outreach DM to @${username}`);
            await this.captureGenericPageScreenshot(page, 'dm-outreach', `${username}-after`);
            this.contactedUsers.add(username);
            await this.humanLikePause(2500, 5000);
            return true;
        } catch (error) {
            console.warn(`Failed to send DM to @${username}:`, error);
            return false;
        } finally {
            if (returnUrl) {
                try {
                    await page.goto(returnUrl, {
                        waitUntil: 'networkidle2',
                        timeout: 35000,
                    });
                    await delay(2000);
                    await this.handleNotificationPopup();
                } catch (navError) {
                    console.warn('Failed to return to original post after DM:', navError);
                }
            } else if (navigated) {
                try {
                    await page.goBack({ waitUntil: 'networkidle2' });
                    await delay(1500);
                } catch {
                    // ignore
                }
            }
        }
    }

    private async waitForDMDelivery(page: puppeteer.Page, snippet: string, timeout = 8000): Promise<boolean> {
        const needle = snippet.trim().toLowerCase();
        if (!needle.length) return false;
        try {
            await page.waitForFunction(
                (expected) => {
                    const candidates = Array.from(document.querySelectorAll('div[role="listitem"] div[dir="auto"], div[role="listitem"] span'));
                    return candidates.some((node) => (node.textContent || '').trim().toLowerCase().includes(expected));
                },
                { timeout },
                needle
            );
            return true;
        } catch {
            return false;
        }
    }

    private async scrapeConversationSnapshotFromPage(pageHandle: puppeteer.Page): Promise<{ texts: string[]; lastIsSelf: boolean }> {
        try {
            const result = await pageHandle.evaluate(() => {
                const texts: string[] = [];
                const containers = Array.from(
                    document.querySelectorAll('div[role="dialog"] div[role="listitem"], div[role="dialog"] li')
                );
                for (const container of containers) {
                    const spans = container.querySelectorAll('span[dir="auto"], div[dir="auto"], div[aria-label]');
                    for (const span of spans) {
                        const text = (span.textContent || '').trim();
                        if (text && text.length < 500) {
                            texts.push(text);
                        }
                    }
                }

                const trimmed = texts.slice(-12);
                const lastText = trimmed[trimmed.length - 1] || '';
                const lowered = lastText.trim().toLowerCase();
                const lastIsSelf =
                    lowered.startsWith('you ') ||
                    lowered.startsWith('you:') ||
                    lowered.includes('you sent') ||
                    lowered.includes('you replied');

                return { texts: trimmed, lastIsSelf };
            });
            return result;
        } catch {
            return { texts: [], lastIsSelf: false };
        }
    }

    private async hasExistingComment(postSelector: string): Promise<boolean> {
        if (!this.page || !this.username) return false;
        try {
            const username = this.username.toLowerCase();
            return await this.page.evaluate(
                ({ selector, username }) => {
                    const article = document.querySelector(selector);
                    if (!article) return false;
                    const commentRows = Array.from(article.querySelectorAll('ul li'));
                    return commentRows.some((row) => {
                        const profileLink = row.querySelector('a[href^="/"]');
                        if (!profileLink) return false;
                        const href = (profileLink.getAttribute('href') || '').toLowerCase();
                        const text = (profileLink.textContent || '').trim().toLowerCase();
                        const normalized = href.replace(/^\//, '').replace(/\/$/, '');
                        return normalized === username && text === username;
                    });
                },
                { selector: postSelector, username }
            );
        } catch (error) {
            console.warn('Failed to detect existing comment:', error);
            return false;
        }
    }

    private async inspectProfile(
        postSelector: string,
        enabled: boolean,
        filters?: { requiredKeywords?: string[] }
    ): Promise<ProfileInspectionResult> {
        if (!enabled || !this.page || !this.browser) return { approved: true };
        const page = this.page;
        let profilePage: puppeteer.Page | null = null;
        let screenshotPath: string | undefined;
        let profileUrl: string | undefined;
        let usernameMatch = 'profile';
        try {
            const postHandle = await page.$(postSelector);
            if (!postHandle) return { approved: true };

            const profileHref = await postHandle.evaluate((post) => {
                const anchor = post.querySelector('header a');
                if (!anchor) return null;
                return anchor.getAttribute('href') || (anchor as HTMLAnchorElement).href || null;
            });
            await postHandle.dispose();

            if (!profileHref) {
                console.log('⚠️ Unable to locate profile link for post; skipping inspection.');
                return { approved: true };
            }

            profileUrl = profileHref.startsWith('http')
                ? profileHref
                : `https://www.instagram.com${profileHref}`;

            profilePage = await this.browser.newPage();
            const viewport = page.viewport() || { width: 1280, height: 720 };
            await profilePage.setViewport(viewport);
            await profilePage.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 25000 });
            await delay(1500);

            const profileText = await profilePage.evaluate(() => {
                const header = document.querySelector('header');
                if (!header) return '';
                return Array.from(header.querySelectorAll('h1, h2, span, div'))
                    .map((el) => (el.textContent || '').trim())
                    .filter(Boolean)
                    .join(' ');
            });
            const normalized = profileText.toLowerCase();
            const category = this.classifyProfile(profileText);

            const screenshotDir = path.join(process.cwd(), 'logs', 'profile-screens');
            await fs.mkdir(screenshotDir, { recursive: true });
            usernameMatch = profileUrl.split('/').filter(Boolean).pop() || 'profile';
            const screenshotName = `${Date.now()}-${this.sanitizeFilename(usernameMatch)}.png`;
            screenshotPath = path.join(screenshotDir, screenshotName);
            await profilePage.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Profile screenshot saved to ${screenshotPath}`);

            const requiredMatch =
                !filters?.requiredKeywords ||
                filters.requiredKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()));

            if (category !== 'restaurant' || !requiredMatch) {
                const reason =
                    category !== 'restaurant'
                        ? `classified as ${category}`
                        : `missing required keywords (${filters?.requiredKeywords?.join(', ')})`;
                console.log(`⚠️ Profile rejected (${reason}): ${profileUrl}`);
            }

            const approved = category === 'restaurant' && requiredMatch;
            return {
                approved,
                username: usernameMatch,
                profileUrl,
                bio: profileText,
                screenshotPath,
                category,
            };
        } catch (error) {
            console.warn('Profile inspection failed:', error);
            return { approved: true };
        } finally {
            if (profilePage) {
                try {
                    await profilePage.close();
                } catch {
                    // ignore close errors
                }
            }
        }
    }

    private async loadConversationItems(targetCount: number = 30, maxAttempts: number = 6, offset: number = 0): Promise<puppeteer.ElementHandle<Element>[]> {
        if (!this.page) return [];
        const baseSelector = '[aria-label="Thread list"] div[role="button"][tabindex="0"]';
        const collected: puppeteer.ElementHandle<Element>[] = [];
        const seen = new Set<string>();

        const isConversationButton = async (
            element: puppeteer.ElementHandle<Element>
        ): Promise<{ valid: boolean; unread: boolean }> => {
            const text = (await element.evaluate((el) => (el.textContent || '').trim().toLowerCase())) || '';
            if (!text) return { valid: false, unread: false };
            if (text.includes('share a thought') || text.includes('share a note') || text.includes('your note')) {
                return { valid: false, unread: false };
            }
            if (text.includes('primary') || text.includes('general') || text.includes('requests')) {
                return { valid: false, unread: false };
            }
            if (text.includes('new message')) return { valid: false, unread: false };
            if (text.includes('your note') || text.startsWith('note')) return { valid: false, unread: false };

            const noteBadge = await element.$('[aria-label="Note"], [aria-label="Notes"]');
            if (noteBadge) return { valid: false, unread: false };

            const hasAvatar = await element.$('img, canvas');
            const badge = await element.$('div[x-status]');
            const unreadDot = await element.$('[aria-label="Unread"]');

            return {
                valid: !!(hasAvatar || badge || text.split(' ').length > 3),
                unread: !!unreadDot,
            };
        };

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const elements = await this.page.$$(baseSelector);
            for (const element of elements) {
                const { valid, unread } = await isConversationButton(element);
                if (valid) {
                    const id = await element.evaluate((el) => el.getAttribute('data-thread-id') || el.textContent || '');
                    if (id && !seen.has(id)) {
                        seen.add(id);
                        if (unread) {
                            collected.unshift(element);
                        } else {
                            collected.push(element);
                        }
                    }
                }
            }

            if (collected.length >= targetCount) {
                return collected.slice(0, targetCount);
            }

            await this.page.evaluate(() => {
                const list = document.querySelector('[aria-label="Thread list"]');
                if (list && list instanceof HTMLElement) {
                    list.scrollTop = list.scrollHeight;
                }
            }).catch(() => {});

            console.log(`Loaded ${collected.length} conversations so far (attempt ${attempt}/${maxAttempts})...`);
            await delay(1500);
            await this.handleNotificationPopup();
        }

        return collected;
    }

    async scrapeFollowers(targetAccount: string, maxFollowers: number) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        try {
            // Navigate to the target account's followers page
            await page.goto(`https://www.instagram.com/${targetAccount}/followers/`, {
                waitUntil: "networkidle2",
            });
            console.log(`Navigated to ${targetAccount}'s followers page`);

            // Wait for the followers modal to load (try robustly)
            try {
                await page.waitForSelector('div a[role="link"] span[title]');
            } catch {
                // fallback: wait for dialog
                await page.waitForSelector('div[role="dialog"]');
            }
            console.log("Followers modal loaded");

            const followers: string[] = [];
            let previousHeight = 0;
            let currentHeight = 0;
            maxFollowers = maxFollowers + 4;
            // Scroll and collect followers until we reach the desired amount or can't scroll anymore
            console.log(maxFollowers);
            while (followers.length < maxFollowers) {
                // Get all follower links in the current view - be more specific
                const newFollowers = await page.evaluate(() => {
                    // Look for links within the followers dialog
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog) return [];
                    
                    const followerElements = dialog.querySelectorAll('a[role="link"]');
                    return Array.from(followerElements)
                        .map((element) => element.getAttribute("href"))
                        .filter((href): href is string => {
                            if (!href) return false;
                            // Only include simple username links (not stories, reels, etc.)
                            const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
                            return match !== null;
                        })
                        .map((href) => href.replace(/^\//, '').replace(/\/$/, '')); // Clean username
                });

                // Add new unique followers to our list
                for (const follower of newFollowers) {
                    if (!followers.includes(follower) && followers.length < maxFollowers) {
                        followers.push(follower);
                        console.log(`Found follower: ${follower}`);
                    }
                }

                // Scroll the followers modal
                await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (dialog) {
                        dialog.scrollTop = dialog.scrollHeight;
                    }
                });

                // Wait for potential new content to load
                await delay(1000);

                // Check if we've reached the bottom
                currentHeight = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    return dialog ? dialog.scrollHeight : 0;
                });

                if (currentHeight === previousHeight) {
                    console.log("Reached the end of followers list");
                    break;
                }

                previousHeight = currentHeight;
            }

            // Filter out any non-username entries (stories, reels, etc.)
            const cleanFollowers = followers.filter(f => {
                return !f.includes('/') && 
                       !f.includes('stories') && 
                       !f.includes('reel') && 
                       !f.includes('highlights') &&
                       f.length > 0;
            });
            
            console.log(`Successfully scraped ${cleanFollowers.length} followers`);
            return cleanFollowers.slice(0, maxFollowers - 4); // Return up to requested amount
        } catch (error) {
            console.error(`Error scraping followers for ${targetAccount}:`, error);
            throw error;
        }
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export async function scrapeFollowersHandler(targetAccount: string, maxFollowers: number) {
    const client = new IgClient();
    await client.init();
    const followers = await client.scrapeFollowers(targetAccount, maxFollowers);
    await client.close();
    return followers;
}