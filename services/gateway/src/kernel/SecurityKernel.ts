// ====================================
// AVENLO CORE - SECURITY KERNEL
// Central Orchestrator for Multi-Ring Defense
// ====================================

import { Message, GuildMember } from 'discord.js';
import { createLogger } from '@avenlo/shared';

import { DefconController, DefconLevel } from './DefconController';
import { ThreatMatrix } from './ThreatMatrix';

import { RingMinus1 } from './rings/RingMinus1';
import { Ring0Sieve } from './rings/Ring0Sieve';
import { Ring1Behavioral } from './rings/Ring1Behavioral';
import { Ring2AI } from './rings/Ring2AI';
import { Ring3Enforcer } from './rings/Ring3Enforcer';

const logger = createLogger('security-kernel');

// ====================================
// TYPES
// ====================================

export interface KernelVerdict {
  actionTaken: boolean;
  actionType?: string;
  threatDetected: boolean;
  reason?: string;
  sourceRing?: string;
}

// ====================================
// KERNEL IMPLEMENTATION
// ====================================

export class SecurityKernel {
  private static instance: SecurityKernel;

  private defconController: DefconController;
  private threatMatrix: ThreatMatrix;

  private ringMinus1: RingMinus1;
  private ring0: Ring0Sieve;
  private ring1: Ring1Behavioral;
  private ring2: Ring2AI;
  private ring3: Ring3Enforcer;

  private constructor() {
    this.defconController = DefconController.getInstance();
    this.threatMatrix = ThreatMatrix.getInstance();

    this.ringMinus1 = RingMinus1.getInstance();
    this.ring0 = Ring0Sieve.getInstance();
    this.ring1 = Ring1Behavioral.getInstance();
    this.ring2 = Ring2AI.getInstance();
    this.ring3 = Ring3Enforcer.getInstance();
    
    logger.info('Security Kernel initialized. All 5 defense rings online.');
  }

  public static getInstance(): SecurityKernel {
    if (!SecurityKernel.instance) {
      SecurityKernel.instance = new SecurityKernel();
    }
    return SecurityKernel.instance;
  }

