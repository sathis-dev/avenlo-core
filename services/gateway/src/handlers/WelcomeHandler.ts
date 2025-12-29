// ====================================
// AVENLO CORE - WELCOME SYSTEM
// Beautiful AI-Enhanced Welcome Messages
// ====================================

import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  Guild,
  Role,
} from 'discord.js';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('welcome-system');

// ====================================
// CHANNEL IDS
// ====================================
const CHANNELS = {
  welcome: '1382631780825305085',
  rules: '1382631780825305088',
  information: '1382631780825305089',
  roles: '1382631780825305090',
  studioNews: '1382631782087860227',
  ourWork: '1382631782087860228',
  activeProjects: '1382631782087860229',
  tickets: '1382631783031468035',
  faqKnowledgeBase: '1382631783031468036',
  bugReports: '1382631783031468037',
  suggestions: '1382631783031468038',
};

// ====================================
// CONFIGURATION
// ====================================

export const WELCOME_CONFIG = {
  // Channel ID for welcome messages
  welcomeChannelId: CHANNELS.welcome,
  
  // Auto-assign roles on join
  autoRoles: [
    // Add role IDs that should be auto-assigned
  ] as string[],
  
  // Welcome message settings
  showMemberCount: true,
  showAccountAge: true,
  showServerInfo: true,
  mentionUser: true,
  
  // Verification settings
  requireVerification: false,
  verificationRoleId: '',
  verifiedRoleId: '',
};

// ====================================
// WELCOME EMBED BUILDER
// ====================================

function formatAccountAge(createdAt: Date): string {
  const now = new Date();
  const diff = now.getTime() - createdAt.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getAccountAgeWarning(createdAt: Date): { isNew: boolean; message: string; color: number } {
  const now = new Date();
  const diff = now.getTime() - createdAt.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 1) {
    return { isNew: true, message: '⚠️ Account created today', color: AvenloColors.RED };
  } else if (days < 7) {
    return { isNew: true, message: `⚠️ Account ${days} days old`, color: AvenloColors.YELLOW };
  } else if (days < 30) {
    return { isNew: false, message: `Account ${days} days old`, color: AvenloColors.CYAN };
  }
  
  return { isNew: false, message: formatAccountAge(createdAt), color: AvenloColors.GREEN };
}

function getMemberMilestone(count: number): string {
  if (count === 100) return '🎉 **100th Member!**';
  if (count === 500) return '🎊 **500th Member!**';
  if (count === 1000) return '🎆 **1000th Member!**';
  if (count === 5000) return '⭐ **5000th Member!**';
  if (count === 10000) return '💫 **10000th Member!**';
  if (count % 100 === 0) return `🎯 **${count}th Member!**`;
  return '';
}

