// ====================================
// AVENLO CORE - TRANSACTION MODEL (LEDGER)
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'earn' | 'spend' | 'bonus' | 'penalty' | 'transfer';

export type TransactionReason =
  | 'pr_merged'
  | 'commit'
  | 'issue_closed'
  | 'code_review'
  | 'ticket_resolved'
  | 'project_completed'
  | 'milestone_reached'
  | 'bonus_manual'
  | 'perk_purchase'
  | 'role_purchase'
  | 'transfer_out'
  | 'transfer_in'
  | 'penalty';

export interface ITransaction extends Document {
  // Identifiers
  transactionId: string;
  userId: string;
  discordId: string;
  
  // Transaction Details
  type: TransactionType;
  reason: TransactionReason;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  
  // Reference
  referenceType?: string; // 'pr', 'commit', 'ticket', etc.
  referenceId?: string;
  referenceUrl?: string;
  
  // Description
  description: string;
  metadata?: Map<string, unknown>;
  
  // Timestamps
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    discordId: {
      type: String,
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: ['earn', 'spend', 'bonus', 'penalty', 'transfer'],
      required: true,
    },
    reason: {
      type: String,
      enum: [
        'pr_merged',
        'commit',
        'issue_closed',
        'code_review',
        'ticket_resolved',
        'project_completed',
        'milestone_reached',
        'bonus_manual',
        'perk_purchase',
        'role_purchase',
        'transfer_out',
        'transfer_in',
        'penalty',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    
    referenceType: String,
    referenceId: String,
    referenceUrl: String,
    
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// Indexes
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
