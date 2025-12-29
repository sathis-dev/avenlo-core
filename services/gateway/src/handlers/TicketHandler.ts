// ====================================
// AVENLO CORE - TICKET HANDLER
// Advanced UI/UX Ticket System
// ====================================

import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  GuildMember,
  Message,
  ThreadChannel,
  CategoryChannel,
  OverwriteType,
  UserSelectMenuBuilder,
} from 'discord.js';
import {
  AvenloColors,
  AvenloBranding,
  AvenloEmojis,
  Ticket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  createLogger,
  getRedisClient,
  EventTypes,
} from '@avenlo/shared';

const logger = createLogger('ticket-handler');

// ====================================
// PERMISSION LEVELS
// ====================================

enum TicketPermission {
  OWNER = 'owner',           // Ticket creator - limited actions
  STAFF = 'staff',           // Developers/Moderators - can work on tickets
  MANAGEMENT = 'management', // Management - full control
  ADMIN = 'admin',           // Server admin - ultimate control
}

interface PermissionCheck {
  level: TicketPermission;
  canClose: boolean;
  canResolve: boolean;
  canClaim: boolean;
  canEscalate: boolean;
  canAddUser: boolean;
  canTransfer: boolean;
  canDelete: boolean;
  canReopen: boolean;
  canChangePriority: boolean;
}

function getTicketPermissions(member: GuildMember, ticket: any): PermissionCheck {
  const isOwner = ticket.clientId === member.id;
  const isAssigned = ticket.assignedTo === member.id;
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const isManagement = member.roles.cache.has(process.env.ROLE_MANAGEMENT || '');
  const isModerator = member.roles.cache.has(process.env.ROLE_MODERATOR || '');
  const isDeveloper = member.roles.cache.has(process.env.ROLE_DEVELOPER || '');
  const isStudioLead = member.roles.cache.has(process.env.ROLE_STUDIO_LEAD || '');

  // Admin - Ultimate power
  if (isAdmin || isManagement || isStudioLead) {
    return {
      level: TicketPermission.ADMIN,
      canClose: true,
      canResolve: true,
      canClaim: true,
      canEscalate: true,
      canAddUser: true,
      canTransfer: true,
      canDelete: true,
      canReopen: true,
      canChangePriority: true,
    };
  }

  // Staff (Moderator/Developer) - Can work on tickets
  if (isModerator || isDeveloper || isAssigned) {
    return {
      level: TicketPermission.STAFF,
      canClose: true,
      canResolve: isAssigned || isDeveloper, // Only assigned or devs can resolve
      canClaim: !ticket.assignedTo, // Can only claim if unassigned
      canEscalate: true,
      canAddUser: true,
      canTransfer: isAssigned, // Only assigned can transfer
      canDelete: false,
      canReopen: true,
      canChangePriority: true,
    };
  }

  // Owner - Limited control
  if (isOwner) {
    return {
      level: TicketPermission.OWNER,
      canClose: true, // Can close their own ticket
      canResolve: false, // Cannot mark as resolved
      canClaim: false,
      canEscalate: true, // Can escalate to get more attention
      canAddUser: false,
      canTransfer: false,
      canDelete: false,
      canReopen: ticket.status === TicketStatus.RESOLVED, // Can reopen if resolved
      canChangePriority: false,
    };
  }

  // No permissions
  return {
    level: TicketPermission.OWNER,
    canClose: false,
    canResolve: false,
    canClaim: false,
    canEscalate: false,
    canAddUser: false,
    canTransfer: false,
    canDelete: false,
    canReopen: false,
    canChangePriority: false,
  };
}

function buildPermissionDeniedEmbed(action: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.RED)
    .setTitle('❌ Permission Denied')
    .setDescription(
      `You don't have permission to **${action}** this ticket.\n\n` +
      `**Ticket Creator:** Can close, escalate, or reopen (if resolved)\n` +
      `**Staff (Dev/Mod):** Can claim, resolve, close, escalate\n` +
      `**Management/Admin:** Full control over all tickets`
    )
    .setFooter({ text: AvenloBranding.footer });
}

// ====================================
// CONFIGURATION
// ====================================

const TICKET_CATEGORY_INFO = {
  [TicketCategory.PROJECT_INQUIRY]: {
    emoji: '🚀',
    label: 'Project Inquiry',
    description: 'Start a new project or get a quote',
    color: AvenloColors.CYAN,
  },
  [TicketCategory.TECHNICAL_SUPPORT]: {
    emoji: '🔧',
    label: 'Technical Support',
    description: 'Get help with technical issues',
    color: AvenloColors.PURPLE,
  },
  [TicketCategory.BILLING]: {
    emoji: '💳',
    label: 'Billing & Payments',
    description: 'Invoice, payment, or subscription questions',
    color: AvenloColors.GOLD,
  },
  [TicketCategory.FEATURE_REQUEST]: {
    emoji: '💡',
    label: 'Feature Request',
    description: 'Suggest improvements or new features',
    color: AvenloColors.CYAN,
  },
  [TicketCategory.BUG_REPORT]: {
    emoji: '🐛',
    label: 'Bug Report',
    description: 'Report a bug or unexpected behavior',
    color: AvenloColors.RED,
  },
  [TicketCategory.GENERAL]: {
    emoji: '📝',
    label: 'General Inquiry',
    description: 'Other questions or feedback',
    color: AvenloColors.CYAN,
  },
};

const SLA_CONFIG = {
  [TicketPriority.URGENT]: { response: 0.5, resolution: 4 },
  [TicketPriority.HIGH]: { response: 2, resolution: 24 },
  [TicketPriority.MEDIUM]: { response: 8, resolution: 72 },
  [TicketPriority.LOW]: { response: 24, resolution: 168 },
};

const TICKET_CREDITS = {
  claim: 5,
  response: 10,
  resolution: 25,
  perHourWorked: 15,
};

// ====================================
// TICKET TOOL SETTINGS (TicketTool.xyz Parity)
// ====================================

const TICKET_SETTINGS = {
  // Two-step close (confirmation before closing)
  twoStepClose: true,
  
  // Two-step ticket (closed state with reopen/delete/transcript)
  twoStepTicket: true,
  
  // Auto-pin ticket message
  autoPinTicket: true,
  
  // Ticket padding (e.g., 5 = TKT-00001)
  ticketPadding: 5,
  
  // Auto-close inactive tickets (hours, 0 = disabled)
  autoCloseInactiveHours: 72,
  
  // Auto-delete closed tickets (hours, 0 = disabled)
  autoDeleteClosedHours: 24,
  
  // Send DM on ticket create
  dmOnCreate: true,
  
  // Send DM on ticket close
  dmOnClose: true,
  
  // Send transcript to log channel
  logTranscripts: true,
  
  // Rename channel on close
  renameOnClose: true,
  
  // Close channel prefix
  closedChannelPrefix: 'closed-',
  
  // Ticket channel naming format
  ticketChannelFormat: 'ticket-{username}',
};

// ====================================
// DM NOTIFICATIONS
// ====================================