export function buildWelcomeEmbed(member: GuildMember): EmbedBuilder {
  const guild = member.guild;
  const memberCount = guild.memberCount;
  const accountAge = getAccountAgeWarning(member.user.createdAt);
  const milestone = getMemberMilestone(memberCount);
  
  // Create stunning welcome embed - optimized for mobile & desktop
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.PURPLE)
    .setAuthor({
      name: '✨ WELCOME TO AVENLO STUDIO ✨',
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(`🎉 ${member.user.displayName} just joined!`)
    .setDescription(
      `Hey ${member}! Welcome to **AVENLO STUDIO**! 🚀\n\n` +
      `We're a creative development studio where\n` +
      `**innovation meets creativity**.\n\n` +
      `${milestone ? `${milestone}\n\n` : ''}` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .addFields(
      {
        name: '📋 Get Started',
        value: 
          `**1.** Read rules → <#${CHANNELS.rules}>\n` +
          `**2.** Get roles → <#${CHANNELS.roles}>\n` +
          `**3.** Server info → <#${CHANNELS.information}>`,
        inline: true,
      },
      {
        name: '🎨 Explore',
        value: 
          `**📢** <#${CHANNELS.studioNews}>\n` +
          `**🖼️** <#${CHANNELS.ourWork}>\n` +
          `**🚀** <#${CHANNELS.activeProjects}>`,
        inline: true,
      },
      {
        name: '\u200b',
        value: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        inline: false,
      },
      {
        name: '👤 About You',
        value: 
          `> **Tag:** \`${member.user.tag}\`\n` +
          `> **ID:** \`${member.id}\`\n` +
          `> **Joined:** ${accountAge.message}`,
        inline: true,
      },
      {
        name: '📊 Server Info',
        value: 
          `> **Members:** \`${memberCount.toLocaleString()}\`\n` +
          `> **You are:** Member #${memberCount}\n` +
          `> **Status:** ${accountAge.isNew ? '⚠️ New' : '✅ Verified'}`,
        inline: true,
      },
      {
        name: '\u200b',
        value: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        inline: false,
      },
      {
        name: '🎫 Need Help?',
        value: `Create a ticket in <#${CHANNELS.tickets}>\nOur team typically responds within 30 mins!`,
        inline: false,
      }
    )
    .setImage('https://i.imgur.com/AfFp7pu.png')
    .setFooter({
      text: `${AvenloBranding.footer} • Member #${memberCount}`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();
  
  return embed;
}

export function buildWelcomeButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('welcome:rules')
      .setLabel('Read Rules')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('welcome:roles')
      .setLabel('Get Roles')
      .setEmoji('🎭')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('welcome:help')
      .setLabel('Get Help')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('Website')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Link)
      .setURL(AvenloBranding.website),
  );
}

// ====================================
// DM WELCOME MESSAGE
// ====================================

export async function sendWelcomeDM(member: GuildMember): Promise<boolean> {
  try {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.PURPLE)
      .setAuthor({
        name: '✨ AVENLO STUDIO ✨',
        iconURL: member.guild.iconURL() || undefined,
      })
      .setTitle(`Welcome, ${member.user.displayName}! 🎉`)
      .setDescription(
        `Hey **${member.user.displayName}**!\n\n` +
        `Thanks for joining **Avenlo Studio**!\n` +
        `We're a creative development studio where\n` +
        `innovation meets creativity.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🚀 What We Do',
          value: 
            `> 🎨 Creative Design\n` +
            `> 💻 Software Development\n` +
            `> 🤖 AI & Automation\n` +
            `> 🎮 Game Development`,
          inline: true,
        },
        {
          name: '📋 First Steps',
          value: 
            `> 📜 Read the rules\n` +
            `> 🎭 Get your roles\n` +
            `> 📖 Check server info\n` +
            `> 🎫 Need help? Ticket!`,
          inline: true,
        },
        {
          name: '\u200b',
          value: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          inline: false,
        },
        {
          name: '💡 Pro Tips',
          value: 
            `• Be respectful and kind to everyone\n` +
            `• Ask questions! We love helping\n` +
            `• Check out our showcase channels\n` +
            `• Have fun and make connections!`,
          inline: false,
        }
      )
      .setThumbnail(member.guild.iconURL({ size: 256 }) || '')
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('🏠 Go to Server')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${member.guild.id}`),
      new ButtonBuilder()
        .setLabel('🌐 Our Website')
        .setStyle(ButtonStyle.Link)
        .setURL(AvenloBranding.website),
    );
    
    await member.send({ embeds: [embed], components: [buttons] });
    return true;
  } catch (error) {
    logger.debug(`Could not send welcome DM to ${member.user.tag}`);
    return false;
  }
}

// ====================================
// GOODBYE MESSAGE
// ====================================

export function buildGoodbyeEmbed(member: GuildMember | { user: { tag: string; id: string; displayAvatarURL: () => string }; guild: Guild }): EmbedBuilder {
  const guild = member.guild;
  
  return new EmbedBuilder()
    .setColor(AvenloColors.GRAY)
    .setAuthor({
      name: '👋 Member Left',
      iconURL: guild.iconURL() || undefined,
    })
    .setDescription(
      `**${member.user.tag}** has left the server.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `We hope to see you again!\n\n` +
      `**Members:** \`${guild.memberCount.toLocaleString()}\``
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ 
      text: `${AvenloBranding.footer} • ID: ${member.user.id}`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();
}

// ====================================
// AUTO ROLE ASSIGNMENT
// ====================================

export async function assignAutoRoles(member: GuildMember): Promise<Role[]> {
  const assignedRoles: Role[] = [];
  
  for (const roleId of WELCOME_CONFIG.autoRoles) {
    try {
      const role = member.guild.roles.cache.get(roleId);
      if (role && !member.roles.cache.has(roleId)) {
        await member.roles.add(role, 'Auto-role assignment on join');
        assignedRoles.push(role);
      }
    } catch (error) {
      logger.error(`Failed to assign auto-role ${roleId}:`, error);
    }
  }
  
  return assignedRoles;
}

// ====================================
// MAIN HANDLER
// ====================================

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const guild = member.guild;
  
  // Send welcome message in channel
  const welcomeChannel = guild.channels.cache.get(WELCOME_CONFIG.welcomeChannelId) as TextChannel;
  
  if (welcomeChannel) {
    const embed = buildWelcomeEmbed(member);
    const buttons = buildWelcomeButtons();
    
    const content = WELCOME_CONFIG.mentionUser ? `${member}` : undefined;
    
    await welcomeChannel.send({
      content,
      embeds: [embed],
      components: [buttons],
    });
  }
  
  // Send DM welcome
  await sendWelcomeDM(member);
  
  // Assign auto-roles
  const assignedRoles = await assignAutoRoles(member);
  if (assignedRoles.length > 0) {
    logger.debug(`Assigned ${assignedRoles.length} auto-roles to ${member.user.tag}`);
  }
  
  logger.info(`👋 ${member.user.tag} joined ${guild.name} (Member #${guild.memberCount})`);
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const guild = member.guild;
  
  // Send goodbye message
  const welcomeChannel = guild.channels.cache.get(WELCOME_CONFIG.welcomeChannelId) as TextChannel;
  
  if (welcomeChannel) {
    const embed = buildGoodbyeEmbed(member);
    await welcomeChannel.send({ embeds: [embed] });
  }
  
  logger.info(`👋 ${member.user.tag} left ${guild.name} (Now ${guild.memberCount} members)`);
}

