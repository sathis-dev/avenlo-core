// ====================================
// AVENLO CORE - GUARDIAN PIPELINE
// Multi-Layer Behavioral Moderation
// ====================================

import { Message, TextChannel, GuildMember, Attachment } from 'discord.js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  createLogger,
  getRedisClient,
  getEventBus,
  EventTypes,
  Infraction,
  IInfraction,
  InfractionSeverity,
  InfractionType,
  ModActionTaken,
  DetectionLayer,
  IntentClassification,
  IAIReasoning,
  ISocialContext,
  IMessageContext,
  IUserHistorySnapshot,
  IImageAnalysis,
} from '@avenlo/shared';

import {
  MessageContextBuffer,
  ContextBufferResult,
  analyzeSentiment,
  detectTechnicalContext,
} from './MessageContextBuffer';

import {
  SentimentEngine,
  getSentimentEngine,
  ChannelHeatStatus,
} from './SentimentEngine';

import {
  UserReputationManager,
  getUserReputationManager,
  UserReputationState,
} from './UserReputation';

const logger = createLogger('guardian-pipeline');

// ====================================
// CONSTANTS
// ====================================

// Layer 1: The Sieve - High-speed regex filter
const CRITICAL_PATTERNS = {
  // Scam links
  scamLinks: [
    /discord\.gift/i,
    /discordnitro\.gift/i,
    /steamcommunity\.com\.(?!$)/i,
    /free-?nitro/i,
    /nitro-?gift/i,
    /@everyone.*http/i,
    /airdrop.*connect.*wallet/i,
    /claim.*free.*nft/i,
    /mint.*free.*token/i,
  ],
  // Extreme slurs (masked for code review)
  extremeSlurs: [
    // These would be actual slur patterns - keeping redacted
    /\bn[i1]gg[e3]r/i,
    /\bk[i1]k[e3]/i,
    /\bf[a@]gg[o0]t/i,
  ],
  // Phishing patterns
  phishing: [
    /verify.*account.*suspend/i,
    /your.*account.*locked/i,
    /click.*here.*verify/i,
    /limited.*time.*offer/i,
    /urgent.*action.*required/i,
  ],
  // Crypto drainer patterns
  cryptoDrainer: [
    /connect.*wallet.*claim/i,
    /airdrop.*eligib/i,
    /claim.*before.*expires/i,
    /free.*eth.*claim/i,
    /nft.*giveaway.*connect/i,
  ],
};

// Severity thresholds
const CONFIDENCE_THRESHOLD_LOW = 50;
const CONFIDENCE_THRESHOLD_MEDIUM = 70;
const CONFIDENCE_THRESHOLD_HIGH = 85;

// ====================================
// TYPES
// ====================================

export interface PipelineResult {
  /** Should message be actioned? */
  shouldAction: boolean;
  /** Detection layer that triggered */
  detectionLayer: DetectionLayer | null;
  /** Infraction details (if any) */
  infraction?: IInfraction;
  /** Action to take */
  recommendedAction: ModActionTaken;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Confidence score */
  confidence: number;
  /** Whether to log but not action */
  silentLog: boolean;
}

export interface AnalystResult {
  isViolation: boolean;
  confidence: number;
  intentClassification: IntentClassification;
  reasoning: string;
  mitigatingFactors: string[];
  aggravatingFactors: string[];
  alternativeInterpretations: string[];
  suggestedAction: ModActionTaken;
  infractionType: InfractionType;
  severity: InfractionSeverity;
}

export interface VisionaryResult {
  isViolation: boolean;
  confidence: number;
  steganographyDetected: boolean;
  extractedText?: string;
  iconographyFlags: string[];
  nsfwProbability: number;
  scamIndicators: string[];
  reasoning: string;
}

// ====================================
// GUARDIAN PIPELINE
// ====================================

export class GuardianPipeline {
  private openai: OpenAI;
  private guildId: string;
  private sentimentEngine: SentimentEngine;
  private reputationManager: UserReputationManager;

