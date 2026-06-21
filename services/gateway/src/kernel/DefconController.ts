// ====================================
// AVENLO CORE - DEFCON CONTROLLER
// Graduated Response & Posture Management
// ====================================

import { createLogger, getRedisClient, getEventBus, EventTypes } from '@avenlo/shared';
import { Guild, TextChannel, EmbedBuilder } from 'discord.js';
import { AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('defcon-controller');

// ====================================
// TYPES & CONSTANTS
// ====================================

export enum DefconLevel {
  DEFCON_5 = 5, // NORMAL
  DEFCON_4 = 4, // ELEVATED
  DEFCON_3 = 3, // SUBSTANTIAL
  DEFCON_2 = 2, // SEVERE
  DEFCON_1 = 1, // CRITICAL
}

export interface DefconState {
  guildId: string;
  level: DefconLevel;
  reason: string;
  updatedAt: number;
  expiresAt: number | null;
  history: Array<{
    level: DefconLevel;
    reason: string;
    timestamp: number;
  }>;
}

const DEFCON_KEY_PREFIX = 'kernel:defcon:';
const LOG_CHANNEL_ID = process.env.CHANNEL_LOGS || '';

// ====================================
// DEFCON CONTROLLER
// ====================================

export class DefconController {
  private static instance: DefconController;

  private constructor() {}

  public static getInstance(): DefconController {
    if (!DefconController.instance) {
      DefconController.instance = new DefconController();
    }
    return DefconController.instance;
  }

  /**
   * Get current DEFCON level for a guild
   */
  async getDefconLevel(guildId: string): Promise<DefconState> {
    const redis = getRedisClient().getClient();
    const key = `${DEFCON_KEY_PREFIX}${guildId}`;
    
    const data = await redis.get(key);
    if (!data) {
      return {
        guildId,
        level: DefconLevel.DEFCON_5,
        reason: 'Default state',
        updatedAt: Date.now(),
        expiresAt: null,
        history: [],
      };
    }

    const state: DefconState = JSON.parse(data);

    // Check expiry
    if (state.expiresAt && Date.now() > state.expiresAt) {
      // Auto-deescalate by 1 level
      await this.setDefconLevel(null, guildId, Math.min(5, state.level + 1) as DefconLevel, 'Auto-deescalation timer expired');
      return this.getDefconLevel(guildId);
    }

    return state;
  }

  /**
   * Set a new DEFCON level
   */
  async setDefconLevel(guild: Guild | null, guildId: string, newLevel: DefconLevel, reason: string, durationMinutes: number | null = null): Promise<void> {
    const currentState = await this.getDefconLevel(guildId);
    
    if (currentState.level === newLevel) return; // No change

    const isEscalation = newLevel < currentState.level;

    const newState: DefconState = {
      guildId,
      level: newLevel,
      reason,
      updatedAt: Date.now(),
      expiresAt: durationMinutes ? Date.now() + (durationMinutes * 60000) : null,
      history: [
        { level: newLevel, reason, timestamp: Date.now() },
        ...currentState.history.slice(0, 9) // Keep last 10
      ]
    };

    const redis = getRedisClient().getClient();
    await redis.set(`${DEFCON_KEY_PREFIX}${guildId}`, JSON.stringify(newState));

    logger.info(`DEFCON changed for ${guildId}: ${currentState.level} -> ${newLevel}. Reason: ${reason}`);

    // Trigger physical posture changes if we have the guild object
    if (guild) {
      await this.applyPhysicalPosture(guild, newLevel, isEscalation);
      await this.announceDefconChange(guild, currentState.level, newLevel, reason);
    }

    // Publish event for web dashboard
    const eventBus = getEventBus();
    await eventBus.publish('security:defcon_changed' as any, {
      source: 'gateway',
      payload: {
        guildId,
        oldLevel: currentState.level,
        newLevel,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Apply physical discord restrictions based on DEFCON
   */
  private async applyPhysicalPosture(guild: Guild, level: DefconLevel, isEscalation: boolean): Promise<void> {
    try {
      switch (level) {
        case DefconLevel.DEFCON_5: // NORMAL
          if (!isEscalation) {
            // Restore verification to Medium
            await guild.setVerificationLevel(2); 
            // Unlockdown server via Ring 3 (TODO)
          }
          break;

        case DefconLevel.DEFCON_4: // ELEVATED
          // Slight bump in verification if currently low
          if (guild.verificationLevel < 2) await guild.setVerificationLevel(2);
          break;

        case DefconLevel.DEFCON_3: // SUBSTANTIAL
          // High verification
          await guild.setVerificationLevel(3);
          break;

        case DefconLevel.DEFCON_2: // SEVERE
          // Highest verification
          await guild.setVerificationLevel(4);
          // (Ring 3 will handle channel slowmodes)
          break;

        case DefconLevel.DEFCON_1: // CRITICAL
          // Maximum lockdown
          await guild.setVerificationLevel(4);
          // (Ring 3 will handle full server lockdown and admin stripping)
          break;
      }
    } catch (err) {
      logger.error(`Failed to apply physical posture for DEFCON ${level}:`, err);
    }
  }

  /**
   * Send embed to staff channel
   */
  private async announceDefconChange(guild: Guild, oldLevel: number, newLevel: number, reason: string): Promise<void> {
    if (!LOG_CHANNEL_ID) return;

    try {
      const channel = guild.channels.cache.get(LOG_CHANNEL_ID) as TextChannel;
      if (!channel) return;

      const isEscalation = newLevel < oldLevel;
      const color = this.getDefconColor(newLevel);
      
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🛡️ THREAT LEVEL ${isEscalation ? 'ESCALATED' : 'DE-ESCALATED'}`)
        .setDescription(
          `**New Posture:** DEFCON ${newLevel}\n` +
          `**Previous:** DEFCON ${oldLevel}\n\n` +
          `**Reason:** ${reason}\n\n` +
          `*The Security Kernel has automatically adjusted AI sensitivity and server restrictions.*`
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('Failed to announce DEFCON change:', err);
    }
  }

  private getDefconColor(level: DefconLevel): number {
    switch (level) {
      case 5: return AvenloColors.GREEN;
      case 4: return AvenloColors.YELLOW;
      case 3: return 0xF59E0B; // Orange
      case 2: return 0xEF4444; // Red
      case 1: return 0x000000; // Black / Critical
      default: return AvenloColors.CYAN;
    }
  }
}
