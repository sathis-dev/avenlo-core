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
// CONFIGURATION
// ====================================

export const WELCOME_CONFIG = {
  // Channel ID for welcome messages
  welcomeChannelId: process.env.CHANNEL_WELCOME || '',
  
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
  
  // Create stunning welcome embed
  const embed = new EmbedBuilder()
    .setColor(accountAge.color)
    .setAuthor({
      name: 'WELCOME TO AVENLO STUDIO',
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(`${member.user.username} just joined!`)
    .setDescription(
      `Hey ${member}! Welcome to **${guild.name}**! 🎉\n\n` +
      `We're thrilled to have you here! This is where creativity meets code.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${milestone ? milestone + '\n\n' : ''}` +
      `📋 **Get Started:**\n` +
      `> 1️⃣ Read our rules in <#rules>\n` +
      `> 2️⃣ Grab your roles in <#roles>\n` +
      `> 3️⃣ Introduce yourself in <#introductions>\n` +
      `> 4️⃣ Start chatting in <#general>\n\n` +
      `🎫 Need help? Open a ticket anytime!`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .addFields(
      {
        name: '👤 Member Info',
        value: 
          `**Username:** ${member.user.tag}\n` +
          `**ID:** \`${member.id}\`\n` +
          `**Created:** ${accountAge.message}`,
        inline: true,
      },
      {
        name: '📊 Server Stats',
        value: 
          `**Members:** ${memberCount.toLocaleString()}\n` +
          `**Online:** ${guild.members.cache.filter(m => m.presence?.status === 'online').size}\n` +
          `**Your #:** #${memberCount}`,
        inline: true,
      }
    )
    .setImage('https://i.imgur.com/AfFp7pu.png') // Banner image
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
      .setLabel('📜 Read Rules')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('welcome:roles')
      .setLabel('🎭 Get Roles')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('welcome:help')
      .setLabel('❓ Get Help')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🌐 Website')
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
      .setColor(AvenloColors.CYAN)
      .setAuthor({
        name: member.guild.name,
        iconURL: member.guild.iconURL() || undefined,
      })
      .setTitle(`Welcome to ${member.guild.name}! 👋`)
      .setDescription(
        `Hey **${member.user.username}**!\n\n` +
        `Thanks for joining our community. Here's everything you need to know:\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🚀 About Us',
          value: 
            `Avenlo Studio is a creative development studio building ` +
            `innovative solutions. We're a community of developers, designers, ` +
            `and creators passionate about technology.`,
          inline: false,
        },
        {
          name: '📋 Quick Links',
          value: 
            `• **Rules** — Please read and follow our community guidelines\n` +
            `• **Roles** — Select roles to customize your experience\n` +
            `• **Support** — Create a ticket for any assistance`,
          inline: false,
        },
        {
          name: '🎯 Pro Tips',
          value: 
            `• Be respectful and kind to all members\n` +
            `• Ask questions! We love helping newcomers\n` +
            `• Check out our projects and contribute\n` +
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
      name: 'Member Left',
      iconURL: guild.iconURL() || undefined,
    })
    .setDescription(
      `**${member.user.tag}** has left the server.\n\n` +
      `We now have **${guild.memberCount}** members.`
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `ID: ${member.user.id}` })
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
        .setColor(AvenloColors.BLUE)
        .setTitle('📜 Server Rules')
        .setDescription(
          `**Welcome to ${interaction.guild.name}!**\n\n` +
          `Please follow these rules to maintain a positive community:\n\n` +
          `**1. 🤝 Be Respectful**\n` +
          `> Treat everyone with kindness and respect.\n\n` +
          `**2. 🚫 No Harassment**\n` +
          `> Bullying, threats, or discrimination are not tolerated.\n\n` +
          `**3. 🔞 Keep it Clean**\n` +
          `> No NSFW content in any channel.\n\n` +
          `**4. 📢 No Spam**\n` +
          `> Avoid excessive messages, caps, or mentions.\n\n` +
          `**5. 🎭 No Impersonation**\n` +
          `> Don't pretend to be someone you're not.\n\n` +
          `**6. 🔗 No Unauthorized Ads**\n` +
          `> Ask before promoting servers or content.\n\n` +
          `**7. 🛡️ Follow Discord ToS**\n` +
          `> Abide by Discord's Terms of Service.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Violations may result in warnings, mutes, kicks, or bans.`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      await interaction.reply({ embeds: [rulesEmbed], ephemeral: true });
      break;
      
    case 'roles':
      const rolesEmbed = new EmbedBuilder()
        .setColor(AvenloColors.PURPLE)
        .setTitle('🎭 Available Roles')
        .setDescription(
          `Head over to our roles channel to customize your experience!\n\n` +
          `**Available Categories:**\n` +
          `> 🎨 **Color Roles** — Customize your name color\n` +
          `> 🔔 **Ping Roles** — Get notified for updates\n` +
          `> 💻 **Tech Roles** — Show your expertise\n` +
          `> 🎮 **Interest Roles** — Find like-minded people`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
      break;
      
    case 'help':
      const helpEmbed = new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setTitle('❓ Need Help?')
        .setDescription(
          `Here's how to get assistance:\n\n` +
          `**🎫 Open a Ticket**\n` +
          `> Use \`/ticket\` or click the button in our ticket channel.\n\n` +
          `**💬 Ask in Chat**\n` +
          `> Post your question in the general or help channel.\n\n` +
          `**📚 Check Resources**\n` +
          `> Browse our FAQ and documentation channels.\n\n` +
          `**👤 Contact Staff**\n` +
          `> Ping a moderator if it's urgent.`
        )
        .setFooter({ text: AvenloBranding.footer });
      
      await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
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
  buildGoodbyeEmbed,
  sendWelcomeDM,
  assignAutoRoles,
};

export default WelcomeHandlers;
