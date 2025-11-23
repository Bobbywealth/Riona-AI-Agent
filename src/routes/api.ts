import express, { Request, Response } from 'express';
import { getIgClient, closeIgClient, scrapeFollowersHandler } from '../client/Instagram';
import logger from '../config/logger';
import mongoose from 'mongoose';
import { signToken, verifyToken, getTokenFromRequest } from '../secret';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import type { InteractionOptions } from '../client/IG-bot/types';

const router = express.Router();

const validSameSiteValues = new Set(['lax', 'strict', 'none']);
const rawSameSite = process.env.COOKIE_SAMESITE?.toLowerCase();
const cookieSameSite: 'lax' | 'strict' | 'none' =
  rawSameSite && validSameSiteValues.has(rawSameSite)
    ? (rawSameSite as 'lax' | 'strict' | 'none')
    : 'lax';
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const logsDirectory = path.join(__dirname, '../../logs');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// JWT Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(token);
  if (!payload || typeof payload !== 'object' || !('username' in payload)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  (req as any).user = { username: payload.username };
  next();
}

// Status endpoint
router.get('/status', (req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const token = getTokenFromRequest(req);
  let authenticated = false;
  let username: string | null = null;

  if (token) {
    const payload = verifyToken(token);
    if (payload && typeof payload === 'object' && 'username' in payload) {
      authenticated = true;
      username = (payload as { username: string }).username;
    }
  }

  return res.json({
    status: dbConnected ? 'Online' : 'Offline',
    dbConnected,
    authenticated,
    username,
  });
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const igClient = await getIgClient(username, password);
    // Sign JWT and set as httpOnly cookie
    const token = signToken({ username });
    // Use 7 days if rememberMe is true, otherwise 2 hours
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: cookieSameSite,
      maxAge,
      secure: cookieSecure,
    });
    return res.json({ message: 'Login successful', username });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Auth check endpoint
router.get('/me', (req: Request, res: Response) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(token);
  if (!payload || typeof payload !== 'object' || !('username' in payload)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  return res.json({ username: payload.username });
});

// Endpoint to clear Instagram cookies
router.delete('/clear-cookies', async (req, res) => {
  const cookiesPath = path.join(__dirname, '../../cookies/Instagramcookies.json');
  try {
    await fs.unlink(cookiesPath);
    res.json({ success: true, message: 'Instagram cookies cleared.' });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.json({ success: true, message: 'No cookies to clear.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to clear cookies.', error: err.message });
    }
  }
});

// All routes below require authentication
router.use(requireAuth);

router.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const limit =
      typeof req.query.lines === 'string' && !Number.isNaN(parseInt(req.query.lines, 10))
        ? Math.min(200, Math.max(10, parseInt(req.query.lines, 10)))
        : 50;

    const now = new Date();
    const dateSlug = now.toISOString().split('T')[0];
    const logPath = path.join(logsDirectory, `${dateSlug}-combined.log`);

    if (!(await fileExists(logPath))) {
      return res.json({ lines: ['No log entries recorded for today yet.'] });
    }

    const raw = await fs.readFile(logPath, 'utf-8');
    const cleaned = raw.trim().split(/\r?\n/).filter(Boolean);
    const lines = cleaned.slice(-limit);
    return res.json({ lines });
  } catch (error) {
    logger.error('Recent logs fetch error:', error);
    return res.status(500).json({ error: 'Failed to load recent logs' });
  }
});

// Interact with posts endpoint
router.post('/interact', async (req: Request, res: Response) => {
  try {
    const { targetUsername, maxPosts, mode, options } = req.body;
    const igClient = await getIgClient((req as any).user.username);

    const sanitizeNumber = (value: any): number | undefined => {
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
      if (typeof value === 'string' && value.trim().length) {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const sanitizeStringArray = (value: any): string[] | undefined => {
      if (!value) return undefined;
      if (Array.isArray(value)) {
        const cleaned = value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean);
        return cleaned.length ? cleaned : undefined;
      }
      if (typeof value === 'string') {
        const cleaned = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        return cleaned.length ? cleaned : undefined;
      }
      return undefined;
    };

    const sanitizeBoolean = (value: any): boolean | undefined => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (!trimmed.length) return undefined;
        if (['true', '1', 'yes', 'y'].includes(trimmed)) return true;
        if (['false', '0', 'no', 'n'].includes(trimmed)) return false;
      }
      return undefined;
    };

    const bodyOptions = (options || {}) as InteractionOptions;
    const interactionOptions: InteractionOptions = {
      mode: bodyOptions.mode || mode,
      hashtags: sanitizeStringArray(bodyOptions.hashtags),
      locationPath:
        typeof bodyOptions.locationPath === 'string'
          ? bodyOptions.locationPath.trim()
          : undefined,
      competitorUsername:
        typeof bodyOptions.competitorUsername === 'string'
          ? bodyOptions.competitorUsername.trim()
          : undefined,
      followersToEngage: sanitizeNumber(bodyOptions.followersToEngage),
      postsPerFollower: sanitizeNumber(bodyOptions.postsPerFollower),
      engagement: bodyOptions.engagement
        ? {
            minLikes: sanitizeNumber(bodyOptions.engagement.minLikes),
            minComments: sanitizeNumber(bodyOptions.engagement.minComments),
          }
        : undefined,
      englishOnly: sanitizeBoolean(
        bodyOptions.englishOnly !== undefined ? bodyOptions.englishOnly : req.body.englishOnly
      ),
    };

    if (
      interactionOptions.engagement &&
      interactionOptions.engagement.minLikes === undefined &&
      interactionOptions.engagement.minComments === undefined
    ) {
      delete interactionOptions.engagement;
    }

    await igClient.interactWithPosts(targetUsername, maxPosts || 5, interactionOptions);
    return res.json({
      message: 'Interaction successful',
      mode: interactionOptions.mode || 'feed',
    });
  } catch (error) {
    logger.error('Interaction error:', error);
    return res.status(500).json({ error: 'Failed to interact with posts' });
  }
});