async function sendTicketCreatedDM(member: GuildMember, ticket: any, channelId: string): Promise<void> {
  if (!TICKET_SETTINGS.dmOnCreate) return;
  
  try {
    const dm = await member.createDM();
    await dm.send({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.CYAN)
          .setTitle(`${AvenloEmojis.TICKET} Your Ticket Has Been Created!`)
          .setDescription(
            `Your support ticket has been successfully created.\n\n` +
            `**Ticket ID:** \`${ticket.ticketId}\`\n` +
            `**Subject:** ${ticket.subject}\n` +
            `**Category:** ${ticket.category.replace(/_/g, ' ')}\n` +
            `**Priority:** ${getPriorityDisplay(ticket.priority)}\n\n` +
            `Our team will respond as soon as possible.\n` +
            `You can view your ticket here: <#${channelId}>`
          )
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp(),
      ],
    });
  } catch (error) {
    logger.debug(`Could not send DM to ${member.user.tag}: DMs may be disabled`);
  }
}

async function sendTicketClosedDM(member: GuildMember, ticket: any, closedBy: string, transcript?: string): Promise<void> {
  if (!TICKET_SETTINGS.dmOnClose) return;
  
  try {
    const dm = await member.createDM();
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.DARK_EMBED)
      .setTitle(`${AvenloEmojis.LOCK} Your Ticket Has Been Closed`)
      .setDescription(
        `Your support ticket has been closed.\n\n` +
        `**Ticket ID:** \`${ticket.ticketId}\`\n` +
        `**Subject:** ${ticket.subject}\n` +
        `**Closed By:** ${closedBy}\n` +
        `**Resolution:** ${ticket.resolution || 'No resolution provided'}\n\n` +
        `Thank you for contacting Avenlo Studio!`
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    if (transcript) {
      embed.addFields({
        name: '📄 Transcript',
        value: `A transcript of your conversation has been saved.`,
      });
    }
    
    await dm.send({ embeds: [embed] });
  } catch (error) {
    logger.debug(`Could not send close DM to ${member.user.tag}: DMs may be disabled`);
  }
}

// ====================================
// TRANSCRIPT GENERATION
// ====================================

async function generateTranscript(channel: TextChannel, ticket: any): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  
  let transcript = `═══════════════════════════════════════\n`;
  transcript += `      AVENLO STUDIO - TICKET TRANSCRIPT\n`;
  transcript += `═══════════════════════════════════════\n\n`;
  transcript += `Ticket ID: ${ticket.ticketId}\n`;
  transcript += `Subject: ${ticket.subject}\n`;
  transcript += `Category: ${ticket.category}\n`;
  transcript += `Priority: ${ticket.priority}\n`;
  transcript += `Created: ${ticket.createdAt.toISOString()}\n`;
  transcript += `Closed: ${new Date().toISOString()}\n`;
  transcript += `Client: ${ticket.clientName} (${ticket.clientId})\n`;
  transcript += `Assigned To: ${ticket.assignedToName || 'Unassigned'}\n\n`;
  transcript += `═══════════════════════════════════════\n`;
  transcript += `              MESSAGE HISTORY\n`;
  transcript += `═══════════════════════════════════════\n\n`;
  
  for (const [, msg] of sorted) {
    if (msg.author.bot && msg.embeds.length > 0) continue; // Skip bot embeds
    const time = msg.createdAt.toISOString().replace('T', ' ').substring(0, 19);
    transcript += `[${time}] ${msg.author.tag}:\n`;
    if (msg.content) transcript += `  ${msg.content}\n`;
    if (msg.attachments.size > 0) {
      msg.attachments.forEach(att => {
        transcript += `  [Attachment: ${att.name}]\n`;
      });
    }
    transcript += `\n`;
  }
  
  transcript += `═══════════════════════════════════════\n`;
  transcript += `           END OF TRANSCRIPT\n`;
  transcript += `═══════════════════════════════════════\n`;
  
  return transcript;
}

async function sendTranscriptToLogChannel(guild: any, ticket: any, transcript: string): Promise<void> {
  const logChannelId = process.env.CHANNEL_TICKET_LOGS;
  if (!logChannelId || !TICKET_SETTINGS.logTranscripts) return;
  
  try {
    const logChannel = await guild.channels.fetch(logChannelId) as TextChannel;
    if (!logChannel) return;
    
    const duration = getTicketDuration(ticket);
    
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.DARK_EMBED)
          .setTitle(`📄 Ticket Transcript - ${ticket.ticketId}`)
          .addFields(
            { name: 'Subject', value: ticket.subject, inline: true },
            { name: 'Category', value: ticket.category.replace(/_/g, ' '), inline: true },
            { name: 'Priority', value: getPriorityDisplay(ticket.priority), inline: true },
            { name: 'Client', value: `<@${ticket.clientId}>`, inline: true },
            { name: 'Assigned To', value: ticket.assignedTo ? `<@${ticket.assignedTo}>` : 'Unassigned', inline: true },
            { name: 'Duration', value: duration, inline: true },
            { name: 'Messages', value: String(ticket.messages.length), inline: true },
            { name: 'SLA Breached', value: ticket.sla.breached ? '❌ Yes' : '✅ No', inline: true },
            { name: 'Resolution', value: ticket.resolution || 'N/A', inline: false },
          )
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp(),
      ],
      files: [
        {
          attachment: Buffer.from(transcript, 'utf-8'),
          name: `transcript-${ticket.ticketId}.txt`,
        },
      ],
    });
  } catch (error) {
    logger.warn('Could not send transcript to log channel:', error);
  }
}

// ====================================
// TICKET PANEL - Deploy to Channel
// ====================================

