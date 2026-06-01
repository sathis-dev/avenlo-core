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
  JoinEvent,
  type IJoinEvent,
} from '@avenlo/shared';
import { buildWelcomeAttachment } from './WelcomeCard';
import { welcomeConfigStore } from './WelcomeConfigStore';
import {
  resolveWelcomeChannel,
  resolveTextChannel,
  resolveChannel,
} from './ChannelResolver';
import { liveBus } from './LiveBus';
import { generatePersonalizedGreeting } from './AIWelcome';

const logger = createLogger('welcome-system');

// ====================================
// DYNAMIC CHANNEL FINDER
// (delegates to ChannelResolver, which handles emoji-prefixed channel names)
// ====================================

function mentionChannel(guild: Guild, idOrName: string, fallbackName: string): string {
  const c = resolveChannel(guild, idOrName) ?? resolveChannel(guild, fallbackName);
  return c ? `<#${c.id}>` : `#${fallbackName}`;
}

function getChannelLinks(
  guild: Guild,
  config: WelcomeConfigData,
): {
  welcome: string;
  rules: string;
  information: string;
  roles: string;
  tickets: string;
  faq: string;
} {
  return {
    welcome: mentionChannel(guild, config.welcomeChannelId || config.channelName, 'welcome'),
    rules: mentionChannel(guild, config.rulesChannelId, 'rules'),
    information: mentionChannel(guild, '', 'information'),
    roles: mentionChannel(guild, config.rolesChannelId, 'roles'),
    tickets: mentionChannel(guild, '', 'tickets'),
    faq: mentionChannel(guild, '', 'faq-knowledge-base'),
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
  /** Optional AI-generated personalized greeting (1-2 lines) */
  personalizedGreeting?: string;
  /** When true, render "Welcome back" style messaging */
  returningMember?: boolean;
  /** When true, render a warning that the account was auto-quarantined */
  quarantined?: boolean;
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
  const ch = getChannelLinks(guild, config);

  const interpVars: Record<string, string> = {
    member: member.user.displayName,
    mention: `<@${member.id}>`,
    guild: guild.name,
    memberCount: memberCount.toLocaleString(),
  };

  const title = opts.returningMember
    ? `🔁 Welcome back, ${member.user.displayName}`
    : interpolate(config.titleTemplate, interpVars);

  const baseBody = interpolate(config.bodyTemplate, interpVars);
  const body = opts.personalizedGreeting
    ? `${opts.personalizedGreeting}\n\n${baseBody}`
    : baseBody;

  const banners: string[] = [];
  if (opts.returningMember) banners.push('🔁 **Returning member detected** — welcome home!');
  if (opts.quarantined)
    banners.push(
      '🔒 **Account auto-quarantined** — your account is very new; a moderator will review shortly.',
    );

  const embed = new EmbedBuilder()
    .setColor(hexToInt(config.embedAccentColor))
    .setAuthor({
      name: `${AvenloBranding.name.toUpperCase()} • NEW ARRIVAL`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(title)
    .setDescription(
      (banners.length ? banners.join('\n') + '\n\n' : '') +
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

interface SendWelcomeDMOptions {
  personalizedGreeting?: string;
  showVerifyButton?: boolean;
}

export async function sendWelcomeDM(
  member: GuildMember,
  config: WelcomeConfigData,
  opts: SendWelcomeDMOptions = {},
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
        (opts.personalizedGreeting ? `${opts.personalizedGreeting}\n\n` : '') +
        `Thanks for joining **${member.guild.name}**.\n` +
        `${config.cardTagline}\n\n` +
        (opts.showVerifyButton
          ? `Tap **Verify Me** below to unlock the rest of the server.\n\n`
          : '') +
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

    const buttons = buildDMVerificationButtons(
      member.guild.id,
      opts.showVerifyButton ?? false,
    );

    await member.send({ embeds: [embed], components: [buttons] });
    return true;
  } catch (err) {
    logger.debug(`Could not send welcome DM to ${member.user.tag}`, err);
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
// JOIN EVENT LOGGING + RETURNING MEMBER DETECTION
// ====================================

async function recordJoinEvent(
  member: GuildMember,
  config: WelcomeConfigData,
  personalizedGreeting?: string,
): Promise<IJoinEvent> {
  const priorJoins = config.returningMemberEnabled
    ? await JoinEvent.countDocuments({
        guildId: member.guild.id,
        userId: member.id,
      })
    : 0;

  const evt = await JoinEvent.create({
    guildId: member.guild.id,
    userId: member.id,
    username: member.user.username,
    displayName: member.user.displayName ?? member.user.username,
    avatarUrl: member.user.displayAvatarURL({ size: 256 }),
    accountCreatedAt: member.user.createdAt,
    joinedAt: new Date(),
    priorJoins,
    stages: [{ stage: 'joined', at: new Date() }],
    personalizedGreeting,
  });
  return evt;
}

async function appendStage(
  guildId: string,
  userId: string,
  stage: IJoinEvent['stages'][number]['stage'],
): Promise<void> {
  try {
    await JoinEvent.findOneAndUpdate(
      { guildId, userId },
      { $push: { stages: { stage, at: new Date() } } },
      { sort: { joinedAt: -1 } },
    );
  } catch (err) {
    logger.debug('Failed to append stage', err);
  }
}

// ====================================
// ACCOUNT SAFETY / QUARANTINE
// ====================================

async function applyQuarantineIfSuspicious(
  member: GuildMember,
  config: WelcomeConfigData,
): Promise<boolean> {
  if (!config.quarantineNewAccounts || !config.pendingRoleId) return false;
  const ageHours =
    (Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours >= config.quarantineHours) return false;
  try {
    const role = member.guild.roles.cache.get(config.pendingRoleId);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(
        role,
        `Auto-quarantine: account age ${ageHours.toFixed(1)}h < ${config.quarantineHours}h`,
      );
      logger.warn(
        `🔒 Quarantined ${member.user.tag} (account age ${ageHours.toFixed(1)}h)`,
      );
      return true;
    }
  } catch (err) {
    logger.error('Failed to apply quarantine role', err);
  }
  return false;
}

// ====================================
// DM VERIFICATION BUTTON BUILDER
// ====================================

function buildDMVerificationButtons(
  guildId: string,
  showVerify: boolean,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (showVerify) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('welcome:verify')
        .setLabel('Verify Me')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setLabel('🏠 Go to Server')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guildId}`),
    new ButtonBuilder()
      .setLabel('🌐 Website')
      .setStyle(ButtonStyle.Link)
      .setURL(AvenloBranding.website),
  );
  return row;
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

  // Optional: AI personalized 1-liner
  let personalizedGreeting: string | undefined;
  if (config.aiPersonalizedEnabled) {
    try {
      personalizedGreeting = await generatePersonalizedGreeting({
        username: member.user.username,
        displayName: member.user.displayName ?? member.user.username,
        guildName: guild.name,
      });
    } catch (err) {
      logger.debug('AI personalized greeting failed (continuing without)', err);
    }
  }

  // Persistent join log + returning-member detection
  const joinEvt = await recordJoinEvent(member, config, personalizedGreeting);

  // Account-safety quarantine
  const quarantined = await applyQuarantineIfSuspicious(member, config);
  if (quarantined) {
    await JoinEvent.updateOne(
      { _id: joinEvt._id },
      { quarantined: true, $push: { stages: { stage: 'quarantined', at: new Date() } } },
    );
  }

  // Resolve welcome channel using the new robust resolver
  const welcomeChannel = resolveWelcomeChannel(guild, {
    welcomeChannelId: config.welcomeChannelId,
    channelName: config.channelName,
  });

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

    const embed = buildWelcomeEmbed(member, config, {
      cardFilename,
      personalizedGreeting,
      returningMember: joinEvt.priorJoins > 0,
      quarantined,
    });
    const buttons = buildWelcomeButtons();

    await welcomeChannel.send({
      content: config.mentionUser ? `${member}` : undefined,
      embeds: [embed],
      components: [buttons],
      files: attachment ? [attachment] : undefined,
    });
    await appendStage(guild.id, member.id, 'welcomed');
  } else {
    logger.warn(
      `No welcome channel found for ${guild.name} (configured: id="${config.welcomeChannelId}", name="${config.channelName}")`,
    );
  }

  await sendWelcomeDM(member, config, {
    personalizedGreeting,
    showVerifyButton: Boolean(config.verifiedRoleId) && !quarantined,
  });

  const assignedRoles = await assignAutoRoles(member, config);
  if (assignedRoles.length > 0) {
    logger.debug(`Assigned ${assignedRoles.length} auto-roles to ${member.user.tag}`);
  }

  // Broadcast over Socket.IO live bus for the dashboard's live-joins widget
  liveBus.broadcast({
    type: 'member:join',
    guildId: guild.id,
    userId: member.id,
    username: member.user.username,
    displayName: member.user.displayName ?? member.user.username,
    avatarUrl: member.user.displayAvatarURL({ size: 256 }),
    memberCount: guild.memberCount,
    quarantined,
    returning: joinEvt.priorJoins > 0,
    personalizedGreeting,
    at: new Date().toISOString(),
  });

  logger.info(
    `👋 ${member.user.tag} joined ${guild.name} (Member #${guild.memberCount}` +
      (joinEvt.priorJoins > 0 ? `, returning, prior=${joinEvt.priorJoins}` : '') +
      (quarantined ? ', QUARANTINED' : '') +
      ')',
  );
}

export async function handleMemberLeave(
  member: GuildMember | PartialMemberLike
): Promise<void> {
  const guild = member.guild;
  const config = await welcomeConfigStore.get(guild.id);

  const goodbyeChannel = resolveWelcomeChannel(guild, {
    welcomeChannelId: config.welcomeChannelId,
    channelName: config.channelName,
  });

  if (goodbyeChannel) {
    const embed = buildGoodbyeEmbed(member);
    await goodbyeChannel.send({ embeds: [embed] });
  }

  try {
    await JoinEvent.findOneAndUpdate(
      { guildId: guild.id, userId: member.user.id },
      {
        leftAt: new Date(),
        $push: { stages: { stage: 'left', at: new Date() } },
      },
      { sort: { joinedAt: -1 } },
    );
  } catch (err) {
    logger.debug('Failed to update leftAt on JoinEvent', err);
  }

  liveBus.broadcast({
    type: 'member:leave',
    guildId: guild.id,
    userId: member.user.id,
    username: member.user.tag,
    memberCount: guild.memberCount,
    at: new Date().toISOString(),
  });

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

  const config = await welcomeConfigStore.get(guild.id);
  const ch = getChannelLinks(guild, config);

  const rulesChannel = resolveTextChannel(guild, config.rulesChannelId || 'rules');
  const ticketsChannel = resolveTextChannel(guild, 'tickets');
  const faqChannel = resolveTextChannel(guild, 'faq-knowledge-base');
  const rulesChannelId = rulesChannel?.id ?? null;
  const ticketsChannelId = ticketsChannel?.id ?? null;
  const faqChannelId = faqChannel?.id ?? null;

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

    case 'verify': {
      try {
        const role =
          (config.verifiedRoleId && guild.roles.cache.get(config.verifiedRoleId)) || null;
        if (!role) {
          await interaction.reply({
            content: '⚠️ No verified role is configured. Ask an admin to set one in the dashboard.',
            ephemeral: true,
          });
          return;
        }
        const targetMember =
          interaction.member && 'roles' in interaction.member
            ? await guild.members.fetch(interaction.user.id).catch(() => null)
            : await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!targetMember) {
          await interaction.reply({
            content: '⚠️ Could not locate your member object — try again from inside the server.',
            ephemeral: true,
          });
          return;
        }
        if (targetMember.roles.cache.has(role.id)) {
          await interaction.reply({
            content: '✅ You are already verified.',
            ephemeral: true,
          });
          return;
        }
        await targetMember.roles.add(role, 'Welcome verification');
        await JoinEvent.findOneAndUpdate(
          { guildId: guild.id, userId: interaction.user.id },
          {
            verified: true,
            verifiedAt: new Date(),
            $push: { stages: { stage: 'verified', at: new Date() } },
          },
          { sort: { joinedAt: -1 } },
        );
        liveBus.broadcast({
          type: 'member:verified',
          guildId: guild.id,
          userId: interaction.user.id,
          username: interaction.user.username,
          at: new Date().toISOString(),
        });
        await interaction.reply({
          content: `✅ Verified! You now have the **${role.name}** role.`,
          ephemeral: true,
        });
      } catch (err) {
        logger.error('Verification failed', err);
        await interaction.reply({
          content: '⚠️ Verification failed. A moderator has been notified.',
          ephemeral: true,
        });
      }
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
