// ====================================
// AVENLO CORE - TICKET CONTROLLER
// ====================================

import {
  TextChannel,
  ThreadChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  GuildMember,
  Message,
  User,
  StringSelectMenuBuilder,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  ITicket,
  TicketPriority,
  TicketStatus,
  TicketCategory,
  AvenloColors,
  AvenloBranding,
  AvenloEmojis,
  createLogger,
  getRedisClient,
  EventTypes,
} from '@avenlo/shared';

const logger = createLogger('ticket-controller');

// SLA Configuration (in hours)
const SLA_CONFIG = {
  [TicketPriority.URGENT]: { response: 0.5, resolution: 4 },   // 30 min response, 4 hours resolution
  [TicketPriority.HIGH]: { response: 2, resolution: 24 },      // 2 hours response, 24 hours resolution
  [TicketPriority.MEDIUM]: { response: 8, resolution: 72 },    // 8 hours response, 72 hours resolution
  [TicketPriority.LOW]: { response: 24, resolution: 168 },     // 24 hours response, 1 week resolution
};

// Credit rewards for ticket work
const TICKET_CREDITS = {
  claim: 5,              // Base credits for claiming a ticket
  response: 10,          // First response
  resolution: 25,        // Resolving the ticket
  perHourWorked: 15,     // Credits per hour worked on ticket
  clientSatisfaction: {
    excellent: 20,
    good: 10,
    neutral: 0,
    poor: -10,
  },
};

export class TicketController {
  private ticketChannelId: string;
  private managementRoleId: string;
  private studioLeadRoleId: string;
  private verifiedClientRoleId: string;

  constructor() {
    this.ticketChannelId = process.env.CHANNEL_TICKETS || '';
    this.managementRoleId = process.env.ROLE_MANAGEMENT || '';
    this.studioLeadRoleId = process.env.ROLE_STUDIO_LEAD || '';
    this.verifiedClientRoleId = process.env.ROLE_VERIFIED_CLIENT || '';
  }

  // ====================================
  // TICKET CREATION
  // ====================================

  async createTicket(
    channel: TextChannel,
    client: GuildMember,
    subject: string,
    category: TicketCategory,
    description: string,
    projectId?: string
  ): Promise<ITicket> {
    const isVerifiedClient = client.roles.cache.has(this.verifiedClientRoleId);
    
    // Verified clients get HIGH priority automatically
    const priority = isVerifiedClient ? TicketPriority.HIGH : TicketPriority.MEDIUM;
    
    // Calculate SLA deadlines
    const now = new Date();
    const slaConfig = SLA_CONFIG[priority];
    const responseDeadline = new Date(now.getTime() + slaConfig.response * 60 * 60 * 1000);
    const resolutionDeadline = new Date(now.getTime() + slaConfig.resolution * 60 * 60 * 1000);

    // Create private thread for the ticket
    const thread = await channel.threads.create({
      name: `🎫 ${subject.slice(0, 50)}`,
      type: ChannelType.PrivateThread,
      reason: `Ticket created by ${client.user.tag}`,
    });

    // Add client to thread
    await thread.members.add(client.id);

    // Create ticket in database
    const ticket = new Ticket({
      channelId: channel.id,
      threadId: thread.id,
      guildId: channel.guild.id,
      clientId: client.id,
      clientName: client.user.tag,
      isVerifiedClient,
      projectId,
      subject,
      category,
      priority,
      status: TicketStatus.OPEN,
      sla: {
        responseDeadline,
        resolutionDeadline,
        breached: false,
      },
      messages: [{
        authorId: client.id,
        authorName: client.user.tag,
        content: description,
        timestamp: now,
      }],
      tags: [],
    });

    await ticket.save();

    // Send ticket embed to thread
    const ticketEmbed = this.buildTicketEmbed(ticket);
    const actionRow = this.buildTicketActions(ticket);

    await thread.send({
      embeds: [ticketEmbed],
      components: [actionRow],
    });

    // Alert management for high priority tickets
    if (isVerifiedClient || priority === TicketPriority.HIGH || priority === TicketPriority.URGENT) {
      await this.alertManagement(channel.guild, ticket);
    }

    // Publish event
    const redis = getRedisClient();
    await redis.publish(EventTypes.TICKET_CREATED, {
      source: 'gateway',
      payload: {
        ticketId: ticket.ticketId,
        clientId: client.id,
        priority,
        isVerifiedClient,
      },
    });

    logger.info(`Ticket ${ticket.ticketId} created by ${client.user.tag} [${priority}]`);

    return ticket;
  }

