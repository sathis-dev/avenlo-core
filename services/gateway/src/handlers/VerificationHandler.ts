// ====================================
// AVENLO CORE - VERIFICATION HANDLER
// Multi-stage native Discord verification flow
// Stage 1: Metadata scan | Stage 2: Modal CAPTCHA | Stage 3: Button puzzle
// ====================================

import {
  GuildMember,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  TextChannel,
  Guild,
  PermissionsBitField,
} from 'discord.js';
import {
  createLogger,
  AvenloColors,
  AvenloBranding,
  getRedisClient,
  EventTypes,
  VerificationLog,
} from '@avenlo/shared';
import { PROTECTION_CONFIG, isRaidLockdownActive, quarantineMember } from './ServerProtection';

const logger = createLogger('verification-handler');

// ====================================
// TYPES
// ====================================

interface VerificationSession extends Record<string, unknown> {
  guildId: string;
  stage: 'started' | 'captcha' | 'puzzle' | 'complete';
  startedAt: number;
  captchaAnswer?: string;
  captchaAttempts: number;
  puzzleTarget?: string;
  riskLevel: 'low' | 'medium' | 'high';
  accountAgeDays: number;
  hasDefaultAvatar: boolean;
}

interface PuzzleOption {
  label: string;
  emoji: string;
  style: ButtonStyle;
  isCorrect: boolean;
}

// ====================================
// STAGE 1: METADATA SCANNER
// ====================================

function getAccountAgeDays(member: GuildMember): number {
  return Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)
  );
}

function hasDefaultAvatar(member: GuildMember): boolean {
  // Discord default avatars have URLs containing "embed/avatars" index
  const avatar = member.user.displayAvatarURL({ forceStatic: true });
  return avatar.includes('embed/avatars');
}

function hasNitroFlags(member: GuildMember): boolean {
  // Public flags: 1<<0 = Discord Employee, 1<<1 = Partner, 1<<2 = HypeSquad,
  // 1<<8 = Early Supporter (Nitro Classic), 1<<9 = Team, 1<<10 = Nitro (deprecated),
  // 1<<17 = Early Verified Bot Developer, 1<<18 = Discord Certified Moderator
  // We'll consider Early Supporter (256) and any premium-related flags as "nitro-like"
  const flags = member.user.flags?.bitfield ?? 0;
  const nitroLikeFlags = 256 | 512 | 4096 | 16384; // Early Supporter | Team | Bug Hunter | Bot HTTP
  return (flags & nitroLikeFlags) !== 0;
}

function isAutomatedAlt(member: GuildMember): boolean {
  // Discord bot / automated account flags
  if (member.user.bot) return true;
  const flags = member.user.flags?.bitfield ?? 0;
  // 1<<6 = Automated account (Discord API)
  const automatedFlag = 1 << 6;
  return (flags & automatedFlag) !== 0;
}

function assessRisk(member: GuildMember): {
  riskLevel: 'low' | 'medium' | 'high';
  shouldHalt: boolean;
  reason: string;
} {
  const ageDays = getAccountAgeDays(member);
  const defaultAvatar = hasDefaultAvatar(member);
  const nitro = hasNitroFlags(member);
  const automated = isAutomatedAlt(member);

  if (ageDays < 7 || automated || (defaultAvatar && !nitro)) {
    return {
      riskLevel: 'high',
      shouldHalt: true,
      reason: automated
        ? 'Account flags indicate an automated / alt account'
        : ageDays < 7
          ? 'Account is less than 7 days old'
          : 'Default avatar with no premium flags',
    };
  }

  if (ageDays < 30) {
    return {
      riskLevel: 'medium',
      shouldHalt: false,
      reason: 'Account is less than 30 days old',
    };
  }

  return {
    riskLevel: 'low',
    shouldHalt: false,
    reason: 'Account passes metadata scan',
  };
}

// ====================================
// CAPTCHA / MATH UTILITIES
// ====================================

