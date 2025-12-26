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
} from 'discord.js';
import { createLogger, getRedisClient, EventTypes } from '@avenlo/shared';
import { loadCommands, Command } from './commands';
import { loadEvents } from './events';

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
      ],
    });

    this.restClient = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Ready event
    this.once(Events.ClientReady, async (readyClient) => {
      logger.info(`✅ Logged in as ${readyClient.user.tag}`);
      
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
    const [action, ...params] = interaction.customId.split(':');

    // Route to appropriate handler based on action prefix
    const redis = getRedisClient();
    const session = await redis.getSession(interaction.user.id);

    // Emit event for other services
    await redis.publish(EventTypes.SYSTEM_METRICS, {
      source: 'gateway',
      payload: {
        type: 'button_click',
        action,
        userId: interaction.user.id,
      },
    });

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
    const [action, ...params] = interaction.customId.split(':');

    logger.debug(`Modal submitted: ${action}`);

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
    const [action, ...params] = interaction.customId.split(':');
    const selectedValues = interaction.values;

    logger.debug(`Select menu: ${action}, values: ${selectedValues.join(', ')}`);

    // Store selection in session
    const redis = getRedisClient();
    await redis.updateSession(interaction.user.id, {
      [`selection_${action}`]: selectedValues,
    });

    await interaction.deferUpdate();
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
