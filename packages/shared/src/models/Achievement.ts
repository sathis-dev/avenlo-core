// ====================================
// AVENLO CORE - ACHIEVEMENT MODEL
// ====================================

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAchievement extends Document {
  userId: string;
  guildId: string;
  badgeId: string;        // E.g., 'the_architect', 'role_collector_1'
  unlockedAt: Date;
}

const AchievementSchema = new Schema<IAchievement>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    badgeId: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AchievementSchema.index({ userId: 1, guildId: 1, badgeId: 1 }, { unique: true });

export const Achievement: Model<IAchievement> =
  mongoose.models.Achievement || mongoose.model<IAchievement>('Achievement', AchievementSchema);
