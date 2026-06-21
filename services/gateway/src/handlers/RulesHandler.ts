// ====================================
// AVENLO CORE - RULES HANDLER
// Premium rules embed + accept button + captcha gate + LiveBus broadcast
// Mirrors the Welcome v3 Core pattern: Mongo + Redis + LiveBus + funnel.
// ====================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  AvenloBranding,
  AvenloColors,
  createLogger,
  EventTypes,
  JoinEvent,
  RuleAcceptance,
  RulesConfig,
  type RulesAcceptedPayload,
  type RulesConfigData,
  type RuleEntry,
  type RulesPublishedPayload,
} from '@avenlo/shared';

import { resolveTextChannel } from './ChannelResolver';
import { liveBus } from './LiveBus';
import { rulesConfigStore } from './RulesConfigStore';
import { hasCompletedVerification, grantVerifiedAndMember } from './VerificationHandler';

const logger = createLogger('rules-system');

// ====================================
// COLOR / SEVERITY HELPERS
// ====================================

function hexToInt(hex: string): number {
  const cleaned = hex.replace(/^#/, '');
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : AvenloColors.CYAN;
}

function severityBadge(sev: RuleEntry['severity']): string {
  switch (sev) {
    case 'info':
      return '🟦 INFO';
    case 'warn':
      return '🟡 WARN';
    case 'mute':
      return '🟠 MUTE';
    case 'kick':
      return '🔴 KICK';
    case 'ban':
      return '⛔ BAN';
    default:
      return '';
  }
}

// ====================================
// EMBED BUILDERS
// ====================================

export function buildRulesHeaderEmbed(
  guild: Guild,
  config: RulesConfigData,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToInt(config.accentColor))
    .setAuthor({
      name: guild.name,
      iconURL: guild.iconURL({ size: 128 }) ?? undefined,
    })
    .setTitle(config.headerTitle)
    .setDescription(
      `${config.headerSubtitle}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    )
    .setThumbnail(guild.iconURL({ size: 256 }) ?? AvenloBranding.iconUrl);
}

function chunkRules<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function buildRulesEmbeds(config: RulesConfigData): EmbedBuilder[] {
  if (config.rules.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(hexToInt(config.accentColor))
        .setDescription(
          '_No rules have been configured yet. Use the dashboard to add some._',
        ),
    ];
  }

  return chunkRules(config.rules, 4).map((batch) => {
    let description = '';
    for (const rule of batch) {
      const sev = severityBadge(rule.severity);
      description += `### ${rule.icon} Rule ${rule.number}: ${rule.title}\n`;
      if (sev) description += `> ${sev}\n`;
      if (rule.body) description += `> ${rule.body.replace(/\n/g, '\n> ')}\n\n`;
      else description += '\n';
    }
    return new EmbedBuilder()
      .setColor(hexToInt(config.accentColor))
      .setDescription(description.trim());
  });
}

export function buildRulesFooterEmbed(config: RulesConfigData): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToInt(config.accentColor))
    .setDescription(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `${config.footerText}\n\n` +
        '_Click **I Accept the Rules** below to unlock full access._',
    )
    .setFooter({
      text: `${AvenloBranding.footer} • Community Guidelines`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();
}

export function buildRulesButtons(
  gate: RulesConfigData['acceptanceGate'],
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (gate === 'captcha') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('rules:accept-captcha')
        .setLabel('✅ I Accept (with captcha)')
        .setStyle(ButtonStyle.Success),
    );
  } else if (gate === 'button') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('rules:accept')
        .setLabel('✅ I Accept the Rules')
        .setStyle(ButtonStyle.Success),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('rules:ticket')
      .setLabel('🎫 Ask Staff')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🌐 Website')
      .setStyle(ButtonStyle.Link)
      .setURL(AvenloBranding.website),
  );

  return row;
}

// ====================================
// PUBLISH (post or edit the rules embed in the configured channel)
// ====================================

export interface PublishOptions {
  publishedBy?: string;
  forceRepost?: boolean;
}

