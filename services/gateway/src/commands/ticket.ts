// ====================================
// AVENLO CORE - /TICKET COMMAND
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import {
  AvenloColors,
  AvenloBranding,
  AvenloEmojis,
  Ticket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
} from '@avenlo/shared';
import { Command } from './index';
import { ticketController, TicketController } from '../controllers/TicketController';
import { TicketHandlers } from '../handlers/TicketHandler';

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create, manage, and resolve support tickets')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Deploy the ticket panel to this channel (Admin only)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new support ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List your open tickets')
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View a specific ticket')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('The ticket ID (e.g., TKT-00001)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close a ticket')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('The ticket ID to close')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Reason for closing')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('Claim an open ticket (Developers only)')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('The ticket ID to claim')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('resolve')
        .setDescription('Mark a ticket as resolved')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('The ticket ID to resolve')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('resolution')
            .setDescription('Resolution summary')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('queue')
        .setDescription('View the ticket queue (Staff only)')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'panel':
        await handlePanel(interaction);
        break;
      case 'create':
        await handleCreate(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'view':
        await handleView(interaction);
        break;
      case 'close':
        await handleClose(interaction);
        break;
      case 'claim':
        await handleClaim(interaction);
        break;
      case 'resolve':
        await handleResolve(interaction);
        break;
      case 'queue':
        await handleQueue(interaction);
        break;
    }
  },
};

// ====================================
// PANEL DEPLOYMENT (Admin Only)
// ====================================

