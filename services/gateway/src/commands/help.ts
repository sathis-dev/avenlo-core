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
      .setAuthor({
        name: 'A V E N L O  S T U D I O  —  S Y S T E M  M A N U A L',
        iconURL: AvenloBranding.iconUrl,
      })
      .setTitle(`Command Center Directive`)
      .setDescription(
        `> Welcome to the **Avenlo Core OS** command lattice.\n` +
        `> Use the interactive matrix below to filter sub-systems.\n\n` +
        `**<:dot_cyan:1234567890> COMMAND MODULES**`
      )
      .addFields(
        {
          name: `🚀 Project Suite`,
          value: 
            `> \`/project start\` — Initialize AI discovery\n` +
            `> \`/project status\` — Active telemetry\n` +
            `> \`/project list\` — Project archive`,
          inline: false,
        },
        {
          name: `💰 Vault & Economy`,
          value: 
            `> \`/vault balance\` — Credit ledger\n` +
            `> \`/vault history\` — Transaction log\n` +
            `> \`/vault exchange\` — Credit exchange`,
          inline: false,
        },
        {
          name: `📊 Analytics Core`,
          value: 
            `> \`/dashboard view\` — Launch Web UI\n` +
            `> \`/leaderboard\` — Top contributors\n` +
            `> \`/profile\` — User dossier`,
          inline: false,
        },
        {
          name: `🎫 Support Matrix`,
          value: 
            `> \`/ticket create\` — Open secure line\n` +
            `> \`/ticket list\` — Active tickets\n` +
            `> \`/ticket claim\` — Staff assignment`,
          inline: false,
        },
        {
          name: `🛡️ Guardian Pipeline`,
          value: 
            `> \`/mod user\` — Standard infraction\n` +
            `> \`/mod channel\` — Channel lockdown\n` +
            `> \`/mod ai analyze\` — Deep packet inspection`,
          inline: false,
        },
        {
          name: `🎯 Tactical Layer`,
          value: 
            `> \`/tactical thermal\` — 3D Heat Prism\n` +
            `> \`/tactical shadow\` — Identity Sparkline\n` +
            `> \`/tactical forensic\` — CSI Logic Sheet\n` +
            `> \`/tactical intercept\` — Target Isolation`,
          inline: false,
        },
        {
          name: `⚡ Strategic Layer`,
          value: 
            `> \`/strategic lockdown\` — Raid Protocols\n` +
            `> \`/strategic sieve patch\` — L1 Injection\n` +
            `> \`/strategic policy inject\` — L2 Heuristics`,
          inline: false,
        },
        {
          name: `👑 Sovereign Layer`,
          value: 
            `> \`/avenlo pivot\` — Culture Shift\n` +
            `> \`/avenlo nuke\` — Safe-State Zero\n` +
            `> \`/avenlo rehabilitate\` — Legacy Trust`,
          inline: false,
        },
        {
          name: `⚙️ Administration`,
          value: 
            `> \`/admin credits\` — Credit override\n` +
            `> \`/admin sync\` — Force state sync\n` +
            `> \`/dashboard create\` — New instance\n` +
            `> \`/rules\` — Deploy governance`,
          inline: false,
        }
      )
      .setFooter({ 
        text: `AVENLO CORE OS • End-to-End Encrypted Manual`,
        iconURL: AvenloBranding.iconUrl,
      })
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