function generateAlphanumeric(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMathEquation(): { question: string; answer: string } {
  const a = Math.floor(Math.random() * 20) + 5;
  const b = Math.floor(Math.random() * 20) + 5;
  return {
    question: `${a} + ${b} = ?`,
    answer: String(a + b),
  };
}

function generateChallenge(): { label: string; answer: string } {
  if (Math.random() > 0.5) {
    const code = generateAlphanumeric();
    return { label: `Enter code: ${code}`, answer: code };
  } else {
    const math = generateMathEquation();
    return { label: `Solve: ${math.question}`, answer: math.answer };
  }
}

// ====================================
// RAW REDIS CAPTCHA HELPERS (EX 60)
// ====================================

const CAPTCHA_KEY = (userId: string): string => `avenlo:verification:captcha:${userId}`;
const RETRY_KEY = (userId: string): string => `avenlo:verification:retries:${userId}`;

async function storeCaptchaAnswer(userId: string, answer: string): Promise<void> {
  const redis = getRedisClient().getClient();
  await redis.set(CAPTCHA_KEY(userId), answer, 'EX', 60);
}

async function getCaptchaAnswer(userId: string): Promise<string | null> {
  const redis = getRedisClient().getClient();
  return redis.get(CAPTCHA_KEY(userId));
}

async function deleteCaptchaAnswer(userId: string): Promise<void> {
  const redis = getRedisClient().getClient();
  await redis.del(CAPTCHA_KEY(userId));
}

async function incrementCaptchaRetry(userId: string): Promise<number> {
  const redis = getRedisClient().getClient();
  const newVal = await redis.incr(RETRY_KEY(userId));
  await redis.expire(RETRY_KEY(userId), 120);
  return newVal;
}

async function deleteCaptchaRetry(userId: string): Promise<void> {
  const redis = getRedisClient().getClient();
  await redis.del(RETRY_KEY(userId));
}

// ====================================
// PUZZLE UTILITIES
// ====================================

const PUZZLE_OPTIONS: Omit<PuzzleOption, 'isCorrect'>[] = [
  { label: 'BLUE', emoji: '🔵', style: ButtonStyle.Primary },
  { label: 'RED', emoji: '🔴', style: ButtonStyle.Danger },
  { label: 'GREEN', emoji: '🟢', style: ButtonStyle.Success },
  { label: 'YELLOW', emoji: '🟡', style: ButtonStyle.Secondary },
  { label: 'PURPLE', emoji: '🟣', style: ButtonStyle.Secondary },
];

function generatePuzzle(): { target: string; options: PuzzleOption[] } {
  const correctIndex = Math.floor(Math.random() * PUZZLE_OPTIONS.length);
  const target = PUZZLE_OPTIONS[correctIndex].label;

  const options = PUZZLE_OPTIONS.map((opt, idx) => ({
    ...opt,
    isCorrect: idx === correctIndex,
  }));

  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { target, options };
}

// ====================================
// REDIS SESSION HELPERS
// ====================================

async function getSession(
  userId: string
): Promise<VerificationSession | null> {
  try {
    const redis = getRedisClient();
    return await redis.getSession<VerificationSession>(userId);
  } catch (err) {
    logger.error('Redis getSession error:', err);
    return null;
  }
}

async function setSession(
  userId: string,
  session: VerificationSession
): Promise<void> {
  try {
    const redis = getRedisClient();
    // 2-minute global timeout
    await redis.setSession(userId, session, 120);
  } catch (err) {
    logger.error('Redis setSession error:', err);
  }
}

async function deleteSession(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.deleteSession(userId);
  } catch (err) {
    logger.error('Redis deleteSession error:', err);
  }
}

async function isTimedOut(session: VerificationSession): Promise<boolean> {
  const elapsed = Date.now() - session.startedAt;
  return elapsed > 120000; // 2 minutes
}

// ====================================
// LOGGING HELPERS
// ====================================