  constructor(guildId: string) {
    this.guildId = guildId;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.sentimentEngine = getSentimentEngine(guildId);
    this.reputationManager = getUserReputationManager(guildId);
  }

  // ====================================
  // MAIN PROCESSING PIPELINE
  // ====================================

  /**
   * Process a message through the 3-layer pipeline
   */
  async processMessage(message: Message): Promise<PipelineResult> {
    const startTime = Date.now();

    // Skip bots and system messages
    if (message.author.bot || message.system) {
      return this.createNullResult(startTime);
    }

    // Get context
    const contextBuffer = new MessageContextBuffer(message.channel.id, this.guildId);
    const context = await contextBuffer.getContext(
      message.channel as TextChannel,
      message
    );

    // Get user reputation state
    const userReputation = await this.reputationManager.getReputationState(
      message.author.id
    );

    // Get sensitivity multiplier
    const channelSensitivity = await this.sentimentEngine.getSensitivityMultiplier(
      message.channel.id
    );
    const userSensitivity = userReputation.sensitivityMultiplier;
    const combinedSensitivity = Math.max(channelSensitivity, userSensitivity);

    logger.debug(
      `Processing message from ${message.author.username} | Sensitivity: ${combinedSensitivity.toFixed(2)}x`
    );

    // ====================================
    // LAYER 1: THE SIEVE
    // ====================================
    const sieveResult = await this.runSieve(message.content, combinedSensitivity);
    if (sieveResult.isViolation) {
      const infraction = await this.createInfraction(
        message,
        context,
        userReputation,
        {
          detectionLayer: 'SIEVE',
          confidence: sieveResult.confidence,
          intentClassification: 'HOSTILE',
          patternSignatures: sieveResult.matchedPatterns,
          reasoning: sieveResult.reasoning,
          mitigatingFactors: [],
          aggravatingFactors: ['Pattern matched critical filter'],
          alternativeInterpretations: [],
          modelUsed: 'regex',
          processingTimeMs: Date.now() - startTime,
          tokenCount: 0,
        },
        sieveResult.type,
        sieveResult.severity,
        sieveResult.action
      );

      return {
        shouldAction: true,
        detectionLayer: 'SIEVE',
        infraction,
        recommendedAction: sieveResult.action,
        processingTimeMs: Date.now() - startTime,
        confidence: sieveResult.confidence,
        silentLog: false,
      };
    }

    // ====================================
    // LAYER 2: THE ANALYST (GPT-4o)
    // ====================================
    const analystResult = await this.runAnalyst(
      message,
      context,
      userReputation,
      combinedSensitivity
    );

    if (analystResult.isViolation && analystResult.confidence >= CONFIDENCE_THRESHOLD_MEDIUM) {
      const infraction = await this.createInfraction(
        message,
        context,
        userReputation,
        {
          detectionLayer: 'ANALYST',
          confidence: analystResult.confidence,
          intentClassification: analystResult.intentClassification,
          patternSignatures: [],
          reasoning: analystResult.reasoning,
          mitigatingFactors: analystResult.mitigatingFactors,
          aggravatingFactors: analystResult.aggravatingFactors,
          alternativeInterpretations: analystResult.alternativeInterpretations,
          modelUsed: 'gpt-4o',
          processingTimeMs: Date.now() - startTime,
          tokenCount: 0, // Would need to track from API response
        },
        analystResult.infractionType,
        analystResult.severity,
        analystResult.suggestedAction
      );

      return {
        shouldAction: true,
        detectionLayer: 'ANALYST',
        infraction,
        recommendedAction: analystResult.suggestedAction,
        processingTimeMs: Date.now() - startTime,
        confidence: analystResult.confidence,
        silentLog: analystResult.confidence < CONFIDENCE_THRESHOLD_HIGH,
      };
    }

    // ====================================
    // LAYER 3: THE VISIONARY (GPT-4o Vision)
    // ====================================
    if (message.attachments.size > 0) {
      const imageAttachments = message.attachments.filter(a =>
        a.contentType?.startsWith('image/')
      );

      for (const [, attachment] of imageAttachments) {
        const visionResult = await this.runVisionary(
          attachment,
          context,
          userReputation
        );

        if (visionResult.isViolation && visionResult.confidence >= CONFIDENCE_THRESHOLD_MEDIUM) {
          const imageAnalysis: IImageAnalysis = {
            imageUrl: attachment.url,
            steganographyDetected: visionResult.steganographyDetected,
            extractedText: visionResult.extractedText,
            iconographyFlags: visionResult.iconographyFlags,
            nsfwProbability: visionResult.nsfwProbability,
            scamIndicators: visionResult.scamIndicators,
            confidence: visionResult.confidence,
          };

          const severity = this.determineSeverity(visionResult.confidence);
          const action = this.determineAction(severity, userReputation);

          const infraction = await this.createInfractionWithImage(
            message,
            context,
            userReputation,
            {
              detectionLayer: 'VISIONARY',
              confidence: visionResult.confidence,
              intentClassification: 'DECEPTIVE',
              patternSignatures: visionResult.scamIndicators,
              reasoning: visionResult.reasoning,
              mitigatingFactors: [],
              aggravatingFactors: visionResult.steganographyDetected
                ? ['Steganographic content detected']
                : [],
              alternativeInterpretations: [],
              modelUsed: 'gpt-4o-vision',
              processingTimeMs: Date.now() - startTime,
              tokenCount: 0,
            },
            imageAnalysis,
            visionResult.nsfwProbability > 0.8 ? 'NSFW' : 'SCAM',
            severity,
            action
          );

          return {
            shouldAction: true,
            detectionLayer: 'VISIONARY',
            infraction,
            recommendedAction: action,
            processingTimeMs: Date.now() - startTime,
            confidence: visionResult.confidence,
            silentLog: false,
          };
        }
      }
    }

    // ====================================
    // NO VIOLATION DETECTED
    // ====================================

    // Update sentiment tracking
    const sentiment = analyzeSentiment(message.content);
    await this.sentimentEngine.recordMessage(
      message.channel.id,
      message.author.id,
      sentiment,
      false
    );

    // Positive contributions boost reputation
    if (sentiment > 0.3 && detectTechnicalContext(message.content)) {
      await this.reputationManager.recordPositiveContribution(
        message.author.id,
        'HELPFUL_MESSAGE'
      );
    }

    return this.createNullResult(startTime);
  }

