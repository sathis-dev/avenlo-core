// ====================================
// AVENLO CORE - DEVOPS DASHBOARD MODEL
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export interface ICommitInfo {
  sha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  timestamp: Date;
  url: string;
}

export interface IDevActivity {
  discordId: string;
  githubUsername: string;
  lastCommitAt: Date;
  commitCount: number;
}

export interface IDashboard extends Document {
  // Identifiers
  guildId: string;
  channelId: string;
  messageId: string;
  
  // Project Reference
  projectId?: string;
  repository: {
    url: string;
    owner: string;
    name: string;
    branch: string;
  };
  
  // Progress
  progress: number;
  totalCommits: number;
  totalPRs: number;
  openPRs: number;
  openIssues: number;
  
  // Recent Activity
  recentCommits: ICommitInfo[];
  activeDevs: IDevActivity[];
  
  // System Health
  health: {
    status: 'online' | 'degraded' | 'offline' | 'unknown';
    latency: number;
    lastCheckedAt: Date;
    uptime: number;
  };
  
  // Build Status
  lastBuild: {
    status: 'success' | 'failure' | 'running' | 'pending';
    buildId: string;
    duration?: number;
    timestamp: Date;
  };
  
  // Last Update
  lastUpdatedAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const CommitInfoSchema = new Schema<ICommitInfo>(
  {
    sha: String,
    message: String,
    author: String,
    authorAvatar: String,
    timestamp: Date,
    url: String,
  },
  { _id: false }
);

const DevActivitySchema = new Schema<IDevActivity>(
  {
    discordId: String,
    githubUsername: String,
    lastCommitAt: Date,
    commitCount: Number,
  },
  { _id: false }
);

const DashboardSchema = new Schema<IDashboard>(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
    },
    
    projectId: {
      type: String,
      sparse: true,
    },
    repository: {
      url: { type: String, required: true },
      owner: { type: String, required: true },
      name: { type: String, required: true },
      branch: { type: String, default: 'main' },
    },
    
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalCommits: {
      type: Number,
      default: 0,
    },
    totalPRs: {
      type: Number,
      default: 0,
    },
    openPRs: {
      type: Number,
      default: 0,
    },
    openIssues: {
      type: Number,
      default: 0,
    },
    
    recentCommits: {
      type: [CommitInfoSchema],
      default: [],
    },
    activeDevs: {
      type: [DevActivitySchema],
      default: [],
    },
    
    health: {
      status: {
        type: String,
        enum: ['online', 'degraded', 'offline', 'unknown'],
        default: 'unknown',
      },
      latency: { type: Number, default: 0 },
      lastCheckedAt: { type: Date, default: Date.now },
      uptime: { type: Number, default: 0 },
    },
    
    lastBuild: {
      status: {
        type: String,
        enum: ['success', 'failure', 'running', 'pending'],
        default: 'pending',
      },
      buildId: String,
      duration: Number,
      timestamp: { type: Date, default: Date.now },
    },
    
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'dashboards',
  }
);

// Indexes
DashboardSchema.index({ 'repository.owner': 1, 'repository.name': 1 });
DashboardSchema.index({ projectId: 1 }, { sparse: true });

export const Dashboard = mongoose.model<IDashboard>('Dashboard', DashboardSchema);
