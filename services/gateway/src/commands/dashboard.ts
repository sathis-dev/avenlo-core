// ====================================
// AVENLO CORE - /DASHBOARD COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { 
  AvenloColors, 
  AvenloBranding, 
  AvenloEmojis, 
  createProgressBar,
  Dashboard,
  getStatusColor,
} from '@avenlo/shared';
import { Command } from './index';

export const dashboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View and manage live project dashboards')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View the current project dashboard')
        .addStringOption((opt) =>
          opt
            .setName('project')
            .setDescription('Project name or ID')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new dashboard for a repository')
        .addStringOption((opt) =>
          opt
            .setName('repository')
            .setDescription('GitHub repository (owner/repo)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('refresh')
        .setDescription('Force refresh the dashboard')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'view':
        await handleViewDashboard(interaction);
        break;
      case 'create':
        await handleCreateDashboard(interaction);
        break;
      case 'refresh':
        await handleRefreshDashboard(interaction);
        break;
    }
  },
};

async function handleViewDashboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const projectName = interaction.options.getString('project');

  // Find dashboard
  const query: Record<string, string> = { guildId: interaction.guildId! };
  if (projectName) {
    query['repository.name'] = projectName;
  }

  const dashboard = await Dashboard.findOne(query).sort({ lastUpdatedAt: -1 });

  if (!dashboard) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.YELLOW)
      .setTitle(`${AvenloEmojis.WARNING} No Dashboard Found`)
      .setDescription(
        'No active dashboard found for this server.\n\n' +
        'Use `/dashboard create` to set up a new dashboard for a repository.'
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Build dashboard embed
  const healthEmoji = {
    online: '🟢',
    degraded: '🟡',
    offline: '🔴',
    unknown: '⚪',
  }[dashboard.health.status];

  const buildEmoji = {
    success: '✅',
    failure: '❌',
    running: '🔄',
    pending: '⏳',
  }[dashboard.lastBuild.status];

  const embed = new EmbedBuilder()
    .setColor(getStatusColor(dashboard.health.status))
    .setTitle(`${AvenloEmojis.CHART} ${dashboard.repository.owner}/${dashboard.repository.name}`)
    .setURL(dashboard.repository.url)
    .setDescription(`**Live Development Dashboard**`)
    .addFields(
      {
        name: '📊 Progress',
        value: `${createProgressBar(dashboard.progress)} ${dashboard.progress}%`,
        inline: false,
      },
      {
        name: `${healthEmoji} System Health`,
        value: [
          `Status: **${dashboard.health.status.toUpperCase()}**`,
          `Latency: **${dashboard.health.latency}ms**`,
          `Uptime: **${(dashboard.health.uptime * 100).toFixed(2)}%**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: `${buildEmoji} Last Build`,
        value: [
          `Status: **${dashboard.lastBuild.status}**`,
          dashboard.lastBuild.duration ? `Duration: **${dashboard.lastBuild.duration}s**` : '',
          `<t:${Math.floor(dashboard.lastBuild.timestamp.getTime() / 1000)}:R>`,
        ].filter(Boolean).join('\n'),
        inline: true,
      },
      {
        name: '📈 Statistics',
        value: [
          `Commits: **${dashboard.totalCommits}**`,
          `PRs: **${dashboard.totalPRs}** (${dashboard.openPRs} open)`,
          `Issues: **${dashboard.openIssues}** open`,
        ].join('\n'),
        inline: true,
      }
    );

  // Add active devs
  if (dashboard.activeDevs.length > 0) {
    embed.addFields({
      name: `${AvenloEmojis.CODE} Active Developers`,
      value: dashboard.activeDevs
        .slice(0, 5)
        .map((dev) => `<@${dev.discordId}> (${dev.commitCount} commits)`)
        .join('\n'),
      inline: false,
    });
  }

  // Add recent commits
  if (dashboard.recentCommits.length > 0) {
    embed.addFields({
      name: '📝 Recent Commits',
      value: dashboard.recentCommits
        .slice(0, 3)
        .map((c) => `[\`${c.sha.slice(0, 7)}\`](${c.url}) ${c.message.slice(0, 50)}...`)
        .join('\n'),
      inline: false,
    });
  }

  embed
    .setFooter({ text: `Last updated • ${AvenloBranding.footer}` })
    .setTimestamp(dashboard.lastUpdatedAt);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dashboard_refresh')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setLabel('View on GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL(dashboard.repository.url)
      .setEmoji('🔗')
  );

  await interaction.editReply({
    embeds: [embed],
    components: [buttonRow],
  });
}

async function handleCreateDashboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const repository = interaction.options.getString('repository', true);
  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    await interaction.editReply({
      content: '❌ Invalid repository format. Please use `owner/repo` format.',
    });
    return;
  }

  // Check if dashboard already exists
  const existing = await Dashboard.findOne({
    guildId: interaction.guildId,
    'repository.owner': owner,
    'repository.name': repo,
  });

  if (existing) {
    await interaction.editReply({
      content: `❌ A dashboard for **${repository}** already exists in this server.`,
    });
    return;
  }

  // Create placeholder message in channel
  const channelId = process.env.CHANNEL_ACTIVE_PROJECTS || interaction.channelId;
  const channel = await interaction.client.channels.fetch(channelId);

  if (!channel?.isTextBased()) {
    await interaction.editReply({
      content: '❌ Could not find the projects channel.',
    });
    return;
  }

  const placeholderEmbed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.LOADING} Setting up dashboard...`)
    .setDescription(`Initializing dashboard for **${repository}**`)
    .setFooter({ text: AvenloBranding.footer });

  const message = await (channel as any).send({ embeds: [placeholderEmbed] });

  // Create dashboard in database
  const dashboard = await Dashboard.create({
    guildId: interaction.guildId,
    channelId: channelId,
    messageId: message.id,
    repository: {
      url: `https://github.com/${owner}/${repo}`,
      owner,
      name: repo,
      branch: 'main',
    },
  });

  await interaction.editReply({
    content: `✅ Dashboard created for **${repository}**!\n\nThe Pulse service will automatically update this dashboard when code is pushed.`,
  });
}

async function handleRefreshDashboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: `${AvenloEmojis.LOADING} Refreshing dashboard... This may take a moment.`,
    ephemeral: true,
  });

  // In production, this would emit an event to the Pulse service
  // to trigger a refresh
}