export interface PublishResult {
  ok: true;
  channelId: string;
  messageId: string;
  edited: boolean;
}

export interface PublishFailure {
  ok: false;
  error: string;
}

export async function publishRulesToGuild(
  guild: Guild,
  opts: PublishOptions = {},
): Promise<PublishResult | PublishFailure> {
  const config = await rulesConfigStore.get(guild.id);

  if (!config.enabled) {
    return { ok: false, error: 'Rules system is disabled for this guild' };
  }

  const channel =
    resolveTextChannel(guild, config.rulesChannelId || config.channelName) ??
    resolveTextChannel(guild, 'rules');

  if (!channel) {
    return { ok: false, error: 'No rules channel found (configure one in the dashboard)' };
  }

  const headerEmbed = buildRulesHeaderEmbed(guild, config);
  const rulesEmbeds = buildRulesEmbeds(config);
  const footerEmbed = buildRulesFooterEmbed(config);
  const buttons = buildRulesButtons(config.acceptanceGate);

  // Try to edit the existing message first when configured.
  let edited = false;
  let message: Message | null = null;

  if (!opts.forceRepost && config.lastPostedMessageId) {
    try {
      const existing = await channel.messages.fetch(config.lastPostedMessageId).catch(() => null);
      if (existing) {
        message = await existing.edit({
          embeds: [headerEmbed, ...rulesEmbeds, footerEmbed],
          components: [buttons],
        });
        edited = true;
      }
    } catch (err) {
      logger.debug('Failed to edit existing rules message — will repost', err);
    }
  }

  if (!message) {
    message = await channel.send({
      embeds: [headerEmbed, ...rulesEmbeds, footerEmbed],
      components: [buttons],
    });
  }

  // Pin if requested (best-effort)
  if (config.pinAfterPost) {
    try {
      await message.pin().catch(() => undefined);
    } catch (err) {
      logger.debug('Failed to pin rules message', err);
    }
  }

  // Persist last-posted pointer
  try {
    await RulesConfig.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          lastPostedAt: new Date(),
          lastPostedMessageId: message.id,
        },
        $setOnInsert: { guildId: guild.id },
      },
      { upsert: true, new: true },
    ).exec();
  } catch (err) {
    logger.warn('Failed to persist last-posted pointer', err);
  }

  // LiveBus broadcast for dashboards
  liveBus.broadcast({
    type: 'mod:action',
    guildId: guild.id,
    at: new Date().toISOString(),
    action: 'rules:published',
    rulesChannelId: channel.id,
    messageId: message.id,
    publishedBy: opts.publishedBy ?? 'system',
    rulesCount: config.rules.length,
  });

  // Optional typed pub/sub event (best-effort)
  try {
    const { getRedisClient } = await import('@avenlo/shared');
    const redis = getRedisClient();
    if (redis) {
      const payload: RulesPublishedPayload = {
        guildId: guild.id,
        rulesChannelId: channel.id,
        messageId: message.id,
        publishedBy: opts.publishedBy ?? 'system',
        rulesCount: config.rules.length,
        at: new Date().toISOString(),
      };
      redis
        .publish(EventTypes.RULES_PUBLISHED, { source: 'gateway', payload })
        .catch(() => undefined);
    }
  } catch {
    // ignore — redis is optional
  }

  return { ok: true, channelId: channel.id, messageId: message.id, edited };
}

export async function publishRulesByGuildId(
  client: { guilds: { cache: { get(id: string): Guild | undefined } } },
  guildId: string,
  opts: PublishOptions = {},
): Promise<PublishResult | PublishFailure> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: `Guild ${guildId} not in cache` };
  return publishRulesToGuild(guild, opts);
}

// ====================================
// ACCEPTANCE (button + captcha + funnel)
// ====================================