// Watch stories endpoint
router.post('/stories/watch', async (req: Request, res: Response) => {
  try {
    const igClient = await getIgClient((req as any).user.username);

    const sanitizeNumber = (value: any): number | undefined => {
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
      if (typeof value === 'string' && value.trim().length) {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const sanitizeFloat = (value: any): number | undefined => {
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
      if (typeof value === 'string' && value.trim().length) {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const normalizeProbability = (value: number | undefined): number | undefined => {
      if (value === undefined) return undefined;
      const normalized = value > 1 ? value / 100 : value;
      return Math.min(1, Math.max(0, normalized));
    };

    const options = {
      targetUsername:
        typeof req.body.targetUsername === 'string'
          ? req.body.targetUsername.trim()
          : undefined,
      storyCount: sanitizeNumber(req.body.storyCount) ?? 10,
      minWatchTimeMs: sanitizeNumber(req.body.minWatchTimeMs),
      maxWatchTimeMs: sanitizeNumber(req.body.maxWatchTimeMs),
      likeProbability: normalizeProbability(sanitizeFloat(req.body.likeProbability)),
      reactionProbability: normalizeProbability(sanitizeFloat(req.body.reactionProbability)),
      reactionEmoji:
        typeof req.body.reactionEmoji === 'string' && req.body.reactionEmoji.trim().length
          ? req.body.reactionEmoji.trim()
          : undefined,
    };

    await igClient.watchStories(options);
    return res.json({ message: 'Stories viewed successfully' });
  } catch (error) {
    logger.error('Stories watch error:', error);
    return res.status(500).json({ error: 'Failed to watch stories' });
  }
});

// Monitor and reply to DMs endpoint
router.post('/monitor-dms', async (req: Request, res: Response) => {
  try {
    const igClient = await getIgClient((req as any).user.username);
    await igClient.monitorAndReplyToDMs();
    return res.json({ message: 'DM monitoring completed' });
  } catch (error) {
    logger.error('DM monitoring error:', error);
    return res.status(500).json({ error: 'Failed to monitor DMs' });
  }
});

// Send direct message endpoint
router.post('/dm', async (req: Request, res: Response) => {
  try {
    const { username, message } = req.body;
    if (!username || !message) {
      return res.status(400).json({ error: 'Username and message are required' });
    }
    const igClient = await getIgClient((req as any).user.username);
    await igClient.sendDirectMessage(username, message);
    return res.json({ message: 'Message sent successfully' });
  } catch (error) {
    logger.error('DM error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send messages from file endpoint
router.post('/dm-file', async (req: Request, res: Response) => {
  try {
    const { file, message, mediaPath } = req.body;
    if (!file || !message) {
      return res.status(400).json({ error: 'File and message are required' });
    }
    const igClient = await getIgClient((req as any).user.username);
    await igClient.sendDirectMessagesFromFile(file, message, mediaPath);
    return res.json({ message: 'Messages sent successfully' });
  } catch (error) {
    logger.error('File DM error:', error);
    return res.status(500).json({ error: 'Failed to send messages from file' });
  }
});

// Scrape followers endpoint
router.post('/scrape-followers', async (req: Request, res: Response) => {
  const { targetAccount, maxFollowers } = req.body;
  try {
    const result = await scrapeFollowersHandler(targetAccount, maxFollowers);
    if (Array.isArray(result)) {
      if (req.query.download === '1') {
        const filename = `${targetAccount}_followers.txt`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/plain');
        res.send(result.join('\n'));
      } else {
        res.json({ success: true, followers: result });
      }
    } else {
      res.json({ success: true, result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET handler for scrape-followers to support file download
router.get('/scrape-followers', async (req: Request, res: Response) => {
  const { targetAccount, maxFollowers } = req.query;
  try {
    const result = await scrapeFollowersHandler(
      String(targetAccount),
      Number(maxFollowers)
    );
    if (Array.isArray(result)) {
      const filename = `${targetAccount}_followers.txt`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain');
      res.send(result.join('\n'));
    } else {
      res.status(400).send('No followers found.');
    }
  } catch (error) {
    res.status(500).send('Error scraping followers.');
  }
});

// Exit endpoint
router.post('/exit', async (_req: Request, res: Response) => {
  try {
    await closeIgClient();
    return res.json({ message: 'Exiting successfully' });
  } catch (error) {
    logger.error('Exit error:', error);
    return res.status(500).json({ error: 'Failed to exit gracefully' });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: cookieSameSite,
    secure: cookieSecure,
  });
  return res.json({ message: 'Logged out successfully' });
});

// Get proxy settings
router.get('/proxy/settings', (_req: Request, res: Response) => {
  try {
    const settings = {
      enabled: process.env.PROXY_ENABLED === 'true',
      host: process.env.PROXY_HOST || '',
      port: process.env.PROXY_PORT || '',
      hasAuth: !!(process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD)
    };
    return res.json(settings);
  } catch (error) {
    logger.error('Error getting proxy settings:', error);
    return res.status(500).json({ error: 'Failed to get proxy settings' });
  }
});

// Update proxy settings
router.post('/proxy/settings', async (req: Request, res: Response) => {
  try {
    const { enabled, host, port, username, password } = req.body;
    
    // Update environment variables
    process.env.PROXY_ENABLED = enabled ? 'true' : 'false';
    process.env.PROXY_HOST = host || '';
    process.env.PROXY_PORT = port || '';
    process.env.PROXY_USERNAME = username || '';
    process.env.PROXY_PASSWORD = password || '';
    
    // Update .env file for persistence
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (error) {
      // .env doesn't exist, create new content
      envContent = '';
    }
    
    // Update or add proxy settings
    const updateEnvVar = (content: string, key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };
    
    envContent = updateEnvVar(envContent, 'PROXY_ENABLED', enabled ? 'true' : 'false');
    envContent = updateEnvVar(envContent, 'PROXY_HOST', host || '');
    envContent = updateEnvVar(envContent, 'PROXY_PORT', port || '');
    envContent = updateEnvVar(envContent, 'PROXY_USERNAME', username || '');
    envContent = updateEnvVar(envContent, 'PROXY_PASSWORD', password || '');
    
    await fs.writeFile(envPath, envContent.trim() + '\n');
    
    logger.info(`Proxy settings updated: ${enabled ? 'enabled' : 'disabled'} ${host}:${port}`);
    
    return res.json({ 
      message: 'Proxy settings saved. Please restart the bot for changes to take effect.',
      requiresRestart: true
    });
  } catch (error) {
    logger.error('Error updating proxy settings:', error);
    return res.status(500).json({ error: 'Failed to update proxy settings' });
  }
});

// Test proxy connection
router.post('/proxy/test', async (req: Request, res: Response) => {
  try {
    const { host, port, username, password } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'Host and port are required' });
    }
    
    // Build proxy URL
    let proxyUrl = `http://`;
    if (username && password) {
      proxyUrl += `${username}:${password}@`;
    }
    proxyUrl += `${host}:${port}`;
    
    // Test proxy by making a simple request through it
    const https = require('https');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    const agent = new HttpsProxyAgent(proxyUrl);
    
    return new Promise<void>((resolve) => {
      const proxyReq = https.get('https://api.ipify.org?format=json', { agent, timeout: 10000 }, (response: any) => {
        let data = '';
        response.on('data', (chunk: any) => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            res.json({ 
              success: true, 
              message: 'Proxy connection successful',
              proxyIp: json.ip
            });
            resolve();
          } catch (e) {
            res.json({ 
              success: true, 
              message: 'Proxy connection successful (IP check failed)'
            });
            resolve();
          }
        });
      });
      
      proxyReq.on('error', (error: any) => {
        res.status(500).json({ 
          success: false, 
          error: 'Proxy connection failed: ' + error.message 
        });
        resolve();
      });
      
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.status(500).json({ 
          success: false, 
          error: 'Proxy connection timeout' 
        });
        resolve();
      });
    });
  } catch (error) {
    logger.error('Error testing proxy:', error);
    return res.status(500).json({ error: 'Failed to test proxy' });
  }
});

export default router; 