export async function deployTicketPanel(channel: TextChannel): Promise<Message> {
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.PURPLE)
    .setAuthor({
      name: 'AVENLO STUDIO',
      iconURL: AvenloBranding.iconUrl,
    })
    .setTitle(`🎫 Support Center`)
    .setDescription(
      `Need assistance? Click the button below to open a private support ticket.\n\n` +
      `Our team will assist you as quickly as possible based on your ticket priority.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: `📋 Available Categories`,
        value: 
          `> 🚀 **Project Inquiry** — Start a new project or get a quote\n` +
          `> 🔧 **Technical Support** — Get help with technical issues\n` +
          `> 💳 **Billing & Payments** — Invoice or subscription questions\n` +
          `> 💡 **Feature Request** — Suggest improvements\n` +
          `> 🐛 **Bug Report** — Report unexpected behavior\n` +
          `> 📝 **General Inquiry** — Other questions`,
        inline: false,
      },
      {
        name: `⏰ Response Times (SLA)`,
        value: 
          `> 🔴 **Urgent:** 30 minutes\n` +
          `> 🟠 **High:** 2 hours\n` +
          `> 🟡 **Medium:** 8 hours\n` +
          `> 🟢 **Low:** 24 hours`,
        inline: true,
      },
      {
        name: `⭐ Verified Clients`,
        value: 
          `> Priority support (2hr response)\n` +
          `> Dedicated project channels\n` +
          `> Direct senior dev access`,
        inline: true,
      }
    )
    .setImage('https://i.imgur.com/AfFp7pu.png') // Optional banner
    .setFooter({ 
      text: `${AvenloBranding.footer} • All tickets are private and secure`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();

  const createButton = new ButtonBuilder()
    .setCustomId('ticket:create')
    .setLabel('Create Ticket')
    .setEmoji('🎫')
    .setStyle(ButtonStyle.Success);

  const faqButton = new ButtonBuilder()
    .setCustomId('ticket:faq')
    .setLabel('View FAQ')
    .setEmoji('📚')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton, faqButton);

  return await channel.send({ embeds: [embed], components: [row] });
}

// ====================================
// BUTTON: Create Ticket
// ====================================

export async function handleCreateTicketButton(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const isVerifiedClient = member.roles.cache.has(process.env.ROLE_VERIFIED_CLIENT || '');

  // Check for existing open tickets (limit to 3)
  const existingTickets = await Ticket.find({
    clientId: interaction.user.id,
    status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE] },
  });

  if (existingTickets.length >= 3) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setTitle(`${AvenloEmojis.ERROR} Ticket Limit Reached`)
          .setDescription(
            `You already have **${existingTickets.length}** open tickets.\n\n` +
            `Please wait for existing tickets to be resolved before opening new ones.\n\n` +
            `**Your open tickets:**\n` +
            existingTickets.map(t => `• \`${t.ticketId}\` - ${t.subject.slice(0, 30)}`).join('\n')
          )
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Show category selection
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:select_category')
    .setPlaceholder('📋 Select a category for your ticket...')
    .addOptions(
      Object.entries(TICKET_CATEGORY_INFO).map(([value, info]) => ({
        label: info.label,
        description: info.description,
        value,
        emoji: info.emoji,
      }))
    );

  const embed = new EmbedBuilder()
    .setColor(isVerifiedClient ? AvenloColors.GOLD : AvenloColors.CYAN)
    .setTitle(`${AvenloEmojis.TICKET} Create New Ticket`)
    .setDescription(
      isVerifiedClient
        ? `${AvenloEmojis.STAR} **Welcome back, Verified Client!**\n\n` +
          `Your ticket will be marked as **HIGH PRIORITY** with guaranteed:\n` +
          `• **2-hour** response time\n` +
          `• **24-hour** resolution target\n\n` +
          `Please select a category below to continue.`
        : `Thank you for reaching out to Avenlo Studio.\n\n` +
          `Select a category that best describes your inquiry.\n\n` +
          `*A private channel will be created just for you.*`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

// ====================================
// SELECT: Category Selection
// ====================================

export async function handleCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const category = interaction.values[0] as TicketCategory;
  const categoryInfo = TICKET_CATEGORY_INFO[category];

  // Store selection in Redis session
  const redis = getRedisClient();
  await redis.setSession(interaction.user.id, {
    ticketCategory: category,
    ticketFlow: 'creating',
    startedAt: new Date().toISOString(),
  }, 600); // 10 minute expiry

  // Show the ticket details modal
  const modal = new ModalBuilder()
    .setCustomId(`ticket:details_modal:${category}`)
    .setTitle(`${categoryInfo.emoji} ${categoryInfo.label}`);

  const subjectInput = new TextInputBuilder()
    .setCustomId('subject')
    .setLabel('Subject')
    .setPlaceholder('Brief summary of your inquiry...')
    .setStyle(TextInputStyle.Short)
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setPlaceholder('Please provide as much detail as possible...')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(20)
    .setMaxLength(2000)
    .setRequired(true);

  const priorityInput = new TextInputBuilder()
    .setCustomId('priority')
    .setLabel('Priority (low / medium / high / urgent)')
    .setPlaceholder('medium')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(priorityInput)
  );

  await interaction.showModal(modal);
}

// ====================================
// MODAL: Ticket Details Submission
// ====================================

