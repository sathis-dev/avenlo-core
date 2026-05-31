// ====================================
// AVENLO CORE - WELCOME SYSTEM
// Dynamic canvas card + premium embed + hot-reloadable config
// ====================================

import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  AttachmentBuilder,
  Guild,
  Role,
} from 'discord.js';
import {
  createLogger,
  AvenloColors,
  AvenloBranding,
  type WelcomeConfigData,
} from '@avenlo/shared';
import { buildWelcomeAttachment } from './WelcomeCard';
import { welcomeConfigStore } from './WelcomeConfigStore';

const logger = createLogger('welcome-system');

// ====================================
// DYNAMIC CHANNEL FINDER
// ====================================

function findChannel(guild: Guild, name: string): string {
  const channel = guild.channels.cache.find(
    c => c.name.toLowerCase().replace(/-/g, '') === name.toLowerCase().replace(/-/g, '') ||
         c.name.toLowerCase() === name.toLowerCase()
  );
  return channel ? `<#${channel.id}>` : `#${name}`;
}

function findChannelId(guild: Guild, name: string): string | null {
  const channel = guild.channels.cache.find(
    c => c.name.toLowerCase().replace(/-/g, '') === name.toLowerCase().replace(/-/g, '') ||
         c.name.toLowerCase() === name.toLowerCase()
  );
  return channel?.id || null;
}

function getChannelLinks(guild: Guild): {
  welcome: string;
  rules: string;
  information: string;
  roles: string;
  tickets: string;
  faq: string;
} {
  return {
    welcome: findChannel(guild, 'welcome'),
    rules: findChannel(guild, 'rules'),
    information: findChannel(guild, 'information'),
    roles: findChannel(guild, 'roles'),
    tickets: findChannel(guild, 'tickets'),
    faq: findChannel(guild, 'faq-knowledge-base'),
  };
}

// ====================================
// TEMPLATE INTERPOLATION
// ====================================

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (full, key: string) => {
    return key in vars ? vars[key] : full;
  });
}

// ====================================
// ACCOUNT-AGE HELPERS
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

interface AccountAgeInfo {
  isNew: boolean;
  message: string;
  color: number;
}

