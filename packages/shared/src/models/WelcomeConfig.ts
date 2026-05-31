// ====================================
// AVENLO CORE - WELCOME CONFIG MODEL
// Per-guild configuration for the Welcome System
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IWelcomeConfig extends Document {
  /** Discord guild ID this configuration applies to */
  guildId: string;

  /** Master toggle for the welcome system */
  enabled: boolean;

  /** Whether to send a private welcome DM in addition to the channel message */
  dmEnabled: boolean;

  /** Whether to ping the new member with the welcome message */
  mentionUser: boolean;

  /** Whether to render the dynamic canvas card image */
  cardEnabled: boolean;

  /** Whether to show server member count in the embed */
  showMemberCount: boolean;

  /** Whether to show new member's account-age status */
  showAccountAge: boolean;

  /** Channel name (without #) to send the welcome message to */
  channelName: string;

  /** Embed title template. Supports {member}, {guild}, {memberCount} */
  titleTemplate: string;

  /** Embed body template. Supports {member}, {guild}, {memberCount}, {mention} */
  bodyTemplate: string;

  /** Subtitle / tagline rendered on the canvas card */
  cardTagline: string;

  /** Hex string (with leading #) for the neon border on the canvas card */
  neonBorderColor: string;

  /** Hex string (with leading #) for the embed accent line (gold by default) */
  embedAccentColor: string;

  /** Role IDs to auto-assign on member join */
  autoRoleIds: string[];

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

const WelcomeConfigSchema = new Schema<IWelcomeConfig>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: { type: Boolean, default: true },
    dmEnabled: { type: Boolean, default: true },
    mentionUser: { type: Boolean, default: true },
    cardEnabled: { type: Boolean, default: true },
    showMemberCount: { type: Boolean, default: true },
    showAccountAge: { type: Boolean, default: true },
    channelName: { type: String, default: 'welcome' },
    titleTemplate: {
      type: String,
      default: '✨ Welcome, {member}',
    },
    bodyTemplate: {
      type: String,
      default:
        'Hey {mention} — welcome to **{guild}**!\nYou are member **#{memberCount}**.',
    },
    cardTagline: {
      type: String,
      default: 'In Code We Trust',
    },
    neonBorderColor: {
      type: String,
      default: '#00FFAA',
      validate: {
        validator: (v: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(v),
        message: 'neonBorderColor must be a 6-digit hex color string',
      },
    },
    embedAccentColor: {
      type: String,
      default: '#FFD700',
      validate: {
        validator: (v: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(v),
        message: 'embedAccentColor must be a 6-digit hex color string',
      },
    },
    autoRoleIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'welcome_configs',
  }
);

export const WelcomeConfig = mongoose.model<IWelcomeConfig>(
  'WelcomeConfig',
  WelcomeConfigSchema
);

/**
 * Plain-object shape of a welcome config — safe to send over the wire
 * (Mongoose Document fields stripped).
 */
export interface WelcomeConfigData {
  guildId: string;
  enabled: boolean;
  dmEnabled: boolean;
  mentionUser: boolean;
  cardEnabled: boolean;
  showMemberCount: boolean;
  showAccountAge: boolean;
  channelName: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTagline: string;
  neonBorderColor: string;
  embedAccentColor: string;
  autoRoleIds: string[];
}

/** Default config used as a fallback when no document exists for a guild. */
export const DEFAULT_WELCOME_CONFIG: Omit<WelcomeConfigData, 'guildId'> = {
  enabled: true,
  dmEnabled: true,
  mentionUser: true,
  cardEnabled: true,
  showMemberCount: true,
  showAccountAge: true,
  channelName: 'welcome',
  titleTemplate: '✨ Welcome, {member}',
  bodyTemplate:
    'Hey {mention} — welcome to **{guild}**!\nYou are member **#{memberCount}**.',
  cardTagline: 'In Code We Trust',
  neonBorderColor: '#00FFAA',
  embedAccentColor: '#FFD700',
  autoRoleIds: [],
};
