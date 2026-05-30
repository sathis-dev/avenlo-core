// ====================================
// AVENLO CORE - THERMAL ENGINE
// Redis-backed per-user Heat with auto-lockdown (Kinetic Engine)
// ====================================
//
// Persists each user's Heat in Redis and applies the exponential Thermal Decay
// model on every read. When a user's Heat crosses the lockdown threshold (90%)
// the engine strips their permission-granting roles and times them out.

import { GuildMember } from 'discord.js';
import {
  createLogger,
  getRedisClient,
  getEventBus,
  EventTypes,
} from '@avenlo/shared';
import {
  ThermalState,
  applyHeat,
  decayHeat,
  isLockdown,
  HEAT_LOCKDOWN_THRESHOLD,
} from './thermalDecay';

const logger = createLogger('guardian-thermal-engine');

const THERMAL_KEY_PREFIX = 'guardian:thermal';
const THERMAL_TTL_SECONDS = 24 * 60 * 60; // 24h
const LOCKDOWN_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h Discord timeout

export class ThermalEngine {
  private guildId: string;

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  private key(userId: string): string {
    return `${THERMAL_KEY_PREFIX}:${this.guildId}:${userId}`;
  }

  private async readState(userId: string): Promise<ThermalState> {
    try {
      const redis = getRedisClient().getClient();
      const raw = await redis.get(this.key(userId));
      if (!raw) {
        return { heat: 0, updatedAt: Date.now() };
      }
      const parsed = JSON.parse(raw) as ThermalState;
      if (typeof parsed.heat !== 'number' || typeof parsed.updatedAt !== 'number') {
        return { heat: 0, updatedAt: Date.now() };
      }
      return parsed;
    } catch (error) {
      logger.error('Error reading thermal state:', error);
      return { heat: 0, updatedAt: Date.now() };
    }
  }

  private async writeState(userId: string, state: ThermalState): Promise<void> {
    try {
      const redis = getRedisClient().getClient();
      await redis.set(this.key(userId), JSON.stringify(state), 'EX', THERMAL_TTL_SECONDS);
    } catch (error) {
      logger.error('Error writing thermal state:', error);
    }
  }

  /** Current decayed Heat for a user (does not mutate storage). */
  async getHeat(userId: string): Promise<number> {
    const state = await this.readState(userId);
    return decayHeat(state.heat, Date.now() - state.updatedAt);
  }

  /**
   * Decay then apply a Heat delta for a user, persisting the result.
   * Returns the new Heat value.
   */
  async addHeat(userId: string, delta: number): Promise<number> {
    const state = await this.readState(userId);
    const next = applyHeat(state, delta, Date.now());
    await this.writeState(userId, next);
    return next.heat;
  }

  /**
   * Evaluate a member's Heat and, if it has crossed the lockdown threshold,
   * strip their roles and time them out. Returns true if a lockdown occurred.
   */
  async enforce(member: GuildMember, heat: number): Promise<boolean> {
    if (!isLockdown(heat)) {
      return false;
    }
    return this.lockdown(member, heat);
  }

  /**
   * Strip permission-granting roles from a member and apply a communication
   * timeout. Best-effort: never throws into the moderation pipeline.
   */
  async lockdown(member: GuildMember, heat: number): Promise<boolean> {
    const reason = `Kinetic lockdown: Heat ${heat.toFixed(0)}% >= ${HEAT_LOCKDOWN_THRESHOLD}%`;

    try {
      const me = member.guild.members.me;
      const botHighest = me?.roles.highest.position ?? 0;

      // Remove every role the bot is allowed to manage (strips permissions).
      const strippable = member.roles.cache.filter(
        (role) =>
          role.id !== member.guild.id && // skip @everyone
          !role.managed && // skip integration-managed roles
          role.position < botHighest
      );

      if (strippable.size > 0) {
        await member.roles.remove(strippable, reason);
      }

      // Lock them down with a Discord timeout where possible.
      if (member.moderatable) {
        await member.timeout(LOCKDOWN_TIMEOUT_MS, reason);
      }

      logger.warn(
        `Locked down ${member.user.username} (${member.id}) - stripped ${strippable.size} role(s)`
      );

      await this.emitLockdown(member, heat, reason);
      return true;
    } catch (error) {
      logger.error(`Failed to lock down ${member.id}:`, error);
      return false;
    }
  }

  private async emitLockdown(
    member: GuildMember,
    heat: number,
    reason: string
  ): Promise<void> {
    try {
      await getEventBus().publish(EventTypes.MOD_USER_MUTED, {
        guildId: this.guildId,
        userId: member.id,
        username: member.user.username,
        moderatorId: 'system:kinetic-engine',
        moderatorName: 'Avenlo Guardian',
        action: 'mute',
        reason,
        duration: LOCKDOWN_TIMEOUT_MS / 60000,
        aiGenerated: true,
        aiScore: heat,
      });
    } catch (error) {
      logger.error('Failed to publish lockdown event:', error);
    }
  }
}

const thermalCache = new Map<string, ThermalEngine>();

export function getThermalEngine(guildId: string): ThermalEngine {
  let engine = thermalCache.get(guildId);
  if (!engine) {
    engine = new ThermalEngine(guildId);
    thermalCache.set(guildId, engine);
  }
  return engine;
}