  // ====================================
  // TICKET ACTIONS
  // ====================================

  async claimTicket(ticket: ITicket, developer: GuildMember): Promise<ITicket> {
    if (ticket.assignedTo) {
      throw new Error('Ticket is already assigned');
    }

    const now = new Date();
    
    ticket.assignedTo = developer.id;
    ticket.assignedToName = developer.user.tag;
    ticket.claimedAt = now;
    ticket.status = TicketStatus.IN_PROGRESS;
    
    // Start session timer
    ticket.activeSession = {
      developerId: developer.id,
      developerName: developer.user.tag,
      startedAt: now,
    };

    // Check if this is the first response (for SLA)
    if (!ticket.sla.firstResponseAt) {
      ticket.sla.firstResponseAt = now;
      
      // Check SLA breach
      if (now > ticket.sla.responseDeadline) {
        ticket.sla.breached = true;
        logger.warn(`SLA breached for ticket ${ticket.ticketId} - Response deadline missed`);
      }
    }

    await ticket.save();

    // Award claim credits
    const redis = getRedisClient();
    await redis.publish(EventTypes.LEDGER_CREDITS_EARN, {
      source: 'gateway',
      payload: {
        userId: developer.id,
        amount: TICKET_CREDITS.claim,
        reason: `Claimed ticket ${ticket.ticketId}`,
        type: 'ticket_claim',
      },
    });

    // Add developer to thread
    const guild = developer.guild;
    const thread = await guild.channels.fetch(ticket.threadId!) as ThreadChannel;
    if (thread) {
      await thread.members.add(developer.id);
      
      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setColor(AvenloColors.CYAN)
            .setDescription(`${AvenloEmojis.CHECK} **${developer.user.tag}** has claimed this ticket.\n\nSession timer started. Work time will be tracked for credits.`)
            .setTimestamp(),
        ],
      });
    }

    logger.info(`Ticket ${ticket.ticketId} claimed by ${developer.user.tag}`);

    return ticket;
  }

  async resolveTicket(
    ticket: ITicket,
    resolvedBy: GuildMember,
    resolution: string
  ): Promise<ITicket> {
    const now = new Date();

    // End active session
    if (ticket.activeSession) {
      ticket.activeSession.endedAt = now;
      
      // Calculate session duration and credits
      const duration = (now.getTime() - ticket.activeSession.startedAt.getTime()) / (1000 * 60 * 60);
      const sessionCredits = Math.floor(duration * TICKET_CREDITS.perHourWorked);
      ticket.activeSession.creditsEarned = sessionCredits;
      
      ticket.sessions.push(ticket.activeSession);
      ticket.activeSession = undefined;
    }

    ticket.status = TicketStatus.RESOLVED;
    ticket.sla.resolvedAt = now;

    // Check resolution SLA
    if (now > ticket.sla.resolutionDeadline) {
      ticket.sla.breached = true;
      logger.warn(`SLA breached for ticket ${ticket.ticketId} - Resolution deadline missed`);
    }

    // Add resolution message
    ticket.messages.push({
      authorId: resolvedBy.id,
      authorName: resolvedBy.user.tag,
      content: `**Resolution:** ${resolution}`,
      timestamp: now,
    });

    await ticket.save();

    // Award resolution credits
    const redis = getRedisClient();
    await redis.publish(EventTypes.LEDGER_CREDITS_EARN, {
      source: 'gateway',
      payload: {
        userId: resolvedBy.id,
        amount: TICKET_CREDITS.resolution,
        reason: `Resolved ticket ${ticket.ticketId}`,
        type: 'ticket_resolution',
      },
    });

    // Update thread
    const guild = resolvedBy.guild;
    const thread = await guild.channels.fetch(ticket.threadId!) as ThreadChannel;
    if (thread) {
      const resolvedEmbed = new EmbedBuilder()
        .setColor(AvenloColors.GOLD)
        .setTitle(`${AvenloEmojis.CHECK} Ticket Resolved`)
        .setDescription(`**Resolution:** ${resolution}`)
        .addFields(
          { name: 'Resolved By', value: resolvedBy.user.tag, inline: true },
          { name: 'Time to Resolution', value: this.formatDuration(now.getTime() - ticket.createdAt.getTime()), inline: true },
          { name: 'SLA Status', value: ticket.sla.breached ? '⚠️ Breached' : '✅ Met', inline: true }
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:close:${ticket.ticketId}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticket.ticketId}`)
          .setLabel('Reopen')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔓')
      );

      await thread.send({
        embeds: [resolvedEmbed],
        components: [closeRow],
      });
    }

    logger.info(`Ticket ${ticket.ticketId} resolved by ${resolvedBy.user.tag}`);

    return ticket;
  }

  async closeTicket(
    ticket: ITicket,
    closedBy: GuildMember,
    reason?: string
  ): Promise<ITicket> {
    const now = new Date();

    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = now;
    ticket.closedBy = closedBy.id;
    ticket.closedReason = reason || 'Ticket closed';

    // Generate transcript
    ticket.transcript = this.generateTranscript(ticket);

    await ticket.save();

    // Archive and lock thread
    const guild = closedBy.guild;
    const thread = await guild.channels.fetch(ticket.threadId!) as ThreadChannel;
    if (thread) {
      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('🔒 Ticket Closed')
            .setDescription(`This ticket has been closed by ${closedBy.user.tag}.\n\n**Reason:** ${reason || 'No reason provided'}`)
            .addFields(
              { name: 'Ticket ID', value: ticket.ticketId, inline: true },
              { name: 'Total Messages', value: String(ticket.messages.length), inline: true },
              { name: 'Transcript', value: '📄 Archived to database', inline: true }
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp(),
        ],
      });

      await thread.setArchived(true);
      await thread.setLocked(true);
    }

    // Publish event
    const redis = getRedisClient();
    await redis.publish(EventTypes.TICKET_CLOSED, {
      source: 'gateway',
      payload: {
        ticketId: ticket.ticketId,
        closedBy: closedBy.id,
        transcript: ticket.transcript,
      },
    });

    logger.info(`Ticket ${ticket.ticketId} closed by ${closedBy.user.tag}`);

    return ticket;
  }

  // ====================================
  // CLIENT ONBOARDING
  // ====================================

  async onVerifiedClientJoin(member: GuildMember): Promise<void> {
    logger.info(`Verified Client joined: ${member.user.tag}`);

    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(AvenloColors.GOLD)
      .setTitle(`${AvenloEmojis.SPARKLES} Welcome to Avenlo Studio, ${member.user.username}!`)
      .setDescription(
        `You've been granted **Verified Client** status, which means you have access to our premium white-glove service.\n\n` +
        `Here's what you can expect:\n` +
        `• **Priority Support** - Your tickets are handled first\n` +
        `• **Dedicated Dashboard** - Real-time project metrics\n` +
        `• **AI-Powered Scoping** - Let our AI architect scope your project\n` +
        `• **Direct Access** - Reach our Studio Lead directly`
      )
      .addFields(
        {
          name: '🎯 Your SLA Guarantee',
          value: '• Response within **2 hours**\n• Resolution within **24 hours**',
          inline: true,
        },
        {
          name: '📊 Your Dashboard',
          value: `View your project metrics in <#${process.env.CHANNEL_CLIENT_DASHBOARD}>`,
          inline: true,
        }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('client:start_project')
        .setLabel('Start New Project')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId('client:open_ticket')
        .setLabel('Open Support Ticket')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎫'),
      new ButtonBuilder()
        .setCustomId('client:view_dashboard')
        .setLabel('View Dashboard')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );

    try {
      // Try to DM the client first
      await member.send({
        embeds: [welcomeEmbed],
        components: [actionRow],
      });
    } catch (error) {
      // If DM fails, create a private thread
      const welcomeChannel = await member.guild.channels.fetch(process.env.CHANNEL_WELCOME || '') as TextChannel;
      if (welcomeChannel) {
        const thread = await welcomeChannel.threads.create({
          name: `Welcome ${member.user.username}`,
          type: ChannelType.PrivateThread,
          reason: `Private welcome for verified client ${member.user.tag}`,
        });
        
        await thread.members.add(member.id);
        await thread.send({
          content: `<@${member.id}>`,
          embeds: [welcomeEmbed],
          components: [actionRow],
        });
      }
    }

    // Alert management
    const managementChannel = await member.guild.channels.fetch(process.env.CHANNEL_LOGS || '') as TextChannel;
    if (managementChannel) {
      await managementChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(AvenloColors.GOLD)
            .setTitle('🌟 New Verified Client')
            .setDescription(`**${member.user.tag}** has joined as a Verified Client.`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: 'User ID', value: member.id, inline: true },
              { name: 'Joined', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp(),
        ],
      });
    }
  }

  // ====================================
  // MANAGEMENT ALERTS
  // ====================================

  private async alertManagement(guild: any, ticket: ITicket): Promise<void> {
    const alertEmbed = new EmbedBuilder()
      .setColor(ticket.priority === TicketPriority.URGENT ? AvenloColors.RED : AvenloColors.GOLD)
      .setTitle(`${ticket.priority === TicketPriority.URGENT ? '🚨' : '⚠️'} ${ticket.priority.toUpperCase()} Priority Ticket`)
      .setDescription(`A ${ticket.isVerifiedClient ? '**Verified Client**' : 'member'} has opened a high-priority ticket.`)
      .addFields(
        { name: 'Ticket ID', value: ticket.ticketId, inline: true },
        { name: 'Client', value: ticket.clientName, inline: true },
        { name: 'Category', value: ticket.category.replace(/_/g, ' ').toUpperCase(), inline: true },
        { name: 'Subject', value: ticket.subject, inline: false },
        { name: 'SLA Response', value: `<t:${Math.floor(ticket.sla.responseDeadline.getTime() / 1000)}:R>`, inline: true },
        { name: 'SLA Resolution', value: `<t:${Math.floor(ticket.sla.resolutionDeadline.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.ticketId}`)
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✋'),
      new ButtonBuilder()
        .setCustomId(`ticket:view:${ticket.ticketId}`)
        .setLabel('View Thread')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👁️')
    );

    // Send to logs channel
    const logsChannel = await guild.channels.fetch(process.env.CHANNEL_LOGS) as TextChannel;
    if (logsChannel) {
      await logsChannel.send({
        content: `<@&${this.managementRoleId}> <@&${this.studioLeadRoleId}>`,
        embeds: [alertEmbed],
        components: [actionRow],
      });
    }
  }

  // ====================================
  // HELPERS
  // ====================================

  private buildTicketEmbed(ticket: ITicket): EmbedBuilder {
    const priorityColors = {
      [TicketPriority.LOW]: AvenloColors.CYAN,
      [TicketPriority.MEDIUM]: AvenloColors.CYAN,
      [TicketPriority.HIGH]: AvenloColors.GOLD,
      [TicketPriority.URGENT]: AvenloColors.RED,
    };

    const priorityEmojis = {
      [TicketPriority.LOW]: '🟢',
      [TicketPriority.MEDIUM]: '🟡',
      [TicketPriority.HIGH]: '🟠',
      [TicketPriority.URGENT]: '🔴',
    };

    return new EmbedBuilder()
      .setColor(priorityColors[ticket.priority])
      .setTitle(`🎫 Ticket: ${ticket.subject}`)
      .setDescription(ticket.messages[0]?.content || 'No description provided.')
      .addFields(
        { name: 'Ticket ID', value: ticket.ticketId, inline: true },
        { name: 'Priority', value: `${priorityEmojis[ticket.priority]} ${ticket.priority.toUpperCase()}`, inline: true },
        { name: 'Category', value: ticket.category.replace(/_/g, ' ').toUpperCase(), inline: true },
        { name: 'Status', value: ticket.status.replace(/_/g, ' ').toUpperCase(), inline: true },
        { name: 'Client', value: `<@${ticket.clientId}>`, inline: true },
        { name: 'Client Type', value: ticket.isVerifiedClient ? '⭐ Verified Client' : 'Member', inline: true },
        { 
          name: '⏱️ SLA', 
          value: `Response: <t:${Math.floor(ticket.sla.responseDeadline.getTime() / 1000)}:R>\nResolution: <t:${Math.floor(ticket.sla.resolutionDeadline.getTime() / 1000)}:R>`,
          inline: false 
        }
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
  }

  private buildTicketActions(ticket: ITicket): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.ticketId}`)
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✋')
        .setDisabled(!!ticket.assignedTo),
      new ButtonBuilder()
        .setCustomId(`ticket:escalate:${ticket.ticketId}`)
        .setLabel('Escalate')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⬆️'),
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticket.ticketId}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒')
    );
  }

  private generateTranscript(ticket: ITicket): string {
    const lines = [
      `========================================`,
      `AVENLO STUDIO - TICKET TRANSCRIPT`,
      `========================================`,
      ``,
      `Ticket ID: ${ticket.ticketId}`,
      `Subject: ${ticket.subject}`,
      `Category: ${ticket.category}`,
      `Priority: ${ticket.priority}`,
      `Client: ${ticket.clientName} (${ticket.clientId})`,
      `Verified Client: ${ticket.isVerifiedClient ? 'Yes' : 'No'}`,
      ``,
      `Created: ${ticket.createdAt.toISOString()}`,
      `Closed: ${ticket.closedAt?.toISOString() || 'N/A'}`,
      `Resolved At: ${ticket.sla.resolvedAt?.toISOString() || 'N/A'}`,
      `SLA Breached: ${ticket.sla.breached ? 'Yes' : 'No'}`,
      ``,
      `Assigned To: ${ticket.assignedToName || 'Unassigned'}`,
      ``,
      `========================================`,
      `MESSAGES`,
      `========================================`,
      ``,
    ];

    for (const msg of ticket.messages) {
      lines.push(`[${msg.timestamp.toISOString()}] ${msg.authorName}:`);
      lines.push(msg.content);
      lines.push(``);
    }

    lines.push(`========================================`);
    lines.push(`END OF TRANSCRIPT`);
    lines.push(`========================================`);

    return lines.join('\n');
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ====================================
  // STATIC HELPERS
  // ====================================

  static async getTicketById(ticketId: string): Promise<ITicket | null> {
    return Ticket.findOne({ ticketId });
  }

  static async getOpenTickets(guildId: string): Promise<ITicket[]> {
    return Ticket.find({
      guildId,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE] },
    }).sort({ priority: -1, createdAt: 1 });
  }

  static async getClientTickets(clientId: string): Promise<ITicket[]> {
    return Ticket.find({ clientId }).sort({ createdAt: -1 });
  }

  static async getMyAssignedTickets(developerId: string): Promise<ITicket[]> {
    return Ticket.find({
      assignedTo: developerId,
      status: { $in: [TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE] },
    }).sort({ priority: -1, createdAt: 1 });
  }
}

export const ticketController = new TicketController();
