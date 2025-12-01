import express, { Request, Response } from 'express';
import { getIgClient, closeIgClient, scrapeFollowersHandler } from '../client/Instagram';
import logger from '../config/logger';
import mongoose from 'mongoose';
import { signToken, verifyToken, getTokenFromRequest } from '../secret';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { runAgent } from '../Agent';
import { getAutomationCommandSchema } from '../Agent/schema';
import { Instagram_cookiesExist } from '../utils';
import type { InteractionOptions, StoryOptions } from '../client/IG-bot/types';

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

type AiChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

type AiCommandPlan = {
  action: 'campaign' | 'interact' | 'stories' | 'status' | 'logs' | 'help';
  mode?: string | null;
  hashtag?: string | null;
  locationPath?: string | null;
  targetUsername?: string | null;
  maxPosts?: number | null;
  sendDMs?: boolean | null;
  inspectProfiles?: boolean | null;
  maxOutboundDMs?: number | null;
  requiredBioKeywords?: string[] | null;
  englishOnly?: boolean | null;
  imagesOnly?: boolean | null;
  storyCount?: number | null;
  storyTarget?: string | null;
  aiReplies?: boolean | null;
  tone?: 'friendly' | 'consultative' | 'hype' | null;
  summary: string;
  confidence: number;
  notes?: string | null;
};

const SUPPORTED_AI_ACTIONS = new Set(['campaign', 'interact', 'stories', 'status', 'logs', 'help']);

const buildAiCommandPrompt = (message: string, history: AiChatTurn[] = []) => {
  const trimmedHistory = history
    .filter((turn) => typeof turn?.content === 'string' && turn.content.trim().length)
    .slice(-6);

  const historyBlock = trimmedHistory
    .map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.content.trim()}`)
    .join('\n');

  return `
You are Riona's automation planner. Interpret natural language commands and map them to the automation capabilities.
Supported actions:
- campaign/interact: run post engagement or DM campaigns. Use fields mode, hashtag, locationPath, targetUsername, maxPosts, sendDMs, inspectProfiles, maxOutboundDMs, requiredBioKeywords, englishOnly, imagesOnly.
- stories: watch stories. Use fields storyCount, storyTarget, aiReplies, tone.
- status: provide a status summary only (no automation run).
- logs: provide the latest bot logs (no automation run).
- help: when the request is outside scope or unclear.

Always respond with the JSON that matches the provided schema. Confidence must be between 0 and 1.

Conversation so far:
${historyBlock || 'None.'}