async function recordAcceptance(
  guild: Guild,
  member: GuildMember,
  config: RulesConfigData,
  method: 'button' | 'captcha' | 'command',
  rulesMessageId?: string,
): Promise<{ memberRoleGranted: boolean }> {
  let memberRoleGranted = false;

  if (config.memberRoleId) {
    const role = guild.roles.cache.get(config.memberRoleId);
    if (role && !member.roles.cache.has(role.id)) {
      try {
        await member.roles.add(role, 'Accepted server rules');
        memberRoleGranted = true;
      } catch (err) {
        logger.error(`Failed to assign member role ${config.memberRoleId}`, err);
      }
    } else if (role) {
      memberRoleGranted = true;
    }
  }

  const rulesVersion = `${config.rules.length}-${config.rules.map((r) => r.id).join(',').slice(0, 60)}`;

  try {
    await RuleAcceptance.findOneAndUpdate(
      { guildId: guild.id, userId: member.id },
      {
        $set: {
          username: member.user.username,
          acceptedAt: new Date(),
          method,
          rulesVersion,
          rulesMessageId,
          memberRoleGranted,
        },
        $setOnInsert: { guildId: guild.id, userId: member.id },
      },
      { upsert: true, new: true },
    ).exec();
  } catch (err) {
    logger.error('Failed to persist rule acceptance', err);
  }

  try {
    await JoinEvent.findOneAndUpdate(
      { guildId: guild.id, userId: member.id },
      { $push: { stages: { stage: 'accepted-rules', at: new Date() } } },
      { sort: { joinedAt: -1 } },
    );
  } catch (err) {
    logger.debug('Failed to append accepted-rules stage', err);
  }

  // Broadcast on LiveBus
  liveBus.broadcast({
    type: 'member:verified',
    guildId: guild.id,
    userId: member.id,
    username: member.user.username,
    action: 'rules:accepted',
    method,
    memberRoleGranted,
    at: new Date().toISOString(),
  });

  // Optional typed event
  try {
    const { getRedisClient } = await import('@avenlo/shared');
    const redis = getRedisClient();
    if (redis) {
      const payload: RulesAcceptedPayload = {
        guildId: guild.id,
        userId: member.id,
        username: member.user.username,
        method,
        memberRoleGranted,
        acceptedAt: new Date().toISOString(),
      };
      redis
        .publish(EventTypes.RULES_ACCEPTED, { source: 'gateway', payload })
        .catch(() => undefined);
    }
  } catch {
    // ignore
  }

  return { memberRoleGranted };
}

export async function handleAcceptButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This must be used inside a server.', ephemeral: true });
    return;
  }

  const config = await rulesConfigStore.get(guild.id);
  if (!config.enabled) {
    await interaction.reply({
      content: '⚠️ Rules system is currently disabled by an admin.',
      ephemeral: true,
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({
      content: '⚠️ Could not locate your member object — try again from inside the server.',
      ephemeral: true,
    });
    return;
  }

  // Already accepted?
  const existing = await RuleAcceptance.findOne({
    guildId: guild.id,
    userId: member.id,
  }).exec();

  if (existing) {
    await interaction.reply({
      content: '✅ You have already accepted the rules.',
      ephemeral: true,
    });
    return;
  }

  // Block rules acceptance until verification is completed
  const isVerified = await hasCompletedVerification(guild.id, member.id);
  if (!isVerified) {
    await interaction.reply({
      content:
        '⚠️ **Please complete verification first.**\n' +
        'Go to <#1511101077184053388> and click **Begin Verification** to unlock the server.',
      ephemeral: true,
    });
    return;
  }

  // Grant Verified + Member roles now that both verification and rules are complete
  await grantVerifiedAndMember(member);

  const { memberRoleGranted } = await recordAcceptance(
    guild,
    member,
    config,
    'button',
    interaction.message.id,
  );

  const lines = [
    `✅ **Thanks for accepting the rules, ${interaction.user}!**`,
    '',
    memberRoleGranted
      ? `You now have the **Member** and **Verified** roles — full server access unlocked.`
      : `Acceptance recorded. (No member role configured — ask an admin to set one in the dashboard.)`,
  ];

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });

  logger.info(`📜 ${member.user.tag} accepted rules in ${guild.name}`);
}

