// ====================================
// AVENLO CORE - MODERATION LOG MODEL
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IModerationLog extends Document {
  guildId: string;
  moderatorId: string;
  moderatorName: string;
  targetId: string;
  targetName: string;
  action: 'warn' | 'mute' | 'kick' | 'ban' | 'unban' | 'unmute' | 'delete' | 'timeout';
  reason: string;
  aiDetected?: boolean;
  aiScore?: number;
  aiCategories?: string[];
  messageContent?: string;
  channelId?: string;
  duration?: number;
  createdAt: Date;
}

const ModerationLogSchema = new Schema<IModerationLog>({
  guildId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  moderatorName: { type: String, required: true },
  targetId: { type: String, required: true, index: true },
  targetName: { type: String, required: true },
  action: { 
    type: String, 
    required: true, 
    enum: ['warn', 'mute', 'kick', 'ban', 'unban', 'unmute', 'delete', 'timeout'],
    index: true,
  },
  reason: { type: String, required: true },
  aiDetected: { type: Boolean, default: false },
  aiScore: { type: Number },
  aiCategories: [{ type: String }],
  messageContent: { type: String },
  channelId: { type: String },
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound indexes for efficient queries
ModerationLogSchema.index({ guildId: 1, createdAt: -1 });
ModerationLogSchema.index({ guildId: 1, targetId: 1 });
ModerationLogSchema.index({ guildId: 1, action: 1 });

export const ModerationLog = mongoose.model<IModerationLog>('ModerationLog', ModerationLogSchema);
