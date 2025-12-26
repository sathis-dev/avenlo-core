// ====================================
// AVENLO CORE - /PROFILE COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { AvenloColors, AvenloBranding, AvenloEmojis, createProgressBar, User } from '@avenlo/shared';
import { Command } from './index';

export const profileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your or another user\'s profile')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to view profile of')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Fetch or create user
    let user = await User.findOne({ discordId: targetUser.id });

    if (!user) {
      if (targetUser.id === interaction.user.id) {
        // Create profile for requester
        user = await User.create({
          discordId: targetUser.id,
          username: targetUser.username,
          discriminator: targetUser.discriminator,
          avatar: targetUser.avatarURL(),
        });
      } else {
        await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a profile yet.`,
        });
        return;
      }
    }

    // Calculate days since last activity
    const daysSinceActive = Math.floor(
      (Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate rank
    const rank = await User.countDocuments({ credits: { $gt: user.credits } }) + 1;

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(user.isStudioLead ? AvenloColors.GOLD : AvenloColors.CYAN)
      .setTitle(`${user.isStudioLead ? '👑' : AvenloEmojis.STAR} ${targetUser.displayName}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: `${AvenloEmojis.MONEY} Credits`,
          value: `\`\`\`${user.credits.toLocaleString()}\`\`\``,
          inline: true,
        },
        {
          name: `${AvenloEmojis.CHART} Rank`,
          value: `\`\`\`#${rank}\`\`\``,
          inline: true,
        },
        {
          name: `${AvenloEmojis.FIRE} Streak`,
          value: `\`\`\`${user.streak} days\`\`\``,
          inline: true,
        },
        {
          name: `${AvenloEmojis.CODE} Contributions`,
          value: [
            `🔀 Pull Requests: **${user.contributions.pullRequests}**`,
            `📝 Commits: **${user.contributions.commits}**`,
            `🐛 Issues: **${user.contributions.issues}**`,
            `👀 Reviews: **${user.contributions.reviews}**`,
            `🎫 Tickets: **${user.contributions.tickets}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: `${AvenloEmojis.CALENDAR} Activity`,
          value: [
            `Status: ${user.isActive ? '🟢 Active' : '⚪ Inactive'}`,
            `Last Active: <t:${Math.floor(user.lastActiveAt.getTime() / 1000)}:R>`,
            user.lastContributionAt 
              ? `Last Contribution: <t:${Math.floor(user.lastContributionAt.getTime() / 1000)}:R>`
              : '',
          ].filter(Boolean).join('\n'),
          inline: true,
        }
      );

    // GitHub link if available
    if (user.githubUsername) {
      embed.addFields({
        name: '🔗 GitHub',
        value: `[${user.githubUsername}](https://github.com/${user.githubUsername})`,
        inline: true,
      });
    }

    // Roles
    if (user.roles.length > 0) {
      embed.addFields({
        name: '🏷️ Roles',
        value: user.roles.map((r) => `<@&${r}>`).join(' '),
        inline: false,
      });
    }

    embed
      .setFooter({ text: `Member since ${user.createdAt.toLocaleDateString()} • ${AvenloBranding.footer}` })
      .setTimestamp();

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_contributions:${targetUser.id}`)
        .setLabel('Contribution History')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );

    if (targetUser.id === interaction.user.id) {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId('profile_edit')
          .setLabel('Edit Profile')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️')
      );
    }

    await interaction.editReply({
      embeds: [embed],
      components: [buttonRow],
    });
  },
};