async function logVerificationStart(
  member: GuildMember,
  riskLevel: 'low' | 'medium' | 'high',
  accountAgeDays: number
): Promise<void> {
  try {
    await VerificationLog.create({
      guildId: member.guild.id,
      userId: member.id,
      username: member.user.tag,
      accountAgeDays,
      riskLevel,
      hasDefaultAvatar: hasDefaultAvatar(member),
      status: 'started',
      stageReached: 1,
      startedAt: new Date(),
    });

    const redis = getRedisClient();
    await redis.publish(EventTypes.VERIFICATION_STARTED, {
      source: 'gateway',
      payload: {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.tag,
        accountAgeDays,
        riskLevel,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to log verification start:', err);
  }
}

async function logVerificationComplete(
  member: GuildMember,
  session: VerificationSession,
  timeTakenMs: number
): Promise<void> {
  try {
    await VerificationLog.findOneAndUpdate(
      { guildId: member.guild.id, userId: member.id, status: 'started' },
      {
        $set: {
          status: 'completed',
          stageReached: 3,
          timeTakenMs,
          endedAt: new Date(),
        },
      },
      { sort: { createdAt: -1 } }
    );

    const redis = getRedisClient();
    await redis.publish(EventTypes.VERIFICATION_COMPLETED, {
      source: 'gateway',
      payload: {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.tag,
        timeTakenMs,
        riskLevel: session.riskLevel,
        stagesPassed: 3,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to log verification complete:', err);
  }
}

async function logVerificationFail(
  member: GuildMember,
  session: VerificationSession | null,
  reason: 'timeout' | 'captcha_fail' | 'puzzle_fail' | 'high_risk_alt' | 'raid_lockdown',
  stageReached = 1
): Promise<void> {
  try {
    await VerificationLog.findOneAndUpdate(
      { guildId: member.guild.id, userId: member.id, status: 'started' },
      {
        $set: {
          status: 'failed',
          failReason: reason,
          stageReached,
          endedAt: new Date(),
        },
      },
      { sort: { createdAt: -1 } }
    );

    const redis = getRedisClient();
    await redis.publish(EventTypes.VERIFICATION_FAILED, {
      source: 'gateway',
      payload: {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.tag,
        reason,
        stageReached,
        failedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to log verification fail:', err);
  }
}

// ====================================
// ROLE HELPERS
// ====================================

async function removeQuarantineRole(member: GuildMember): Promise<void> {
  const config = PROTECTION_CONFIG.quarantine;
  const guild = member.guild;

  // Remove Quarantine role
  const quarantineRole = guild.roles.cache.find(
    (r) => r.name === config.quarantineRoleName
  );
  if (quarantineRole) {
    try {
      await member.roles.remove(quarantineRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to remove Quarantine role:', err);
    }
  }
}

async function ensureRoleExists(
  guild: Guild,
  roleName: string,
  color: number
): Promise<import('discord.js').Role | undefined> {
  const existing = guild.roles.cache.find((r) => r.name === roleName);
  if (existing) {
    return existing;
  }

  // Check if bot has Manage Roles permission
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.warn(`Bot lacks Manage Roles permission — cannot create "${roleName}" role`);
    return undefined;
  }

  try {
    const newRole = await guild.roles.create({
      name: roleName,
      color,
      permissions: [],
      reason: 'Avenlo Core: Auto-created for verification system',
    });
    logger.info(`Created "${roleName}" role in ${guild.name}`);
    return newRole;
  } catch (err) {
    logger.error(`Failed to create "${roleName}" role:`, err);
    return undefined;
  }
}

export async function grantVerifiedAndMember(member: GuildMember): Promise<void> {
  const config = PROTECTION_CONFIG.quarantine;
  const guild = member.guild;

  // Ensure bot has Manage Roles
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.error('Bot lacks Manage Roles permission — cannot assign roles');
    return;
  }

  // Add Verified role (create if missing)
  const verifiedRole = await ensureRoleExists(guild, config.verifiedRoleName, AvenloColors.CYAN);
  if (verifiedRole) {
    try {
      await member.roles.add(verifiedRole, 'Rules accepted after verification');
      logger.info(`Granted "${config.verifiedRoleName}" to ${member.user.tag}`);
    } catch (err) {
      logger.error('Failed to add Verified role:', err);
    }
  } else {
    logger.warn(`"${config.verifiedRoleName}" role not found and could not be created`);
  }

  // Add Member role (create if missing)
  const memberRole = await ensureRoleExists(guild, config.memberRoleName, AvenloColors.GREEN);
  if (memberRole) {
    try {
      await member.roles.add(memberRole, 'Rules accepted after verification');
      logger.info(`Granted "${config.memberRoleName}" to ${member.user.tag}`);
    } catch (err) {
      logger.error('Failed to add Member role:', err);
    }
  } else {
    logger.warn(`"${config.memberRoleName}" role not found and could not be created`);
  }

  // Also handle legacy verifiedRoleId if configured
  if (PROTECTION_CONFIG.verification.verifiedRoleId) {
    try {
      const legacyRole = guild.roles.cache.get(
        PROTECTION_CONFIG.verification.verifiedRoleId
      );
      if (legacyRole) {
        await member.roles.add(legacyRole, 'Rules accepted after verification');
      }
    } catch (err) {
      logger.error('Failed to add legacy verified role:', err);
    }
  }
}

export async function hasCompletedVerification(
  guildId: string,
  userId: string
): Promise<boolean> {
  try {
    const log = await VerificationLog.findOne({
      guildId,
      userId,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .exec();
    const completed = log !== null;
    logger.debug(`hasCompletedVerification(${userId}) = ${completed}`);
    return completed;
  } catch (err) {
    logger.error('Failed to check verification status:', err);
    return false;
  }
}

// ====================================
// INTERACTION HANDLERS
// ====================================

export async function handleBeginVerification(
  interaction: ButtonInteraction
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!guild || !member) {
    await interaction.reply({
      content: 'Unable to verify in this context.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check raid lockdown
  if (await isRaidLockdownActive(guild.id)) {
    await interaction.reply({
      content:
        'Server is currently under RAID LOCKDOWN. Verification is paused. Please wait for a moderator to lift the lockdown.',
      flags: MessageFlags.Ephemeral,
    });
    await logVerificationFail(member, null, 'raid_lockdown', 0);
    return;
  }

  // Check existing session
  const existing = await getSession(member.id);

  if (existing && !(await isTimedOut(existing))) {
    // Session exists and is still valid — try to resume the appropriate stage
    if (existing.stage === 'captcha' || existing.stage === 'started') {
      const challenge = generateChallenge();
      existing.captchaAnswer = challenge.answer;
      setSession(member.id, existing).catch(() => undefined);
      storeCaptchaAnswer(member.id, challenge.answer).catch(() => undefined);

      const modal = new ModalBuilder()
        .setCustomId('verify:captcha_submit')
        .setTitle('Security Check - Stage 2')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('captcha_input')
              .setLabel(challenge.label)
              .setPlaceholder('Type your answer here')
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(10)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
      return;
    }

    if (existing.stage === 'puzzle') {
      const { target, options } = generatePuzzle();
      existing.puzzleTarget = target;
      setSession(member.id, existing).catch(() => undefined);

      const embed = new EmbedBuilder()
        .setColor(AvenloColors.BLUE)
        .setTitle('Stage 3: Button Puzzle')
        .setDescription(
          `Almost there! Click the **${target}** button to finalize your verification.\n\n` +
            `*Buttons are randomized every time to prevent auto-clickers.*`
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let currentRow = new ActionRowBuilder<ButtonBuilder>();

      options.forEach((opt, idx) => {
        const btn = new ButtonBuilder()
          .setCustomId(`verify:puzzle:${idx}`)
          .setLabel(opt.label)
          .setEmoji(opt.emoji)
          .setStyle(opt.style);
        currentRow.addComponents(btn);
        if (currentRow.components.length === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
      });

      if (currentRow.components.length > 0) {
        rows.push(currentRow);
      }

      await interaction.reply({ embeds: [embed], components: rows, flags: MessageFlags.Ephemeral });
      return;
    }
  }

  if (existing && (await isTimedOut(existing))) {
    await deleteSession(member.id);
  }

  // Stage 1: Metadata Scanner
  const assessment = assessRisk(member);
  const accountAgeDays = getAccountAgeDays(member);
  const hasDefault = hasDefaultAvatar(member);

  if (assessment.shouldHalt) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.RED)
      .setTitle('High-Risk Account Detected')
      .setDescription(
        `Your account has been flagged as high-risk:\n` +
          `**Reason:** ${assessment.reason}\n\n` +
          `A moderator will review your account shortly. Please do not leave the server.`
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('verify:request_review')
        .setLabel('Request Manual Review')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️')
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    logVerificationFail(member, null, 'high_risk_alt', 1).catch(() => undefined);
    return;
  }

  // Stage 2: Show CAPTCHA Modal IMMEDIATELY
  const challenge = generateChallenge();
  const modal = new ModalBuilder()
    .setCustomId('verify:captcha_submit')
    .setTitle('Security Check - Stage 2')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('captcha_input')
          .setLabel(challenge.label)
          .setPlaceholder('Type your answer here')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(10)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);

  // Background: persist session + log start (non-blocking so we stay under 3s)
  const session: VerificationSession = {
    guildId: guild.id,
    stage: 'captcha',
    startedAt: Date.now(),
    captchaAnswer: challenge.answer,
    captchaAttempts: 0,
    riskLevel: assessment.riskLevel,
    accountAgeDays,
    hasDefaultAvatar: hasDefault,
  };

  Promise.all([
    setSession(member.id, session),
    storeCaptchaAnswer(member.id, challenge.answer),
    logVerificationStart(member, assessment.riskLevel, accountAgeDays),
  ]).catch((err) => {
    logger.error('Background verification setup failed:', err);
  });
}

export async function handleVerificationCaptcha(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  const session = await getSession(member.id);
  if (!session) {
    await interaction.reply({
      content: 'Your verification session has expired or does not exist. Please restart.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (await isTimedOut(session)) {
    await deleteSession(member.id);
    await deleteCaptchaAnswer(member.id);
    await deleteCaptchaRetry(member.id);
    await interaction.reply({
      content: 'Your verification session timed out (2 minutes). Please click **Begin Verification** again.',
      flags: MessageFlags.Ephemeral,
    });
    await logVerificationFail(member, session, 'timeout', 2);
    return;
  }

  const input = interaction.fields.getTextInputValue('captcha_input').trim();
  const expected = await getCaptchaAnswer(member.id);

  if (!expected || input.toUpperCase() !== expected.toUpperCase()) {
    // Increment attempts and evaluate lockout
    session.captchaAttempts = (session.captchaAttempts || 0) + 1;
    await setSession(member.id, session);

    if (session.captchaAttempts > 2) {
      // Lock session after exhausting retries (initial + 2 retries)
      await deleteSession(member.id);
      await deleteCaptchaAnswer(member.id);
      await deleteCaptchaRetry(member.id);
      await interaction.reply({
        content:
          'You have exceeded the maximum number of attempts. Your session has been locked. Please contact a staff member for manual review.',
        flags: MessageFlags.Ephemeral,
      });
      await logVerificationFail(member, session, 'captcha_fail', 2);
      return;
    }

    const remaining = 3 - session.captchaAttempts;
    await interaction.reply({
      content:
        `Incorrect answer. You have **${remaining}** attempt${remaining === 1 ? '' : 's'} remaining. ` +
        'Please click **Begin Verification** to try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Correct — clean up Redis captcha key and advance to Stage 3
  await deleteCaptchaAnswer(member.id);
  await deleteCaptchaRetry(member.id);

  session.stage = 'puzzle';
  await setSession(member.id, session);

  const { target, options } = generatePuzzle();
  session.puzzleTarget = target;
  await setSession(member.id, session);

  const embed = new EmbedBuilder()
    .setColor(AvenloColors.BLUE)
    .setTitle('Stage 3: Button Puzzle')
    .setDescription(
      `Almost there! Click the **${target}** button to finalize your verification.\n\n` +
        `*Buttons are randomized every time to prevent auto-clickers.*`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  options.forEach((opt, idx) => {
    const btn = new ButtonBuilder()
      .setCustomId(`verify:puzzle:${idx}`)
      .setLabel(opt.label)
      .setEmoji(opt.emoji)
      .setStyle(opt.style);

    currentRow.addComponents(btn);

    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  await interaction.reply({
    embeds: [embed],
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePuzzleClick(
  interaction: ButtonInteraction,
  puzzleIndex: string
): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) return;

  const session = await getSession(member.id);
  if (!session) {
    await interaction.reply({
      content: 'Your verification session has expired. Please restart.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (await isTimedOut(session)) {
    await deleteSession(member.id);
    await interaction.reply({
      content: 'Your verification session timed out (2 minutes). Please click **Begin Verification** again.',
      flags: MessageFlags.Ephemeral,
    });
    await logVerificationFail(member, session, 'timeout', 3);
    return;
  }

  // Check if the clicked button's label matches the target
  const clickedLabel = (interaction.component as { label?: string }).label;
  const target = session.puzzleTarget;

  if (!clickedLabel || !target || clickedLabel !== target) {
    await interaction.update({
      content: 'Incorrect button. Verification failed. Please restart.',
      embeds: [],
      components: [],
    });
    await logVerificationFail(member, session, 'puzzle_fail', 3);
    await deleteSession(member.id);
    return;
  }

  // SUCCESS — verification passed, but roles are held until rules are accepted
  const timeTakenMs = Date.now() - session.startedAt;
  session.stage = 'complete';
  await setSession(member.id, session);

  await removeQuarantineRole(member);
  await logVerificationComplete(member, session, timeTakenMs);

  // Update ephemeral message to direct to rules channel
  const successEmbed = new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle('Stage 3 Complete')
    .setDescription(
      '**Security check passed!**\n\n' +
        'One last step: go to the rules channel and click **✅ I Accept the Rules** to unlock full server access.\n\n' +
        'Welcome to the community!'
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();

  await interaction.update({
    embeds: [successEmbed],
    components: [],
  });

  // Clean up Redis
  await deleteSession(member.id);

  // Attempt to delete any messages the user sent in the verification channel
  try {
    const guild = interaction.guild;
    if (guild) {
      const verificationChannel = guild.channels.cache.find(
        (ch) =>
          ch.isTextBased() &&
          ch.name
            .toLowerCase()
            .includes(PROTECTION_CONFIG.quarantine.verificationChannelName.toLowerCase())
      ) as TextChannel | undefined;

      if (verificationChannel) {
        const messages = await verificationChannel.messages.fetch({ limit: 20 });
        const userMessages = messages.filter((m) => m.author.id === member.id);
        for (const msg of userMessages.values()) {
          await msg.delete().catch(() => {
            // Ignore permission errors
          });
        }
      }
    }
  } catch (err) {
    logger.error('Failed to clean up verification channel messages:', err);
  }
}

export async function handleRequestReview(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.reply({
    content:
      'Your request for manual review has been logged. A moderator will review your account shortly.',
    flags: MessageFlags.Ephemeral,
  });

  // Publish event for mod dashboard / logging
  try {
    const redis = getRedisClient();
    await redis.publish(EventTypes.SYSTEM_METRICS, {
      source: 'gateway',
      payload: {
        type: 'manual_review_requested',
        guildId: interaction.guild?.id,
        userId: interaction.user.id,
        username: interaction.user.tag,
      },
    });
  } catch (err) {
    logger.error('Failed to publish manual review event:', err);
  }
}

// ====================================
// EXPORTS
// ====================================

export const VerificationHandlers = {
  handleBeginVerification,
  handleVerificationCaptcha,
  handlePuzzleClick,
  handleRequestReview,
  quarantineMember,
  grantVerifiedAndMember,
  hasCompletedVerification,
};

export default VerificationHandlers;
