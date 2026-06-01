// ====================================
// AVENLO CORE - CHANNEL & ROLE RESOLVER
// Snowflake-first lookup with emoji-aware name fallback.
// Used by Welcome, Moderation, Tickets, every future module.
// ====================================

import {
  Guild,
  GuildBasedChannel,
  Role,
  TextChannel,
  ChannelType,
} from 'discord.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Normalise a string for fuzzy name matching:
 *  - lowercase
 *  - strip all non-ASCII (emojis, middle-dots, line-art) via NFKD + range filter
 *  - drop dashes/underscores/spaces
 */
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve a channel by snowflake ID first, then by fuzzy name match.
 * Handles names like `🍑・welcome`, `┃welcome`, `welcome-newbies`, etc.
 *
 * @param idOrName Channel snowflake OR partial name
 * @param requiredType Optional Discord channel-type filter
 */
export function resolveChannel(
  guild: Guild,
  idOrName: string,
  requiredType?: ChannelType,
): GuildBasedChannel | null {
  if (!idOrName) return null;

  // 1) Direct ID hit
  if (SNOWFLAKE_RE.test(idOrName)) {
    const byId = guild.channels.cache.get(idOrName) ?? null;
    if (byId && (requiredType === undefined || byId.type === requiredType)) {
      return byId;
    }
  }

  const target = normalizeName(idOrName);
  if (!target) return null;

  // 2) Prefer exact normalized match, then substring match
  let exact: GuildBasedChannel | null = null;
  let partial: GuildBasedChannel | null = null;

  for (const channel of guild.channels.cache.values()) {
    if (requiredType !== undefined && channel.type !== requiredType) continue;
    const norm = normalizeName(channel.name);
    if (norm === target) {
      exact = channel;
      break;
    }
    if (!partial && norm.includes(target)) {
      partial = channel;
    }
  }
  return exact ?? partial;
}

/**
 * Resolve a text-based channel suitable for posting messages.
 */
export function resolveTextChannel(
  guild: Guild,
  idOrName: string,
): TextChannel | null {
  const channel = resolveChannel(guild, idOrName);
  if (!channel) return null;
  if (channel.isTextBased() && 'send' in channel) {
    return channel as TextChannel;
  }
  return null;
}

/**
 * Best-effort welcome channel discovery.
 * Tries (in order): explicit ID/name from config, common alternates, system channel.
 */
export function resolveWelcomeChannel(
  guild: Guild,
  configured: {
    welcomeChannelId?: string;
    channelName?: string;
  },
): TextChannel | null {
  const candidates: string[] = [];
  if (configured.welcomeChannelId) candidates.push(configured.welcomeChannelId);
  if (configured.channelName) candidates.push(configured.channelName);
  candidates.push('welcome', 'general', 'lobby', 'main');

  for (const c of candidates) {
    const channel = resolveTextChannel(guild, c);
    if (channel) return channel;
  }
  if (guild.systemChannel) return guild.systemChannel as TextChannel;
  return null;
}

/**
 * Resolve a Role by snowflake ID first, then by fuzzy name match.
 */
export function resolveRole(guild: Guild, idOrName: string): Role | null {
  if (!idOrName) return null;
  if (SNOWFLAKE_RE.test(idOrName)) {
    const byId = guild.roles.cache.get(idOrName);
    if (byId) return byId;
  }
  const target = normalizeName(idOrName);
  if (!target) return null;
  let exact: Role | null = null;
  let partial: Role | null = null;
  for (const role of guild.roles.cache.values()) {
    const norm = normalizeName(role.name);
    if (norm === target) {
      exact = role;
      break;
    }
    if (!partial && norm.includes(target)) partial = role;
  }
  return exact ?? partial;
}

/**
 * Lightweight JSON representation of a text channel — used by dashboard API.
 */
export interface ChannelDescriptor {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string | null;
  position: number;
}

export function listTextChannels(guild: Guild): ChannelDescriptor[] {
  return Array.from(guild.channels.cache.values())
    .filter(
      (c): c is TextChannel =>
        c.type === ChannelType.GuildText ||
        c.type === ChannelType.GuildAnnouncement,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId ?? null,
      parentName: c.parent?.name ?? null,
      position: c.position,
    }))
    .sort((a, b) => a.position - b.position);
}

export interface RoleDescriptor {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export function listAssignableRoles(guild: Guild): RoleDescriptor[] {
  return Array.from(guild.roles.cache.values())
    .filter((r) => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      managed: r.managed,
    }));
}
