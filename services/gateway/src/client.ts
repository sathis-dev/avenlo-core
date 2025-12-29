// ====================================
// AVENLO CORE - DISCORD CLIENT
// ====================================

import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  REST,
  Routes,
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  TextChannel,
  Message,
  GuildMember,
  PartialGuildMember,
  GuildBan,
  Role,
  GuildChannel,
  DMChannel,
  NonThreadGuildBasedChannel,
} from 'discord.js';
import { createLogger, getRedisClient, EventTypes } from '@avenlo/shared';
import { loadCommands, Command } from './commands';
import { loadEvents } from './events';
import { TicketHandlers } from './handlers/TicketHandler';
import { AIModerationHandlers } from './handlers/AIModeration';
import { WelcomeHandlers } from './handlers/WelcomeHandler';
import { ServerProtection } from './handlers/ServerProtection';
import { handleRulesButton } from './commands/rules';

const logger = createLogger('gateway-client');

export class GatewayClient extends Client {
  public commands: Collection<string, Command> = new Collection();
  private restClient: REST;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildModeration,
      ],
    });

    this.restClient = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Ready event
    this.once(Events.ClientReady, async (readyClient) => {
      logger.info(`✅ Logged in as ${readyClient.user.tag}`);
      logger.info(`🛡️ AI Moderation: ACTIVE`);
      logger.info(`👋 Welcome System: ACTIVE`);
      logger.info(`🔒 Server Protection: ACTIVE`);
      
      // Publish ready event to Redis
      const redis = getRedisClient();
      await redis.publish(EventTypes.GATEWAY_READY, {
        source: 'gateway',
        payload: {
          userId: readyClient.user.id,
          username: readyClient.user.tag,
          guildCount: readyClient.guilds.cache.size,
        },
      });
    });

    // ====================================
    // MESSAGE HANDLER (AI MODERATION)
    // ====================================
    this.on(Events.MessageCreate, async (message: Message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        logger.error('Message handler error:', error);
      }
    });

    // ====================================
    // MEMBER JOIN (WELCOME + RAID DETECTION)
    // ====================================
    this.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      try {
        await this.handleMemberJoin(member);
      } catch (error) {
        logger.error('Member join handler error:', error);
      }
    });

    // ====================================
    // MEMBER LEAVE (GOODBYE)
    // ====================================
    this.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
      try {
        await this.handleMemberLeave(member);
      } catch (error) {
        logger.error('Member leave handler error:', error);
      }
    });

    // ====================================
    // ANTI-NUKE PROTECTION
    // ====================================
    this.on(Events.ChannelDelete, async (channel: DMChannel | NonThreadGuildBasedChannel) => {
      try {
        if (!('guild' in channel) || !channel.guild) return;
        // Get executor from audit log
        const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 }); // CHANNEL_DELETE
        const entry = auditLogs.entries.first();
        const executor = entry?.executor ? await this.users.fetch(entry.executor.id) : null;
        await ServerProtection.handleChannelDelete(channel as GuildChannel, executor);
      } catch (error) {
        logger.error('Channel delete handler error:', error);
      }
    });

    this.on(Events.GuildRoleDelete, async (role: Role) => {
      try {
        // Get executor from audit log
        const auditLogs = await role.guild.fetchAuditLogs({ limit: 1, type: 32 }); // ROLE_DELETE
        const entry = auditLogs.entries.first();
        const executor = entry?.executor ? await this.users.fetch(entry.executor.id) : null;
        await ServerProtection.handleRoleDelete(role, executor);
      } catch (error) {
        logger.error('Role delete handler error:', error);
      }
    });

    this.on(Events.GuildBanAdd, async (ban: GuildBan) => {
      try {
        // Get executor from audit log
        const auditLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: 22 }); // MEMBER_BAN_ADD
        const entry = auditLogs.entries.first();
        const executor = entry?.executor ? await this.users.fetch(entry.executor.id) : null;
        await ServerProtection.handleMassBan(ban.guild, executor);
      } catch (error) {
        logger.error('Ban handler error:', error);
      }
    });

    // Interaction handler
    this.on(Events.InteractionCreate, async (interaction) => {
      try {
        await this.handleInteraction(interaction);
      } catch (error) {
        logger.error('Interaction error:', error);
        
        if (interaction.isRepliable()) {
          const reply = {
            content: '❌ An error occurred while processing your request.',
            ephemeral: true,
          };
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      }
    });

    // Error handling
    this.on(Events.Error, (error) => {
      logger.error('Discord client error:', error);
    });

    this.on(Events.Warn, (message) => {
      logger.warn('Discord warning:', message);
    });
  }

  // ====================================
  // MESSAGE HANDLER (AI MODERATION)
  // ====================================
  private async handleMessage(message: Message): Promise<void> {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    
    // Run AI moderation
    await AIModerationHandlers.handleMessage(message);
  }

  // ====================================
  // MEMBER JOIN HANDLER
  // ====================================
  private async handleMemberJoin(member: GuildMember): Promise<void> {
    const guild = member.guild;
    
    // Check for raid
    const raidCheck = ServerProtection.trackJoin(member);
    if (raidCheck.isRaid) {
      logger.warn(`⚠️ RAID DETECTED in ${guild.name}! Handling...`);
      const logChannel = guild.channels.cache.find(
        ch => ch.name.includes('mod-log') && ch.isTextBased()
      ) as TextChannel | undefined;
      await ServerProtection.handlePotentialRaid(guild, logChannel);
      return;
    }
    
    // Get welcome channel (look for channels named "welcome", "general", or use system channel)
    const welcomeChannel = guild.channels.cache.find(
      ch => ch.name.includes('welcome') && ch.isTextBased()
    ) || guild.channels.cache.find(
      ch => ch.name.includes('general') && ch.isTextBased()
    ) || guild.systemChannel;
    
    if (welcomeChannel && welcomeChannel.isTextBased()) {
      // Build and send welcome message
      const embed = WelcomeHandlers.buildWelcomeEmbed(member);
      const row = WelcomeHandlers.buildWelcomeButtons();
      await (welcomeChannel as TextChannel).send({
        content: `${member}`,
        embeds: [embed],
        components: [row],
      });
    }
    
    // Send DM welcome
    await WelcomeHandlers.sendWelcomeDM(member);
    
    // Assign auto-roles
    await WelcomeHandlers.assignAutoRoles(member);
    
    logger.info(`👋 Welcomed ${member.user.tag} to ${guild.name}`);
  }

  // ====================================
  // MEMBER LEAVE HANDLER
  // ====================================
  private async handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    const guild = member.guild;
    
    // Get goodbye channel
    const goodbyeChannel = guild.channels.cache.find(
      ch => ch.name.includes('welcome') && ch.isTextBased()
    ) || guild.channels.cache.find(
      ch => ch.name.includes('general') && ch.isTextBased()
    ) || guild.systemChannel;
    
    if (goodbyeChannel && goodbyeChannel.isTextBased()) {
      const embed = await WelcomeHandlers.buildGoodbyeEmbed(member);
      await (goodbyeChannel as TextChannel).send({ embeds: [embed] });
    }
    
    logger.info(`👋 ${member.user?.tag || 'Unknown'} left ${guild.name}`);
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      await this.handleCommand(interaction);
      return;
    }

    // Button Interactions
    if (interaction.isButton()) {
      await this.handleButton(interaction);
      return;
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      await this.handleModal(interaction);
      return;
    }

    // Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      await this.handleSelectMenu(interaction);
      return;
    }

    // User Select Menu Interactions
    if (interaction.isUserSelectMenu()) {
      await this.handleUserSelectMenu(interaction);
      return;
    }
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      await interaction.reply({
        content: '❌ Unknown command.',
        ephemeral: true,
      });
      return;
    }

    // Update user session activity
    const redis = getRedisClient();
    await redis.updateSession(interaction.user.id, {
      lastCommand: interaction.commandName,
      lastCommandAt: new Date().toISOString(),
    });

    await command.execute(interaction);
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [action, subAction, ...params] = interaction.customId.split(':');

    // Route to appropriate handler based on action prefix
    const redis = getRedisClient();

    // Emit event for other services
    await redis.publish(EventTypes.SYSTEM_METRICS, {
      source: 'gateway',
      payload: {
        type: 'button_click',
        action,
        userId: interaction.user.id,
      },
    });

    // Handle welcome system buttons
    if (action === 'welcome') {
      await WelcomeHandlers.handleWelcomeButton(interaction, subAction);
      return;
    }

    // Handle rules system buttons
    if (action === 'rules') {
      await handleRulesButton(interaction);
      return;
    }

    // Handle verification buttons
    if (action === 'verify') {
      await ServerProtection.startVerification(interaction.member as GuildMember, interaction);
      return;
    }

    // Handle ticket system buttons
    if (action === 'ticket') {
      switch (subAction) {
        case 'create':
          await TicketHandlers.handleCreateButton(interaction);
          return;
        case 'faq':
          await TicketHandlers.handleFaqButton(interaction);
          return;
        case 'claim':
          await TicketHandlers.handleClaimButton(interaction);
          return;
        case 'close':
          await TicketHandlers.handleCloseButton(interaction);
          return;
        case 'resolve':
          await TicketHandlers.handleResolveButton(interaction);
          return;
        case 'reopen':
          await TicketHandlers.handleReopenButton(interaction);
          return;
        case 'escalate':
          await TicketHandlers.handleEscalateButton(interaction);
          return;
        case 'add_user':
          await TicketHandlers.handleAddUserButton(interaction);
          return;
        case 'transfer':
          await TicketHandlers.handleTransferButton(interaction);
          return;
        case 'priority':
          await TicketHandlers.handleChangePriorityButton(interaction);
          return;
        case 'delete':
          await TicketHandlers.handleDeleteButton(interaction);
          return;
        case 'delete_confirm':
          await TicketHandlers.handleDeleteConfirmButton(interaction);
          return;
        case 'delete_cancel':
          await interaction.update({ 
            content: '❌ Deletion cancelled.', 
            embeds: [], 
            components: [] 
          });
          return;
        case 'transcript':
          await TicketHandlers.handleTranscriptButton(interaction);
          return;
        case 'rename':
          await TicketHandlers.handleRenameButton(interaction);
          return;
      }
    }

    // Handle common button actions
    switch (action) {
      case 'start_project':
        await this.handleStartProject(interaction);
        break;
      case 'confirm':
      case 'cancel':
        await this.handleConfirmation(interaction, action, params);
        break;
      default:
        logger.debug(`Unhandled button action: ${action}`);
    }
  }

  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, subAction, ...params] = interaction.customId.split(':');

    logger.debug(`Modal submitted: ${action}:${subAction}`);

    // Handle ticket modals
    if (action === 'ticket') {
      switch (subAction) {
        case 'details_modal':
          await TicketHandlers.handleTicketModal(interaction);
          return;
        case 'close_confirm':
          await TicketHandlers.handleCloseModal(interaction);
          return;
        case 'resolve_confirm':
          await TicketHandlers.handleResolveModal(interaction);
          return;
        case 'rename_modal':
          await TicketHandlers.handleRenameModal(interaction);
          return;
      }
    }

    // Handle based on action type
    switch (action) {
      case 'project_details':
        await this.handleProjectDetailsModal(interaction, params);
        break;
      case 'feedback':
        await this.handleFeedbackModal(interaction, params);
        break;
      default:
        await interaction.reply({
          content: '✅ Form submitted successfully!',
          ephemeral: true,
        });
    }
  }

  private async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const [action, subAction, ...params] = interaction.customId.split(':');
    const selectedValues = interaction.values;

    logger.debug(`Select menu: ${action}:${subAction || ''}, values: ${selectedValues.join(', ')}`);

    // Handle ticket category selection
    if (action === 'ticket' && subAction === 'select_category') {
      await TicketHandlers.handleCategorySelect(interaction);
      return;
    }

    // Handle ticket priority selection
    if (action === 'ticket' && subAction === 'priority_select') {
      await TicketHandlers.handlePrioritySelect(interaction);
      return;
    }

    // Store selection in session
    const redis = getRedisClient();
    await redis.updateSession(interaction.user.id, {
      [`selection_${action}`]: selectedValues,
    });

    // Handle help category selection
    if (action === 'help_category') {
      await this.handleHelpCategorySelect(interaction, selectedValues[0]);
      return;
    }

    await interaction.deferUpdate();
  }

  private async handleUserSelectMenu(interaction: UserSelectMenuInteraction): Promise<void> {
    const [action, subAction, ...params] = interaction.customId.split(':');
    const selectedUser = interaction.users.first();

    if (!selectedUser) {
      await interaction.reply({ content: '❌ No user selected.', ephemeral: true });
      return;
    }

    logger.debug(`User select menu: ${action}:${subAction || ''}, user: ${selectedUser.tag}`);

    // Handle ticket user selections
    if (action === 'ticket') {
      const { EmbedBuilder, PermissionFlagsBits } = await import('discord.js');
      const { AvenloColors, AvenloBranding, Ticket } = await import('@avenlo/shared');
      const ticketId = params[0];
      const ticket = await Ticket.findOne({ ticketId });

      if (!ticket) {
        await interaction.update({ content: '❌ Ticket not found.', embeds: [], components: [] });
        return;
      }

      if (subAction === 'user_select') {
        // Add user to ticket channel
        const channel = interaction.channel as TextChannel;
        
        try {
          await channel.permissionOverwrites.create(selectedUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });

          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.CYAN)
                .setTitle('👥 User Added')
                .setDescription(`${selectedUser} has been added to this ticket by ${interaction.user}.`)
                .setTimestamp(),
            ],
          });

          await interaction.update({ 
            content: `✅ Added ${selectedUser.tag} to the ticket.`, 
            embeds: [], 
            components: [] 
          });
        } catch (error) {
          logger.error('Failed to add user to ticket:', error);
          await interaction.update({ 
            content: '❌ Failed to add user to ticket.', 
            embeds: [], 
            components: [] 
          });
        }
        return;
      }

      if (subAction === 'transfer_select') {
        // Transfer ticket to new developer
        const member = await interaction.guild?.members.fetch(selectedUser.id);
        const isDeveloper = member?.roles.cache.has(process.env.ROLE_DEVELOPER || '') ||
                           member?.roles.cache.has(process.env.ROLE_MODERATOR || '') ||
                           member?.roles.cache.has(process.env.ROLE_MANAGEMENT || '');

        if (!isDeveloper) {
          await interaction.update({
            content: `❌ ${selectedUser.tag} is not a staff member. Tickets can only be transferred to staff.`,
            embeds: [],
            components: [],
          });
          return;
        }

        const channel = interaction.channel as TextChannel;
        const oldAssigned = ticket.assignedTo;

        ticket.assignedTo = selectedUser.id;
        ticket.assignedToName = selectedUser.tag;
        await ticket.save();

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(AvenloColors.PURPLE)
              .setTitle('🔄 Ticket Transferred')
              .setDescription(
                `${interaction.user} transferred this ticket.\n\n` +
                `**From:** ${oldAssigned ? `<@${oldAssigned}>` : 'Unassigned'}\n` +
                `**To:** ${selectedUser}`
              )
              .setTimestamp(),
          ],
        });

        await interaction.update({ 
          content: `✅ Ticket transferred to ${selectedUser.tag}.`, 
          embeds: [], 
          components: [] 
        });
        return;
      }
    }

    await interaction.deferUpdate();
  }

  private async handleHelpCategorySelect(
    interaction: StringSelectMenuInteraction,
    category: string
  ): Promise<void> {
    const { EmbedBuilder } = await import('discord.js');
    const { AvenloColors, AvenloBranding, AvenloEmojis } = await import('@avenlo/shared');

    const embeds: Record<string, { title: string; description: string; fields: { name: string; value: string }[] }> = {
      getting_started: {
        title: `${AvenloEmojis.SPARKLES} Getting Started`,
        description: 'Welcome to Avenlo Core! Here\'s how to get started:',
        fields: [
          {
            name: '1️⃣ Create Your Profile',
            value: 'Use `/profile` to see your stats and contribution level.',
          },
          {
            name: '2️⃣ Start a Project',
            value: 'Use `/project start` to begin an AI-powered project interview. Our AI will help scope your project.',
          },
          {
            name: '3️⃣ Earn Credits',
            value: 'Contribute code, review PRs, and complete tasks to earn credits. Use `/vault` to check your balance.',
          },
          {
            name: '4️⃣ Climb the Ranks',
            value: 'Accumulate credits to unlock higher roles: Contributor → Builder → Architect → Core → Studio Lead!',
          },
        ],
      },
      projects: {
        title: `${AvenloEmojis.ROCKET} Project Management`,
        description: 'Learn how to manage projects in Avenlo:',
        fields: [
          {
            name: '/project start',
            value: 'Start an AI-powered discovery session. The Architect will interview you to understand your project needs.',
          },
          {
            name: '/project status',
            value: 'Check the current status of your active projects, including progress and team members.',
          },
          {
            name: '/project list',
            value: 'View all projects you\'re involved with, both active and completed.',
          },
        ],
      },
      economy: {
        title: `${AvenloEmojis.MONEY} Credit Economy`,
        description: 'Proof of Value - not useless XP:',
        fields: [
          {
            name: 'Earning Credits',
            value: '• Major Commit: +50\n• PR Merged: +30\n• Issue Resolved: +25\n• Code Review: +20\n• Documentation: +15',
          },
          {
            name: '/vault balance',
            value: 'Check your current credit balance and lifetime earnings.',
          },
          {
            name: '/vault history',
            value: 'View your recent transactions and credit history.',
          },
          {
            name: 'Role Progression',
            value: 'Observer (0) → Contributor (100) → Builder (500) → Architect (2000) → Core (5000)',
          },
        ],
      },
      analytics: {
        title: `${AvenloEmojis.CHART} Analytics & Dashboards`,
        description: 'Track progress with live dashboards:',
        fields: [
          {
            name: '/dashboard view',
            value: 'View the live DevOps dashboard for a project. Shows commits, PRs, CI/CD status, and health.',
          },
          {
            name: '/leaderboard',
            value: 'See the top contributors ranked by credits. Compete for the Studio Lead role!',
          },
          {
            name: '/profile [@user]',
            value: 'View detailed stats for yourself or another user, including contributions and achievements.',
          },
        ],
      },
    };

    const categoryData = embeds[category] || embeds.getting_started;

    const embed = new EmbedBuilder()
      .setColor(AvenloColors.CYAN)
      .setTitle(categoryData.title)
      .setDescription(categoryData.description)
      .addFields(categoryData.fields.map(f => ({ name: f.name, value: f.value, inline: false })))
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    // Rebuild the select menu to preserve it
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category for more details...')
      .addOptions([
        {
          label: 'Projects',
          description: 'Learn about project management',
          value: 'projects',
          emoji: '🚀',
          default: category === 'projects',
        },
        {
          label: 'Economy',
          description: 'Learn about the credit system',
          value: 'economy',
          emoji: '💰',
          default: category === 'economy',
        },
        {
          label: 'Analytics',
          description: 'Learn about dashboards and stats',
          value: 'analytics',
          emoji: '📊',
          default: category === 'analytics',
        },
        {
          label: 'Getting Started',
          description: 'New here? Start here!',
          value: 'getting_started',
          emoji: '✨',
          default: category === 'getting_started',
        },
      ]);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu) as any;

    await interaction.update({ embeds: [embed], components: [selectRow] });
  }

  // ====================================
  // SPECIFIC HANDLERS
  // ====================================

  private async handleStartProject(interaction: ButtonInteraction): Promise<void> {
    const redis = getRedisClient();
    
    // Store session for project start
    await redis.setSession(interaction.user.id, {
      flow: 'project_start',
      step: 'awaiting_thread',
      startedAt: new Date().toISOString(),
    }, 3600);

    // Emit event to Architect service
    await redis.publish(EventTypes.ARCHITECT_INTERVIEW_START, {
      source: 'gateway',
      payload: {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      },
    });

    await interaction.reply({
      content: '🚀 Starting project discovery... A private thread will be created for you!',
      ephemeral: true,
    });
  }

  private async handleConfirmation(
    interaction: ButtonInteraction,
    action: string,
    params: string[]
  ): Promise<void> {
    const redis = getRedisClient();
    const session = await redis.getSession(interaction.user.id);

    if (action === 'confirm') {
      await interaction.reply({
        content: '✅ Action confirmed!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '❌ Action cancelled.',
        ephemeral: true,
      });
    }

    // Clear the pending action from session
    await redis.updateSession(interaction.user.id, {
      pendingAction: null,
    });
  }

  private async handleProjectDetailsModal(
    interaction: ModalSubmitInteraction,
    params: string[]
  ): Promise<void> {
    const projectName = interaction.fields.getTextInputValue('project_name');
    const projectDescription = interaction.fields.getTextInputValue('project_description');

    await interaction.reply({
      content: `✅ Project "${projectName}" details received! Our AI will analyze your requirements.`,
      ephemeral: true,
    });
  }

  private async handleFeedbackModal(
    interaction: ModalSubmitInteraction,
    params: string[]
  ): Promise<void> {
    const feedback = interaction.fields.getTextInputValue('feedback');
    const rating = interaction.fields.getTextInputValue('rating');

    await interaction.reply({
      content: '✅ Thank you for your feedback!',
      ephemeral: true,
    });
  }

  // ====================================
  // STARTUP
  // ====================================

  async start(): Promise<void> {
    // Load commands
    this.commands = await loadCommands();
    logger.info(`Loaded ${this.commands.size} commands`);

    // Register commands with Discord
    await this.registerCommands();

    // Load event handlers
    await loadEvents(this);

    // Login
    await this.login(process.env.DISCORD_TOKEN);
  }

  private async registerCommands(): Promise<void> {
    // Skip registration if SKIP_COMMAND_REGISTER is set (for dev restarts)
    if (process.env.SKIP_COMMAND_REGISTER === 'true') {
      logger.info('⏭️ Skipping command registration (SKIP_COMMAND_REGISTER=true)');
      return;
    }

    const commands = Array.from(this.commands.values()).map((cmd) => cmd.data.toJSON());

    try {
      logger.info(`Registering ${commands.length} slash commands...`);

      if (process.env.DISCORD_GUILD_ID) {
        // Guild-specific commands (instant update)
        await this.restClient.put(
          Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID!,
            process.env.DISCORD_GUILD_ID
          ),
          { body: commands }
        );
      } else {
        // Global commands (may take up to an hour)
        await this.restClient.put(
          Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
          { body: commands }
        );
      }

      logger.info('✅ Slash commands registered');
    } catch (error) {
      logger.error('Failed to register commands:', error);
      throw error;
    }
  }
}