function getAccountAgeWarning(createdAt: Date): AccountAgeInfo {
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

// ====================================
// COLOR HELPERS
// ====================================

function hexToInt(hex: string): number {
  const cleaned = hex.replace(/^#/, '');
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : AvenloColors.GOLD;
}

// ====================================
// SOVEREIGN EMBED BUILDER
// ====================================

interface BuildEmbedOptions {
  /** When provided, the embed will reference the welcome card via attachment://filename */
  cardFilename?: string;
}

/**
 * Build the premium welcome embed. Uses the gold accent colour from the
 * config and pulls live server stats into dynamic fields.
 */
export function buildWelcomeEmbed(
  member: GuildMember,
  config: WelcomeConfigData,
  opts: BuildEmbedOptions = {}
): EmbedBuilder {
  const guild = member.guild;
  const memberCount = guild.memberCount;
  const accountAge = getAccountAgeWarning(member.user.createdAt);
  const milestone = getMemberMilestone(memberCount);
  const ch = getChannelLinks(guild);

  const interpVars: Record<string, string> = {
    member: member.user.displayName,
    mention: `<@${member.id}>`,
    guild: guild.name,
    memberCount: memberCount.toLocaleString(),
  };

  const title = interpolate(config.titleTemplate, interpVars);
  const body = interpolate(config.bodyTemplate, interpVars);

  const embed = new EmbedBuilder()
    .setColor(hexToInt(config.embedAccentColor))
    .setAuthor({
      name: `${AvenloBranding.name.toUpperCase()} • NEW ARRIVAL`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(title)
    .setDescription(
      `${body}\n` +
      (milestone ? `\n${milestone}\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: '📋 Get Started',
        value:
          `**1.** Read rules → ${ch.rules}\n` +
          `**2.** Get roles → ${ch.roles}\n` +
          `**3.** Server info → ${ch.information}`,
        inline: true,
      },
      {
        name: '📊 Server Stats',
        value:
          (config.showMemberCount
            ? `> **Member Count:** \`${memberCount.toLocaleString()}\`\n`
            : '') +
          `> **You are:** Member #${memberCount}\n` +
          `> **Status:** ${accountAge.isNew ? '⚠️ New Account' : '✅ Verified'}`,
        inline: true,
      },
      {
        name: '\u200b',
        value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        inline: false,
      },
      {
        name: '👤 About You',
        value:
          `> **Tag:** \`${member.user.tag}\`\n` +
          `> **ID:** \`${member.id}\`\n` +
          (config.showAccountAge ? `> **Joined Discord:** ${accountAge.message}\n` : '') +
          `> **Tagline:** ${config.cardTagline}`,
        inline: true,
      },
      {
        name: '🎫 Need Help?',
        value: `Open a ticket in ${ch.tickets}\nWe respond within 30 mins.`,
        inline: true,
      }
    )
    .setFooter({
      text: `${AvenloBranding.footer} • Member #${memberCount}`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();

  if (opts.cardFilename) {
    embed.setImage(`attachment://${opts.cardFilename}`);
  } else {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 512 }));
  }

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

export async function sendWelcomeDM(
  member: GuildMember,
  config: WelcomeConfigData
): Promise<boolean> {
  if (!config.dmEnabled) return false;

  try {
    const embed = new EmbedBuilder()
      .setColor(hexToInt(config.embedAccentColor))
      .setAuthor({
        name: `${AvenloBranding.name.toUpperCase()}`,
        iconURL: member.guild.iconURL() || undefined,
      })
      .setTitle(`Welcome, ${member.user.displayName}!`)
      .setDescription(
        `Hey **${member.user.displayName}**!\n\n` +
        `Thanks for joining **${member.guild.name}**.\n` +
        `${config.cardTagline}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
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
          name: '💡 Pro Tips',
          value:
            `• Be respectful and kind\n` +
            `• Ask questions — we love helping\n` +
            `• Check out our showcase channels\n` +
            `• Have fun and make connections!`,
          inline: true,
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
  } catch {
    logger.debug(`Could not send welcome DM to ${member.user.tag}`);
    return false;
  }
}

// ====================================
// GOODBYE MESSAGE
// ====================================

interface PartialMemberLike {
  user: { tag: string; id: string; displayAvatarURL: () => string };
  guild: Guild;
}

export function buildGoodbyeEmbed(member: GuildMember | PartialMemberLike): EmbedBuilder {
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

export async function assignAutoRoles(
  member: GuildMember,
  config: WelcomeConfigData
): Promise<Role[]> {
  const assignedRoles: Role[] = [];

  for (const roleId of config.autoRoleIds) {
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
// CHANNEL RESOLUTION (config-driven)
// ====================================

function findWelcomeChannel(guild: Guild, name: string): TextChannel | null {
  const normalized = name.toLowerCase().replace(/-/g, '');
  const channel = guild.channels.cache.find(
    c =>
      c.isTextBased() &&
      (c.name.toLowerCase() === name.toLowerCase() ||
        c.name.toLowerCase().replace(/-/g, '') === normalized)
  );
  return (channel as TextChannel | undefined) ?? null;
}

// ====================================
// MAIN HANDLER (full join sequence)
// ====================================

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const config = await welcomeConfigStore.get(guild.id);

  if (!config.enabled) {
    logger.debug(`Welcome disabled for ${guild.name}, skipping ${member.user.tag}`);
    return;
  }

  const welcomeChannel =
    findWelcomeChannel(guild, config.channelName) ??
    findWelcomeChannel(guild, 'welcome') ??
    findWelcomeChannel(guild, 'general') ??
    (guild.systemChannel as TextChannel | null);

  if (welcomeChannel) {
    let attachment: AttachmentBuilder | undefined;
    let cardFilename: string | undefined;

    if (config.cardEnabled) {
      try {
        const built = await buildWelcomeAttachment(member, config);
        attachment = built.attachment;
        cardFilename = built.filename;
      } catch (err) {
        logger.error('Failed to render welcome card — falling back to embed only', err);
      }
    }

    const embed = buildWelcomeEmbed(member, config, { cardFilename });
    const buttons = buildWelcomeButtons();

    await welcomeChannel.send({
      content: config.mentionUser ? `${member}` : undefined,
      embeds: [embed],
      components: [buttons],
      files: attachment ? [attachment] : undefined,
    });
  } else {
    logger.warn(`No welcome channel found for ${guild.name}`);
  }

  await sendWelcomeDM(member, config);

  const assignedRoles = await assignAutoRoles(member, config);
  if (assignedRoles.length > 0) {
    logger.debug(`Assigned ${assignedRoles.length} auto-roles to ${member.user.tag}`);
  }

  logger.info(`👋 ${member.user.tag} joined ${guild.name} (Member #${guild.memberCount})`);
}

export async function handleMemberLeave(
  member: GuildMember | PartialMemberLike
): Promise<void> {
  const guild = member.guild;
  const config = await welcomeConfigStore.get(guild.id);

  const goodbyeChannel =
    findWelcomeChannel(guild, config.channelName) ??
    findWelcomeChannel(guild, 'welcome') ??
    findWelcomeChannel(guild, 'general') ??
    (guild.systemChannel as TextChannel | null);

  if (goodbyeChannel) {
    const embed = buildGoodbyeEmbed(member);
    await goodbyeChannel.send({ embeds: [embed] });
  }

  logger.info(`👋 ${member.user.tag} left ${guild.name} (Now ${guild.memberCount} members)`);
}

// ====================================
// BUTTON HANDLERS
// ====================================

export async function handleWelcomeButton(
  interaction: ButtonInteraction,
  action: string
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This action requires a guild context.', ephemeral: true });
    return;
  }

  const ch = getChannelLinks(guild);

  const rulesChannelId = findChannelId(guild, 'rules');
  const ticketsChannelId = findChannelId(guild, 'tickets');
  const faqChannelId = findChannelId(guild, 'faq-knowledge-base');

  switch (action) {
    case 'rules': {
      const rulesEmbed = new EmbedBuilder()
        .setColor(AvenloColors.PURPLE)
        .setTitle('📜 Community Rules')
        .setDescription(
          `**Read our full rules in ${ch.rules}**\n\n` +
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

      if (rulesChannelId) {
        const rulesButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('📜 View Full Rules')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${interaction.guildId}/${rulesChannelId}`)
        );
        await interaction.reply({ embeds: [rulesEmbed], components: [rulesButton], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [rulesEmbed], ephemeral: true });
      }
      break;
    }

    case 'roles': {
      const rolesEmbed = new EmbedBuilder()
        .setColor(AvenloColors.CYAN)
        .setTitle('🎭 Customize Your Profile')
        .setDescription(
          `**Get your roles in ${ch.roles}**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Pick the roles that match your interests so people can find you and you can find the right channels.`
        )
        .setFooter({ text: AvenloBranding.footer });
      await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
      break;
    }

    case 'help': {
      const helpEmbed = new EmbedBuilder()
        .setColor(AvenloColors.BLUE)
        .setTitle('❓ Need Help?')
        .setDescription(
          (ticketsChannelId
            ? `Open a ticket: <#${ticketsChannelId}>\n`
            : `Open a ticket in ${ch.tickets}\n`) +
          (faqChannelId
            ? `Read the FAQ: <#${faqChannelId}>\n`
            : `Read the FAQ in ${ch.faq}\n`) +
          `\nOur team typically responds within 30 minutes.`
        )
        .setFooter({ text: AvenloBranding.footer });
      await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      break;
    }

    default:
      await interaction.reply({
        content: `Unknown welcome action: \`${action}\``,
        ephemeral: true,
      });
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
