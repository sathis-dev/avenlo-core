// ====================================
// AVENLO CORE - RING 3: ENFORCER
// Action Queue, Escalation Ladder, Rollback
// ====================================

import { Message, GuildMember, User, EmbedBuilder, TextChannel } from 'discord.js';
import { createLogger, getRedisClient, AvenloColors, AvenloBranding } from '@avenlo/shared';
import { ThreatMatrix } from '../ThreatMatrix';

const logger = createLogger('ring3-enforcer');
const LOG_CHANNEL_ID = process.env.CHANNEL_LOGS || '';

// ====================================
// TYPES
// ====================================

export type EnforcementAction = 'warn' | 'mute' | 'kick' | 'ban' | 'delete_message' | 'quarantine' | 'sandbox';

export interface EnforcementRequest {
  guildId: string;
  userId: string;
  targetMessage?: Message;
  targetMember?: GuildMember;
  action: EnforcementAction;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceRing: string;
}

// ====================================
// RING 3 IMPLEMENTATION
// ====================================

export class Ring3Enforcer {
  private static instance: Ring3Enforcer;
  private threatMatrix: ThreatMatrix;

  private constructor() {
    this.threatMatrix = ThreatMatrix.getInstance();
  }

  public static getInstance(): Ring3Enforcer {
    if (!Ring3Enforcer.instance) {
      Ring3Enforcer.instance = new Ring3Enforcer();
    }
    return Ring3Enforcer.instance;
  }

  /**
   * Execute an enforcement action.
   * This handles the actual Discord API calls and escalation logic.
   */
  async enforce(request: EnforcementRequest): Promise<void> {
    // 1. Determine final action (Escalation Ladder)
    const finalAction = await this.calculateEscalation(request);

    // 2. Execute Action
    try {
      await this.executeDiscordAction(finalAction, request);
      
      // 3. Log to Audit Channel
      await this.logEnforcement(finalAction, request);

      // 4. Update Threat Matrix based on action taken
      await this.updateThreatMatrix(finalAction, request);

    } catch (err) {
      logger.error(`Failed to enforce ${finalAction} on ${request.userId}:`, err);
    }
  }

  // ====================================
  // INTERNAL LOGIC
  // ====================================

  /**
   * Escalation Ladder: 
   * If user has a high threat score, escalate warnings to mutes, mutes to kicks.
   */
  private async calculateEscalation(request: EnforcementRequest): Promise<EnforcementAction> {
    const profile = await this.threatMatrix.getProfile(request.userId, request.guildId);
    let action = request.action;

    // Escalate based on composite threat score
    if (profile.compositeScore > 80) {
      if (action === 'warn' || action === 'mute') action = 'ban';
      if (action === 'quarantine') action = 'kick';
    } else if (profile.compositeScore > 50) {
      if (action === 'warn') action = 'mute';
    }

    // Escalate based on severity
    if (request.severity === 'critical' && action !== 'ban') {
      action = 'ban';
    }

    return action;
  }

  private async executeDiscordAction(action: EnforcementAction, request: EnforcementRequest): Promise<void> {
    const { targetMember, targetMessage, reason, guildId, userId } = request;

    // Always try to delete the offending message if present
    if (targetMessage && targetMessage.deletable) {
      await targetMessage.delete().catch(() => {});
    }

    if (!targetMember) return; // Cannot moderate if they left

    switch (action) {
      case 'sandbox':
        const { GhostSandbox } = await import('../GhostSandbox');
        await GhostSandbox.getInstance().exile(targetMember, reason);
        break;

      case 'warn':
        // Send a DM warning
        await targetMember.send(`⚠️ **Warning from Avenlo Core:** You have been warned in ${targetMember.guild.name} for: ${reason}`).catch(() => {});
        break;

      case 'mute':
        // Timeout for 1 hour
        if (targetMember.moderatable) {
          await targetMember.timeout(60 * 60 * 1000, `Avenlo Core: ${reason}`);
          await targetMember.send(`🔇 **Muted by Avenlo Core:** You have been timed out in ${targetMember.guild.name} for 1 hour. Reason: ${reason}`).catch(() => {});
        }
        break;

      case 'quarantine':
        // Assign quarantine role (managed by ServerProtection logic, but can be done here)
        // For brevity, we just timeout them if quarantine isn't setup
        if (targetMember.moderatable) {
            await targetMember.timeout(24 * 60 * 60 * 1000, `Avenlo Core Quarantine: ${reason}`);
        }
        break;

      case 'kick':
        if (targetMember.kickable) {
          await targetMember.send(`🚪 **Kicked by Avenlo Core:** You were kicked from ${targetMember.guild.name}. Reason: ${reason}`).catch(() => {});
          await targetMember.kick(`Avenlo Core: ${reason}`);
        }
        break;

      case 'ban':
        if (targetMember.bannable) {
          await targetMember.send(`🔨 **Banned by Avenlo Core:** You were banned from ${targetMember.guild.name}. Reason: ${reason}`).catch(() => {});
          await targetMember.ban({ reason: `Avenlo Core: ${reason}`, deleteMessageSeconds: 86400 }); // Delete 1 day of messages
        }
        break;
      
      case 'delete_message':
        // Handled above
        break;
    }
  }

  private async updateThreatMatrix(action: EnforcementAction, request: EnforcementRequest): Promise<void> {
    let vector = 'TOXICITY';
    let amount = 0;

    switch (action) {
      case 'warn': amount = 10; break;
      case 'mute': amount = 25; break;
      case 'quarantine': amount = 30; break;
      case 'sandbox': amount = 40; break;
      case 'kick': amount = 50; break;
      case 'ban': amount = 100; break;
    }

    if (request.sourceRing === 'Ring0Sieve') vector = 'PHISHING';
    if (request.reason.toLowerCase().includes('spam')) vector = 'SPAM';
    
    if (amount > 0) {
      await this.threatMatrix.addThreatSignal(request.userId, request.guildId, vector, amount);
    }
  }

  private async logEnforcement(action: EnforcementAction, request: EnforcementRequest): Promise<void> {
    if (!LOG_CHANNEL_ID) return;
    if (!request.targetMember && !request.targetMessage) return;

    try {
      const guild = request.targetMember?.guild || request.targetMessage?.guild;
      if (!guild) return;

      const channel = guild.channels.cache.get(LOG_CHANNEL_ID) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(this.getColorForAction(action))
        .setTitle(`🛡️ KERNEL ENFORCEMENT: ${action.toUpperCase()}`)
        .addFields(
          { name: 'User', value: `<@${request.userId}> (${request.userId})`, inline: true },
          { name: 'Source', value: request.sourceRing, inline: true },
          { name: 'Severity', value: request.severity.toUpperCase(), inline: true },
          { name: 'Reason', value: request.reason, inline: false }
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('Failed to send audit log:', err);
    }
  }

  private getColorForAction(action: EnforcementAction): number {
    switch (action) {
      case 'delete_message': return AvenloColors.YELLOW;
      case 'warn': return 0xF59E0B; // Orange
      case 'mute': return 0xEF4444; // Red
      case 'quarantine': return 0xEF4444; // Red
      case 'sandbox': return 0x4B5563; // Gray (Ghost)
      case 'kick': return 0x991B1B; // Dark Red
      case 'ban': return 0x000000; // Black
      default: return AvenloColors.CYAN;
    }
  }
}
