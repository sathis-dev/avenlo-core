// ====================================
// AVENLO CORE - TICKET MODEL
// ====================================

import mongoose, { Schema, Document } from 'mongoose';

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  AWAITING_RESPONSE = 'awaiting_response',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketCategory {
  PROJECT_INQUIRY = 'project_inquiry',
  TECHNICAL_SUPPORT = 'technical_support',
  BILLING = 'billing',
  FEATURE_REQUEST = 'feature_request',
  BUG_REPORT = 'bug_report',
  GENERAL = 'general',
}

export interface ITicketMessage {
  authorId: string;
  authorName: string;
  content: string;
  timestamp: Date;
  attachments?: string[];
}

export interface ITicketSession {
  developerId: string;
  developerName: string;
  startedAt: Date;
  endedAt?: Date;
  creditsEarned?: number;
}

export interface ITicket extends Document {
  ticketId: string;
  channelId: string;
  threadId?: string;
  guildId: string;
  
  // Client info
  clientId: string;
  clientName: string;
  isVerifiedClient: boolean;
  projectId?: string;
  
  // Ticket details
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  // SLA tracking
  sla: {
    responseDeadline: Date;
    resolutionDeadline: Date;
    firstResponseAt?: Date;
    resolvedAt?: Date;
    breached: boolean;
  };
  
  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  claimedAt?: Date;
  
  // Session tracking for credits
  sessions: ITicketSession[];
  activeSession?: ITicketSession;
  
  // Transcript
  messages: ITicketMessage[];
  transcript?: string;
  
  // Metadata
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  closedBy?: string;
  closedReason?: string;
}

const TicketMessageSchema = new Schema<ITicketMessage>({
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attachments: [{ type: String }],
}, { _id: false });

const TicketSessionSchema = new Schema<ITicketSession>({
  developerId: { type: String, required: true },
  developerName: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  creditsEarned: { type: Number, default: 0 },
}, { _id: false });

const TicketSchema = new Schema<ITicket>({
  ticketId: { 
    type: String, 
    required: true, 
    unique: true,
  },
  channelId: { type: String, required: true },
  threadId: { type: String },
  guildId: { type: String, required: true },
  
  // Client info
  clientId: { type: String, required: true, index: true },
  clientName: { type: String, required: true },
  isVerifiedClient: { type: Boolean, default: false },
  projectId: { type: String, index: true },
  
  // Ticket details
  subject: { type: String, required: true },
  category: { 
    type: String, 
    enum: Object.values(TicketCategory),
    default: TicketCategory.GENERAL,
  },
  priority: { 
    type: String, 
    enum: Object.values(TicketPriority),
    default: TicketPriority.MEDIUM,
  },
  status: { 
    type: String, 
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN,
    index: true,
  },
  
  // SLA tracking
  sla: {
    responseDeadline: { type: Date, required: true },
    resolutionDeadline: { type: Date, required: true },
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    breached: { type: Boolean, default: false },
  },
  
  // Assignment
  assignedTo: { type: String, index: true },
  assignedToName: { type: String },
  claimedAt: { type: Date },
  
  // Session tracking
  sessions: [TicketSessionSchema],
  activeSession: TicketSessionSchema,
  
  // Transcript
  messages: [TicketMessageSchema],
  transcript: { type: String },
  
  // Metadata
  tags: [{ type: String }],
  closedAt: { type: Date },
  closedBy: { type: String },
  closedReason: { type: String },
}, {
  timestamps: true,
});

// Compound indexes
TicketSchema.index({ guildId: 1, status: 1 });
TicketSchema.index({ clientId: 1, status: 1 });
TicketSchema.index({ priority: 1, status: 1 });

// Auto-generate ticket ID
TicketSchema.pre('save', async function(next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