  /**
   * Pipeline entrypoint for a new message
   */
  async processMessage(message: Message): Promise<KernelVerdict> {
    if (message.author.bot || !message.guild) {
      return { actionTaken: false, threatDetected: false };
    }

    const guildId = message.guild.id;
    const userId = message.author.id;

    // Fast-path: Check DEFCON. If DEFCON 1, we might block all messages globally.
    const defcon = await this.defconController.getDefconLevel(guildId);
    if (defcon.level === DefconLevel.DEFCON_1) {
       // Only allow admins
       if (!message.member?.permissions.has('Administrator')) {
           await message.delete().catch(() => {});
           return { actionTaken: true, actionType: 'delete_message', threatDetected: true, reason: 'DEFCON 1 Lockdown' };
       }
    }

    // --- RING -1: ANOMALY SIEVE (Native < 0.1ms) ---
    const rMinus1 = this.ringMinus1.processMessage(message);
    if (rMinus1.threatAmount > 0) {
      await this.threatMatrix.addThreatSignal(userId, guildId, 'EVASION', rMinus1.threatAmount);
    }
    if (rMinus1.blocked) {
      await this.ring3.enforce({
        guildId, userId, targetMessage: message, targetMember: message.member!,
        action: 'mute', reason: rMinus1.reason || 'Blocked by Anomaly Sieve',
        severity: 'high', sourceRing: 'Ring -1'
      });
      return { actionTaken: true, actionType: 'mute', threatDetected: true, reason: rMinus1.reason, sourceRing: 'RingMinus1' };
    }

    // Replace message content with normalized content for downstream rings
    message.content = rMinus1.normalizedContent;

    // --- RING 0: SIEVE (Instant) ---
    const r0 = await this.ring0.processMessage(message);
    if (r0.blocked) {
      // Immediate Enforcement
      await this.threatMatrix.addThreatSignal(userId, guildId, r0.threatVector || 'TOXICITY', r0.threatAmount || 50);
      await this.ring3.enforce({
        guildId,
        userId,
        targetMessage: message,
        targetMember: message.member!,
        action: 'mute',
        reason: r0.reason || 'Blocked by Ring 0',
        severity: 'high',
        sourceRing: 'Ring 0: Sieve'
      });
      return { actionTaken: true, actionType: 'mute', threatDetected: true, reason: r0.reason, sourceRing: 'Ring0' };
    }

    // --- RING 1: BEHAVIORAL (< 50ms) ---
    const r1 = await this.ring1.processMessage(message);

    // Filter out obvious noise: If heat is low and anomaly is low, skip AI (Save OpenAI costs)
    if (defcon.level === DefconLevel.DEFCON_5 && r1.compositeThreatScore < 20 && r1.channelHeat < 40 && !r1.isCrossChannelSpill) {
      return { actionTaken: false, threatDetected: false }; // Safe path
    }

    // --- RING 2: AI JUDGMENT (< 2000ms) ---
    const r2 = await this.ring2.processMessage(message, r1);

    // Check if AI recommends defcon escalation
    if (r2.shouldEscalateDefcon && defcon.level > DefconLevel.DEFCON_2) {
      await this.defconController.setDefconLevel(message.guild, guildId, DefconLevel.DEFCON_2, `AI Escalation: ${r2.reasoning}`, 60);
    }

    if (r2.isViolation) {
      // Consensus Enforcement
      let enforcementAction: 'warn' | 'mute' | 'kick' | 'ban' | 'delete_message' = 'warn';
      
      if (r2.severity === 'critical') enforcementAction = 'ban';
      else if (r2.severity === 'high') enforcementAction = 'mute';
      else if (r2.severity === 'medium') enforcementAction = 'warn';

      // Always delete message if violation
      if (enforcementAction === 'warn') {
         await message.delete().catch(() => {});
      }

      await this.ring3.enforce({
        guildId,
        userId,
        targetMessage: message,
        targetMember: message.member!,
        action: enforcementAction,
        reason: `AI Detection (${r2.category}): ${r2.reasoning}`,
        severity: (r2.severity === 'none' ? 'low' : r2.severity) as any,
        sourceRing: 'Ring 2: AI'
      });
      return { actionTaken: true, actionType: enforcementAction, threatDetected: true, reason: r2.reasoning, sourceRing: 'Ring2' };
    }

    // --- TEMPORAL DRIFT JITTER (Precognitive) ---
    if (r2.temporalDrift > 1.5) {
       // High drift -> Apply pre-emptive jitter
       logger.warn(`User ${userId} drifting towards violation. (Drift: ${r2.temporalDrift})`);
       // We can apply a temporary slowmode here if needed
       // await message.channel.setRateLimitPerUser(...)
    }

    return { actionTaken: false, threatDetected: false };
  }

  /**
   * Pipeline entrypoint for a member join
   */
  async processMemberJoin(member: GuildMember): Promise<KernelVerdict> {
    const guildId = member.guild.id;
    const userId = member.id;

    // --- RING 0: SIEVE ---
    const r0 = await this.ring0.processMemberJoin(member);

    // If DEFCON is Severe or Critical, auto-kick suspicious joins
    const defcon = await this.defconController.getDefconLevel(guildId);
    
    if (r0.threatVector === 'EVASION') {
        if (defcon.level <= DefconLevel.DEFCON_3) {
            await this.ring3.enforce({
                guildId,
                userId,
                targetMember: member,
                action: 'kick',
                reason: 'Auto-kicked new account during elevated DEFCON',
                severity: 'medium',
                sourceRing: 'Ring 0: Join Gate'
            });
            return { actionTaken: true, actionType: 'kick', threatDetected: true, reason: 'Evasion during lockdown' };
        } else {
            // Normal times: just quarantine
            await this.ring3.enforce({
                guildId,
                userId,
                targetMember: member,
                action: 'quarantine',
                reason: 'New account needs verification',
                severity: 'low',
                sourceRing: 'Ring 0: Join Gate'
            });
            return { actionTaken: true, actionType: 'quarantine', threatDetected: true };
        }
    }

    return { actionTaken: false, threatDetected: false };
  }
}
