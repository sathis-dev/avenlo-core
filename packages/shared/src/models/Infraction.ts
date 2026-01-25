// ====================================
// AVENLO CORE - INFRACTION MODEL
// Guardian AI Moderation Evidence Store
// ====================================

import mongoose, { Document, Schema, Model } from 'mongoose';

// ====================================
// TYPES
// ====================================

export type InfractionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InfractionType =
  | 'SPAM'
  | 'SCAM'
  | 'TOXICITY'
  | 'HARASSMENT'
  | 'RAID'
  | 'NSFW'
  | 'EXTREMISM'
  | 'IMPERSONATION'
  | 'DOXXING'
  | 'PHISHING'
  | 'MALWARE'
  | 'CRYPTO_DRAINER'
  | 'OTHER';

export type ModActionTaken =
  | 'NONE'
  | 'WARNING'
  | 'MESSAGE_DELETE'
  | 'TIMEOUT_5M'
  | 'TIMEOUT_30M'
  | 'TIMEOUT_1H'
  | 'TIMEOUT_24H'
  | 'KICK'
  | 'BAN'
  | 'LOCKDOWN';

export type DetectionLayer = 'SIEVE' | 'ANALYST' | 'VISIONARY' | 'RAID_DETECTOR';

export type IntentClassification =
  | 'EDUCATIONAL'
  | 'HOSTILE'
  | 'SARCASTIC'
  | 'DEFENSIVE'
  | 'NEUTRAL'
  | 'DECEPTIVE'
  | 'PROVOCATIVE';

// ====================================
// EMBEDDED SCHEMAS
// ====================================

/**
 * Social Context Snapshot
 * Captures the environment at the time of infraction
 */
export interface ISocialContext {
  /** Channel heat level at time of infraction */
  channelHeat: number;
  /** Recent message velocity (msgs/min) */
  messageVelocity: number;
  /** Sentiment delta over last 7 messages */
  sentimentDelta: number;
  /** Number of active users in channel */
  activeUsers: number;
  /** Was the channel in a heated discussion? */
  isHeatedDiscussion: boolean;
  /** Topic of conversation (if detected) */
  conversationTopic?: string;
  /** Were technical terms present? */
  technicalContext: boolean;
}

/**
 * Message Context - The sliding window snapshot
 */
export interface IMessageContext {
  /** Message ID */
  messageId: string;
  /** Author ID */
  authorId: string;
  /** Author username */
  authorUsername: string;
  /** Message content (truncated) */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Sentiment score (-1 to 1) */
  sentiment: number;
}

/**
 * AI Reasoning - Explainable Moderation
 */
export interface IAIReasoning {
  /** Which detection layer triggered */
  detectionLayer: DetectionLayer;
  /** Confidence score (0-100) */
  confidence: number;
  /** Intent classification */
  intentClassification: IntentClassification;
  /** Pattern signatures matched */
  patternSignatures: string[];
  /** Detailed reasoning (human-readable) */
  reasoning: string;
  /** Mitigating factors considered */
  mitigatingFactors: string[];
  /** Aggravating factors */
  aggravatingFactors: string[];
  /** Alternative interpretations considered */
  alternativeInterpretations: string[];
  /** Model used for analysis */
  modelUsed: string;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Token count used */
  tokenCount: number;
}

/**
 * User History Snapshot
 * User's state at time of infraction
 */
export interface IUserHistorySnapshot {
  /** User reputation score at time */
  reputationScore: number;
  /** Account age in days */
  accountAgeDays: number;
  /** Server tenure in days */
  serverTenureDays: number;
  /** Previous infractions count */
  previousInfractions: number;
  /** Was user in elevated observation? */
  wasElevatedObservation: boolean;
  /** Recent positive contributions */
  positiveContributions: number;
  /** Roles at time of infraction */
  roles: string[];
}

/**
 * Image Analysis Results
 */
export interface IImageAnalysis {
  /** Image URL */
  imageUrl: string;
  /** Was steganographic content detected? */
  steganographyDetected: boolean;
  /** Text extracted from image */
  extractedText?: string;
  /** Iconography flags */
  iconographyFlags: string[];
  /** NSFW probability */
  nsfwProbability: number;
  /** Scam indicators */
  scamIndicators: string[];
  /** Analysis confidence */
  confidence: number;
}

/**
 * Appeal Information
 */
export interface IAppealInfo {
  /** Was this infraction appealed? */
  appealed: boolean;
  /** Appeal timestamp */
  appealedAt?: Date;
  /** Appeal reason provided */
  appealReason?: string;
  /** Appeal decision */
  appealDecision?: 'PENDING' | 'UPHELD' | 'OVERTURNED' | 'REDUCED';
  /** Staff member who reviewed */
  reviewedBy?: string;
  /** Review notes */
  reviewNotes?: string;
  /** Review timestamp */
  reviewedAt?: Date;
}