export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const [, , categoryValue] = interaction.customId.split(':');
  const category = categoryValue as TicketCategory;
  const categoryInfo = TICKET_CATEGORY_INFO[category];

  const subject = interaction.fields.getTextInputValue('subject');
  const description = interaction.fields.getTextInputValue('description');
  const priorityInput = interaction.fields.getTextInputValue('priority')?.toLowerCase() || 'medium';

  const member = interaction.member as GuildMember;
  const guild = interaction.guild!;
  const isVerifiedClient = member.roles.cache.has(process.env.ROLE_VERIFIED_CLIENT || '');

  // Determine priority
  let priority: TicketPriority;
  if (isVerifiedClient) {
    priority = TicketPriority.HIGH; // Verified clients always get high priority
  } else {
    switch (priorityInput) {
      case 'urgent':
        priority = TicketPriority.URGENT;
        break;
      case 'high':
        priority = TicketPriority.HIGH;
        break;
      case 'low':
        priority = TicketPriority.LOW;
        break;
      default:
        priority = TicketPriority.MEDIUM;
    }
  }

  // Calculate SLA deadlines
  const now = new Date();
  const slaConfig = SLA_CONFIG[priority];
  const responseDeadline = new Date(now.getTime() + slaConfig.response * 60 * 60 * 1000);
  const resolutionDeadline = new Date(now.getTime() + slaConfig.resolution * 60 * 60 * 1000);

  // Get ticket count for ID
  const ticketCount = await Ticket.countDocuments({ guildId: guild.id });
  const ticketId = `TKT-${String(ticketCount + 1).padStart(5, '0')}`;

  // Create private ticket channel
  const ticketCategoryId = process.env.CATEGORY_TICKETS;
  const supportRoleId = process.env.ROLE_DEVELOPER;
  const managementRoleId = process.env.ROLE_MANAGEMENT;
  const moderatorRoleId = process.env.ROLE_MODERATOR;

  const channelName = `ticket-${ticketId.toLowerCase().replace('tkt-', '')}`;

  // Fetch roles to ensure they're cached
  const supportRole = supportRoleId ? guild.roles.cache.get(supportRoleId) : null;
  const managementRole = managementRoleId ? guild.roles.cache.get(managementRoleId) : null;
  const moderatorRole = moderatorRoleId ? guild.roles.cache.get(moderatorRoleId) : null;

  // Build permission overwrites
  const permissionOverwrites: any[] = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id, // Ticket creator
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  // Add Developer role permissions (only if role exists)
  if (supportRole) {
    permissionOverwrites.push({
      id: supportRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  // Add Management role permissions (only if role exists)
  if (managementRole) {
    permissionOverwrites.push({
      id: managementRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  // Add Moderator role permissions (only if role exists)
  if (moderatorRole) {
    permissionOverwrites.push({
      id: moderatorRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  try {
    // Create the private channel
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategoryId || undefined,
      topic: `${categoryInfo.emoji} ${subject} | Client: ${member.user.tag} | ${ticketId}`,
      permissionOverwrites,
    });

    // Create ticket in database
    const ticket = new Ticket({
      ticketId,
      channelId: ticketChannel.id,
      guildId: guild.id,
      clientId: member.id,
      clientName: member.user.tag,
      isVerifiedClient,
      subject,
      category,
      priority,
      status: TicketStatus.OPEN,
      sla: {
        responseDeadline,
        resolutionDeadline,
        breached: false,
      },
      messages: [
        {
          authorId: member.id,
          authorName: member.user.tag,
          content: description,
          timestamp: now,
        },
      ],
      tags: [],
    });

    await ticket.save();

    // Send welcome embed to ticket channel
    // Member sees limited buttons, staff/management see full controls
    const welcomeEmbed = buildTicketWelcomeEmbed(ticket, member, description, categoryInfo);
    
    // Row 1: Member-accessible buttons (Close, Add User)
    const memberRow = buildMemberButtons(ticket);
    
    // Row 2: Staff-only buttons (Claim, Resolve, Escalate, Transfer)
    const staffRow = buildStaffActionButtons(ticket);
    
    // Row 3: Management-only buttons (Priority, Rename, Transcript, Delete)
    const adminRow = buildManagementButtons(ticket);

    await ticketChannel.send({
      content: `${member} Welcome to your private support channel!\n\n` +
        `> 🔒 **Your buttons:** Close Ticket, Add User\n` +
        `> 👨‍💼 **Staff buttons:** Claim, Resolve, Escalate, Transfer\n` +
        `> 👑 **Management buttons:** Priority, Rename, Transcript, Delete`,
      embeds: [welcomeEmbed],
      components: [memberRow, staffRow, adminRow],
    });

    // Send SLA info
    await ticketChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.DARK_EMBED)
          .setTitle(`${AvenloEmojis.CLOCK} SLA Information`)
          .addFields(
            {
              name: 'Response Deadline',
              value: `<t:${Math.floor(responseDeadline.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: 'Resolution Target',
              value: `<t:${Math.floor(resolutionDeadline.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: 'Priority',
              value: getPriorityDisplay(priority),
              inline: true,
            }
          )
          .setFooter({ text: 'Our team strives to meet all SLA targets' }),
      ],
    });

    // Alert staff team about new ticket
    await alertSupportTeam(guild, ticket, ticketChannel);

    // Send DM notification to user
    await sendTicketCreatedDM(member, ticket, ticketChannel.id);

    // Auto-pin the welcome message if enabled
    if (TICKET_SETTINGS.autoPinTicket) {
      try {
        const messages = await ticketChannel.messages.fetch({ limit: 5 });
        const welcomeMsg = messages.find(m => m.embeds[0]?.title?.includes(ticket.ticketId));
        if (welcomeMsg) await welcomeMsg.pin();
      } catch (err) {
        logger.debug('Could not pin ticket message:', err);
      }
    }

    // Publish event
    const redis = getRedisClient();
    await redis.publish(EventTypes.TICKET_CREATED, {
      source: 'gateway',
      payload: {
        ticketId: ticket.ticketId,
        clientId: member.id,
        priority,
        isVerifiedClient,
        channelId: ticketChannel.id,
      },
    });

    logger.info(`Ticket ${ticketId} created by ${member.user.tag} [${priority}]`);

    // Reply to user
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.GREEN)
          .setTitle(`${AvenloEmojis.CHECK} Ticket Created Successfully!`)
          .setDescription(
            `Your ticket has been created and a private channel is ready.\n\n` +
            `**Ticket ID:** \`${ticketId}\`\n` +
            `**Channel:** ${ticketChannel}\n\n` +
            `Our support team will be with you shortly!`
          )
          .addFields(
            {
              name: 'Expected Response',
              value: `<t:${Math.floor(responseDeadline.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: 'Priority',
              value: getPriorityDisplay(priority),
              inline: true,
            }
          )
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp(),
      ],
    });

  } catch (error) {
    logger.error('Failed to create ticket channel:', error);
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setTitle(`${AvenloEmojis.ERROR} Ticket Creation Failed`)
          .setDescription(
            'An error occurred while creating your ticket channel.\n\n' +
            'Please try again or contact a moderator directly.'
          )
          .setFooter({ text: AvenloBranding.footer }),
      ],
    });
  }
}

// ====================================
// BUTTON: Claim Ticket
// ====================================

export async function handleClaimTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  
  if (!ticket) {
    await interaction.reply({
      content: '❌ Ticket not found.',
      ephemeral: true,
    });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canClaim) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('claim')],
      ephemeral: true,
    });
    return;
  }

  if (ticket.assignedTo) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} This ticket is already assigned to <@${ticket.assignedTo}>.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Claim the ticket
  const now = new Date();
  ticket.assignedTo = member.id;
  ticket.assignedToName = member.user.tag;
  ticket.claimedAt = now;
  ticket.status = TicketStatus.IN_PROGRESS;

  // Track first response SLA
  if (!ticket.sla.firstResponseAt) {
    ticket.sla.firstResponseAt = now;
    if (now > ticket.sla.responseDeadline) {
      ticket.sla.breached = true;
    }
  }

  // Start session
  ticket.activeSession = {
    developerId: member.id,
    developerName: member.user.tag,
    startedAt: now,
  };

  await ticket.save();

  // Award credits
  const redis = getRedisClient();
  await redis.publish(EventTypes.LEDGER_CREDITS_EARN, {
    source: 'gateway',
    payload: {
      userId: member.id,
      amount: TICKET_CREDITS.claim,
      reason: `Claimed ticket ${ticketId}`,
      type: 'ticket_claim',
    },
  });

  // Update the embed
  const channel = interaction.channel as TextChannel;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setTitle(`${AvenloEmojis.CHECK} Ticket Claimed`)
        .setDescription(
          `${member} has claimed this ticket!\n\n` +
          `**Session Timer Started** — Work time is being tracked.\n\n` +
          `*Earned +${TICKET_CREDITS.claim} credits for claiming.*`
        )
        .setTimestamp(),
    ],
  });

  // Update original message buttons
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const welcomeMessage = messages.find(m => 
      m.author.id === interaction.client.user?.id && 
      m.embeds[0]?.title?.includes(ticket.ticketId)
    );

    if (welcomeMessage) {
      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:unclaim:${ticketId}`)
          .setLabel(`Assigned: ${member.user.username}`)
          .setEmoji('👤')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`ticket:resolve:${ticketId}`)
          .setLabel('Mark Resolved')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket:close:${ticketId}`)
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),
      );

      await welcomeMessage.edit({ components: [updatedRow, welcomeMessage.components[1]] });
    }
  } catch (err) {
    logger.warn('Could not update ticket message:', err);
  }

  logger.info(`Ticket ${ticketId} claimed by ${member.user.tag}`);
}

// ====================================
// BUTTON: Close Ticket
// ====================================

export async function handleCloseTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });

  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check using new system
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canClose) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('close')],
      ephemeral: true,
    });
    return;
  }

  // Show confirmation modal
  const modal = new ModalBuilder()
    .setCustomId(`ticket:close_confirm:${ticketId}`)
    .setTitle('Close Ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Closing Reason (Optional)')
    .setPlaceholder('Briefly describe why the ticket is being closed...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  const feedbackInput = new TextInputBuilder()
    .setCustomId('feedback')
    .setLabel('How was your experience? (1-5)')
    .setPlaceholder('5')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(1);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackInput)
  );

  await interaction.showModal(modal);
}

// ====================================
// MODAL: Close Ticket Confirmation
// ====================================

export async function handleCloseTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply();

  const [, , ticketId] = interaction.customId.split(':');
  const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
  const feedbackRaw = interaction.fields.getTextInputValue('feedback') || '0';
  const feedback = parseInt(feedbackRaw) || 0;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.editReply({ content: '❌ Ticket not found.' });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const member = interaction.member as GuildMember;
  const guild = interaction.guild!;

  // End active session if exists
  if (ticket.activeSession) {
    const now = new Date();
    ticket.activeSession.endedAt = now;
    const duration = (now.getTime() - ticket.activeSession.startedAt.getTime()) / (1000 * 60 * 60);
    ticket.activeSession.creditsEarned = Math.floor(duration * TICKET_CREDITS.perHourWorked);
    ticket.sessions.push(ticket.activeSession);
    ticket.activeSession = undefined;
  }

  // Update ticket status
  ticket.status = TicketStatus.CLOSED;
  ticket.closedAt = new Date();
  ticket.closedBy = member.id;
  ticket.resolution = reason;

  await ticket.save();

  // Generate transcript
  const transcript = await generateTranscript(channel, ticket);
  
  // Send transcript to log channel
  await sendTranscriptToLogChannel(guild, ticket, transcript);

  // Send DM to ticket creator
  try {
    const ticketOwner = await guild.members.fetch(ticket.clientId);
    await sendTicketClosedDM(ticketOwner, ticket, member.user.tag, transcript);
  } catch (err) {
    logger.debug('Could not send close DM:', err);
  }

  // Rename channel if enabled
  if (TICKET_SETTINGS.renameOnClose) {
    try {
      await channel.setName(`${TICKET_SETTINGS.closedChannelPrefix}${channel.name.replace('ticket-', '')}`);
    } catch (err) {
      logger.debug('Could not rename channel on close:', err);
    }
  }

  // Lock channel - remove ticket owner's send permission
  try {
    await channel.permissionOverwrites.edit(ticket.clientId, {
      SendMessages: false,
    });
  } catch (err) {
    logger.debug('Could not lock channel:', err);
  }

  // Two-Step Ticket: Show moderator message with Reopen/Delete/Transcript buttons
  if (TICKET_SETTINGS.twoStepTicket) {
    const closeEmbed = new EmbedBuilder()
      .setColor(AvenloColors.DARK_EMBED)
      .setTitle(`${AvenloEmojis.LOCK} Ticket Closed`)
      .setDescription(
        `This ticket has been closed by ${member}.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        { name: 'Ticket ID', value: ticketId, inline: true },
        { name: 'Duration', value: getTicketDuration(ticket), inline: true },
        { name: 'Status', value: '🔒 Closed', inline: true }
      )
      .setFooter({ text: 'Use the buttons below to manage this closed ticket' })
      .setTimestamp();

    if (feedback > 0 && feedback <= 5) {
      closeEmbed.addFields({
        name: 'Client Feedback',
        value: '⭐'.repeat(feedback) + '☆'.repeat(5 - feedback),
        inline: false,
      });
    }

    // Moderator Message Buttons (TicketTool style)
    const moderatorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:reopen:${ticketId}`)
        .setLabel('Reopen')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:delete:${ticketId}`)
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket:transcript:${ticketId}`)
        .setLabel('Save Transcript')
        .setEmoji('📄')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [closeEmbed], components: [moderatorRow] });
  } else {
    // Simple close - delete after delay
    const closeEmbed = new EmbedBuilder()
      .setColor(AvenloColors.DARK_EMBED)
      .setTitle(`${AvenloEmojis.LOCK} Ticket Closed`)
      .setDescription(
        `This ticket has been closed by ${member}.\n\n` +
        `**Reason:** ${reason}`
      )
      .addFields(
        { name: 'Ticket ID', value: ticketId, inline: true },
        { name: 'Duration', value: getTicketDuration(ticket), inline: true }
      )
      .setFooter({ text: 'This channel will be deleted in 10 seconds...' })
      .setTimestamp();

    await interaction.editReply({ embeds: [closeEmbed] });

    // Delete after delay
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket ${ticketId} closed`);
      } catch (err) {
        logger.warn(`Could not delete channel for ${ticketId}:`, err);
      }
    }, 10000);
  }

  // Publish event
  const redis = getRedisClient();
  await redis.publish(EventTypes.TICKET_CLOSED, {
    source: 'gateway',
    payload: {
      ticketId,
      closedBy: member.id,
      reason,
      feedback,
    },
  });

  logger.info(`Ticket ${ticketId} closed by ${member.user.tag}`);
}