  // ====================================
  // LAYER 1: THE SIEVE
  // ====================================

  private async runSieve(
    content: string,
    sensitivity: number
  ): Promise<{
    isViolation: boolean;
    matchedPatterns: string[];
    type: InfractionType;
    severity: InfractionSeverity;
    action: ModActionTaken;
    confidence: number;
    reasoning: string;
  }> {
    const matchedPatterns: string[] = [];
    let type: InfractionType = 'OTHER';
    let severity: InfractionSeverity = 'LOW';
    let action: ModActionTaken = 'NONE';

    // Check scam links
    for (const pattern of CRITICAL_PATTERNS.scamLinks) {
      if (pattern.test(content)) {
        matchedPatterns.push(`scam_link:${pattern.source}`);
        type = 'SCAM';
        severity = 'CRITICAL';
        action = 'BAN';
      }
    }

    // Check extreme slurs
    for (const pattern of CRITICAL_PATTERNS.extremeSlurs) {
      if (pattern.test(content)) {
        matchedPatterns.push(`slur:${pattern.source}`);
        type = 'HARASSMENT';
        severity = 'CRITICAL';
        action = 'BAN';
      }
    }

    // Check phishing
    for (const pattern of CRITICAL_PATTERNS.phishing) {
      if (pattern.test(content)) {
        matchedPatterns.push(`phishing:${pattern.source}`);
        type = 'PHISHING';
        severity = 'HIGH';
        action = 'BAN';
      }
    }

    // Check crypto drainer
    for (const pattern of CRITICAL_PATTERNS.cryptoDrainer) {
      if (pattern.test(content)) {
        matchedPatterns.push(`crypto_drainer:${pattern.source}`);
        type = 'CRYPTO_DRAINER';
        severity = 'CRITICAL';
        action = 'BAN';
      }
    }

    // Sensitivity amplification
    if (matchedPatterns.length > 0 && sensitivity > 1.5) {
      severity = 'CRITICAL';
      action = 'BAN';
    }

    return {
      isViolation: matchedPatterns.length > 0,
      matchedPatterns,
      type,
      severity,
      action,
      confidence: matchedPatterns.length > 0 ? 100 : 0,
      reasoning:
        matchedPatterns.length > 0
          ? `Critical pattern match: ${matchedPatterns.join(', ')}. This content matches known scam/abuse signatures with 100% certainty.`
          : '',
    };
  }

