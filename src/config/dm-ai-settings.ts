import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

export type DmReplyTone = 'friendly' | 'professional' | 'consultative' | 'playful' | 'hype';
export type DmCtaStyle = 'soft' | 'direct' | 'question' | 'none';
export type EmojiLevel = 'none' | 'low' | 'medium';

export interface DmAiSettings {
  enabled: boolean;
  brandName: string;
  about: string; // What the account is about
  offer: string; // What you sell / how you help
  tone: DmReplyTone;
  ctaStyle: DmCtaStyle;
  emojiLevel: EmojiLevel;
  maxSentences: number; // 1-4
  maxChars: number; // 80-600
  signature: string; // optional short sign-off
  avoidTopics: string[]; // do-not-say topics
}

const DEFAULTS: DmAiSettings = {
  enabled: true,
  brandName: 'Riona',
  about: 'We help businesses with marketing and growth.',
  offer: 'We offer marketing services and automation to generate leads.',
  tone: 'friendly',
  ctaStyle: 'question',
  emojiLevel: 'low',
  maxSentences: 2,
  maxChars: 260,
  signature: '',
  avoidTopics: ['prices', 'sensitive personal data', 'illegal activity'],
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function resolveSettingsPath() {
  // Store outside src/build, stable across deploys
  return path.join(process.cwd(), 'data', 'dm-ai-settings.json');
}

export async function loadDmAiSettings(): Promise<DmAiSettings> {
  const filePath = resolveSettingsPath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    const merged: DmAiSettings = {
      ...DEFAULTS,
      ...(parsed || {}),
    };
    merged.maxSentences = clamp(Number(merged.maxSentences || DEFAULTS.maxSentences), 1, 4);
    merged.maxChars = clamp(Number(merged.maxChars || DEFAULTS.maxChars), 80, 600);
    merged.avoidTopics = Array.isArray(merged.avoidTopics)
      ? merged.avoidTopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 50)
      : DEFAULTS.avoidTopics;
    merged.brandName = String(merged.brandName || DEFAULTS.brandName).slice(0, 60);
    merged.about = String(merged.about || DEFAULTS.about).slice(0, 2000);
    merged.offer = String(merged.offer || DEFAULTS.offer).slice(0, 2000);
    merged.signature = String(merged.signature || '').slice(0, 120);
    return merged;
  } catch (e: any) {
    // If file missing or invalid, fall back to defaults.
    return { ...DEFAULTS };
  }
}

export async function saveDmAiSettings(next: Partial<DmAiSettings>): Promise<DmAiSettings> {
  const filePath = resolveSettingsPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const current = await loadDmAiSettings();
  const merged: DmAiSettings = {
    ...current,
    ...next,
  } as any;

  // Normalize
  merged.enabled = !!merged.enabled;
  merged.brandName = String(merged.brandName || DEFAULTS.brandName).slice(0, 60);
  merged.about = String(merged.about || DEFAULTS.about).slice(0, 2000);
  merged.offer = String(merged.offer || DEFAULTS.offer).slice(0, 2000);
  merged.signature = String(merged.signature || '').slice(0, 120);
  merged.maxSentences = clamp(Number(merged.maxSentences || DEFAULTS.maxSentences), 1, 4);
  merged.maxChars = clamp(Number(merged.maxChars || DEFAULTS.maxChars), 80, 600);
  merged.avoidTopics = Array.isArray(merged.avoidTopics)
    ? merged.avoidTopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 50)
    : DEFAULTS.avoidTopics;

  // Validate enums lightly
  const tone = String((merged as any).tone);
  if (!['friendly', 'professional', 'consultative', 'playful', 'hype'].includes(tone)) {
    merged.tone = DEFAULTS.tone;
  }
  const cta = String((merged as any).ctaStyle);
  if (!['soft', 'direct', 'question', 'none'].includes(cta)) {
    merged.ctaStyle = DEFAULTS.ctaStyle;
  }
  const emoji = String((merged as any).emojiLevel);
  if (!['none', 'low', 'medium'].includes(emoji)) {
    merged.emojiLevel = DEFAULTS.emojiLevel;
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to save DM AI settings', err as any);
    throw err;
  }
  return merged;
}


