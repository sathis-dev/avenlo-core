// ====================================
// AVENLO CORE - KINETIC ANALYST
// L3 Forensic Visionary: GPT-4o psychological intent analysis
// ====================================
//
// Consumes a user's 7-message sliding window, asks GPT-4o to act as a
// behavioral threat analyst (manipulation / raid-planning / passive-aggressive
// hostility), and fires KINETIC_THREAT_DETECTED on the Redis event bus when a
// threat is found.

import OpenAI from 'openai';
import {
  createLogger,
  getEventBus,
  EventTypes,
  KineticThreatDetectedPayload,
} from '@avenlo/shared';
import {
  KineticAssessment,
  WindowMessage,
  buildAnalystMessages,
  parseAnalystResponse,
} from './kineticAnalysis';

const logger = createLogger('guardian-kinetic-analyst');

/** Minimum confidence before a flagged threat is escalated to an event. */
const THREAT_CONFIDENCE_FLOOR = 0.6;

export interface KineticSubject {
  userId: string;
  username: string;
  channelId: string;
  messageId?: string;
}

/** Maps a severity to the reputation penalty applied to the offender. */
function reputationDeltaFor(assessment: KineticAssessment): number {
  const base: Record<KineticAssessment['severity'], number> = {
    low: -5,
    medium: -15,
    high: -30,
    critical: -50,
  };
  return Math.round(base[assessment.severity] * assessment.confidence);
}

export class KineticAnalyst {
  private openai: OpenAI;
  private guildId: string;
  private enabled: boolean;

  constructor(guildId: string) {
    this.guildId = guildId;
    this.enabled = Boolean(process.env.OPENAI_API_KEY);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Analyze a user's sliding window. Returns the assessment (or null when the
   * analyst is disabled / the window is empty / the call fails). Fires a
   * KINETIC_THREAT_DETECTED event as a side effect when a credible threat is
   * detected.
   */
  async analyze(
    window: WindowMessage[],
    subject: KineticSubject
  ): Promise<KineticAssessment | null> {
    if (!this.enabled || window.length === 0) {
      return null;
    }

    let assessment: KineticAssessment;
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: buildAnalystMessages(window, subject.userId),
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('Kinetic analyst returned empty content');
        return null;
      }

      assessment = parseAnalystResponse(content);
    } catch (error) {
      logger.error('Kinetic analyst inference failed:', error);
      return null;
    }

    if (assessment.isThreat && assessment.confidence >= THREAT_CONFIDENCE_FLOOR) {
      await this.emitThreat(assessment, subject);
    }

    return assessment;
  }

  private async emitThreat(
    assessment: KineticAssessment,
    subject: KineticSubject
  ): Promise<void> {
    const payload: KineticThreatDetectedPayload = {
      guildId: this.guildId,
      channelId: subject.channelId,
      userId: subject.userId,
      username: subject.username,
      messageId: subject.messageId,
      vector: assessment.vector,
      severity: assessment.severity,
      confidence: assessment.confidence,
      reputationDelta: reputationDeltaFor(assessment),
      recommendedAction: assessment.recommendedAction,
      signals: assessment.signals,
      detectedAt: new Date().toISOString(),
    };

    try {
      await getEventBus().publish(EventTypes.KINETIC_THREAT_DETECTED, payload);
      logger.warn(
        `KINETIC_THREAT_DETECTED: ${subject.username} | ${assessment.vector}/${assessment.severity} ` +
          `(${(assessment.confidence * 100).toFixed(0)}%) -> ${assessment.recommendedAction}`
      );
    } catch (error) {
      logger.error('Failed to publish KINETIC_THREAT_DETECTED:', error);
    }
  }
}

// Per-guild analyst cache.
const analystCache = new Map<string, KineticAnalyst>();

export function getKineticAnalyst(guildId: string): KineticAnalyst {
  let analyst = analystCache.get(guildId);
  if (!analyst) {
    analyst = new KineticAnalyst(guildId);
    analystCache.set(guildId, analyst);
  }
  return analyst;
}
