// ====================================
// AVENLO CORE - KERNEL ROLES PANEL HANDLER
// Intercepts role requests and passes them through ThreatMatrix
// ====================================

import { StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { createLogger, AvenloColors } from '@avenlo/shared';
import { ThreatMatrix } from '../kernel/ThreatMatrix';

const logger = createLogger('roles-panel-handler');

export class RolePanelHandler {
  
  static async handleInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId !== 'kernel_role_panel') return;

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const member = interaction.member as GuildMember;
    const requestedRoleId = interaction.values[0];

    if (!guildId || !member) {
      await interaction.editReply({ content: '❌ Critical Error: Could not verify identity context.' });
      return;
    }

    // 1. Ghost Sandbox Check
    // If the user has the Ghost role, they are in the Shadow Realm.
    const isGhost = member.roles.cache.some(r => r.name === 'Ghost');
    if (isGhost) {
      // Fake success to maintain the sandbox illusion
      logger.info(`👻 Ghost user ${userId} attempted to claim role ${requestedRoleId}. Faking success.`);
      await interaction.editReply({ 
        content: `✅ **Identity Verified.** Role granted successfully.\n*Welcome to the inner circle.*` 
      });
      return;
    }

    // 2. Threat Matrix Check
    const threatMatrix = ThreatMatrix.getInstance();
    const profile = await threatMatrix.getProfile(userId, guildId);

    if (profile.compositeScore >= 50) {
      // Reject application
      logger.warn(`🛡️ Kernel Blocked role assignment for ${userId}. Threat Score: ${profile.compositeScore}`);
      
      // Optionally penalize them for probing
      await threatMatrix.addThreatSignal(userId, guildId, 'EVASION', 10);

      await interaction.editReply({ 
        content: `❌ **KERNEL REJECTION:** Access Denied.\nYour shadow threat score (${profile.compositeScore.toFixed(0)}) exceeds the safety threshold.` 
      });
      return;
    }

    // 3. Ledger/Value Check (Optional - currently we just enforce basic safety)
    // Here we could import LedgerHandler and check if they have enough balance for premium roles

    // 4. Grant Role
    try {
      const role = interaction.guild?.roles.cache.get(requestedRoleId);
      if (!role) {
        await interaction.editReply({ content: '❌ Role no longer exists.' });
        return;
      }

      // Check bot hierarchy
      const botMember = interaction.guild?.members.me;
      if (botMember && role.position >= botMember.roles.highest.position) {
        await interaction.editReply({ 
          content: `❌ **ERROR:** The bot's highest role must be placed above the \`${role.name}\` role in Server Settings to assign it.` 
        });
        return;
      }

      // Toggle role
      if (member.roles.cache.has(requestedRoleId)) {
        await member.roles.remove(requestedRoleId, 'Kernel Roles Panel: User removed role');
        await interaction.editReply({ content: `✅ **Role Removed:** ${role.name}` });
      } else {
        await member.roles.add(requestedRoleId, 'Kernel Roles Panel: Identity verified');
        await interaction.editReply({ content: `✅ **Identity Verified.** Role Granted: ${role.name}` });
      }
    } catch (err) {
      logger.error('Failed to grant role:', err);
      await interaction.editReply({ content: '❌ **ERROR:** Kernel failed to interface with Discord permissions.' });
    }
  }
}