// ====================================
// BUTTON: Resolve Ticket
// ====================================

export async function handleResolveTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canResolve) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('resolve')],
      ephemeral: true,
    });
    return;
  }

  // Show resolution modal
  const modal = new ModalBuilder()
    .setCustomId(`ticket:resolve_confirm:${ticketId}`)
    .setTitle('Resolve Ticket');

  const resolutionInput = new TextInputBuilder()
    .setCustomId('resolution')
    .setLabel('Resolution Summary')
    .setPlaceholder('Describe how the issue was resolved...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(resolutionInput)
  );

  await interaction.showModal(modal);
}

// ====================================
// MODAL: Resolve Ticket Confirmation
// ====================================

export async function handleResolveTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply();

  const [, , ticketId] = interaction.customId.split(':');
  const resolution = interaction.fields.getTextInputValue('resolution');

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.editReply({ content: '❌ Ticket not found.' });
    return;
  }

  const member = interaction.member as GuildMember;
  const now = new Date();

  // Calculate work credits
  let creditsEarned = TICKET_CREDITS.resolution;
  
  if (ticket.activeSession) {
    ticket.activeSession.endedAt = now;
    const duration = (now.getTime() - ticket.activeSession.startedAt.getTime()) / (1000 * 60 * 60);
    const sessionCredits = Math.floor(duration * TICKET_CREDITS.perHourWorked);
    ticket.activeSession.creditsEarned = sessionCredits;
    creditsEarned += sessionCredits;
    ticket.sessions.push(ticket.activeSession);
    ticket.activeSession = undefined;
  }

  // Check SLA
  const slaStatus = now <= ticket.sla.resolutionDeadline ? 'met' : 'breached';
  if (slaStatus === 'breached') {
    ticket.sla.breached = true;
  }

  // Update ticket
  ticket.status = TicketStatus.RESOLVED;
  ticket.resolution = resolution;
  ticket.resolvedAt = now;

  await ticket.save();

  // Award credits
  const redis = getRedisClient();
  await redis.publish(EventTypes.LEDGER_CREDITS_EARN, {
    source: 'gateway',
    payload: {
      userId: member.id,
      amount: creditsEarned,
      reason: `Resolved ticket ${ticketId}`,
      type: 'ticket_resolution',
    },
  });

  // Send resolution embed
  const resolveEmbed = new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle(`${AvenloEmojis.CHECK} Ticket Resolved`)
    .setDescription(
      `This ticket has been marked as **Resolved** by ${member}.\n\n` +
      `**Resolution:**\n${resolution}`
    )
    .addFields(
      { 
        name: 'SLA Status', 
        value: slaStatus === 'met' ? '✅ Met' : '⚠️ Breached', 
        inline: true 
      },
      { 
        name: 'Credits Earned', 
        value: `+${creditsEarned} credits`, 
        inline: true 
      }
    )
    .setFooter({ text: `${AvenloBranding.footer} • Client can close this ticket or reopen if needed` })
    .setTimestamp();

  await interaction.editReply({ embeds: [resolveEmbed] });

  // Update buttons
  const channel = interaction.channel as TextChannel;
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const welcomeMessage = messages.find(m => 
      m.author.id === interaction.client.user?.id && 
      m.embeds[0]?.title?.includes(ticket.ticketId)
    );

    if (welcomeMessage) {
      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticketId}`)
          .setLabel('Reopen Ticket')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`ticket:close:${ticketId}`)
          .setLabel('Close & Archive')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Primary),
      );

      await welcomeMessage.edit({ components: [updatedRow] });
    }
  } catch (err) {
    logger.warn('Could not update ticket message:', err);
  }

  logger.info(`Ticket ${ticketId} resolved by ${member.user.tag} (+${creditsEarned} credits)`);
}

// ====================================
// BUTTON: Reopen Ticket
// ====================================

export async function handleReopenTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canReopen) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('reopen')],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  // Restore ticket status
  ticket.status = TicketStatus.OPEN;
  ticket.resolution = undefined;
  ticket.resolvedAt = undefined;
  ticket.closedAt = undefined;
  ticket.closedBy = undefined;
  await ticket.save();

  // Restore channel name (remove closed- prefix)
  if (TICKET_SETTINGS.renameOnClose) {
    try {
      const newName = channel.name.replace(TICKET_SETTINGS.closedChannelPrefix, 'ticket-');
      await channel.setName(newName);
    } catch (err) {
      logger.debug('Could not rename channel on reopen:', err);
    }
  }

  // Restore ticket owner's permissions
  try {
    await channel.permissionOverwrites.edit(ticket.clientId, {
      SendMessages: true,
    });
  } catch (err) {
    logger.debug('Could not restore permissions:', err);
  }

  // Send reopen message with updated buttons
  const reopenEmbed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle(`🔓 Ticket Reopened`)
    .setDescription(
      `${member} has reopened this ticket.\n\n` +
      `The support team has been notified and will continue assisting you.`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  // Restore action buttons
  const actionRow = buildTicketActionButtons(ticket);
  const infoRow = buildTicketInfoButtons(ticket);

  await interaction.reply({
    embeds: [reopenEmbed],
    components: [actionRow, infoRow],
  });

  // Notify support team
  const supportRoleId = process.env.ROLE_DEVELOPER;
  if (supportRoleId) {
    await channel.send({
      content: `📢 <@&${supportRoleId}> This ticket has been reopened and needs attention.`,
    });
  }

  logger.info(`Ticket ${ticketId} reopened by ${member.user.tag}`);
}

// ====================================
// BUTTON: Save Transcript
// ====================================

export async function handleTranscriptButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.editReply({ content: '❌ Ticket not found.' });
    return;
  }

  const channel = interaction.channel as TextChannel;

  // Generate and send transcript
  const transcript = await generateTranscript(channel, ticket);

  // Send to log channel
  await sendTranscriptToLogChannel(interaction.guild!, ticket, transcript);

  // Send to user as DM
  try {
    const dm = await member.createDM();
    await dm.send({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.CYAN)
          .setTitle(`📄 Ticket Transcript - ${ticketId}`)
          .setDescription('Your requested transcript is attached below.')
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp(),
      ],
      files: [
        {
          attachment: Buffer.from(transcript, 'utf-8'),
          name: `transcript-${ticketId}.txt`,
        },
      ],
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.GREEN)
          .setTitle('✅ Transcript Saved')
          .setDescription(
            'The transcript has been:\n' +
            '• Sent to your DMs\n' +
            '• Saved to the log channel'
          )
          .setFooter({ text: AvenloBranding.footer }),
      ],
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setTitle('⚠️ Transcript Saved (Partial)')
          .setDescription(
            'The transcript was saved to the log channel.\n\n' +
            'However, we couldn\'t DM you. Please enable DMs from server members.'
          )
          .setFooter({ text: AvenloBranding.footer }),
      ],
    });
  }

  logger.info(`Transcript saved for ticket ${ticketId} by ${member.user.tag}`);
}

// ====================================
// BUTTON: Rename Ticket
// ====================================

export async function handleRenameTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');

  const modal = new ModalBuilder()
    .setCustomId(`ticket:rename_modal:${ticketId}`)
    .setTitle('Rename Ticket Channel');

  const nameInput = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('New Channel Name')
    .setPlaceholder('support-issue-123')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(50);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
  );

  await interaction.showModal(modal);
}

export async function handleRenameTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const newName = interaction.fields.getTextInputValue('new_name');
  const channel = interaction.channel as TextChannel;
  const member = interaction.member as GuildMember;

  try {
    const oldName = channel.name;
    await channel.setName(newName);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.CYAN)
          .setTitle('✏️ Channel Renamed')
          .setDescription(`${member} renamed this channel.\n\n**From:** \`${oldName}\`\n**To:** \`${newName}\``)
          .setTimestamp(),
      ],
    });

    logger.info(`Ticket ${ticketId} renamed from ${oldName} to ${newName} by ${member.user.tag}`);
  } catch (error) {
    await interaction.reply({
      content: '❌ Failed to rename channel. Discord rate limits allow only 2 renames per 10 minutes.',
      ephemeral: true,
    });
  }
}

