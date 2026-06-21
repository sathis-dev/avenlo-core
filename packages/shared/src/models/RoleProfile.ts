// ====================================
// AVENLO CORE - ROLE PROFILE MODEL
// ====================================

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRoleProfile extends Document {
  userId: string;
  guildId: string;
  unlockedRoles: string[];    // Array of Role IDs
  equippedRoles: string[];    // Array of Role IDs currently equipped
  synergiesUnlocked: string[]; // E.g., 'Creative Director'
  lastAiSuggestion: Date;
  collectionScore: number;
}

const RoleProfileSchema = new Schema<IRoleProfile>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    unlockedRoles: { type: [String], default: [] },
    equippedRoles: { type: [String], default: [] },
    synergiesUnlocked: { type: [String], default: [] },
    lastAiSuggestion: { type: Date, default: new Date(0) },
    collectionScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for fast lookup
RoleProfileSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export const RoleProfile: Model<IRoleProfile> =
  mongoose.models.RoleProfile || mongoose.model<IRoleProfile>('RoleProfile', RoleProfileSchema);
