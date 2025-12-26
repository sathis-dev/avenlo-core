// ====================================
// AVENLO CORE - USER MODEL
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  discordId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
  githubUsername?: string;
  githubId?: string;
  
  // Credits & Economy
  credits: number;
  totalEarned: number;
  totalSpent: number;
  
  // Contribution tracking
  contributions: {
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
    tickets: number;
  };
  
  // Activity
  lastActiveAt: Date;
  lastContributionAt?: Date;
  isActive: boolean;
  streak: number;
  
  // Roles
  roles: string[];
  isStudioLead: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    discriminator: {
      type: String,
      default: '0',
    },
    avatar: String,
    email: {
      type: String,
      sparse: true,
    },
    githubUsername: {
      type: String,
      sparse: true,
    },
    githubId: {
      type: String,
      sparse: true,
    },
    
    // Credits
    credits: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    
    // Contributions
    contributions: {
      commits: { type: Number, default: 0 },
      pullRequests: { type: Number, default: 0 },
      issues: { type: Number, default: 0 },
      reviews: { type: Number, default: 0 },
      tickets: { type: Number, default: 0 },
    },
    
    // Activity
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    lastContributionAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    streak: {
      type: Number,
      default: 0,
    },
    
    // Roles
    roles: [{
      type: String,
    }],
    isStudioLead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Indexes
UserSchema.index({ credits: -1 });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ 'contributions.pullRequests': -1 });
UserSchema.index({ githubUsername: 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', UserSchema);
