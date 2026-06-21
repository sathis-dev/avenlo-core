// ====================================
// AVENLO CORE - /VAULT COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { 
  AvenloColors, 
  AvenloBranding, 
  AvenloEmojis, 
  createProgressBar,
  User,
  Transaction,
} from '@avenlo/shared';
import { Command } from './index';

export const vaultCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Check your credits, view history, and redeem perks')
    .addSubcommand((sub) =>
      sub
        .setName('balance')
        .setDescription('Check your current credit balance')
    )
    .addSubcommand((sub) =>
      sub
        .setName('history')
        .setDescription('View your transaction history')
    )
    .addSubcommand((sub) =>
      sub
        .setName('exchange')
        .setDescription('Exchange credits for studio perks')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'balance':
        await handleBalance(interaction);
        break;
      case 'history':
        await handleHistory(interaction);
        break;
      case 'exchange':
        await handleExchange(interaction);
        break;
    }
  },
};

async function handleBalance(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Fetch or create user
  let user = await User.findOne({ discordId: interaction.user.id });
  
  if (!user) {
    user = await User.create({
      discordId: interaction.user.id,
      username: interaction.user.username,
      discriminator: interaction.user.discriminator,
      avatar: interaction.user.avatarURL(),
    });
  }

  // Calculate rank (simplified)
  const rank = await User.countDocuments({ credits: { $gt: user.credits } }) + 1;
  const totalUsers = await User.countDocuments();

  // Progress to next tier
  const tiers = [
    { name: 'Bronze', min: 0, max: 100 },
    { name: 'Silver', min: 100, max: 500 },
    { name: 'Gold', min: 500, max: 1000 },
    { name: 'Platinum', min: 1000, max: 5000 },
    { name: 'Diamond', min: 5000, max: Infinity },
  ];

  const currentTier = tiers.find(t => user!.credits >= t.min && user!.credits < t.max) || tiers[0];
  const nextTier = tiers[tiers.indexOf(currentTier) + 1];
  const tierProgress = nextTier 
    ? Math.min(100, ((user.credits - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.GOLD)
    .setTitle(`${AvenloEmojis.MONEY} Your Vault`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`Welcome back, **${interaction.user.displayName}**!`)
    .addFields(
      {
        name: `${AvenloEmojis.STAR} Credit Balance`,
        value: `\`\`\`${user.credits.toLocaleString()} Credits\`\`\``,
        inline: true,
      },
      {
        name: `${AvenloEmojis.CHART} Ranking`,
        value: `\`\`\`#${rank} of ${totalUsers}\`\`\``,
        inline: true,
      },
      {
        name: `${AvenloEmojis.FIRE} Current Tier`,
        value: `\`\`\`${currentTier.name}\`\`\``,
        inline: true,
      },
      {
        name: `📈 Tier Progress`,
        value: nextTier 
          ? `${createProgressBar(tierProgress)} ${tierProgress.toFixed(0)}%\n*${nextTier.min - user.credits} credits to ${nextTier.name}*`
          : `${createProgressBar(100)} MAX TIER!`,
        inline: false,
      },
      {
        name: '📊 Lifetime Stats',
        value: [
          `${AvenloEmojis.SUCCESS} Total Earned: **${user.totalEarned.toLocaleString()}** credits`,
          `${AvenloEmojis.FIRE} Total Spent: **${user.totalSpent.toLocaleString()}** credits`,
          `${AvenloEmojis.CODE} Contributions: **${user.contributions.pullRequests + user.contributions.commits}**`,
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vault_exchange')
      .setLabel('Exchange Credits')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('vault_history')
      .setLabel('View History')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📜')
  );

  await interaction.editReply({
    embeds: [embed],
    components: [buttonRow],
  });
}

async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const transactions = await Transaction.find({ discordId: interaction.user.id })
    .sort({ createdAt: -1 })
    .limit(10);

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.CLOCK} Transaction History`)
    .setDescription(
      transactions.length > 0
        ? transactions.map((tx, i) => {
            const emoji = tx.type === 'earn' || tx.type === 'bonus' ? '🟢' : '🔴';
            const sign = tx.amount >= 0 ? '+' : '';
            return `${emoji} \`${sign}${tx.amount}\` - ${tx.description}\n<t:${Math.floor(tx.createdAt.getTime() / 1000)}:R>`;
          }).join('\n\n')
        : '*No transactions yet. Start contributing to earn credits!*'
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleExchange(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.GOLD)
    .setTitle(`${AvenloEmojis.SPARKLES} Credit Exchange`)
    .setDescription(
      'Exchange your hard-earned credits for exclusive studio perks!\n\n' +
      '**Available Perks:**'
    )
    .addFields(
      {
        name: '🎨 Custom Role Color',
        value: '`500 Credits` - Choose a custom color for your role',
        inline: false,
      },
      {
        name: '⭐ Priority Support',
        value: '`1,000 Credits` - Get priority access to dev support',
        inline: false,
      },
      {
        name: '🏆 Project Bonus',
        value: '`2,500 Credits` - 10% bonus on next project payment',
        inline: false,
      },
      {
        name: '👑 Studio Lead Nomination',
        value: '`5,000 Credits` - Be nominated for Studio Lead role',
        inline: false,
      }
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('exchange_perk')
    .setPlaceholder('Select a perk to exchange...')
    .addOptions([
      { label: 'Custom Role Color', value: 'custom_color', emoji: '🎨' },
      { label: 'Priority Support', value: 'priority_support', emoji: '⭐' },
      { label: 'Project Bonus', value: 'project_bonus', emoji: '🏆' },
      { label: 'Studio Lead Nomination', value: 'studio_lead', emoji: '👑' },
    ]);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [selectRow],
    ephemeral: true,
  });
}
