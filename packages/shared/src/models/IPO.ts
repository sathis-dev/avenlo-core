// ====================================
// AVENLO CORE - PROJECT IPO MODEL
// ====================================

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IIPO extends Document {
  ipoId: string;
  creatorId: string;
  projectName: string;
  description: string;
  targetCredits: number;
  raisedCredits: number;
  status: 'funding' | 'funded' | 'failed';
  investors: Array<{
    userId: string;
    amount: number;
    investedAt: Date;
  }>;
  deadline: Date;
  createdAt: Date;
}

const ipoSchema = new Schema<IIPO>(
  {
    ipoId: { type: String, required: true, unique: true },
    creatorId: { type: String, required: true },
    projectName: { type: String, required: true },
    description: { type: String, required: true },
    targetCredits: { type: Number, required: true },
    raisedCredits: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['funding', 'funded', 'failed'],
      default: 'funding',
    },
    investors: [
      {
        userId: { type: String, required: true },
        amount: { type: Number, required: true },
        investedAt: { type: Date, default: Date.now },
      },
    ],
    deadline: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const IPO: Model<IIPO> = mongoose.models.IPO || mongoose.model<IIPO>('IPO', ipoSchema);
