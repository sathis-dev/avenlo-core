// ====================================
// AVENLO CORE - /PROJECT COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { AvenloColors, AvenloBranding, AvenloEmojis, getRedisClient, EventTypes } from '@avenlo/shared';
import { Command } from './index';

export const projectCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('project')
    .setDescription('Project management commands')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a new project with AI-powered discovery')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Check the status of your current project')
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all your projects')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start':
        await handleStartProject(interaction);
        break;
      case 'status':
        await handleProjectStatus(interaction);
        break;
      case 'list':
        await handleListProjects(interaction);
        break;
    }
  },
};

async function handleStartProject(interaction: ChatInputCommandInteraction): Promise<void> {
  // Create welcome embed
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.ROCKET} Start Your Project`)
    .setDescription(
      `Welcome to **${AvenloBranding.name}**!\n\n` +
      `Our AI Discovery Agent will guide you through a smart interview process to understand your project requirements.\n\n` +
      `**What to expect:**\n` +
      `${AvenloEmojis.CHECK} Private thread for your interview\n` +
      `${AvenloEmojis.CHECK} AI-powered requirement analysis\n` +
      `${AvenloEmojis.CHECK} Automated project brief generation\n` +
      `${AvenloEmojis.CHECK} Complexity scoring & time estimates`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  // Project type selection
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('project_type')
    .setPlaceholder('What type of project are you looking for?')
    .addOptions([
      {
        label: 'Web Application',
        description: 'React, Next.js, Vue, Angular applications',
        value: 'web_app',
        emoji: '🌐',
      },
      {
        label: 'Mobile Application',
        description: 'iOS, Android, React Native, Flutter',
        value: 'mobile_app',
        emoji: '📱',
      },
      {
        label: 'Discord Bot',
        description: 'Custom Discord bots and integrations',
        value: 'discord_bot',
        emoji: '🤖',
      },
      {
        label: 'API / Backend',
        description: 'REST APIs, GraphQL, microservices',
        value: 'api_backend',
        emoji: '⚡',
      },
      {
        label: 'Full Stack Solution',
        description: 'Complete end-to-end development',
        value: 'full_stack',
        emoji: '🏗️',
      },
      {
        label: 'Other',
        description: 'Something else entirely',
        value: 'other',
        emoji: '✨',
      },
    ]);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Action buttons
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('start_project')
      .setLabel('Start Discovery Interview')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId('view_portfolio')
      .setLabel('View Our Portfolio')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📁'),
    new ButtonBuilder()
      .setLabel('Visit Website')
      .setStyle(ButtonStyle.Link)
      .setURL(AvenloBranding.website)
      .setEmoji('🔗')
  );

  await interaction.reply({
    embeds: [embed],
    components: [selectRow, buttonRow],
    ephemeral: true,
  });
}

async function handleProjectStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  // This would normally fetch from database
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.CHART} Project Status`)
    .setDescription('You don\'t have any active projects at the moment.')
    .addFields(
      {
        name: 'Start a New Project',
        value: 'Use `/project start` to begin a new project discovery.',
        inline: false,
      }
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleListProjects(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.FOLDER} Your Projects`)
    .setDescription('Here are all your projects with Avenlo Studio.')
    .addFields(
      {
        name: '📋 No Projects Yet',
        value: 'You haven\'t started any projects yet.\nUse `/project start` to begin!',
        inline: false,
      }
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