// ====================================
// BUTTON: Escalate Ticket
// ====================================

export async function handleEscalateTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canEscalate) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('escalate')],
      ephemeral: true,
    });
    return;
  }

  // Already at highest priority
  if (ticket.priority === TicketPriority.URGENT) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setDescription(`${AvenloEmojis.ERROR} This ticket is already at **URGENT** priority.`)
          .setFooter({ text: AvenloBranding.footer }),
      ],
      ephemeral: true,
    });
    return;
  }

  // Escalate priority
  const priorityOrder = [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT];
  const currentIndex = priorityOrder.indexOf(ticket.priority);
  const newPriority = priorityOrder[Math.min(currentIndex + 1, priorityOrder.length - 1)];

  ticket.priority = newPriority;
  
  // Update SLA deadlines
  const now = new Date();
  const slaConfig = SLA_CONFIG[newPriority];
  ticket.sla.responseDeadline = new Date(now.getTime() + slaConfig.response * 60 * 60 * 1000);
  ticket.sla.resolutionDeadline = new Date(now.getTime() + slaConfig.resolution * 60 * 60 * 1000);
  
  await ticket.save();

  const channel = interaction.channel as TextChannel;
  
  // Alert management if escalated to high or urgent
  if (newPriority === TicketPriority.HIGH || newPriority === TicketPriority.URGENT) {
    const managementRoleId = process.env.ROLE_MANAGEMENT;
    const studioLeadRoleId = process.env.ROLE_STUDIO_LEAD;
    const mentions: string[] = [];
    if (managementRoleId) mentions.push(`<@&${managementRoleId}>`);
    if (newPriority === TicketPriority.URGENT && studioLeadRoleId) mentions.push(`<@&${studioLeadRoleId}>`);
    
    await channel.send({
      content: `🚨 **Ticket Escalated!** ${mentions.join(' ')}`,
    });
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.GOLD)
        .setTitle(`⬆️ Ticket Escalated`)
        .setDescription(
          `${member} has escalated this ticket.\n\n` +
          `**New Priority:** ${getPriorityDisplay(newPriority)}\n` +
          `**New Response Deadline:** <t:${Math.floor(ticket.sla.responseDeadline.getTime() / 1000)}:R>`
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp(),
    ],
  });

  logger.info(`Ticket ${ticketId} escalated to ${newPriority} by ${member.user.tag}`);
}

