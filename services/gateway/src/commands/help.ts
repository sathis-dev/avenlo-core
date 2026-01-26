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
import { AvenloColors, AvenloBranding, AvenloEmojis } from '@avenlo/shared';
import { Command } from './index';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with Avenlo Core commands') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.CYAN)
      .setTitle(`${AvenloEmojis.SPARKLES} Avenlo Core Help`)
      .setDescription(
        `Welcome to **${AvenloBranding.name}**!\n\n` +
        `${AvenloBranding.tagline}\n\n` +
        `Use the menu below to explore our features.`
      )
      .addFields(
        {
          name: `${AvenloEmojis.ROCKET} Project Commands`,
          value: [
            '`/project start` - Start a new project with AI discovery',
            '`/project status` - Check your project status',
            '`/project list` - View all your projects',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${AvenloEmojis.MONEY} Economy Commands`,
          value: [
            '`/vault balance` - Check your credit balance',
            '`/vault history` - View transaction history',
            '`/vault exchange` - Exchange credits for perks',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${AvenloEmojis.CHART} Analytics Commands`,
          value: [
            '`/dashboard view` - View project dashboard',
            '`/leaderboard` - View contribution rankings',
            '`/profile` - View your or another user\'s profile',
          ].join('\n'),
          inline: false,
        },
        {
          name: `🎫 Support Commands`,
          value: [
            '`/ticket create` - Create a support ticket',
            '`/ticket list` - View your open tickets',
            '`/ticket claim` - Claim an open ticket (Dev)',
          ].join('\n'),
          inline: false,
        },
        {
          name: `🛡️ Moderation Commands`,
          value: [
            '`/mod user warn/mute/kick/ban` - User moderation',
            '`/mod channel lock/purge` - Channel control',
            '`/mod ai analyze` - AI content analysis',
          ].join('\n'),
          inline: false,
        },
        {
          name: `🎯 Tactical Commands`,
          value: [
            '`/thermal` - View 3D Heat Prism visualization',
            '`/shadow` - Pull 24h reputation sparkline',
            '`/forensic` - Open CSI logic sheet for event',
            '`/intercept` - Isolate user for deep AI auditing',
          ].join('\n'),
          inline: false,
        },
        {
          name: `⚡ Strategic Commands`,
          value: [
            '`/lockdown` - Activate raid protocols',
            '`/sieve patch` - Inject L1 filter patterns',
            '`/policy inject` - Add L2 AI heuristics',
          ].join('\n'),
          inline: false,
        },
        {
          name: `👑 Sovereign Commands`,
          value: [
            '`/avenlo pivot` - Shift global culture/vibe',
            '`/avenlo nuke` - Trigger Safe-State Zero',
            '`/avenlo rehabilitate` - Grant legacy trust',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${AvenloEmojis.GEAR} Admin Commands`,
          value: [
            '`/admin credits` - Manage user credits',
            '`/admin sync` - Sync with external services',
            '`/dashboard create` - Create a new dashboard',
            '`/rules` - Deploy server rules (Admin)',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category for more details...')
      .addOptions([
        {
          label: 'Projects',
          description: 'Learn about project management',
          value: 'projects',
          emoji: '🚀',
        },
        {
          label: 'Economy',
          description: 'Learn about the credit system',
          value: 'economy',
          emoji: '💰',
        },
        {
          label: 'Support & Tickets',
          description: 'Learn about the ticket system',
          value: 'tickets',
          emoji: '🎫',
        },
        {
          label: 'Moderation',
          description: 'Learn about moderation tools',
          value: 'moderation',
          emoji: '🛡️',
        },
        {
          label: 'Guardian AI',
          description: 'Tactical, Strategic & Sovereign commands',
          value: 'guardian',
          emoji: '🤖',
        },
        {
          label: 'Getting Started',
          description: 'New here? Start here!',
          value: 'getting_started',
          emoji: '✨',
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
