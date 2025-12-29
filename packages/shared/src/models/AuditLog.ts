// ====================================
// AVENLO CORE - AUDIT LOG MODEL
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  guildId: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  targetType: 'user' | 'channel' | 'role' | 'guild' | 'message' | 'bot' | 'system';
  changes?: {
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
  metadata?: Record<string, unknown>;
  ip?: string;
  source: 'bot' | 'dashboard' | 'api' | 'system';
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  guildId: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  actorId: { type: String, required: true, index: true },
  actorName: { type: String, required: true },
  targetId: { type: String },
  targetName: { type: String },
  targetType: { 
    type: String, 
    required: true,
    enum: ['user', 'channel', 'role', 'guild', 'message', 'bot', 'system'],
  },
  changes: [{
    field: { type: String, required: true },
    oldValue: { type: String },
    newValue: { type: String },
  }],
  metadata: { type: Schema.Types.Mixed },
  ip: { type: String },
  source: { 
    type: String, 
    required: true,
    enum: ['bot', 'dashboard', 'api', 'system'],
    default: 'system',
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound indexes
AuditLogSchema.index({ guildId: 1, createdAt: -1 });
AuditLogSchema.index({ guildId: 1, action: 1 });
AuditLogSchema.index({ guildId: 1, actorId: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
