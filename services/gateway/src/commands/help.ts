// ====================================
// AVENLO CORE - /HELP COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { AvenloColors, AvenloBranding } from '@avenlo/shared';
import { Command } from './index';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands and how to use them') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.CYAN)
      .setAuthor({
        name: 'A V E N L O  S T U D I O  —  S Y S T E M  M A N U A L',
        iconURL: AvenloBranding.iconUrl,
      })
      .setTitle(`Command Center Directive`)
      .setDescription(
        `> Welcome to the **Avenlo Core** command center.\n` +
        `> Use the menu below to explore each module.\n\n` +
        `**COMMAND MODULES**`
      )
      .addFields(
        {
          name: `🚀 Project Suite`,
          value: 
            `> \`/project start\` — Start a new project\n` +
            `> \`/project status\` — Check project status\n` +
            `> \`/project list\` — View all projects`,
          inline: false,
        },
        {
          name: `💰 Vault & Economy`,
          value: 
            `> \`/vault balance\` — Check your credits\n` +
            `> \`/vault history\` — Transaction history\n` +
            `> \`/vault exchange\` — Redeem perks`,
          inline: false,
        },
        {
          name: `📊 Analytics`,
          value: 
            `> \`/dashboard view\` — Project dashboard\n` +
            `> \`/leaderboard\` — Top contributors\n` +
            `> \`/profile\` — View user profile`,
          inline: false,
        },
        {
          name: `🎫 Support`,
          value: 
            `> \`/ticket create\` — Open a ticket\n` +
            `> \`/ticket list\` — Your open tickets\n` +
            `> \`/ticket claim\` — Claim a ticket (staff)`,
          inline: false,
        },
        {
          name: `🛡️ Moderation`,
          value: 
            `> \`/mod user warn|mute|kick|ban\` — User actions\n` +
            `> \`/mod channel lock|purge|slowmode\` — Channel control\n` +
            `> \`/mod ai analyze\` — AI content analysis\n` +
            `> \`/mod tactical thermal|shadow\` — Behavioral forensics\n` +
            `> \`/mod strategic lockdown|sieve|policy\` — Defense systems`,
          inline: false,
        },
        {
          name: `👑 Sovereign`,
          value: 
            `> \`/sovereign pivot\` — Shift server culture\n` +
            `> \`/sovereign nuke\` — Emergency shutdown\n` +
            `> \`/sovereign rehabilitate\` — Grant legacy trust`,
          inline: false,
        },
        {
          name: `⚙️ Administration`,
          value: 
            `> \`/admin credits\` — Manage user credits\n` +
            `> \`/admin security\` — DEFCON & threat profiles\n` +
            `> \`/admin audit\` — Recent admin actions\n` +
            `> \`/rules publish\` — Deploy server rules\n` +
            `> \`/verify setup\` — Setup verification`,
          inline: false,
        }
      )
      .setFooter({ 
        text: `Avenlo Core • Command Reference`,
        iconURL: AvenloBranding.iconUrl,
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category for more details...')
      .addOptions([
        {
          label: 'Getting Started',
          description: 'New here? Start here!',
          value: 'getting_started',
          emoji: '✨',
        },
        {
          label: 'Projects',
          description: 'Project management commands',
          value: 'projects',
          emoji: '🚀',
        },
        {
          label: 'Economy & Vault',
          description: 'Credits, tiers, and perks',
          value: 'economy',
          emoji: '💰',
        },
        {
          label: 'Support & Tickets',
          description: 'Create and manage support tickets',
          value: 'tickets',
          emoji: '🎫',
        },
        {
          label: 'Moderation',
          description: 'User, channel, and AI moderation tools',
          value: 'moderation',
          emoji: '🛡️',
        },
        {
          label: 'Administration',
          description: 'Admin, sovereign, and security commands',
          value: 'administration',
          emoji: '⚙️',
        },
      ]);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [selectRow],
      ephemeral: true,
    });
  },
};
