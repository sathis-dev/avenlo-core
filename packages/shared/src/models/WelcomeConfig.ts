// ====================================
// AVENLO CORE - WELCOME CONFIG MODEL
// Per-guild configuration for the Welcome System
// ====================================

import mongoose, { Document, Schema } from 'mongoose';

export const THEME_PRESETS = [
  'cyber',
  'gold',
  'halloween',
  'christmas',
  'minimal',
  'custom',
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

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

  /** Channel name fallback (without #) when no channel ID is configured */
  channelName: string;

  /** Channel ID (preferred). Falls back to channelName when empty. */
  welcomeChannelId: string;

  /** Channel ID for rules — used in welcome embeds & buttons */
  rulesChannelId: string;

  /** Channel ID for self-assignable roles */
  rolesChannelId: string;

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

  /** Role ID granted when a user clicks "Verify" in their welcome DM */
  verifiedRoleId: string;

  /** Role ID applied to suspicious / quarantined accounts */
  pendingRoleId: string;

  /** When true, accounts younger than quarantineHours are auto-quarantined */
  quarantineNewAccounts: boolean;

  /** Threshold below which accounts get quarantined (in hours) */
  quarantineHours: number;

  /** Use OpenAI to generate a personalized 1-line greeting per new member */
  aiPersonalizedEnabled: boolean;

  /** Detect returning members from JoinEvent history and greet differently */
  returningMemberEnabled: boolean;

  /** Selected theme preset (drives card + accent defaults) */
  themePreset: ThemePreset;

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
    welcomeChannelId: { type: String, default: '' },
    rulesChannelId: { type: String, default: '' },
    rolesChannelId: { type: String, default: '' },
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
    verifiedRoleId: { type: String, default: '' },
    pendingRoleId: { type: String, default: '' },
    quarantineNewAccounts: { type: Boolean, default: false },
    quarantineHours: { type: Number, default: 24, min: 0, max: 24 * 365 },
    aiPersonalizedEnabled: { type: Boolean, default: false },
    returningMemberEnabled: { type: Boolean, default: true },
    themePreset: {
      type: String,
      enum: THEME_PRESETS,
      default: 'cyber',
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
  welcomeChannelId: string;
  rulesChannelId: string;
  rolesChannelId: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTagline: string;
  neonBorderColor: string;
  embedAccentColor: string;
  autoRoleIds: string[];
  verifiedRoleId: string;
  pendingRoleId: string;
  quarantineNewAccounts: boolean;
  quarantineHours: number;
  aiPersonalizedEnabled: boolean;
  returningMemberEnabled: boolean;
  themePreset: ThemePreset;
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
  welcomeChannelId: '',
  rulesChannelId: '',
  rolesChannelId: '',
  titleTemplate: '✨ Welcome, {member}',
  bodyTemplate:
    'Hey {mention} — welcome to **{guild}**!\nYou are member **#{memberCount}**.',
  cardTagline: 'In Code We Trust',
  neonBorderColor: '#00FFAA',
  embedAccentColor: '#FFD700',
  autoRoleIds: [],
  verifiedRoleId: '',
  pendingRoleId: '',
  quarantineNewAccounts: false,
  quarantineHours: 24,
  aiPersonalizedEnabled: false,
  returningMemberEnabled: true,
  themePreset: 'cyber',
};

// ====================================
// THEME PRESETS — apply with one click from dashboard
// ====================================

export interface ThemePresetDefinition {
  /** Display label shown in dashboard */
  label: string;
  /** Short tagline used in card subtitle */
  description: string;
  neonBorderColor: string;
  embedAccentColor: string;
  cardTagline: string;
  titleTemplate: string;
}

export const THEME_PRESET_DEFINITIONS: Record<ThemePreset, ThemePresetDefinition> = {
  cyber: {
    label: 'Cyber Neon',
    description: 'Cyan + gold, our signature look',
    neonBorderColor: '#00FFAA',
    embedAccentColor: '#FFD700',
    cardTagline: 'In Code We Trust',
    titleTemplate: '✨ Welcome, {member}',
  },
  gold: {
    label: 'Royal Gold',
    description: 'All-gold, premium feel',
    neonBorderColor: '#FFD700',
    embedAccentColor: '#FFD700',
    cardTagline: 'The Sovereign Lounge',
    titleTemplate: '👑 Welcome, {member}',
  },
  halloween: {
    label: 'Halloween',
    description: 'Orange + purple for spooky season',
    neonBorderColor: '#FF6A00',
    embedAccentColor: '#9D00FF',
    cardTagline: 'Welcome to the dark side',
    titleTemplate: '🎃 Welcome, {member}',
  },
  christmas: {
    label: 'Christmas',
    description: 'Red + green festive cheer',
    neonBorderColor: '#1ED760',
    embedAccentColor: '#FF3232',
    cardTagline: 'Tis the season',
    titleTemplate: '🎄 Welcome, {member}',
  },
  minimal: {
    label: 'Minimalist',
    description: 'Monochrome whites',
    neonBorderColor: '#FFFFFF',
    embedAccentColor: '#CCCCCC',
    cardTagline: 'Quiet luxury',
    titleTemplate: 'Welcome, {member}',
  },
  custom: {
    label: 'Custom',
    description: 'Free-form — tweak each value yourself',
    neonBorderColor: '#00FFAA',
    embedAccentColor: '#FFD700',
    cardTagline: 'In Code We Trust',
    titleTemplate: '✨ Welcome, {member}',
  },
};