async function handlePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as any;
  
  // Check admin permissions
  const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) ||
                  member?.roles?.cache?.has(process.env.ROLE_MANAGEMENT);

  if (!isAdmin) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Only administrators can deploy the ticket panel.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  // Deploy the panel
  await interaction.deferReply({ ephemeral: true });

  try {
    const panelMessage = await TicketHandlers.deployPanel(channel);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.GREEN)
          .setTitle(`${AvenloEmojis.CHECK} Ticket Panel Deployed`)
          .setDescription(
            `The ticket panel has been deployed to this channel.\n\n` +
            `**Message ID:** \`${panelMessage.id}\`\n\n` +
            `Users can now click the button to create support tickets.`
          )
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp(),
      ],
    });
  } catch (error: any) {
    console.error('Ticket panel deploy error:', error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Failed to deploy ticket panel.\n\n**Error:** ${error?.message || 'Unknown error'}`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
    });
  }
}

// ====================================
// CREATE TICKET (Slash Command Fallback)
// ====================================

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  // Show category selection first
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('ticket:select_category')
    .setPlaceholder('Select ticket category...')
    .addOptions([
      {
        label: 'Project Inquiry',
        description: 'Questions about starting a new project',
        value: TicketCategory.PROJECT_INQUIRY,
        emoji: '🚀',
      },
      {
        label: 'Technical Support',
        description: 'Help with technical issues',
        value: TicketCategory.TECHNICAL_SUPPORT,
        emoji: '🔧',
      },
      {
        label: 'Billing',
        description: 'Payment and invoice questions',
        value: TicketCategory.BILLING,
        emoji: '💳',
      },
      {
        label: 'Feature Request',
        description: 'Suggest a new feature',
        value: TicketCategory.FEATURE_REQUEST,
        emoji: '💡',
      },
      {
        label: 'Bug Report',
        description: 'Report a bug or issue',
        value: TicketCategory.BUG_REPORT,
        emoji: '🐛',
      },
      {
        label: 'General',
        description: 'Other inquiries',
        value: TicketCategory.GENERAL,
        emoji: '📝',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);

  // Check if user is verified client
  const member = interaction.member as any;
  const isVerifiedClient = member?.roles?.cache?.has(process.env.ROLE_VERIFIED_CLIENT);

  const embed = new EmbedBuilder()
    .setColor(isVerifiedClient ? AvenloColors.GOLD : AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.TICKET} Create Support Ticket`)
    .setDescription(
      isVerifiedClient
        ? `${AvenloEmojis.STAR} **Verified Client Detected**\n\nYour ticket will be marked as **HIGH PRIORITY** with a guaranteed 2-hour response time.\n\nPlease select a category to continue.`
        : `Create a new support ticket and our team will assist you.\n\nPlease select a category to continue.`
    )
    .addFields({
      name: '📋 SLA Information',
      value: isVerifiedClient
        ? '• Response: **2 hours**\n• Resolution: **24 hours**'
        : '• Response: **8 hours**\n• Resolution: **72 hours**',
      inline: false,
    })
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const tickets = await TicketController.getClientTickets(interaction.user.id);

  if (tickets.length === 0) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.CYAN)
          .setDescription(`${AvenloEmojis.INFO} You don't have any tickets. Use \`/ticket create\` to open one.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const statusEmojis: Record<string, string> = {
    [TicketStatus.OPEN]: '🟢',
    [TicketStatus.IN_PROGRESS]: '🔵',
    [TicketStatus.AWAITING_RESPONSE]: '🟡',
    [TicketStatus.RESOLVED]: '✅',
    [TicketStatus.CLOSED]: '🔒',
  };

  const ticketList = tickets.slice(0, 10).map((t) => {
    const emoji = statusEmojis[t.status] || '⚪';
    return `${emoji} **${t.ticketId}** - ${t.subject.slice(0, 30)}${t.subject.length > 30 ? '...' : ''}\n└ ${t.status.replace(/_/g, ' ')} • <t:${Math.floor(t.createdAt.getTime() / 1000)}:R>`;
  });

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.TICKET} Your Tickets`)
    .setDescription(ticketList.join('\n\n'))
    .setFooter({ text: `Showing ${Math.min(tickets.length, 10)} of ${tickets.length} tickets • ${AvenloBranding.footer}` })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const ticketId = interaction.options.getString('id', true);
  const ticket = await TicketController.getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Ticket \`${ticketId}\` not found.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check permission (client or staff)
  const isOwner = ticket.clientId === interaction.user.id;
  const isAssigned = ticket.assignedTo === interaction.user.id;
  const isStaff = (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_DEVELOPER) ||
                  (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_MANAGEMENT);

  if (!isOwner && !isAssigned && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} You don't have permission to view this ticket.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const priorityColors: Record<string, number> = {
    [TicketPriority.LOW]: AvenloColors.CYAN,
    [TicketPriority.MEDIUM]: AvenloColors.CYAN,
    [TicketPriority.HIGH]: AvenloColors.GOLD,
    [TicketPriority.URGENT]: AvenloColors.RED,
  };

  const embed = new EmbedBuilder()
    .setColor(priorityColors[ticket.priority])
    .setTitle(`🎫 ${ticket.ticketId}: ${ticket.subject}`)
    .setDescription(ticket.messages[0]?.content?.slice(0, 500) || 'No description')
    .addFields(
      { name: 'Status', value: ticket.status.replace(/_/g, ' ').toUpperCase(), inline: true },
      { name: 'Priority', value: ticket.priority.toUpperCase(), inline: true },
      { name: 'Category', value: ticket.category.replace(/_/g, ' ').toUpperCase(), inline: true },
      { name: 'Client', value: `<@${ticket.clientId}>`, inline: true },
      { name: 'Assigned To', value: ticket.assignedTo ? `<@${ticket.assignedTo}>` : 'Unassigned', inline: true },
      { name: 'Created', value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`, inline: true },
      { 
        name: 'SLA Status', 
        value: ticket.sla.breached 
          ? '⚠️ **BREACHED**' 
          : `✅ Response: <t:${Math.floor(ticket.sla.responseDeadline.getTime() / 1000)}:R>`,
        inline: false 
      }
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  // Add thread link if exists
  if (ticket.threadId) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Go to Thread')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.threadId}`)
        .setEmoji('💬')
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }
}

async function handleClose(interaction: ChatInputCommandInteraction): Promise<void> {
  const ticketId = interaction.options.getString('id', true);
  const reason = interaction.options.getString('reason') || 'Closed by user';
  
  const ticket = await TicketController.getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Ticket \`${ticketId}\` not found.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check permission
  const isOwner = ticket.clientId === interaction.user.id;
  const isStaff = (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_MANAGEMENT);

  if (!isOwner && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} You don't have permission to close this ticket.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as any;
  await ticketController.closeTicket(ticket, member, reason);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setDescription(`${AvenloEmojis.CHECK} Ticket \`${ticketId}\` has been closed.\n\n**Reason:** ${reason}`)
        .setFooter({ text: AvenloBranding.footer }),
    ],
  });
}