// ====================================
// MAIN INFRACTION INTERFACE
// ====================================

export interface IInfraction extends Document {
  /** Unique infraction ID */
  infractionId: string;
  /** Guild ID */
  guildId: string;
  /** Channel ID where infraction occurred */
  channelId: string;
  /** User ID of offender */
  userId: string;
  /** Username at time of infraction */
  username: string;
  /** Original message ID */
  messageId?: string;
  /** Original message content */
  messageContent: string;
  /** Attachments (if any) */
  attachmentUrls: string[];

  // Classification
  /** Type of infraction */
  type: InfractionType;
  /** Severity level */
  severity: InfractionSeverity;
  /** Action taken */
  actionTaken: ModActionTaken;
  /** Was this automated or manual? */
  automated: boolean;

  // AI Analysis
  /** AI reasoning and analysis */
  aiReasoning: IAIReasoning;
  /** Social context snapshot */
  socialContext: ISocialContext;
  /** Message context window */
  messageContext: IMessageContext[];
  /** User history snapshot */
  userHistorySnapshot: IUserHistorySnapshot;
  /** Image analysis (if applicable) */
  imageAnalysis?: IImageAnalysis;

  // Appeals
  /** Appeal information */
  appeal: IAppealInfo;

  // Metadata
  /** Was this a false positive? (for ML training) */
  confirmedFalsePositive: boolean;
  /** Staff override reason */
  staffOverrideReason?: string;
  /** Staff who overrode */
  overriddenBy?: string;
  /** Tags for categorization */
  tags: string[];
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Expiration (for auto-cleanup) */
  expiresAt?: Date;
}

// ====================================
// SCHEMA DEFINITIONS
// ====================================

const SocialContextSchema = new Schema<ISocialContext>(
  {
    channelHeat: { type: Number, required: true, min: 0, max: 100 },
    messageVelocity: { type: Number, required: true },
    sentimentDelta: { type: Number, required: true, min: -2, max: 2 },
    activeUsers: { type: Number, required: true },
    isHeatedDiscussion: { type: Boolean, default: false },
    conversationTopic: { type: String },
    technicalContext: { type: Boolean, default: false },
  },
  { _id: false }
);

const MessageContextSchema = new Schema<IMessageContext>(
  {
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    content: { type: String, required: true, maxlength: 500 },
    timestamp: { type: Date, required: true },
    sentiment: { type: Number, required: true, min: -1, max: 1 },
  },
  { _id: false }
);

