// ====================================
// AVENLO CORE - RULES CONFIG MODEL
// Per-guild configuration for the Rules System
// Follows the same Core pattern as WelcomeConfig:
//   Mongo + Redis hot-reload + channel/role pickers + theme presets
// ====================================

import mongoose, { Document, Schema } from 'mongoose';
import { THEME_PRESETS, type ThemePreset } from './WelcomeConfig';

// ====================================
// SEVERITY (used by L1 sieve + dashboard severity picker)
// ====================================

export const RULE_SEVERITIES = ['info', 'warn', 'mute', 'kick', 'ban'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

// ====================================
// ACCEPTANCE GATE TYPES
// ====================================

export const ACCEPTANCE_GATE_TYPES = ['button', 'captcha', 'none'] as const;
export type AcceptanceGateType = (typeof ACCEPTANCE_GATE_TYPES)[number];

// ====================================
// RULE SUBDOCUMENT
// ====================================

export interface RuleEntry {
  /** Stable client-side id (uuid). Used by dashboard for drag-reorder. */
  id: string;
  /** 1-indexed display number, e.g. "Rule 3" */
  number: number;
  /** Short emoji or icon code (🤝, 💬, etc.) */
  icon: string;
  /** Rule title */
  title: string;
  /** Longer description (markdown allowed in embeds) */
  body: string;
  /** Severity tier — drives moderation linkage in later modules */
  severity: RuleSeverity;
  /** When true, L1 sieve will auto-flag obvious violations of this rule */
  autoEnforced: boolean;
}

const RuleEntrySchema = new Schema<RuleEntry>(
  {
    id: { type: String, required: true },
    number: { type: Number, required: true, min: 1 },
    icon: { type: String, default: '📜' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    severity: {
      type: String,
      enum: RULE_SEVERITIES,
      default: 'warn',
    },
    autoEnforced: { type: Boolean, default: false },
  },
  { _id: false },
);

// ====================================
// MAIN DOCUMENT
// ====================================

export interface IRulesConfig extends Document {
  guildId: string;

  /** Master toggle */
  enabled: boolean;

  /** Channel where the rules embed is posted */
  rulesChannelId: string;
  /** Fallback channel name for the legacy resolver */
  channelName: string;

  /** Role assigned when a user clicks "I Accept" */
  memberRoleId: string;

  /** Acceptance gate behaviour */
  acceptanceGate: AcceptanceGateType;
  /** Captcha math/text question (only used when gate === 'captcha') */
  captchaPrompt: string;
  /** Captcha expected answer */
  captchaAnswer: string;

  /** Header title shown above the rules list */
  headerTitle: string;
  /** Header subtitle / intro paragraph */
  headerSubtitle: string;
  /** Footer text at the bottom of the rules embed */
  footerText: string;

  /** Theme preset — reuses the shared THEME_PRESETS palette */
  themePreset: ThemePreset;
  /** Override accent color (overrides preset when provided) */
  accentColor: string;

  /** Last time the rules embed was published, and the resulting Discord message ID */
  lastPostedAt?: Date;
  lastPostedMessageId?: string;
  /** When true, the bot will edit the existing message instead of re-posting */
  pinAfterPost: boolean;

  /** Ordered list of rule cards rendered in the embed */
  rules: RuleEntry[];

  createdAt: Date;
  updatedAt: Date;
}

const RulesConfigSchema = new Schema<IRulesConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    enabled: { type: Boolean, default: true },

    rulesChannelId: { type: String, default: '' },
    channelName: { type: String, default: 'rules' },

    memberRoleId: { type: String, default: '' },

    acceptanceGate: {
      type: String,
      enum: ACCEPTANCE_GATE_TYPES,
      default: 'button',
    },
    captchaPrompt: { type: String, default: 'What is 7 + 4?' },
    captchaAnswer: { type: String, default: '11' },

    headerTitle: { type: String, default: '📜 COMMUNITY GUIDELINES' },
    headerSubtitle: {
      type: String,
      default:
        'Welcome to our community! To keep this server productive and safe, please read and accept the rules below.',
    },
    footerText: {
      type: String,
      default:
        'By staying in this server you agree to follow these rules. Violations may result in warnings, mutes, or bans.',
    },

    themePreset: {
      type: String,
      enum: THEME_PRESETS,
      default: 'cyber',
    },
    accentColor: {
      type: String,
      default: '#00FFAA',
      validate: {
        validator: (v: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(v),
        message: 'accentColor must be a 6-digit hex color string',
      },
    },

    lastPostedAt: { type: Date },
    lastPostedMessageId: { type: String },
    pinAfterPost: { type: Boolean, default: true },

    rules: { type: [RuleEntrySchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'rules_configs',
  },
);

export const RulesConfig = mongoose.model<IRulesConfig>('RulesConfig', RulesConfigSchema);

// ====================================
// PLAIN DTO + DEFAULTS
// ====================================

export interface RulesConfigData {
  guildId: string;
  enabled: boolean;
  rulesChannelId: string;
  channelName: string;
  memberRoleId: string;
  acceptanceGate: AcceptanceGateType;
  captchaPrompt: string;
  captchaAnswer: string;
  headerTitle: string;
  headerSubtitle: string;
  footerText: string;
  themePreset: ThemePreset;
  accentColor: string;
  lastPostedAt?: string;
  lastPostedMessageId?: string;
  pinAfterPost: boolean;
  rules: RuleEntry[];
}

export const DEFAULT_RULES: RuleEntry[] = [
  {
    id: 'default-respect',
    number: 1,
    icon: '🤝',
    title: 'Respect Everyone',
    body:
      'Treat every member with respect. No harassment, hate speech, discrimination, or personal attacks.',
    severity: 'warn',
    autoEnforced: false,
  },
  {
    id: 'default-clean',
    number: 2,
    icon: '💬',
    title: 'Keep It Clean',
    body:
      'No NSFW content, excessive profanity, or inappropriate material. This is a professional space.',
    severity: 'mute',
    autoEnforced: true,
  },
  {
    id: 'default-nospam',
    number: 3,
    icon: '🚫',
    title: 'No Spam or Self-Promotion',
    body:
      'Avoid spam, excessive caps, repeated messages, or unsolicited self-promotion outside the right channels.',
    severity: 'warn',
    autoEnforced: true,
  },
  {
    id: 'default-privacy',
    number: 4,
    icon: '🔒',
    title: 'Protect Privacy',
    body:
      'Never share personal information about yourself or others without consent.',
    severity: 'kick',
    autoEnforced: false,
  },
  {
    id: 'default-channels',
    number: 5,
    icon: '📢',
    title: 'Use Channels Correctly',
    body:
      'Post in the channel that matches the topic. Check the channel description if unsure.',
    severity: 'info',
    autoEnforced: false,
  },
  {
    id: 'default-staff',
    number: 6,
    icon: '👮',
    title: 'Listen to Staff',
    body:
      'Follow instructions from moderators and admins. Their decisions are final — open a ticket if you disagree.',
    severity: 'warn',
    autoEnforced: false,
  },
];

export const DEFAULT_RULES_CONFIG: Omit<RulesConfigData, 'guildId'> = {
  enabled: true,
  rulesChannelId: '',
  channelName: 'rules',
  memberRoleId: '',
  acceptanceGate: 'button',
  captchaPrompt: 'What is 7 + 4?',
  captchaAnswer: '11',
  headerTitle: '📜 COMMUNITY GUIDELINES',
  headerSubtitle:
    'Welcome to our community! To keep this server productive and safe, please read and accept the rules below.',
  footerText:
    'By staying in this server you agree to follow these rules. Violations may result in warnings, mutes, or bans.',
  themePreset: 'cyber',
  accentColor: '#00FFAA',
  pinAfterPost: true,
  rules: DEFAULT_RULES,
};