  // ====================================
  // LAYER 2: THE ANALYST
  // ====================================

  private async runAnalyst(
    message: Message,
    context: ContextBufferResult,
    userReputation: UserReputationState,
    sensitivity: number
  ): Promise<AnalystResult> {
    const systemPrompt = `You are the Guardian Analyst, an advanced AI moderation system for Discord servers. Your role is to analyze messages for violations while respecting context.

CRITICAL CONTEXT RULES:
1. Technical discussions get HIGH tolerance - developers often say "this code is trash" or "that's stupid" when discussing code
2. Sarcasm and jokes between friends should be recognized and given passes
3. Educational discussions about harmful topics (security, history) are NOT violations
4. Consider the channel's "heat level" - heated debates don't automatically equal violations
5. Look at the user's reputation - trusted users get more benefit of the doubt

SENSITIVITY LEVEL: ${sensitivity.toFixed(2)}x (higher = stricter)

OUTPUT FORMAT (JSON):
{
  "isViolation": boolean,
  "confidence": 0-100,
  "intentClassification": "EDUCATIONAL" | "HOSTILE" | "SARCASTIC" | "DEFENSIVE" | "NEUTRAL" | "DECEPTIVE" | "PROVOCATIVE",
  "reasoning": "Detailed explanation of your analysis",
  "mitigatingFactors": ["list of reasons to be lenient"],
  "aggravatingFactors": ["list of reasons for concern"],
  "alternativeInterpretations": ["other ways to interpret this message"],
  "suggestedAction": "NONE" | "WARNING" | "MESSAGE_DELETE" | "TIMEOUT_5M" | "TIMEOUT_30M" | "TIMEOUT_1H" | "TIMEOUT_24H" | "KICK" | "BAN",
  "infractionType": "SPAM" | "SCAM" | "TOXICITY" | "HARASSMENT" | "NSFW" | "OTHER",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}`;

    const contextString = this.formatContextForAI(context, userReputation);

    const userPrompt = `Analyze this message for moderation:

MESSAGE:
"${message.content}"

CONTEXT:
${contextString}

Provide your analysis in JSON format.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getDefaultAnalystResult();
      }

      const result = JSON.parse(content);

      // Apply sensitivity adjustment
      if (sensitivity > 1.5) {
        result.confidence = Math.min(100, result.confidence * sensitivity);
      }

      return {
        isViolation: result.isViolation,
        confidence: result.confidence,
        intentClassification: result.intentClassification,
        reasoning: result.reasoning,
        mitigatingFactors: result.mitigatingFactors || [],
        aggravatingFactors: result.aggravatingFactors || [],
        alternativeInterpretations: result.alternativeInterpretations || [],
        suggestedAction: result.suggestedAction,
        infractionType: result.infractionType,
        severity: result.severity,
      };
    } catch (error) {
      logger.error('Analyst error:', error);
      return this.getDefaultAnalystResult();
    }
  }

  // ====================================
  // LAYER 3: THE VISIONARY
  // ====================================

  private async runVisionary(
    attachment: Attachment,
    context: ContextBufferResult,
    userReputation: UserReputationState
  ): Promise<VisionaryResult> {
    const systemPrompt = `You are the Guardian Visionary, an AI image analysis system for Discord moderation. You detect:

1. STEGANOGRAPHIC SCAMS: Text hidden in images (fake Discord messages, fake giveaways, wallet connect prompts)
2. EXTREMIST ICONOGRAPHY: Hate symbols, terrorist imagery, dangerous ideological content
3. NSFW CONTENT: Explicit sexual content, gore, or disturbing imagery
4. PHISHING: Fake login screens, fake Discord UI, QR codes for wallet draining

OUTPUT FORMAT (JSON):
{
  "isViolation": boolean,
  "confidence": 0-100,
  "steganographyDetected": boolean,
  "extractedText": "any text visible in the image",
  "iconographyFlags": ["list of concerning symbols/imagery"],
  "nsfwProbability": 0.0-1.0,
  "scamIndicators": ["list of scam patterns detected"],
  "reasoning": "Detailed explanation of what you see and why it's concerning or safe"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image for moderation violations. User reputation: ${userReputation.trustLevel}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: attachment.url,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 600,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getDefaultVisionaryResult();
      }

      return JSON.parse(content);
    } catch (error) {
      logger.error('Visionary error:', error);
      return this.getDefaultVisionaryResult();
    }
  }

  // ====================================
  // INFRACTION CREATION
  // ====================================

  private async createInfraction(
    message: Message,
    context: ContextBufferResult,
    userReputation: UserReputationState,
    aiReasoning: IAIReasoning,
    type: InfractionType,
    severity: InfractionSeverity,
    action: ModActionTaken
  ): Promise<IInfraction> {
    const infractionId = uuidv4();

    const userHistorySnapshot: IUserHistorySnapshot = {
      reputationScore: userReputation.score,
      accountAgeDays: this.getAccountAgeDays(message.author.createdAt),
      serverTenureDays: message.member
        ? this.getAccountAgeDays(message.member.joinedAt || new Date())
        : 0,
      previousInfractions: await Infraction.getUserInfractionCount(
        this.guildId,
        message.author.id
      ),
      wasElevatedObservation: userReputation.observationLevel !== 'NORMAL',
      positiveContributions: 0, // Would need to track this
      roles: message.member?.roles.cache.map(r => r.name) || [],
    };

    const infraction = await Infraction.create({
      infractionId,
      guildId: this.guildId,
      channelId: message.channel.id,
      userId: message.author.id,
      username: message.author.username,
      messageId: message.id,
      messageContent: message.content,
      attachmentUrls: message.attachments.map(a => a.url),
      type,
      severity,
      actionTaken: action,
      automated: true,
      aiReasoning,
      socialContext: context.socialContext,
      messageContext: context.messages,
      userHistorySnapshot,
      appeal: { appealed: false },
      confirmedFalsePositive: false,
      tags: [],
    });

    // Update user reputation
    await this.reputationManager.recordViolation(
      message.author.id,
      severity,
      infractionId
    );

    // Update channel heat
    await this.sentimentEngine.recordMessage(
      message.channel.id,
      message.author.id,
      -1,
      true
    );

    // Publish event
    const eventBus = getEventBus();
    await eventBus.publish(EventTypes.MOD_USER_WARNED, {
      guildId: this.guildId,
      moderatorId: 'guardian_ai',
      moderatorName: 'Guardian AI',
      userId: message.author.id,
      username: message.author.username,
      action: 'warn',
      reason: aiReasoning.reasoning,
      duration: this.getActionDuration(action),
      aiGenerated: true,
    });

    logger.warn(
      `🛡️ GUARDIAN INFRACTION: ${message.author.username} | ${type} | ${severity} | ${action}`
    );
    logger.warn(`   Reasoning: ${aiReasoning.reasoning.slice(0, 200)}...`);

    return infraction;
  }

  private async createInfractionWithImage(
    message: Message,
    context: ContextBufferResult,
    userReputation: UserReputationState,
    aiReasoning: IAIReasoning,
    imageAnalysis: IImageAnalysis,
    type: InfractionType,
    severity: InfractionSeverity,
    action: ModActionTaken
  ): Promise<IInfraction> {
    const infraction = await this.createInfraction(
      message,
      context,
      userReputation,
      aiReasoning,
      type,
      severity,
      action
    );

    // Add image analysis
    infraction.imageAnalysis = imageAnalysis;
    await infraction.save();

    return infraction;
  }

  // ====================================
  // HELPERS
  // ====================================

  private formatContextForAI(
    context: ContextBufferResult,
    userReputation: UserReputationState
  ): string {
    const recentMessages = context.messages
      .slice(-5)
      .map(m => `[${m.authorUsername}]: ${m.content.slice(0, 100)}`)
      .join('\n');

    return `
CHANNEL STATE:
- Heat Level: ${context.socialContext.channelHeat}/100 (${context.socialContext.isHeatedDiscussion ? 'HEATED' : 'calm'})
- Message Velocity: ${context.socialContext.messageVelocity.toFixed(1)} msgs/min
- Sentiment Trend: ${context.socialContext.sentimentDelta > 0 ? 'Improving' : context.socialContext.sentimentDelta < 0 ? 'Worsening' : 'Stable'}
- Technical Discussion: ${context.socialContext.technicalContext ? 'YES' : 'NO'}

USER REPUTATION:
- Trust Level: ${userReputation.trustLevel}
- Reputation Score: ${userReputation.score}/100
- Observation Status: ${userReputation.observationLevel}
- Previous Infractions: ${userReputation.recentChanges.filter(c => c.delta < 0).length} recent

RECENT MESSAGES:
${recentMessages}
`.trim();
  }

  private determineSeverity(confidence: number): InfractionSeverity {
    if (confidence >= 95) return 'CRITICAL';
    if (confidence >= 80) return 'HIGH';
    if (confidence >= 60) return 'MEDIUM';
    return 'LOW';
  }

  private determineAction(
    severity: InfractionSeverity,
    userReputation: UserReputationState
  ): ModActionTaken {
    // First-time offenders get lighter punishments
    const isFirstOffense = userReputation.recentChanges.filter(c => c.delta < 0).length === 0;

    switch (severity) {
      case 'CRITICAL':
        return 'BAN';
      case 'HIGH':
        return isFirstOffense ? 'TIMEOUT_1H' : 'TIMEOUT_24H';
      case 'MEDIUM':
        return isFirstOffense ? 'WARNING' : 'TIMEOUT_30M';
      case 'LOW':
        return isFirstOffense ? 'NONE' : 'WARNING';
    }
  }

  private getActionDuration(action: ModActionTaken): number | undefined {
    switch (action) {
      case 'TIMEOUT_5M':
        return 5 * 60;
      case 'TIMEOUT_30M':
        return 30 * 60;
      case 'TIMEOUT_1H':
        return 60 * 60;
      case 'TIMEOUT_24H':
        return 24 * 60 * 60;
      default:
        return undefined;
    }
  }

  private getAccountAgeDays(date: Date): number {
    return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  }

  private createNullResult(startTime: number): PipelineResult {
    return {
      shouldAction: false,
      detectionLayer: null,
      recommendedAction: 'NONE',
      processingTimeMs: Date.now() - startTime,
      confidence: 0,
      silentLog: false,
    };
  }

  private getDefaultAnalystResult(): AnalystResult {
    return {
      isViolation: false,
      confidence: 0,
      intentClassification: 'NEUTRAL',
      reasoning: 'Analysis could not be completed',
      mitigatingFactors: [],
      aggravatingFactors: [],
      alternativeInterpretations: [],
      suggestedAction: 'NONE',
      infractionType: 'OTHER',
      severity: 'LOW',
    };
  }

  private getDefaultVisionaryResult(): VisionaryResult {
    return {
      isViolation: false,
      confidence: 0,
      steganographyDetected: false,
      iconographyFlags: [],
      nsfwProbability: 0,
      scamIndicators: [],
      reasoning: 'Image analysis could not be completed',
    };
  }
}

// ====================================
// SINGLETON FACTORY
// ====================================

const pipelineCache = new Map<string, GuardianPipeline>();

export function getGuardianPipeline(guildId: string): GuardianPipeline {
  if (!pipelineCache.has(guildId)) {
    pipelineCache.set(guildId, new GuardianPipeline(guildId));
  }
  return pipelineCache.get(guildId)!;
}
