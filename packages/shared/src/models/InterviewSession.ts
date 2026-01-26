// ====================================
// AVENLO CORE - INTERVIEW SESSION MODEL
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export type InterviewStatus = 'active' | 'completed' | 'abandoned' | 'expired';

export interface IInterviewMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IInterviewSession extends Document {
  // Identifiers
  sessionId: string;
  userId: string;
  projectId?: string;

  // Discord
  guildId: string;
  threadId: string;
  channelId: string;

  // Status
  status: InterviewStatus;
  currentPhase: string;

  // Conversation
  messages: IInterviewMessage[];
  messageCount: number;

  // Extracted Data
  extractedData: {
    projectType?: string;
    techStack?: string[];
    features?: string[];
    budget?: string;
    timeline?: string;
    designPreferences?: string[];
    additionalNotes?: string[];
  };

  // AI Configuration
  aiModel: string;
  systemPrompt: string;

  // Timestamps
  startedAt: Date;
  lastMessageAt: Date;
  completedAt?: Date;
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const InterviewMessageSchema = new Schema<IInterviewMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const InterviewSessionSchema = new Schema<IInterviewSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      sparse: true,
    },

    // Discord
    guildId: {
      type: String,
      required: true,
    },
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned', 'expired'],
      default: 'active',
      index: true,
    },
    currentPhase: {
      type: String,
      default: 'introduction',
    },

    // Conversation
    messages: [InterviewMessageSchema],
    messageCount: {
      type: Number,
      default: 0,
    },

    // Extracted Data
    extractedData: {
      projectType: String,
      techStack: [String],
      features: [String],
      budget: String,
      timeline: String,
      designPreferences: [String],
      additionalNotes: [String],
    },

    // AI Config
    aiModel: {
      type: String,
      default: 'gpt-4o',
    },
    systemPrompt: {
      type: String,
      required: true,
    },

    // Timestamps
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    expiresAt: {
      type: Date,
      required: true,
      // TTL index defined below with expireAfterSeconds
    },
  },
  {
    timestamps: true,
    collection: 'interview_sessions',
  }
);

// Indexes
InterviewSessionSchema.index({ userId: 1, status: 1 });
InterviewSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InterviewSession = mongoose.model<IInterviewSession>(
  'InterviewSession',
  InterviewSessionSchema
);
