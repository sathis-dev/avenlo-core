// ====================================
// AVENLO CORE - LEDGER HANDLER
// Proof-of-Value Chat Listener
// Detects 'Helpful' reactions and awards Kinetic Credits.
// ====================================

import { Client, MessageReaction, PartialMessageReaction, User as DiscordUser, PartialUser, GuildMember, EmbedBuilder, TextChannel, GuildBasedChannel } from 'discord.js';
import {
  createLogger,
  getRedisClient,
  EventTypes,
  AvenloColors,
} from '@avenlo/shared';

const logger = createLogger('ledger-handler');

// ====================================
// CONFIGURATION
// ====================================

const HELPFUL_EMOJI_NAME = 'kinetics_upvote';
const HELPFUL_REWARD = 10;

// ====================================
// CHAT VALUE LISTENER
// ====================================

/**
 * Fires when a reaction is added to a message.
 * If the reaction is the custom `kinetics_upvote` emoji added by a *different* user
 * than the message author, award 10 Kinetic Credits via the Ledger event bus.
 */
export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: DiscordUser | PartialUser
): Promise<void> {
  // Fetch partial reaction if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  // Fetch partial user if needed
  if (user.partial) {
    try {
      await user.fetch();
    } catch {
      return;
    }
  }

  // Ignore self-reactions and bot reactions
  if (user.bot) return;

  const message = reaction.message;
  if (!message.guild) return;

  const author = message.author;
  if (!author || author.id === user.id) return; // No self-upvotes

  // Check if this is the designated "helpful" emoji (by name or custom ID)
  const emoji = reaction.emoji;
  const isHelpfulEmoji =
    emoji.name === HELPFUL_EMOJI_NAME || emoji.id === HELPFUL_EMOJI_NAME;

  if (!isHelpfulEmoji) return;

  logger.info(
    `Helpful reaction detected: ${user.tag} -> ${author.tag} in ${message.guild.name}`
  );

  // Publish credit-earn event to the Ledger service
  const redis = getRedisClient();
  await redis.publish(EventTypes.LEDGER_CREDITS_EARNED, {
    source: 'gateway',
    payload: {
      userId: author.id,
      discordId: author.id,
      username: author.tag,
      amount: HELPFUL_REWARD,
      reason: 'helpful_reaction',
      balanceBefore: 0, // Ledger will resolve actual balance
      balanceAfter: 0,  // Ledger computes final
      referenceType: 'ticket',
      referenceId: message.id,
      referenceUrl: message.url,
    },
  });
}

// ====================================
// TIER UPGRADE CONSUMER
// ====================================

/**
 * Subscribe to TIER_UPGRADE events published by the Ledger service.
 * Assigns the Discord role to the user and sends a celebratory embed.
 */
export function initTierUpgradeListener(client: Client): void {
  const redis = getRedisClient();

  redis
    .subscribe(EventTypes.TIER_UPGRADE, async (event) => {
      try {
        const payload = event.payload as {
          userId: string;
          discordId: string;
          username: string;
          roleName: 'Tactical' | 'Strategic' | 'Sovereign';
          creditsTotal: number;
          threshold: number;
          upgradedAt: string;
        };

        // Find the primary guild (first cached)
        const guild = client.guilds.cache.first();
        if (!guild) {
          logger.warn('No guild available for TIER_UPGRADE role assignment');
          return;
        }

        // Resolve member
        let member: GuildMember | null = null;
        try {
          member = await guild.members.fetch(payload.discordId);
        } catch {
          logger.warn(`Member ${payload.discordId} not found for tier upgrade`);
          return;
        }

        if (!member) return;

        // Resolve role by name (auto-create if missing)
        let role = guild.roles.cache.find(
          (r: { name: string }) => r.name === payload.roleName
        );

        if (!role) {
          try {
            role = await guild.roles.create({
              name: payload.roleName,
              color:
                payload.roleName === 'Tactical'
                  ? AvenloColors.GREEN
                  : payload.roleName === 'Strategic'
                    ? AvenloColors.BLUE
                    : AvenloColors.GOLD,
              permissions: [],
              reason: `Avenlo Ledger: Auto-created ${payload.roleName} tier role`,
            });
            logger.info(`Created tier role: ${payload.roleName}`);
          } catch (err) {
            logger.error(`Failed to create tier role ${payload.roleName}:`, err);
            return;
          }
        }

        // Assign role
        try {
          await member.roles.add(
            role,
            `Tier Upgrade — ${payload.creditsTotal} Kinetic Credits`
          );
          logger.info(`Assigned ${payload.roleName} to ${payload.username}`);
        } catch (err) {
          logger.error('Failed to assign tier role:', err);
          return;
        }

        // Send celebratory embed to general channel (or first text channel)
        const generalChannel = guild.channels.cache.find(
          (ch: GuildBasedChannel) =>
            ch.isTextBased() &&
            (ch.name.toLowerCase().includes('general') ||
              ch.name.toLowerCase().includes('announcements'))
        ) as TextChannel | undefined;

        if (generalChannel) {
          const embed = new EmbedBuilder()
            .setColor(
              payload.roleName === 'Tactical'
                ? AvenloColors.GREEN
                : payload.roleName === 'Strategic'
                  ? AvenloColors.BLUE
                  : AvenloColors.GOLD
            )
            .setTitle(`Tier Upgrade — ${payload.roleName}`)
            .setDescription(
              `Congratulations <@${payload.discordId}>!\n\n` +
                `You have reached **${payload.creditsTotal.toLocaleString()}** Kinetic Credits ` +
                `and have been promoted to the **${payload.roleName}** tier.\n\n` +
                `Keep contributing to climb even higher!`
            )
            .setFooter({ text: 'Avenlo Proof-of-Value Ledger' })
            .setTimestamp();

          await generalChannel.send({ embeds: [embed] }).catch(() => {
            // Ignore permission errors silently
          });
        }
      } catch (err) {
        logger.error('Tier upgrade listener error:', err);
      }
    })
    .catch((err) => {
      logger.error('Failed to subscribe to TIER_UPGRADE:', err);
    });
}
