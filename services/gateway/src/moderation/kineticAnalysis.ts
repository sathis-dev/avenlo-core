// ====================================
// AVENLO CORE - KINETIC ANALYSIS
// Pure helpers for the L3 Forensic Visionary (GPT-4o psychological analyst)
// ====================================
//
// This module is intentionally dependency-free (only type-only imports) so the
// prompt construction and response parsing can be unit tested without a live
// OpenAI client, Redis, or Discord connection.

import type { ThreatVector, ThreatSeverity } from '@avenlo/shared';

/** Number of messages retained in the per-user sliding window. */
export const KINETIC_WINDOW_SIZE = 7;

export type KineticAction =
  | 'observe'
  | 'warn'
  | 'mute'
  | 'kick'
  | 'ban'
  | 'quarantine';

/** A single message stored in the Redis-backed per-user sliding window. */
export interface WindowMessage {
  messageId: string;
  authorId: string;
  username: string;
  content: string;
  /** ISO timestamp */
  timestamp: string;
}

/** Structured verdict returned by the psychological analyst. */
export interface KineticAssessment {
  isThreat: boolean;
  vector: ThreatVector;
  severity: ThreatSeverity;
  /** Confidence in range [0, 1] */
  confidence: number;
  recommendedAction: KineticAction;
  signals: string[];
  rationale: string;
}

const VALID_VECTORS: readonly ThreatVector[] = [
  'spam',
  'raid',
  'toxicity',
  'phishing',
  'scam',
  'nsfw',
  'self_harm',
  'impersonation',
];

const VALID_SEVERITIES: readonly ThreatSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

const VALID_ACTIONS: readonly KineticAction[] = [
  'observe',
  'warn',
  'mute',
  'kick',
  'ban',
  'quarantine',
];

const SYSTEM_PROMPT = [
  'You are Avenlo Guardian, an elite behavioral threat analyst for a Discord community.',
  'You are NOT a profanity filter. Your job is to read a short sliding window of a',
  "single user's recent messages (in conversational context) and assess INTENT.",
  'Detect subtle manipulation, social engineering, coordinated raid-planning,',
  'passive-aggressive hostility, grooming, scam/phishing setups, and impersonation —',
  'even when no individual message contains banned words.',
  '',
  'Respond ONLY with a JSON object matching exactly this shape:',
  '{',
  '  "isThreat": boolean,',
  '  "vector": one of ["spam","raid","toxicity","phishing","scam","nsfw","self_harm","impersonation"],',
  '  "severity": one of ["low","medium","high","critical"],',
  '  "confidence": number between 0 and 1,',
  '  "recommendedAction": one of ["observe","warn","mute","kick","ban","quarantine"],',
  '  "signals": array of short strings citing the behavioral evidence,',
  '  "rationale": one concise sentence explaining the verdict',
  '}',
  'If the behavior is benign, set isThreat=false, vector="toxicity", severity="low",',
  'confidence reflecting how sure you are it is benign, and recommendedAction="observe".',
].join('\n');

/**
 * Build the chat messages sent to GPT-4o. Pure: no side effects.
 */
export function buildAnalystMessages(
  window: WindowMessage[],
  subjectUserId: string
): Array<{ role: 'system' | 'user'; content: string }> {
  const transcript = window
    .map((m) => {
      const who = m.authorId === subjectUserId ? `SUBJECT(${m.username})` : m.username;
      return `[${m.timestamp}] ${who}: ${m.content}`;
    })
    .join('\n');

  const userPrompt = [
    `Analyze the SUBJECT user (id: ${subjectUserId}).`,
    `Here are the last ${window.length} message(s) in chronological order:`,
    '---',
    transcript,
    '---',
    'Assess the SUBJECT\'s intent and return the JSON verdict.',
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function coerceVector(value: unknown): ThreatVector {
  return VALID_VECTORS.includes(value as ThreatVector)
    ? (value as ThreatVector)
    : 'toxicity';
}

function coerceSeverity(value: unknown): ThreatSeverity {
  return VALID_SEVERITIES.includes(value as ThreatSeverity)
    ? (value as ThreatSeverity)
    : 'low';
}

function coerceAction(value: unknown): KineticAction {
  return VALID_ACTIONS.includes(value as KineticAction)
    ? (value as KineticAction)
    : 'observe';
}

function coerceSignals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 12);
}

/**
 * Parse and normalize the model's JSON response into a safe assessment.
 * Throws if the input is not valid JSON; all field-level issues are coerced
 * to safe defaults so a malformed-but-parseable response never crashes the bot.
 */
export function parseAnalystResponse(raw: string): KineticAssessment {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    isThreat: parsed.isThreat === true,
    vector: coerceVector(parsed.vector),
    severity: coerceSeverity(parsed.severity),
    confidence: clampConfidence(parsed.confidence),
    recommendedAction: coerceAction(parsed.recommendedAction),
    signals: coerceSignals(parsed.signals),
    rationale:
      typeof parsed.rationale === 'string' ? parsed.rationale : 'No rationale provided.',
  };
}