// Captcha modal flow

export async function handleAcceptCaptchaButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This must be used inside a server.', ephemeral: true });
    return;
  }
  const config = await rulesConfigStore.get(guild.id);

  const existing = await RuleAcceptance.findOne({
    guildId: guild.id,
    userId: interaction.user.id,
  }).exec();
  if (existing) {
    await interaction.reply({
      content: '✅ You have already accepted the rules.',
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('rules:captcha-submit')
    .setTitle('Confirm you are human')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('rules-captcha-input')
          .setLabel(config.captchaPrompt.slice(0, 45) || 'Answer the question')
          .setPlaceholder('Type your answer here')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(50)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

export async function handleCaptchaSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This must be used inside a server.', ephemeral: true });
    return;
  }
  const config = await rulesConfigStore.get(guild.id);
  const answer = interaction.fields.getTextInputValue('rules-captcha-input').trim();

  if (
    answer.localeCompare(config.captchaAnswer.trim(), undefined, {
      sensitivity: 'base',
    }) !== 0
  ) {
    await interaction.reply({
      content: '❌ That answer is incorrect. Please try again.',
      ephemeral: true,
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({
      content: '⚠️ Could not locate your member object — rejoin the server and retry.',
      ephemeral: true,
    });
    return;
  }

  // Block rules acceptance until verification is completed
  const isVerified = await hasCompletedVerification(guild.id, member.id);
  if (!isVerified) {
    await interaction.reply({
      content:
        '⚠️ **Please complete verification first.**\n' +
        'Go to <#1511101077184053388> and click **Begin Verification** to unlock the server.',
      ephemeral: true,
    });
    return;
  }

  // Grant Verified + Member roles now that both verification and rules are complete
  await grantVerifiedAndMember(member);

  const { memberRoleGranted } = await recordAcceptance(
    guild,
    member,
    config,
    'captcha',
    interaction.message?.id,
  );

  await interaction.reply({
    content: memberRoleGranted
      ? `✅ Verified! You now have the **Member** and **Verified** roles.`
      : `✅ Acceptance recorded.`,
    ephemeral: true,
  });

  logger.info(`📜 ${member.user.tag} passed captcha + accepted rules in ${guild.name}`);
}

// Ask staff / ticket button

export async function handleAskStaffButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const guild = interaction.guild;
  const ticketsChannel = guild
    ? resolveTextChannel(guild, 'tickets') ?? resolveTextChannel(guild, 'support')
    : null;

  const helpLines = [
    '🎫 **Need help with the rules?**',
    '',
    ticketsChannel
      ? `Open a ticket in <#${ticketsChannel.id}> and staff will respond shortly.`
      : 'Open a support ticket and staff will respond shortly.',
    '',
    'You can ask for clarification on any rule before accepting.',
  ];

  await interaction.reply({
    content: helpLines.join('\n'),
    ephemeral: true,
  });
}

// ====================================
// PUBLIC EXPORT
// ====================================

export const RulesHandlers = {
  handleAcceptButton,
  handleAcceptCaptchaButton,
  handleCaptchaSubmit,
  handleAskStaffButton,
  publishRulesToGuild,
  publishRulesByGuildId,
  buildRulesHeaderEmbed,
  buildRulesEmbeds,
  buildRulesFooterEmbed,
  buildRulesButtons,
};

// Used for testing-only paths (e.g. /rules accept command)
export async function manuallyAcceptRules(guild: Guild, member: GuildMember): Promise<{ memberRoleGranted: boolean; verificationRequired: boolean }> {
  const isVerified = await hasCompletedVerification(guild.id, member.id);
  if (!isVerified) {
    return { memberRoleGranted: false, verificationRequired: true };
  }

  const config = await rulesConfigStore.get(guild.id);
  await grantVerifiedAndMember(member);
  const result = await recordAcceptance(guild, member, config, 'command');
  return { ...result, verificationRequired: false };
}

// Re-export the channel type for callers that need to narrow.
export type RulesTextChannel = TextChannel;
