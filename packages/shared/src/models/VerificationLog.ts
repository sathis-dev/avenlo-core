// ====================================
// AVENLO CORE - VERIFICATION LOG MODEL
// Persistent audit + metrics for the native verification flow
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export type VerificationRiskLevel = 'low' | 'medium' | 'high';
export type VerificationStatus = 'started' | 'completed' | 'failed' | 'timed_out';
export type VerificationFailReason =
  | 'timeout'
  | 'captcha_fail'
  | 'puzzle_fail'
  | 'high_risk_alt'
  | 'raid_lockdown';

export interface IVerificationLog extends Document {
  guildId: string;
  userId: string;
  username: string;

  /** Account age in days at time of verification */
  accountAgeDays: number;

  /** Risk classification from Stage 1 metadata scan */
  riskLevel: VerificationRiskLevel;

  /** Did the user have a default avatar? */
  hasDefaultAvatar: boolean;

  /** Current status of the verification attempt */
  status: VerificationStatus;

  /** If failed, the reason */
  failReason?: VerificationFailReason;

  /** Stage reached when the attempt ended (1-3) */
  stageReached: number;

  /** Total time from start to completion/failure in ms */
  timeTakenMs?: number;

  /** When the user began verification */
  startedAt: Date;

  /** When the attempt ended */
  endedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const VerificationLogSchema = new Schema<IVerificationLog>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },

    accountAgeDays: { type: Number, required: true },
    riskLevel: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high'],
    },
    hasDefaultAvatar: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      required: true,
      enum: ['started', 'completed', 'failed', 'timed_out'],
      default: 'started',
    },
    failReason: {
      type: String,
      enum: ['timeout', 'captcha_fail', 'puzzle_fail', 'high_risk_alt', 'raid_lockdown'],
    },

    stageReached: { type: Number, required: true, default: 1 },
    timeTakenMs: { type: Number },

    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'verification_logs',
  },
);

// Compound indexes for analytics queries
VerificationLogSchema.index({ guildId: 1, status: 1, createdAt: -1 });
VerificationLogSchema.index({ guildId: 1, riskLevel: 1 });
VerificationLogSchema.index({ userId: 1, createdAt: -1 });

export const VerificationLog = mongoose.model<IVerificationLog>('VerificationLog', VerificationLogSchema);