// ====================================
// BUTTON HANDLERS
// ====================================

export async function handleWelcomeButton(
  interaction: any,
  action: string
): Promise<void> {
  const member = interaction.member as GuildMember;
  
  switch (action) {
    case 'rules':
      const rulesEmbed = new EmbedBuilder()
        .setColor(AvenloColors.PURPLE)
        .setTitle('📜 Community Rules')
        .setDescription(
          `**Read our full rules in <#${CHANNELS.rules}>**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Quick Summary:**\n\n` +
          `> 🤝 **Respect** — Be kind to everyone\n` +
          `> 💬 **Clean** — No NSFW or inappropriate content\n` +
          `> 🚫 **No Spam** — Keep it meaningful\n` +
          `> 🔒 **Privacy** — Protect personal info\n` +
          `> 📢 **Right Channels** — Post in correct places\n` +
          `> 👮 **Listen to Staff** — Follow mod instructions\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `*Violations may result in warnings, timeouts, or bans.*`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      const rulesButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('📜 View Full Rules')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${interaction.guildId}/${CHANNELS.rules}`)
      );
      
      await interaction.reply({ embeds: [rulesEmbed], components: [rulesButton], ephemeral: true });
      break;
      
    case 'roles':
      const rolesEmbed = new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setTitle('🎭 Customize Your Profile')
        .setDescription(
          `**Get your roles in <#${CHANNELS.roles}>**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Available Roles:**\n\n` +
          `> 🎨 **Color Roles** — Stand out with custom colors\n` +
          `> 🔔 **Notification Roles** — Get pinged for updates\n` +
          `> 💻 **Tech Stack Roles** — Show your skills\n` +
          `> 🎮 **Interest Roles** — Find your community\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `*React to messages to claim your roles!*`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      const rolesButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🎭 Get Roles')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${interaction.guildId}/${CHANNELS.roles}`)
      );
      
      await interaction.reply({ embeds: [rolesEmbed], components: [rolesButton], ephemeral: true });
      break;
      
    case 'help':
      const helpEmbed = new EmbedBuilder()
        .setColor(AvenloColors.GREEN)
        .setTitle('❓ Need Assistance?')
        .setDescription(
          `**We're here to help!**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**🎫 Support Ticket**\n` +
          `> Create a ticket in <#${CHANNELS.tickets}>\n` +
          `> *Average response: ~30 mins*\n\n` +
          `**📖 Knowledge Base**\n` +
          `> Check our FAQ at <#${CHANNELS.faqKnowledgeBase}>\n` +
          `> *Common questions answered*\n\n` +
          `**🐛 Bug Reports**\n` +
          `> Report issues in <#${CHANNELS.bugReports}>\n` +
          `> *Help us improve*\n\n` +
          `**💡 Suggestions**\n` +
          `> Share ideas in <#${CHANNELS.suggestions}>\n` +
          `> *We love feedback*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      const helpButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🎫 Create Ticket')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${interaction.guildId}/${CHANNELS.tickets}`),
        new ButtonBuilder()
          .setLabel('📖 FAQ')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${interaction.guildId}/${CHANNELS.faqKnowledgeBase}`)
      );
      
      await interaction.reply({ embeds: [helpEmbed], components: [helpButtons], ephemeral: true });
      break;
  }
}

// ====================================
// EXPORTS
// ====================================

export const WelcomeHandlers = {
  handleMemberJoin,
  handleMemberLeave,
  handleWelcomeButton,
  buildWelcomeEmbed,
  buildWelcomeButtons,
  buildGoodbyeEmbed,
  sendWelcomeDM,
  assignAutoRoles,
};

export default WelcomeHandlers;