User command:
${message}`.trim();
};

const sanitizeAiCommandPlan = (raw: any): AiCommandPlan | null => {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.action !== 'string' || !SUPPORTED_AI_ACTIONS.has(raw.action)) return null;
  if (typeof raw.summary !== 'string' || !raw.summary.trim().length) return null;
  const confidence =
    typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.5;

  return {
    action: raw.action,
    mode: raw.mode ?? null,
    hashtag: raw.hashtag ?? null,
    locationPath: raw.locationPath ?? null,
    targetUsername: raw.targetUsername ?? null,
    maxPosts: raw.maxPosts ?? null,
    sendDMs: raw.sendDMs ?? null,
    inspectProfiles: raw.inspectProfiles ?? null,
    maxOutboundDMs: raw.maxOutboundDMs ?? null,
    requiredBioKeywords: raw.requiredBioKeywords ?? null,
    englishOnly: raw.englishOnly ?? null,
    imagesOnly: raw.imagesOnly ?? null,
    storyCount: raw.storyCount ?? null,
    storyTarget: raw.storyTarget ?? null,
    aiReplies: raw.aiReplies ?? null,
    tone: raw.tone ?? null,
    summary: raw.summary.trim(),
    confidence,
    notes: raw.notes ?? null,
  };
};

const normalizeHashtag = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return undefined;
  const cleaned = value.replace(/#/g, '').trim();
  return cleaned.length ? cleaned : undefined;
};

const coerceBoolean = (value: boolean | null | undefined) =>
  typeof value === 'boolean' ? value : undefined;

const coerceNumber = (value: number | null | undefined) =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

const fetchRecentLogs = async (limit = 40): Promise<string[]> => {
  const now = new Date();
  const dateSlug = now.toISOString().split('T')[0];
  const logPath = path.join(logsDirectory, `${dateSlug}-combined.log`);

  if (!(await fileExists(logPath))) {
    return ['No log entries recorded for today yet.'];
  }

  const raw = await fs.readFile(logPath, 'utf-8');
  const cleaned = raw.trim().split(/\r?\n/).filter(Boolean);
  return cleaned.slice(-limit);
};

const helpSummary = [
  'Try commands like:',
  '• "Run the Miami location campaign with 5 DMs"',
  '• "Inspect 3 posts from #goodfoods and skip comments"',
  '• "Watch 8 stories for @username with AI replies"',
  '• "Show me today\'s logs" or "What is the bot status?"',
].join('\n');

const buildInteractionOptionsFromPlan = (plan: AiCommandPlan): InteractionOptions => {
  const options: InteractionOptions = {};
  if (plan.mode && typeof plan.mode === 'string') {
    options.mode = plan.mode as InteractionOptions['mode'];
  }
  const hashtag = normalizeHashtag(plan.hashtag);
  if (hashtag) {
    options.hashtags = [hashtag];
  }
  if (plan.locationPath) {
    options.locationPath = plan.locationPath;
  }
  if (plan.targetUsername && plan.mode === 'competitor_followers') {
    options.competitorUsername = plan.targetUsername;
  }
  if (coerceBoolean(plan.inspectProfiles) !== undefined) {
    options.inspectProfile = plan.inspectProfiles ?? undefined;
  }
  if (coerceBoolean(plan.sendDMs) !== undefined) {
    options.sendDMs = plan.sendDMs ?? undefined;
  }
  if (coerceNumber(plan.maxOutboundDMs) !== undefined) {
    options.maxOutboundDMs = plan.maxOutboundDMs ?? undefined;
  }
  if (Array.isArray(plan.requiredBioKeywords) && plan.requiredBioKeywords.length) {
    options.requiredBioKeywords = plan.requiredBioKeywords.filter(
      (keyword) => typeof keyword === 'string' && keyword.trim().length
    );
  }
  if (coerceBoolean(plan.englishOnly) !== undefined) {
    options.englishOnly = plan.englishOnly ?? undefined;
  }
  if (coerceBoolean(plan.imagesOnly) !== undefined) {
    options.imagesOnly = plan.imagesOnly ?? undefined;
  }
  return options;
};

const buildStoryOptionsFromPlan = (plan: AiCommandPlan): StoryOptions => {
  const options: StoryOptions = {};
  if (coerceNumber(plan.storyCount) !== undefined) {
    options.storyCount = plan.storyCount ?? undefined;
  }
  if (plan.storyTarget) {
    options.targetUsername = plan.storyTarget;
  }
  if (plan.aiReplies) {
    options.aiReply = {
      enabled: true,
      tone: plan.tone ?? undefined,
    };
  }
  return options;
};

const executeAiCommandPlan = async (
  plan: AiCommandPlan,
  username: string
): Promise<{ success: boolean; message: string; details?: any }> => {
  switch (plan.action) {
    case 'campaign':
    case 'interact': {
      const igClient = await getIgClient(username);
      const options = buildInteractionOptionsFromPlan(plan);
      const maxPosts = coerceNumber(plan.maxPosts) ?? 5;
      const targetForMode = plan.mode === 'user' ? plan.targetUsername ?? undefined : undefined;
      await igClient.interactWithPosts(targetForMode, maxPosts, options);
      return {
        success: true,
        message: `Campaign executed (${options.mode || 'feed'}) for ${maxPosts} posts.`,
        details: { options },
      };
    }
    case 'stories': {
      const igClient = await getIgClient(username);
      const options = buildStoryOptionsFromPlan(plan);
      options.storyCount = options.storyCount ?? 5;
      await igClient.watchStories(options);
      return {
        success: true,
        message: `Watching ${options.storyCount} stories${options.targetUsername ? ` for ${options.targetUsername}` : ''
          }.`,
        details: { options },
      };
    }
    case 'status': {
      const dbConnected = mongoose.connection.readyState === 1;
      const cookiesReady = await Instagram_cookiesExist();
      const proxyEnabled = process.env.PROXY_ENABLED === 'true';
      return {
        success: true,
        message: dbConnected ? 'Bot is online.' : 'Database offline, bot still running in memory mode.',
        details: {
          dbConnected,
          cookiesReady,
          proxyEnabled,
        },
      };
    }
    case 'logs': {
      const lines = await fetchRecentLogs(20);
      return {
        success: true,
        message: 'Latest activity logs attached.',
        details: { logs: lines },
      };
    }
    case 'help':
    default:
      return {
        success: true,
        message: 'Here is what I can help with:',
        details: { help: helpSummary },
      };
  }
};
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
router.get('/status', async (req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const token = getTokenFromRequest(req);
  let authenticated = false;
  let username: string | null = null;
  let sessionStatus = null;

  if (token) {
    const payload = verifyToken(token);
    if (payload && typeof payload === 'object' && 'username' in payload) {
      authenticated = true;
      username = (payload as { username: string }).username;
      
      // Get session status if authenticated
      try {
        const igClient = await getIgClient();
        sessionStatus = igClient.getSessionStatus();
      } catch (error) {
        logger.debug('Could not get session status:', error);
      }
    }
  }

  return res.json({
    status: dbConnected ? 'Online' : 'Offline',
    dbConnected,
    authenticated,
    username,
    session: sessionStatus,
  });
});

// Session refresh endpoint
router.post('/session/refresh', requireAuth, async (req: Request, res: Response) => {
  try {
    const igClient = await getIgClient((req as any).user.username);
    const success = await igClient.refreshSession();
    
    if (success) {
      const sessionStatus = igClient.getSessionStatus();
      return res.json({ 
        success: true, 
        message: 'Session refreshed successfully',
        session: sessionStatus
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to refresh session. You may need to log in again.' 
      });
    }
  } catch (error) {
    logger.error('Session refresh error:', error);
    return res.status(500).json({ error: 'Failed to refresh session' });
  }
});

// Get session status
router.get('/session/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const igClient = await getIgClient((req as any).user.username);
    const sessionStatus = igClient.getSessionStatus();
    
    return res.json({ 
      success: true,
      session: sessionStatus
    });
  } catch (error) {
    logger.error('Get session status error:', error);
    return res.status(500).json({ error: 'Failed to get session status' });
  }
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
    // Use 30 days if rememberMe is true, otherwise 24 hours
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: cookieSameSite,
      maxAge,
      secure: cookieSecure,
      path: '/', // Ensure cookie is available for all paths
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

// Proxy configuration endpoints
router.post('/proxy/configure', requireAuth, async (req: Request, res: Response) => {
  try {
    const { enabled, host, port, username, password } = req.body;

    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      envContent = '';
    }

    const envVars = new Map<string, string>();
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars.set(match[1].trim(), match[2].trim());
      }
    });

    envVars.set('PROXY_ENABLED', enabled ? 'true' : 'false');
    envVars.set('PROXY_HOST', host || '');
    envVars.set('PROXY_PORT', port || '');
    envVars.set('PROXY_USERNAME', username || '');
    envVars.set('PROXY_PASSWORD', password || '');

    const newEnvContent = Array.from(envVars.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(envPath, newEnvContent, 'utf-8');

    dotenv.config({ override: true });

    logger.info(`Proxy settings updated: ${enabled ? 'enabled' : 'disabled'}`);

    res.json({
      success: true,
      message: enabled
        ? `Proxy configured: ${host}:${port}. Restart bot to apply changes.`
        : 'Proxy disabled. Restart bot to apply changes.',
    });
  } catch (error) {
    logger.error('Error saving proxy settings:', error);
    res.status(500).json({ error: 'Failed to save proxy settings' });
  }
});

router.get('/proxy/status', async (req: Request, res: Response) => {
  try {
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      return res.json({
        enabled: false,
        host: '',
        port: '',
        username: '',
      });
    }

    const envVars = new Map<string, string>();
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars.set(match[1].trim(), match[2].trim());
      }
    });

    res.json({
      enabled: envVars.get('PROXY_ENABLED') === 'true',
      host: envVars.get('PROXY_HOST') || '',
      port: envVars.get('PROXY_PORT') || '',
      username: envVars.get('PROXY_USERNAME') || '',
    });
  } catch (error) {
    logger.error('Error reading proxy settings:', error);
    res.status(500).json({ error: 'Failed to read proxy settings' });
  }
});

// All routes below require authentication
router.use(requireAuth);

router.post('/ai/command', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (typeof message !== 'string' || !message.trim().length) {
      return res.status(400).json({ error: 'Command message is required.' });
    }

    const historyTurns: AiChatTurn[] = Array.isArray(history)
      ? history
          .map((turn: any) => {
            const normalizedRole: AiChatTurn['role'] = turn?.role === 'assistant' ? 'assistant' : 'user';
            return {
              role: normalizedRole,
              content: typeof turn?.content === 'string' ? turn.content : '',
            };
          })
          .filter((turn) => turn.content.trim().length)
      : [];

    const prompt = buildAiCommandPrompt(message.trim(), historyTurns);
    const schema = getAutomationCommandSchema();
    const rawPlan = await runAgent(schema as any, prompt);
    const plan = sanitizeAiCommandPlan(rawPlan);

    if (!plan) {
      return res.status(422).json({
        error: 'I could not understand that request. Try being a bit more specific.',
      });
    }

    const execution = await executeAiCommandPlan(plan, (req as any).user.username);

    return res.json({
      success: execution.success,
      plan,
      execution,
    });
  } catch (error) {
    logger.error('AI command error:', error);
    return res.status(500).json({ error: 'Failed to process AI command' });
  }
});

router.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const limit =
      typeof req.query.lines === 'string' && !Number.isNaN(parseInt(req.query.lines, 10))
        ? Math.min(500, Math.max(10, parseInt(req.query.lines, 10)))
        : 100;
    
    const levelFilter = typeof req.query.level === 'string' ? req.query.level.toLowerCase() : null;
    const categoryFilter = typeof req.query.category === 'string' ? req.query.category.toLowerCase() : null;

    const now = new Date();
    const dateSlug = now.toISOString().split('T')[0];
    const logPath = path.join(logsDirectory, `${dateSlug}-combined.log`);

    if (!(await fileExists(logPath))) {
      return res.json({ logs: [], stats: { total: 0, info: 0, warn: 0, error: 0, debug: 0 } });
    }

    const raw = await fs.readFile(logPath, 'utf-8');
    const rawLines = raw.trim().split(/\r?\n/).filter(Boolean);
    
    // Helper to strip ANSI color codes from strings
    const stripAnsi = (str: string): string => {
      return str.replace(/\x1b\[[0-9;]*m/g, '');
    };
    
    // Parse JSON log entries and add categories
    const parsedLogs = rawLines.map((line, index) => {
      try {
        const parsed = JSON.parse(line);
        const message = parsed.message || '';
        
        // Clean level (strip ANSI codes and normalize)
        let level = stripAnsi(String(parsed.level || 'info')).toLowerCase();
        if (!['info', 'warn', 'error', 'debug'].includes(level)) {
          level = 'info';
        }
        
        // Detect category based on message content
        let category = 'system';
        const msgLower = message.toLowerCase();
        if (msgLower.includes('login') || msgLower.includes('cookie') || msgLower.includes('logged') || msgLower.includes('session')) {
          category = 'login';
        } else if (msgLower.includes('campaign') || msgLower.includes('comment') || msgLower.includes('interact') || msgLower.includes('liking') || msgLower.includes('liked')) {
          category = 'campaign';
        } else if (msgLower.includes('story') || msgLower.includes('stories')) {
          category = 'story';
        } else if (msgLower.includes('dm') || msgLower.includes('direct message')) {
          category = 'dm';
        } else if (msgLower.includes('proxy')) {
          category = 'proxy';
        } else if (msgLower.includes('scheduler') || msgLower.includes('cron') || msgLower.includes('schedule')) {
          category = 'scheduler';
        } else if (msgLower.includes('screenshot') || msgLower.includes('📸')) {
          category = 'screenshot';
        } else if (msgLower.includes('browser') || msgLower.includes('puppeteer') || msgLower.includes('chromium')) {
          category = 'browser';
        } else if (msgLower.includes('warning') || msgLower.includes('duplicate')) {
          category = 'system';
        }
        
        return {
          id: index,
          level: level,
          message: message,
          timestamp: parsed.timestamp || new Date().toISOString(),
          category: category
        };
      } catch {
        // If not valid JSON, return as plain text
        return {
          id: index,
          level: 'info',
          message: line,
          timestamp: new Date().toISOString(),
          category: 'system'
        };
      }
    });
    
    // Calculate stats before filtering
    const stats = {
      total: parsedLogs.length,
      info: parsedLogs.filter(l => l.level === 'info').length,
      warn: parsedLogs.filter(l => l.level === 'warn').length,
      error: parsedLogs.filter(l => l.level === 'error').length,
      debug: parsedLogs.filter(l => l.level === 'debug').length
    };
    
    // Apply filters
    let filteredLogs = parsedLogs;
    if (levelFilter && levelFilter !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.level === levelFilter);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.category === categoryFilter);
    }
    
    // Get the most recent entries
    const logs = filteredLogs.slice(-limit).reverse();
    
    return res.json({ logs, stats });
  } catch (error) {
    logger.error('Recent logs fetch error:', error);
    return res.status(500).json({ error: 'Failed to load recent logs' });
  }
});

// Screenshots endpoint - also accessible without auth for debugging
router.get('/screenshots/list', async (req: Request, res: Response) => {
  try {
    const screenshotDirs = [
      path.join(__dirname, '../../logs/post-screens'),
      path.join(__dirname, '../../logs/profile-screens'),
      path.join(__dirname, '../../logs/dm-outreach'),
      path.join(__dirname, '../../logs/feed-screens'),
      path.join(__dirname, '../../logs/debug'),
    ];

    const screenshots: Array<{ path: string; name: string; timestamp: number; type: string }> = [];

    for (const dir of screenshotDirs) {
      if (await fileExists(dir)) {
        const files = await fs.readdir(dir);
        const type = dir.includes('post-screens') ? 'post' : 
                     dir.includes('profile-screens') ? 'profile' :
                     dir.includes('dm-outreach') ? 'dm' : 
                     dir.includes('debug') ? 'debug' : 'feed';
        
        for (const file of files) {
          if (file.endsWith('.png') || file.endsWith('.jpg')) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            screenshots.push({
              path: file,
              name: file,
              timestamp: stats.mtimeMs,
              type,
            });
          }
        }
      }
    }

    // Sort by timestamp, newest first
    screenshots.sort((a, b) => b.timestamp - a.timestamp);

    // Return only the 20 most recent
    return res.json({ screenshots: screenshots.slice(0, 20) });
  } catch (error) {
    logger.error('Screenshot list error:', error);
    return res.status(500).json({ error: 'Failed to list screenshots' });
  }
});

// Serve a specific screenshot (also public)
router.get('/screenshots/view/:type/:filename', async (req: Request, res: Response) => {
  try {
    const { type, filename } = req.params;
    
    // Validate type
    const validTypes = ['post', 'profile', 'dm', 'feed', 'debug'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid screenshot type' });
    }

    // Map type to directory
    const dirMap: Record<string, string> = {
      post: 'post-screens',
      profile: 'profile-screens',
      dm: 'dm-outreach',
      feed: 'feed-screens',
      debug: 'debug',
    };

    const screenshotPath = path.join(__dirname, '../../logs', dirMap[type], filename);

    // Security: Prevent path traversal
    const normalizedPath = path.normalize(screenshotPath);
    const baseDir = path.join(__dirname, '../../logs');
    if (!normalizedPath.startsWith(baseDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!(await fileExists(screenshotPath))) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }

    // Send the image file with caching headers
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(screenshotPath);
  } catch (error) {
    logger.error('Screenshot view error:', error);
    return res.status(500).json({ error: 'Failed to load screenshot', details: String(error) });
  }
});

// All routes below require authentication
router.use(requireAuth);

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

  const sanitizeTone = (value: any): 'friendly' | 'consultative' | 'hype' | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['friendly', 'consultative', 'hype'].includes(normalized)) {
      return normalized as 'friendly' | 'consultative' | 'hype';
    }
    return undefined;
  };

  const clamp01 = (value: number | undefined): number | undefined => {
    if (value === undefined || Number.isNaN(value)) return undefined;
    return Math.min(1, Math.max(0, value));
  };

  const options: StoryOptions = {
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
    aiReply:
      req.body.aiReply && req.body.aiReply.enabled
        ? {
            enabled: true,
            maxReplies: sanitizeNumber(req.body.aiReply.maxReplies),
            minConfidence: clamp01(sanitizeFloat(req.body.aiReply.minConfidence)),
            tone: sanitizeTone(req.body.aiReply.tone),
          }
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

// Clear replied conversations cache
router.post('/dms/clear-cache', async (req: Request, res: Response) => {
  try {
    const igClient = await getIgClient((req as any).user.username);
    await igClient.clearRepliedConversationsCache();
    return res.json({ message: 'Replied conversations cache cleared successfully' });
  } catch (error) {
    logger.error('Clear cache error:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
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

// Proxy configuration endpoints
export default router; 