const AIReasoningSchema = new Schema<IAIReasoning>(
  {
    detectionLayer: {
      type: String,
      enum: ['SIEVE', 'ANALYST', 'VISIONARY', 'RAID_DETECTOR'],
      required: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    intentClassification: {
      type: String,
      enum: ['EDUCATIONAL', 'HOSTILE', 'SARCASTIC', 'DEFENSIVE', 'NEUTRAL', 'DECEPTIVE', 'PROVOCATIVE'],
      required: true,
    },
    patternSignatures: [{ type: String }],
    reasoning: { type: String, required: true },
    mitigatingFactors: [{ type: String }],
    aggravatingFactors: [{ type: String }],
    alternativeInterpretations: [{ type: String }],
    modelUsed: { type: String, required: true },
    processingTimeMs: { type: Number, required: true },
    tokenCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserHistorySnapshotSchema = new Schema<IUserHistorySnapshot>(
  {
    reputationScore: { type: Number, required: true },
    accountAgeDays: { type: Number, required: true },
    serverTenureDays: { type: Number, required: true },
    previousInfractions: { type: Number, default: 0 },
    wasElevatedObservation: { type: Boolean, default: false },
    positiveContributions: { type: Number, default: 0 },
    roles: [{ type: String }],
  },
  { _id: false }
);

const ImageAnalysisSchema = new Schema<IImageAnalysis>(
  {
    imageUrl: { type: String, required: true },
    steganographyDetected: { type: Boolean, default: false },
    extractedText: { type: String },
    iconographyFlags: [{ type: String }],
    nsfwProbability: { type: Number, default: 0 },
    scamIndicators: [{ type: String }],
    confidence: { type: Number, required: true },
  },
  { _id: false }
);

const AppealInfoSchema = new Schema<IAppealInfo>(
  {
    appealed: { type: Boolean, default: false },
    appealedAt: { type: Date },
    appealReason: { type: String },
    appealDecision: {
      type: String,
      enum: ['PENDING', 'UPHELD', 'OVERTURNED', 'REDUCED'],
    },
    reviewedBy: { type: String },
    reviewNotes: { type: String },
    reviewedAt: { type: Date },
  },
  { _id: false }
);

// ====================================
// MAIN SCHEMA
// ====================================

const InfractionSchema = new Schema<IInfraction>(
  {
    infractionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    messageId: {
      type: String,
      sparse: true,
    },
    messageContent: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    attachmentUrls: [{ type: String }],

    // Classification
    type: {
      type: String,
      enum: [
        'SPAM',
        'SCAM',
        'TOXICITY',
        'HARASSMENT',
        'RAID',
        'NSFW',
        'EXTREMISM',
        'IMPERSONATION',
        'DOXXING',
        'PHISHING',
        'MALWARE',
        'CRYPTO_DRAINER',
        'OTHER',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    actionTaken: {
      type: String,
      enum: [
        'NONE',
        'WARNING',
        'MESSAGE_DELETE',
        'TIMEOUT_5M',
        'TIMEOUT_30M',
        'TIMEOUT_1H',
        'TIMEOUT_24H',
        'KICK',
        'BAN',
        'LOCKDOWN',
      ],
      required: true,
    },
    automated: {
      type: Boolean,
      default: true,
    },

    // AI Analysis
    aiReasoning: {
      type: AIReasoningSchema,
      required: true,
    },
    socialContext: {
      type: SocialContextSchema,
      required: true,
    },
    messageContext: {
      type: [MessageContextSchema],
      default: [],
    },
    userHistorySnapshot: {
      type: UserHistorySnapshotSchema,
      required: true,
    },
    imageAnalysis: {
      type: ImageAnalysisSchema,
    },

    // Appeals
    appeal: {
      type: AppealInfoSchema,
      default: { appealed: false },
    },

    // Metadata
    confirmedFalsePositive: {
      type: Boolean,
      default: false,
      index: true,
    },
    staffOverrideReason: { type: String },
    overriddenBy: { type: String },
    tags: [{ type: String }],
    expiresAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    collection: 'infractions',
  }
);

// ====================================
// INDEXES
// ====================================

// Compound indexes for common queries
InfractionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
InfractionSchema.index({ guildId: 1, type: 1, createdAt: -1 });
InfractionSchema.index({ guildId: 1, severity: 1, createdAt: -1 });
InfractionSchema.index({ userId: 1, createdAt: -1 });
InfractionSchema.index({ 'appeal.appealDecision': 1, createdAt: -1 });

// TTL index for auto-cleanup (optional - set expiresAt for auto-delete)
InfractionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Text index for searching reasoning
InfractionSchema.index({
  'aiReasoning.reasoning': 'text',
  messageContent: 'text',
});

// ====================================
// STATICS
// ====================================

interface InfractionModel extends Model<IInfraction> {
  getUserInfractionCount(guildId: string, userId: string): Promise<number>;
  getRecentInfractions(guildId: string, userId: string, days: number): Promise<IInfraction[]>;
  getFalsePositiveRate(guildId: string, days: number): Promise<number>;
  getInfractionsByType(guildId: string, days: number): Promise<Record<InfractionType, number>>;
}

InfractionSchema.statics.getUserInfractionCount = async function (
  guildId: string,
  userId: string
): Promise<number> {
  return this.countDocuments({ guildId, userId, confirmedFalsePositive: false });
};

InfractionSchema.statics.getRecentInfractions = async function (
  guildId: string,
  userId: string,
  days: number
): Promise<IInfraction[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return this.find({
    guildId,
    userId,
    createdAt: { $gte: since },
    confirmedFalsePositive: false,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
};

InfractionSchema.statics.getFalsePositiveRate = async function (
  guildId: string,
  days: number
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const total = await this.countDocuments({
    guildId,
    createdAt: { $gte: since },
  });

  if (total === 0) return 0;

  const falsePositives = await this.countDocuments({
    guildId,
    createdAt: { $gte: since },
    confirmedFalsePositive: true,
  });

  return (falsePositives / total) * 100;
};

InfractionSchema.statics.getInfractionsByType = async function (
  guildId: string,
  days: number
): Promise<Record<InfractionType, number>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await this.aggregate([
    {
      $match: {
        guildId,
        createdAt: { $gte: since },
        confirmedFalsePositive: false,
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
  ]);

  const typeMap: Record<string, number> = {};
  for (const result of results) {
    typeMap[result._id] = result.count;
  }

  return typeMap as Record<InfractionType, number>;
};

// ====================================
// EXPORT
// ====================================

export const Infraction = mongoose.model<IInfraction, InfractionModel>(
  'Infraction',
  InfractionSchema
);

export default Infraction;