async function handleClaim(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check if user is a developer
  const isDeveloper = (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_DEVELOPER) ||
                      (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_ACTIVE_DEV);

  if (!isDeveloper) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Only developers can claim tickets.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const ticketId = interaction.options.getString('id', true);
  const ticket = await TicketController.getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Ticket \`${ticketId}\` not found.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (ticket.assignedTo) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Ticket is already assigned to <@${ticket.assignedTo}>.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as any;
  await ticketController.claimTicket(ticket, member);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setDescription(`${AvenloEmojis.CHECK} You've claimed ticket \`${ticketId}\`.\n\n⏱️ Session timer started. Your work time will be tracked for credits.`)
        .setFooter({ text: AvenloBranding.footer }),
    ],
  });
}

async function handleResolve(interaction: ChatInputCommandInteraction): Promise<void> {
  const ticketId = interaction.options.getString('id', true);
  const resolution = interaction.options.getString('resolution', true);
  
  const ticket = await TicketController.getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Ticket \`${ticketId}\` not found.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check if user is assigned or staff
  const isAssigned = ticket.assignedTo === interaction.user.id;
  const isStaff = (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_MANAGEMENT);

  if (!isAssigned && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Only the assigned developer or staff can resolve this ticket.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as any;
  await ticketController.resolveTicket(ticket, member, resolution);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.GOLD)
        .setTitle(`${AvenloEmojis.CHECK} Ticket Resolved`)
        .setDescription(`Ticket \`${ticketId}\` has been marked as resolved.`)
        .addFields(
          { name: 'Resolution', value: resolution, inline: false },
          { name: 'SLA Status', value: ticket.sla.breached ? '⚠️ Breached' : '✅ Met', inline: true }
        )
        .setFooter({ text: AvenloBranding.footer }),
    ],
  });
}

async function handleQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check if user is staff
  const isStaff = (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_DEVELOPER) ||
                  (interaction.member as any)?.roles?.cache?.has(process.env.ROLE_MANAGEMENT);

  if (!isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} Only staff can view the ticket queue.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const tickets = await TicketController.getOpenTickets(interaction.guildId!);

  if (tickets.length === 0) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.CYAN)
          .setDescription(`${AvenloEmojis.CHECK} No open tickets! The queue is clear.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  const priorityEmojis: Record<string, string> = {
    [TicketPriority.URGENT]: '🔴',
    [TicketPriority.HIGH]: '🟠',
    [TicketPriority.MEDIUM]: '🟡',
    [TicketPriority.LOW]: '🟢',
  };

  const ticketList = tickets.slice(0, 15).map((t) => {
    const emoji = priorityEmojis[t.priority];
    const clientType = t.isVerifiedClient ? '⭐' : '';
    const assigned = t.assignedTo ? `→ <@${t.assignedTo}>` : '**UNCLAIMED**';
    return `${emoji}${clientType} \`${t.ticketId}\` - ${t.subject.slice(0, 25)}... ${assigned}`;
  });

  const urgentCount = tickets.filter(t => t.priority === TicketPriority.URGENT).length;
  const highCount = tickets.filter(t => t.priority === TicketPriority.HIGH).length;
  const unclaimedCount = tickets.filter(t => !t.assignedTo).length;

  const embed = new EmbedBuilder()
    .setColor(urgentCount > 0 ? AvenloColors.RED : highCount > 0 ? AvenloColors.GOLD : AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.TICKET} Ticket Queue`)
    .setDescription(ticketList.join('\n'))
    .addFields(
      { name: '🔴 Urgent', value: String(urgentCount), inline: true },
      { name: '🟠 High', value: String(highCount), inline: true },
      { name: '⏳ Unclaimed', value: String(unclaimedCount), inline: true }
    )
    .setFooter({ text: `${tickets.length} open tickets • ${AvenloBranding.footer}` })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