// ====================================
// BUTTON: Change Priority (Admin Only)
// ====================================

export async function handleChangePriorityButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check - requires admin level
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canChangePriority) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('change priority')],
      ephemeral: true,
    });
    return;
  }

  // Show priority select menu
  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ticket:priority_select:${ticketId}`)
      .setPlaceholder('Select new priority...')
      .addOptions(
        {
          label: 'Low Priority',
          value: TicketPriority.LOW,
          emoji: '🟢',
          description: 'Non-urgent, can wait',
        },
        {
          label: 'Medium Priority',
          value: TicketPriority.MEDIUM,
          emoji: '🟡',
          description: 'Standard support request',
        },
        {
          label: 'High Priority',
          value: TicketPriority.HIGH,
          emoji: '🟠',
          description: 'Requires prompt attention',
        },
        {
          label: 'Urgent Priority',
          value: TicketPriority.URGENT,
          emoji: '🔴',
          description: 'Critical - immediate attention needed',
        }
      )
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.PURPLE)
        .setTitle('🎯 Change Ticket Priority')
        .setDescription(`Current priority: **${getPriorityDisplay(ticket.priority)}**\n\nSelect a new priority below:`)
        .setFooter({ text: AvenloBranding.footer }),
    ],
    components: [selectRow],
    ephemeral: true,
  });
}

export async function handlePrioritySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const newPriority = interaction.values[0] as TicketPriority;
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  const oldPriority = ticket.priority;
  ticket.priority = newPriority;

  // Update SLA deadlines
  const now = new Date();
  const slaConfig = SLA_CONFIG[newPriority];
  ticket.sla.responseDeadline = new Date(now.getTime() + slaConfig.response * 60 * 60 * 1000);
  ticket.sla.resolutionDeadline = new Date(now.getTime() + slaConfig.resolution * 60 * 60 * 1000);
  
  await ticket.save();

  const channel = interaction.channel as TextChannel;
  
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.GOLD)
        .setTitle('🎯 Priority Changed')
        .setDescription(
          `${member} changed the ticket priority.\n\n` +
          `**From:** ${getPriorityDisplay(oldPriority)}\n` +
          `**To:** ${getPriorityDisplay(newPriority)}`
        )
        .setTimestamp(),
    ],
  });

  await interaction.update({
    content: `✅ Priority updated to **${getPriorityDisplay(newPriority)}**`,
    embeds: [],
    components: [],
  });

  logger.info(`Ticket ${ticketId} priority changed from ${oldPriority} to ${newPriority} by ${member.user.tag}`);
}

// ====================================
// BUTTON: Add User to Ticket
// ====================================

export async function handleAddUserButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canAddUser) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('add users')],
      ephemeral: true,
    });
    return;
  }

  // Show user select menu
  const selectRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ticket:user_select:${ticketId}`)
      .setPlaceholder('Select a user to add...')
      .setMaxValues(1)
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setTitle('👥 Add User to Ticket')
        .setDescription('Select a user to add to this ticket. They will be able to view and send messages in this channel.')
        .setFooter({ text: AvenloBranding.footer }),
    ],
    components: [selectRow],
    ephemeral: true,
  });
}

// ====================================
// BUTTON: Transfer Ticket
// ====================================

export async function handleTransferTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canTransfer) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('transfer')],
      ephemeral: true,
    });
    return;
  }

  // Show user select menu for transfer
  const selectRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ticket:transfer_select:${ticketId}`)
      .setPlaceholder('Select staff member to transfer to...')
      .setMaxValues(1)
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.PURPLE)
        .setTitle('🔄 Transfer Ticket')
        .setDescription('Select a staff member to transfer this ticket to. They will become the new assigned developer.')
        .setFooter({ text: AvenloBranding.footer }),
    ],
    components: [selectRow],
    ephemeral: true,
  });
}

// ====================================
// BUTTON: Delete Ticket (Admin Only)
// ====================================

export async function handleDeleteTicketButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  // Permission check - Admin only
  const permissions = getTicketPermissions(member, ticket);
  if (!permissions.canDelete) {
    await interaction.reply({
      embeds: [buildPermissionDeniedEmbed('delete')],
      ephemeral: true,
    });
    return;
  }

  // Confirmation button
  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:delete_confirm:${ticketId}`)
      .setLabel('Yes, Delete Ticket')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket:delete_cancel:${ticketId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(AvenloColors.RED)
        .setTitle('⚠️ Delete Ticket')
        .setDescription(
          `Are you sure you want to **permanently delete** ticket \`${ticketId}\`?\n\n` +
          `This action **cannot be undone**. The ticket data and channel will be immediately deleted.`
        )
        .setFooter({ text: AvenloBranding.footer }),
    ],
    components: [confirmRow],
    ephemeral: true,
  });
}

export async function handleDeleteConfirmButton(interaction: ButtonInteraction): Promise<void> {
  const [, , ticketId] = interaction.customId.split(':');
  const member = interaction.member as GuildMember;

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;

  // Delete ticket from database
  await Ticket.deleteOne({ ticketId });

  await interaction.update({
    content: `🗑️ Ticket \`${ticketId}\` deleted. Channel will be removed in 3 seconds...`,
    embeds: [],
    components: [],
  });

  // Delete channel
  setTimeout(async () => {
    try {
      await channel.delete(`Ticket ${ticketId} deleted by ${member.user.tag}`);
    } catch (err) {
      logger.warn(`Could not delete channel for ${ticketId}:`, err);
    }
  }, 3000);

  logger.info(`Ticket ${ticketId} permanently deleted by ${member.user.tag}`);
}

// ====================================
// BUTTON: FAQ
// ====================================

export async function handleFaqButton(interaction: ButtonInteraction): Promise<void> {
  const faqEmbed = new EmbedBuilder()
    .setColor(AvenloColors.DARK_EMBED)
    .setTitle(`📚 Avenlo Support — FAQ`)
    .setDescription(
      `Here are answers to the most commonly asked questions about our support system.`
    )
    .addFields(
      {
        name: '🕐 How long until I get a response?',
        value: 
          `• **Urgent:** 30 minutes\n` +
          `• **High:** 2 hours\n` +
          `• **Medium:** 8 hours\n` +
          `• **Low:** 24 hours\n` +
          `Verified clients receive priority support.`,
      },
      {
        name: '⭐ What is a Verified Client?',
        value: 'Verified Clients are users with active paid projects. They receive HIGH priority by default, dedicated project channels, and direct access to senior developers.',
      },
      {
        name: '🎫 Can I have multiple tickets?',
        value: 'Yes, you can have up to 3 open tickets at a time. Each ticket creates its own private channel.',
      },
      {
        name: '🔒 How do I close my ticket?',
        value: 'Click the "Close Ticket" button in your ticket channel. You\'ll be asked to provide a reason and feedback rating.',
      },
      {
        name: '📄 What about transcripts?',
        value: 'When a ticket is closed, a transcript is automatically generated and sent to you via DM. Staff can also save transcripts at any time.',
      },
      {
        name: '🔓 Can I reopen a closed ticket?',
        value: 'Yes! Closed tickets remain accessible for a period. Use the "Reopen" button if you need further assistance on the same issue.',
      },
      {
        name: '👥 Can I add someone to my ticket?',
        value: 'Staff members can add users to tickets. If you need to include someone, ask the assigned staff member.',
      }
    )
    .setFooter({ text: `${AvenloBranding.footer} • Need more help? Open a ticket!` })
    .setTimestamp();

  await interaction.reply({
    embeds: [faqEmbed],
    ephemeral: true,
  });
}

