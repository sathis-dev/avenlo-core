// ====================================
// AVENLO CORE - JOIN EVENT MODEL
// Persistent join log + onboarding funnel tracking
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export type JoinFunnelStage =
  | 'joined'
  | 'welcomed'
  | 'verified'
  | 'engaged'
  | 'quarantined'
  | 'left';

export interface IJoinEvent extends Document {
  guildId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;

  /** Account creation time on Discord — used for account-age safety */
  accountCreatedAt: Date;
  /** When the user joined the guild (this event) */
  joinedAt: Date;
  /** When the user left (if applicable) */
  leftAt?: Date;

  /** Inviter who brought this user in (if known) */
  inviterId?: string;
  inviterUsername?: string;
  inviteCode?: string;

  /** Number of prior joins to this same guild (0 = first time) */
  priorJoins: number;

  /** Funnel stage progression — last entry is current state */
  stages: { stage: JoinFunnelStage; at: Date }[];

  /** Was this account auto-quarantined as suspicious? */
  quarantined: boolean;

  /** Whether the user clicked the "Verify" button in DM */
  verified: boolean;
  verifiedAt?: Date;

  /** AI-generated personalized greeting (if enabled), cached */
  personalizedGreeting?: string;

  createdAt: Date;
  updatedAt: Date;
}

const JoinEventSchema = new Schema<IJoinEvent>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },

    accountCreatedAt: { type: Date, required: true },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date },

    inviterId: { type: String },
    inviterUsername: { type: String },
    inviteCode: { type: String },

    priorJoins: { type: Number, default: 0 },

    stages: [
      {
        _id: false,
        stage: {
          type: String,
          enum: ['joined', 'welcomed', 'verified', 'engaged', 'quarantined', 'left'],
          required: true,
        },
        at: { type: Date, required: true, default: Date.now },
      },
    ],

    quarantined: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },

    personalizedGreeting: { type: String },
  },
  {
    timestamps: true,
    collection: 'join_events',
  }
);

JoinEventSchema.index({ guildId: 1, userId: 1, joinedAt: -1 });
JoinEventSchema.index({ guildId: 1, joinedAt: -1 });

export const JoinEvent = mongoose.model<IJoinEvent>('JoinEvent', JoinEventSchema);

/** Lightweight DTO used in API + Socket.IO payloads */
export interface JoinEventData {
  guildId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  joinedAt: string;
  leftAt?: string;
  priorJoins: number;
  quarantined: boolean;
  verified: boolean;
  inviterUsername?: string;
  inviteCode?: string;
  stages: { stage: JoinFunnelStage; at: string }[];
}
