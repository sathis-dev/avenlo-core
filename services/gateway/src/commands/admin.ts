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
    .setDescription('Server administration — credits, security, and sync')
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
              { name: 'Rules', value: 'rules' },
              { name: 'Identity (Roles)', value: 'identity' },
              { name: 'All', value: 'all' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('audit')
        .setDescription('View recent admin actions')
    )
    .addSubcommandGroup((group) =>
      group
        .setName('security')
        .setDescription('Kernel Security Management')
        .addSubcommand((sub) =>
          sub
            .setName('status')
            .setDescription('View current DEFCON level and security health')
        )
        .addSubcommand((sub) =>
          sub
            .setName('defcon')
            .setDescription('Manually set DEFCON level')
            .addIntegerOption((opt) =>
              opt
                .setName('level')
                .setDescription('Level 1-5 (1=Critical, 5=Normal)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)
            )
            .addStringOption((opt) =>
              opt
                .setName('reason')
                .setDescription('Reason for posture change')
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('threat')
            .setDescription('View user threat profile')
            .addUserOption((opt) =>
              opt
                .setName('user')
                .setDescription('User to inspect')
                .setRequired(true)
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('roles_panel')
        .setDescription('Deploy a Kernel-Level Biometric Roles Panel')
        .addRoleOption((opt) => opt.setName('role_1').setDescription('First role option').setRequired(true))
        .addRoleOption((opt) => opt.setName('role_2').setDescription('Second role option (optional)').setRequired(false))
        .addRoleOption((opt) => opt.setName('role_3').setDescription('Third role option (optional)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('roles_manage')
        .setDescription('Open the AI Role Management Dashboard')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'credits') {
      await handleCreditsCommand(interaction, subcommand);
    } else if (subcommandGroup === 'security') {
      await handleSecurityCommand(interaction, subcommand);
    } else if (subcommand === 'sync') {
      await handleSyncCommand(interaction);
    } else if (subcommand === 'audit') {
      await handleAuditCommand(interaction);
    } else if (subcommand === 'roles_panel') {
      await handleRolesPanelCommand(interaction);
    } else if (subcommand === 'roles_manage') {
      await handleRolesManageCommand(interaction);
    }
  },
};

async function handleSecurityCommand(interaction: ChatInputCommandInteraction, subcommand: string): Promise<void> {
  const { DefconController } = await import('../kernel/DefconController');
  const { ThreatMatrix } = await import('../kernel/ThreatMatrix');

  const defconController = DefconController.getInstance();
  const threatMatrix = ThreatMatrix.getInstance();

  if (subcommand === 'status') {
    const status = await defconController.getDefconLevel(interaction.guildId!);
    
    let color: number = AvenloColors.GREEN;
    if (status.level === 4) color = AvenloColors.YELLOW;
    if (status.level === 3) color = 0xF59E0B;
    if (status.level === 2) color = 0xEF4444;
    if (status.level === 1) color = 0x000000;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🛡️ SECURITY KERNEL STATUS`)
      .setDescription(`**Current Posture:** DEFCON ${status.level}\n**Reason:** ${status.reason}`)
      .addFields({ name: 'Last Updated', value: `<t:${Math.floor(status.updatedAt / 1000)}:R>` })
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (subcommand === 'defcon') {
    const level = interaction.options.getInteger('level', true);
    const reason = interaction.options.getString('reason', true);

    await defconController.setDefconLevel(interaction.guild, interaction.guildId!, level, reason);
    await interaction.reply({ content: `✅ Security posture updated to DEFCON ${level}.`, ephemeral: true });
  } else if (subcommand === 'threat') {
    const user = interaction.options.getUser('user', true);
    const profile = await threatMatrix.getProfile(user.id, interaction.guildId!);

    let color: number = AvenloColors.GREEN;
    if (profile.compositeScore > 50) color = AvenloColors.YELLOW;
    if (profile.compositeScore > 80) color = 0xEF4444;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Threat Profile: ${user.tag}`)
      .setDescription(`**Composite Score:** ${profile.compositeScore.toFixed(1)} / 100`)
      .addFields(
        { name: 'Toxicity', value: (profile.vectors['TOXICITY'] || 0).toFixed(1), inline: true },
        { name: 'Spam', value: (profile.vectors['SPAM'] || 0).toFixed(1), inline: true },
        { name: 'Phishing', value: (profile.vectors['PHISHING'] || 0).toFixed(1), inline: true }
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

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

  await interaction.deferReply({ ephemeral: true });

  if (service === 'rules' || service === 'all') {
    const { publishRulesToGuild } = await import('../handlers/RulesHandler');
    await publishRulesToGuild(interaction.guild!);
  }

  if (service === 'identity' || service === 'all') {
    const { IdentityHandler } = await import('../handlers/IdentityHandler');
    await IdentityHandler.deployIdentityPanel(interaction.channel as any);
  }

  await interaction.editReply({
    content: `${AvenloEmojis.SUCCESS} Sync with **${service}** completed.`,
  });
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

async function handleRolesPanelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const role1 = interaction.options.getRole('role_1', true);
  const role2 = interaction.options.getRole('role_2', false);
  const role3 = interaction.options.getRole('role_3', false);

  const roles = [role1, role2, role3].filter(Boolean);
  
  if (roles.length === 0) {
    await interaction.reply({ content: 'You must provide at least one role.', ephemeral: true });
    return;
  }

  // Create the interactive Dropdown (StringSelectMenu)
  const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = await import('discord.js');

  const select = new StringSelectMenuBuilder()
    .setCustomId('kernel_role_panel')
    .setPlaceholder('Select a role to request access...')
    .setMinValues(1)
    .setMaxValues(1);

  roles.forEach(r => {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(r!.name)
        .setDescription('Request access through the Security Kernel')
        .setValue(r!.id)
    );
  });

  const row = new ActionRowBuilder<any>().addComponents(select);

  const embed = new EmbedBuilder()
    .setColor(0x000000) // Pure black for "Kernel" aesthetic
    .setTitle('🌌 **KERNEL IDENTITY ACCESS**')
    .setDescription('Select a role below to request authorization.\n\n⚠️ **WARNING:** All requests are processed through the **ThreatMatrix**. Anomalous behavior or high threat scores will result in immediate denial.')
    .setFooter({ text: 'Avenlo Ultra Kernel Security', iconURL: 'https://i.imgur.com/8Qj82wU.png' }); // Some generic shield icon if none exists

  await interaction.reply({ content: 'Deploying panel...', ephemeral: true });
  await (interaction.channel as any).send({ embeds: [embed], components: [row] });
}

async function handleRolesManageCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const { buildRoleListEmbed } = await import('../handlers/RoleManager');

  await interaction.deferReply({ ephemeral: true });

  const embed = buildRoleListEmbed(interaction.guild!);

  const row = new ActionRowBuilder<any>().addComponents(
    new ButtonBuilder()
      .setCustomId('manage_roles_audit')
      .setLabel('Audit Hierarchy')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('manage_roles_ai')
      .setLabel('AI Suggestions')
      .setEmoji('🤖')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