// ====================================
// HELPER FUNCTIONS
// ====================================

function buildTicketWelcomeEmbed(
  ticket: any,
  member: GuildMember,
  description: string,
  categoryInfo: any
): EmbedBuilder {
  const priorityColors: Record<string, number> = {
    [TicketPriority.LOW]: AvenloColors.CYAN,
    [TicketPriority.MEDIUM]: AvenloColors.CYAN,
    [TicketPriority.HIGH]: AvenloColors.GOLD,
    [TicketPriority.URGENT]: AvenloColors.RED,
  };

  return new EmbedBuilder()
    .setColor(priorityColors[ticket.priority] || AvenloColors.CYAN)
    .setTitle(`${categoryInfo.emoji} ${ticket.ticketId}: ${ticket.subject}`)
    .setDescription(
      `**Client:** ${member}\n` +
      `**Category:** ${categoryInfo.label}\n` +
      `**Priority:** ${getPriorityDisplay(ticket.priority)}\n` +
      `**Status:** 🟢 Open\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**Description:**\n${description}`
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ 
      text: `${AvenloBranding.footer} • Created`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();
}

// ====================================
// ROLE-BASED BUTTON BUILDERS
// ====================================

// Buttons visible to EVERYONE (ticket creator included)
function buildMemberButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticket.ticketId}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:add_user:${ticket.ticketId}`)
      .setLabel('Add User')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary),
  );
}

// Buttons visible to STAFF ONLY (Moderator, Developer, Management)
function buildStaffActionButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticket.ticketId}`)
      .setLabel('Claim Ticket')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:resolve:${ticket.ticketId}`)
      .setLabel('Mark Resolved')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ticket:escalate:${ticket.ticketId}`)
      .setLabel('Escalate')
      .setEmoji('⬆️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:transfer:${ticket.ticketId}`)
      .setLabel('Transfer')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );
}

// Buttons visible to MANAGEMENT ONLY
function buildManagementButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:priority:${ticket.ticketId}`)
      .setLabel('Priority')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:rename:${ticket.ticketId}`)
      .setLabel('Rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:transcript:${ticket.ticketId}`)
      .setLabel('Transcript')
      .setEmoji('📄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:delete:${ticket.ticketId}`)
      .setLabel('Delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
  );
}

// Legacy functions for backwards compatibility
function buildTicketActionButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return buildStaffActionButtons(ticket);
}

function buildTicketInfoButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return buildMemberButtons(ticket);
}

function buildTicketAdminButtons(ticket: any): ActionRowBuilder<ButtonBuilder> {
  return buildManagementButtons(ticket);
}

function getPriorityDisplay(priority: TicketPriority): string {
  const displays: Record<string, string> = {
    [TicketPriority.LOW]: '🟢 Low',
    [TicketPriority.MEDIUM]: '🟡 Medium',
    [TicketPriority.HIGH]: '🟠 High',
    [TicketPriority.URGENT]: '🔴 Urgent',
  };
  return displays[priority] || '🟡 Medium';
}

function getTicketDuration(ticket: any): string {
  if (!ticket.createdAt) return 'N/A';
  const now = ticket.closedAt || new Date();
  const ms = now.getTime() - ticket.createdAt.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

async function alertSupportTeam(guild: any, ticket: any, channel: TextChannel): Promise<void> {
  const managementRoleId = process.env.ROLE_MANAGEMENT;
  const moderatorRoleId = process.env.ROLE_MODERATOR;
  const developerRoleId = process.env.ROLE_DEVELOPER;
  const studioLeadRoleId = process.env.ROLE_STUDIO_LEAD;

  // Build role mentions - always include management, moderator, and developer
  const mentions: string[] = [];
  if (managementRoleId) mentions.push(`<@&${managementRoleId}>`);
  if (moderatorRoleId) mentions.push(`<@&${moderatorRoleId}>`);
  if (developerRoleId) mentions.push(`<@&${developerRoleId}>`);
  
  // Add Studio Lead for urgent tickets
  if (ticket.priority === TicketPriority.URGENT && studioLeadRoleId) {
    mentions.push(`<@&${studioLeadRoleId}>`);
  }

  if (mentions.length === 0) return;

  // Determine embed color and message based on priority
  const isHighPriority = ticket.priority === TicketPriority.HIGH || ticket.priority === TicketPriority.URGENT;
  const embedColor = ticket.isVerifiedClient 
    ? AvenloColors.GOLD 
    : isHighPriority 
      ? AvenloColors.RED 
      : AvenloColors.CYAN;

  await channel.send({
    content: `🎫 **New Ticket Alert!** ${mentions.join(' ')}`,
    embeds: [
      new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`📋 New Support Ticket`)
        .setDescription(
          `A new ticket has been created and requires attention.\n\n` +
          `**Ticket ID:** \`${ticket.ticketId}\`\n` +
          `**Subject:** ${ticket.subject}\n` +
          `**Priority:** ${getPriorityDisplay(ticket.priority)}\n` +
          `**Category:** ${ticket.category.replace(/_/g, ' ')}` +
          (ticket.isVerifiedClient ? `\n\n⭐ **Verified Client** - Priority Support Required!` : '')
        )
        .addFields(
          {
            name: '⏰ Response Deadline',
            value: `<t:${Math.floor(ticket.sla.responseDeadline.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: '🎯 Resolution Target',
            value: `<t:${Math.floor(ticket.sla.resolutionDeadline.getTime() / 1000)}:R>`,
            inline: true,
          }
        )
        .setFooter({ text: 'Click "Claim Ticket" to start working on this ticket' })
        .setTimestamp(),
    ],
  });
}

// Export all handlers
export const TicketHandlers = {
  deployPanel: deployTicketPanel,
  handleCreateButton: handleCreateTicketButton,
  handleCategorySelect,
  handleTicketModal,
  handleClaimButton: handleClaimTicketButton,
  handleCloseButton: handleCloseTicketButton,
  handleCloseModal: handleCloseTicketModal,
  handleResolveButton: handleResolveTicketButton,
  handleResolveModal: handleResolveTicketModal,
  handleReopenButton: handleReopenTicketButton,
  handleFaqButton,
  // Permission-based handlers
  handleEscalateButton: handleEscalateTicketButton,
  handleChangePriorityButton: handleChangePriorityButton,
  handlePrioritySelect: handlePrioritySelect,
  handleAddUserButton: handleAddUserButton,
  handleTransferButton: handleTransferTicketButton,
  handleDeleteButton: handleDeleteTicketButton,
  handleDeleteConfirmButton: handleDeleteConfirmButton,
  // TicketTool feature parity
  handleTranscriptButton: handleTranscriptButton,
  handleRenameButton: handleRenameTicketButton,
  handleRenameModal: handleRenameTicketModal,
};
