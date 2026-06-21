// ====================================
// AVENLO CORE - RING 2: AI JUDGMENT
// GPT-4o Classification, Temporal Drift, Image Scanning
// ====================================

import OpenAI from 'openai';
import { Message } from 'discord.js';
import { createLogger } from '@avenlo/shared';
import { Ring1Result } from './Ring1Behavioral';

const logger = createLogger('ring2-ai');

// ====================================
// TYPES
// ====================================

export interface Ring2Result {
  isViolation: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  confidence: number;
  reasoning: string;
  temporalDrift: number;
  shouldEscalateDefcon: boolean;
}

export interface TemporalVector {
  timestamp: number;
  toxicityScore: number;
  provocationScore: number;
}

// ====================================
// RING 2 IMPLEMENTATION
// ====================================

export class Ring2AI {
  private static instance: Ring2AI;
  private openai: OpenAI;
  private userVectors: Map<string, TemporalVector[]> = new Map();

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public static getInstance(): Ring2AI {
    if (!Ring2AI.instance) {
      Ring2AI.instance = new Ring2AI();
    }
    return Ring2AI.instance;
  }

  /**
   * Process a message through the AI Ring.
   */
  async processMessage(message: Message, ring1Context: Ring1Result): Promise<Ring2Result> {
    const userId = message.author.id;
    const content = message.content.trim();

    // Fast-path: If it's a completely empty message (only attachments handled separately), skip AI
    if (!content) {
      return {
        isViolation: false,
        severity: 'none',
        confidence: 100,
        reasoning: 'Empty message',
        temporalDrift: 0,
        shouldEscalateDefcon: false
      };
    }

    try {
      // Structure the prompt with context from Ring 1
      const systemPrompt = `You are the Avenlo Core Security Kernel AI.
Analyze the user's message for violations of Discord TOS or server rules.

CONTEXT:
- User Threat Score: ${ring1Context.compositeThreatScore}/100 (0=safe, 100=danger)
- Channel Heat: ${ring1Context.channelHeat}/100
- Cross-channel spill active: ${ring1Context.isCrossChannelSpill}
- Recent channel context:
${ring1Context.contextBuffer.map((m, i) => `[${i}] ${m}`).join('\n')}

OUTPUT JSON FORMAT:
{
  "isViolation": boolean,
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "category": "toxicity" | "spam" | "nsfw" | "phishing" | "raid" | "safe",
  "confidence": number (0-100),
  "reasoning": "brief explanation",
  "toxicityScore": number (0.0-1.0),
  "provocationScore": number (0.0-1.0),
  "shouldEscalateDefcon": boolean (true if this looks like part of a coordinated attack)
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 150,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Calculate temporal drift (from PrecognitiveEngine)
      const currentVector: TemporalVector = {
        timestamp: Date.now(),
        toxicityScore: result.toxicityScore || 0,
        provocationScore: result.provocationScore || 0
      };

      const temporalDrift = this.calculateDrift(userId, currentVector);

      return {
        isViolation: result.isViolation || false,
        severity: result.severity || 'none',
        category: result.category,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || 'No reasoning provided',
        temporalDrift,
        shouldEscalateDefcon: result.shouldEscalateDefcon || false
      };

    } catch (err) {
      logger.error('OpenAI API error in Ring 2:', err);
      // Fail open (allow) if AI is down
      return {
        isViolation: false,
        severity: 'none',
        confidence: 0,
        reasoning: 'AI Error',
        temporalDrift: 0,
        shouldEscalateDefcon: false
      };
    }
  }

  // ====================================
  // INTERNAL CHECKS
  // ====================================

  private calculateDrift(userId: string, currentVector: TemporalVector): number {
    let history = this.userVectors.get(userId) || [];
    history.push(currentVector);
    
    // Keep last 5 messages
    if (history.length > 5) history.shift();
    this.userVectors.set(userId, history);

    if (history.length < 3) return 0; // Not enough data

    const recent = history.slice(-3);
    const v1 = recent[0].toxicityScore + recent[0].provocationScore;
    const v2 = recent[1].toxicityScore + recent[1].provocationScore;
    const v3 = recent[2].toxicityScore + recent[2].provocationScore;

    // Velocity
    const vel1 = v2 - v1;
    const vel2 = v3 - v2;

    // Acceleration (Drift)
    const drift = vel2 - vel1;
    return drift;
  }
}
