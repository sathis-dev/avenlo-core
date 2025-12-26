// ====================================
// AVENLO CORE - /LEADERBOARD COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { AvenloColors, AvenloBranding, AvenloEmojis, User } from '@avenlo/shared';
import { Command } from './index';

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the contribution leaderboard')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Type of leaderboard to view')
        .setRequired(false)
        .addChoices(
          { name: 'Credits', value: 'credits' },
          { name: 'Contributions', value: 'contributions' },
          { name: 'Weekly', value: 'weekly' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const type = interaction.options.getString('type') || 'credits';

    let users;
    let title: string;
    let valueGetter: (user: any) => string;

    switch (type) {
      case 'contributions':
        users = await User.find()
          .sort({ 'contributions.pullRequests': -1 })
          .limit(10);
        title = `${AvenloEmojis.CODE} Contribution Leaderboard`;
        valueGetter = (u) => `${u.contributions.pullRequests} PRs • ${u.contributions.commits} commits`;
        break;
      
      case 'weekly':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        users = await User.find({ lastContributionAt: { $gte: weekAgo } })
          .sort({ credits: -1 })
          .limit(10);
        title = `${AvenloEmojis.FIRE} Weekly Top Contributors`;
        valueGetter = (u) => `${u.credits} credits`;
        break;

      case 'credits':
      default:
        users = await User.find()
          .sort({ credits: -1 })
          .limit(10);
        title = `${AvenloEmojis.MONEY} Credit Leaderboard`;
        valueGetter = (u) => `${u.credits.toLocaleString()} credits`;
        break;
    }

    const medals = ['🥇', '🥈', '🥉'];

    const leaderboardText = users.length > 0
      ? users.map((user, index) => {
          const medal = medals[index] || `**${index + 1}.**`;
          const isActive = user.isActive ? '🟢' : '⚪';
          return `${medal} ${isActive} <@${user.discordId}>\n   └ ${valueGetter(user)}`;
        }).join('\n\n')
      : '*No contributors yet. Be the first to contribute!*';

    const embed = new EmbedBuilder()
      .setColor(AvenloColors.GOLD)
      .setTitle(title)
      .setDescription(leaderboardText)
      .setFooter({ text: `${AvenloBranding.footer} • Updated` })
      .setTimestamp();

    // Find requester's rank
    const requesterUser = await User.findOne({ discordId: interaction.user.id });
    if (requesterUser) {
      const rank = await User.countDocuments({ credits: { $gt: requesterUser.credits } }) + 1;
      embed.addFields({
        name: '📍 Your Position',
        value: `**#${rank}** with **${requesterUser.credits.toLocaleString()}** credits`,
        inline: false,
      });
    }

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('leaderboard_credits')
        .setLabel('Credits')
        .setStyle(type === 'credits' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId('leaderboard_contributions')
        .setLabel('Contributions')
        .setStyle(type === 'contributions' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('💻'),
      new ButtonBuilder()
        .setCustomId('leaderboard_weekly')
        .setLabel('Weekly')
        .setStyle(type === 'weekly' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('🔥')
    );

    await interaction.editReply({
      embeds: [embed],
      components: [buttonRow],
    });
  },
};
