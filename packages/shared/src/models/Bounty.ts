// ====================================
// AVENLO CORE - BOUNTY SMART CONTRACT MODEL
// ====================================

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBounty extends Document {
  bountyId: string;
  creatorId: string;
  title: string;
  description: string;
  rewardCredits: number;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  claimedBy?: string;
  githubIssueUrl?: string;
  linkedPrNumber?: number;
  createdAt: Date;
  completedAt?: Date;
}

const bountySchema = new Schema<IBounty>(
  {
    bountyId: { type: String, required: true, unique: true },
    creatorId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    rewardCredits: { type: Number, required: true },
    status: {
      type: String,
      enum: ['open', 'claimed', 'completed', 'cancelled'],
      default: 'open',
    },
    claimedBy: { type: String },
    githubIssueUrl: { type: String },
    linkedPrNumber: { type: Number },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const Bounty: Model<IBounty> = mongoose.models.Bounty || mongoose.model<IBounty>('Bounty', bountySchema);
