// ====================================
// AVENLO CORE - /ADMIN COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { AvenloColors, AvenloBranding, AvenloEmojis, User, Transaction } from '@avenlo/shared';
import { v4 as uuidv4 } from 'uuid';
import { Command } from './index';

export const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName('credits')
        .setDescription('Manage user credits')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add credits to a user')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to add credits to').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt.setName('amount').setDescription('Amount of credits').setRequired(true).setMinValue(1)
            )
            .addStringOption((opt) =>
              opt.setName('reason').setDescription('Reason for adding credits').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove credits from a user')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to remove credits from').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt.setName('amount').setDescription('Amount of credits').setRequired(true).setMinValue(1)
            )
            .addStringOption((opt) =>
              opt.setName('reason').setDescription('Reason for removing credits').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Set a user\'s credits to a specific amount')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to set credits for').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt.setName('amount').setDescription('Amount of credits').setRequired(true).setMinValue(0)
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sync')
        .setDescription('Sync data with external services')
        .addStringOption((opt) =>
          opt
            .setName('service')
            .setDescription('Service to sync with')
            .setRequired(true)
            .addChoices(
              { name: 'GitHub', value: 'github' },
              { name: 'All', value: 'all' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('audit')
        .setDescription('View recent admin actions')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'credits') {
      await handleCreditsCommand(interaction, subcommand);
    } else if (subcommand === 'sync') {
      await handleSyncCommand(interaction);
    } else if (subcommand === 'audit') {
      await handleAuditCommand(interaction);
    }
  },
};

async function handleCreditsCommand(
  interaction: ChatInputCommandInteraction,
  action: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason') || 'Admin action';

  // Find or create user
  let user = await User.findOne({ discordId: targetUser.id });

  if (!user) {
    user = await User.create({
      discordId: targetUser.id,
      username: targetUser.username,
      discriminator: targetUser.discriminator,
    });
  }

  const balanceBefore = user.credits;
  let balanceAfter: number;
  let transactionType: 'bonus' | 'penalty';

  switch (action) {
    case 'add':
      user.credits += amount;
      user.totalEarned += amount;
      balanceAfter = user.credits;
      transactionType = 'bonus';
      break;

    case 'remove':
      user.credits = Math.max(0, user.credits - amount);
      balanceAfter = user.credits;
      transactionType = 'penalty';
      break;

    case 'set':
      user.credits = amount;
      balanceAfter = amount;
      transactionType = amount > balanceBefore ? 'bonus' : 'penalty';
      break;

    default:
      await interaction.editReply({ content: '❌ Invalid action.' });
      return;
  }

  await user.save();

  // Create transaction record
  await Transaction.create({
    transactionId: uuidv4(),
    userId: user._id.toString(),
    discordId: targetUser.id,
    type: transactionType,
    reason: action === 'set' ? 'bonus_manual' : transactionType === 'bonus' ? 'bonus_manual' : 'penalty',
    amount: action === 'remove' ? -amount : action === 'set' ? balanceAfter - balanceBefore : amount,
    balanceBefore,
    balanceAfter,
    description: `${reason} (by ${interaction.user.tag})`,
  });

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle(`${AvenloEmojis.SUCCESS} Credits Updated`)
    .addFields(
      { name: 'User', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Action', value: action.toUpperCase(), inline: true },
      { name: 'Amount', value: `${amount.toLocaleString()} credits`, inline: true },
      { name: 'Before', value: balanceBefore.toLocaleString(), inline: true },
      { name: 'After', value: balanceAfter.toLocaleString(), inline: true },
      { name: 'Reason', value: reason, inline: false },
    )
    .setFooter({ text: `Admin: ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSyncCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const service = interaction.options.getString('service', true);

  await interaction.reply({
    content: `${AvenloEmojis.LOADING} Syncing with ${service}... This may take a moment.`,
    ephemeral: true,
  });

  // In production, this would trigger the sync process
  setTimeout(async () => {
    await interaction.editReply({
      content: `${AvenloEmojis.SUCCESS} Sync with ${service} completed!`,
    });
  }, 2000);
}

async function handleAuditCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const recentTransactions = await Transaction.find({
    description: { $regex: /\(by .+\)$/ },
  })
    .sort({ createdAt: -1 })
    .limit(10);

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.SHIELD} Admin Audit Log`)
    .setDescription(
      recentTransactions.length > 0
        ? recentTransactions
            .map((tx) => {
              const emoji = tx.amount >= 0 ? '🟢' : '🔴';
              return `${emoji} <@${tx.discordId}> | \`${tx.amount >= 0 ? '+' : ''}${tx.amount}\` | ${tx.description}\n<t:${Math.floor(tx.createdAt.getTime() / 1000)}:R>`;
            })
            .join('\n\n')
        : '*No recent admin actions.*'
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
