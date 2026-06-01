// ====================================
// AVENLO CORE - RULE ACCEPTANCE AUDIT LOG
// One document per (guildId, userId) — last acceptance overrides earlier rows.
// Drives the dashboard's "acceptance rate" funnel + verification gate.
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export type AcceptanceMethod = 'button' | 'captcha' | 'command';

export interface IRuleAcceptance extends Document {
  guildId: string;
  userId: string;
  username: string;
  acceptedAt: Date;
  method: AcceptanceMethod;
  /** Snapshot of rules version (hash or timestamp) at acceptance time */
  rulesVersion: string;
  /** Discord message ID of the rules post the user accepted from */
  rulesMessageId?: string;
  /** Whether the member role was successfully assigned */
  memberRoleGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RuleAcceptanceSchema = new Schema<IRuleAcceptance>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: '' },
    acceptedAt: { type: Date, required: true, default: Date.now },
    method: {
      type: String,
      enum: ['button', 'captcha', 'command'],
      default: 'button',
    },
    rulesVersion: { type: String, default: '' },
    rulesMessageId: { type: String },
    memberRoleGranted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'rule_acceptances',
  },
);

RuleAcceptanceSchema.index({ guildId: 1, userId: 1 }, { unique: true });
RuleAcceptanceSchema.index({ guildId: 1, acceptedAt: -1 });

export const RuleAcceptance = mongoose.model<IRuleAcceptance>(
  'RuleAcceptance',
  RuleAcceptanceSchema,
);
