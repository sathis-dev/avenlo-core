// ====================================
// AVENLO CORE - ROLE MANAGER
// ====================================

import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import { 
  createLogger, 
  getRedisClient, 
  getEventBus,
  EventTypes,
  LedgerRoleUpdatePayload,
  User,
} from '@avenlo/shared';
import {
  PROMOTION_TIERS,
  PromotionTier,
  tierForCredits,
  tierRank,
  resolveTierRoleId,
} from './tiers';

const logger = createLogger('ledger-roles');

// Role configuration
const RoleConfig = {
  STUDIO_LEAD: process.env.ROLE_STUDIO_LEAD!,
  ACTIVE_DEV: process.env.ROLE_ACTIVE_DEV!,
  CONTRIBUTOR: process.env.ROLE_CONTRIBUTOR!,
};

// Thresholds
const INACTIVITY_DAYS = 14;
const MIN_CONTRIBUTIONS_FOR_ACTIVE = 5;

export class RoleManager {
  private client: Client;
  private activityCheckJob?: cron.ScheduledTask;
  private leaderboardCheckJob?: cron.ScheduledTask;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
      ],
    });
  }

  async start(): Promise<void> {
    // Login to Discord
    await this.client.login(process.env.DISCORD_TOKEN);
    logger.info('Role manager Discord client connected');

    // Subscribe to role update events
    const redis = getRedisClient();
    await redis.subscribe(EventTypes.LEDGER_ROLE_UPDATE, async (event) => {
      await this.handleRoleUpdate(event.payload as any);
    });

    await redis.subscribe(EventTypes.LEDGER_LEADERBOARD_UPDATE, async (event) => {
      await this.handleLeaderboardUpdate(event.payload as any);
    });

    // Schedule activity check (daily at midnight)
    this.activityCheckJob = cron.schedule('0 0 * * *', async () => {
      await this.checkInactiveUsers();
    });

    // Schedule leaderboard check (every 6 hours)
    this.leaderboardCheckJob = cron.schedule('0 */6 * * *', async () => {
      await this.updateStudioLead();
    });

    logger.info('Role manager subscriptions and cron jobs established');
  }

  async stop(): Promise<void> {
    this.activityCheckJob?.stop();
    this.leaderboardCheckJob?.stop();
    await this.client.destroy();
  }

  private async handleRoleUpdate(payload: {
    userId: string;
    discordId: string;
    action: 'add' | 'remove';
    roleId: string;
    roleName: string;
  }): Promise<void> {
    try {
      const guildId = process.env.DISCORD_GUILD_ID!;
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(payload.discordId);

      if (payload.action === 'add') {
        await member.roles.add(payload.roleId);
        logger.info(`Added role ${payload.roleName} to ${member.user.tag}`);
      } else {
        await member.roles.remove(payload.roleId);
        logger.info(`Removed role ${payload.roleName} from ${member.user.tag}`);
      }

      // Update user record
      const user = await User.findOne({ discordId: payload.discordId });
      if (user) {
        if (payload.action === 'add') {
          if (!user.roles.includes(payload.roleId)) {
            user.roles.push(payload.roleId);
          }
        } else {
          user.roles = user.roles.filter((r) => r !== payload.roleId);
        }
        await user.save();
      }
    } catch (error) {
      logger.error(`Failed to update role for ${payload.discordId}:`, error);
    }
  }

  private async handleLeaderboardUpdate(payload: {
    userId: string;
    discordId: string;
    rank: number;
    credits: number;
  }): Promise<void> {
    // If user is now #1, consider for Studio Lead
    if (payload.rank === 1) {
      await this.updateStudioLead();
    }
  }

  async checkInactiveUsers(): Promise<void> {
    logger.info('Running inactive user check...');

    const inactivityThreshold = new Date();
    inactivityThreshold.setDate(inactivityThreshold.getDate() - INACTIVITY_DAYS);

    // Find users who haven't contributed in 14 days but have Active role
    const inactiveUsers = await User.find({
      isActive: true,
      lastContributionAt: { $lt: inactivityThreshold },
    });

    const redis = getRedisClient();
    const guildId = process.env.DISCORD_GUILD_ID!;
    const guild = await this.client.guilds.fetch(guildId);

    for (const user of inactiveUsers) {
      try {
        const member = await guild.members.fetch(user.discordId);

        // Remove Active Developer role
        if (RoleConfig.ACTIVE_DEV && member.roles.cache.has(RoleConfig.ACTIVE_DEV)) {
          await member.roles.remove(RoleConfig.ACTIVE_DEV);
          
          await redis.publish(EventTypes.LEDGER_ROLE_UPDATE, {
            source: 'ledger',
            payload: {
              userId: user._id.toString(),
              discordId: user.discordId,
              action: 'remove',
              roleId: RoleConfig.ACTIVE_DEV,
              roleName: 'Active Developer',
            },
          });
        }

        // Update user record
        user.isActive = false;
        user.roles = user.roles.filter((r) => r !== RoleConfig.ACTIVE_DEV);
        await user.save();

        logger.info(`Marked ${user.username} as inactive`);
      } catch (error) {
        logger.error(`Failed to process inactive user ${user.discordId}:`, error);
      }
    }

    // Also check for users who should gain Active status
    const activeThreshold = new Date();
    activeThreshold.setDate(activeThreshold.getDate() - 7); // Active in last 7 days

    const newlyActiveUsers = await User.find({
      isActive: false,
      lastContributionAt: { $gte: activeThreshold },
      $expr: {
        $gte: [
          { $add: ['$contributions.commits', '$contributions.pullRequests'] },
          MIN_CONTRIBUTIONS_FOR_ACTIVE,
        ],
      },
    });

    for (const user of newlyActiveUsers) {
      try {
        const member = await guild.members.fetch(user.discordId);

        // Add Active Developer role
        if (RoleConfig.ACTIVE_DEV && !member.roles.cache.has(RoleConfig.ACTIVE_DEV)) {
          await member.roles.add(RoleConfig.ACTIVE_DEV);
          
          await redis.publish(EventTypes.LEDGER_ROLE_UPDATE, {
            source: 'ledger',
            payload: {
              userId: user._id.toString(),
              discordId: user.discordId,
              action: 'add',
              roleId: RoleConfig.ACTIVE_DEV,
              roleName: 'Active Developer',
            },
          });
        }

        // Update user record
        user.isActive = true;
        if (!user.roles.includes(RoleConfig.ACTIVE_DEV)) {
          user.roles.push(RoleConfig.ACTIVE_DEV);
        }
        await user.save();

        logger.info(`Marked ${user.username} as active`);
      } catch (error) {
        logger.error(`Failed to activate user ${user.discordId}:`, error);
      }
    }

    logger.info(`Inactive check complete. ${inactiveUsers.length} deactivated, ${newlyActiveUsers.length} activated.`);
  }

  async updateStudioLead(): Promise<void> {
    logger.info('Checking for Studio Lead update...');

    // Get current top contributor
    const topUser = await User.findOne()
      .sort({ credits: -1 })
      .limit(1);

    if (!topUser) return;

    // Get current Studio Lead
    const currentLead = await User.findOne({ isStudioLead: true });

    // If top user is already Studio Lead, nothing to do
    if (currentLead?.discordId === topUser.discordId) return;

    const redis = getRedisClient();
    const guildId = process.env.DISCORD_GUILD_ID!;
    const guild = await this.client.guilds.fetch(guildId);

    // Remove role from current lead
    if (currentLead && RoleConfig.STUDIO_LEAD) {
      try {
        const oldLeadMember = await guild.members.fetch(currentLead.discordId);
        await oldLeadMember.roles.remove(RoleConfig.STUDIO_LEAD);
        
        currentLead.isStudioLead = false;
        currentLead.roles = currentLead.roles.filter((r) => r !== RoleConfig.STUDIO_LEAD);
        await currentLead.save();

        await redis.publish(EventTypes.LEDGER_ROLE_UPDATE, {
          source: 'ledger',
          payload: {
            userId: currentLead._id.toString(),
            discordId: currentLead.discordId,
            action: 'remove',
            roleId: RoleConfig.STUDIO_LEAD,
            roleName: 'Studio Lead',
          },
        });

        logger.info(`Removed Studio Lead from ${currentLead.username}`);
      } catch (error) {
        logger.error(`Failed to remove Studio Lead from ${currentLead.discordId}:`, error);
      }
    }

    // Add role to new lead
    if (RoleConfig.STUDIO_LEAD) {
      try {
        const newLeadMember = await guild.members.fetch(topUser.discordId);
        await newLeadMember.roles.add(RoleConfig.STUDIO_LEAD);
        
        topUser.isStudioLead = true;
        if (!topUser.roles.includes(RoleConfig.STUDIO_LEAD)) {
          topUser.roles.push(RoleConfig.STUDIO_LEAD);
        }
        await topUser.save();

        await redis.publish(EventTypes.LEDGER_ROLE_UPDATE, {
          source: 'ledger',
          payload: {
            userId: topUser._id.toString(),
            discordId: topUser.discordId,
            action: 'add',
            roleId: RoleConfig.STUDIO_LEAD,
            roleName: 'Studio Lead',
          },
        });

        logger.info(`Assigned Studio Lead to ${topUser.username}`);
      } catch (error) {
        logger.error(`Failed to assign Studio Lead to ${topUser.discordId}:`, error);
      }
    }
  }

  async grantContributorRole(discordId: string): Promise<void> {
    if (!RoleConfig.CONTRIBUTOR) return;

    try {
      const guildId = process.env.DISCORD_GUILD_ID!;
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(discordId);

      if (!member.roles.cache.has(RoleConfig.CONTRIBUTOR)) {
        await member.roles.add(RoleConfig.CONTRIBUTOR);
        
        const user = await User.findOne({ discordId });
        if (user && !user.roles.includes(RoleConfig.CONTRIBUTOR)) {
          user.roles.push(RoleConfig.CONTRIBUTOR);
          await user.save();
        }

        logger.info(`Granted Contributor role to ${member.user.tag}`);
      }
    } catch (error) {
      logger.error(`Failed to grant Contributor role to ${discordId}:`, error);
    }
  }

  // ====================================
  // PROOF-OF-VALUE TIER PROMOTION
  // ====================================

  private tierMarkerKey(discordId: string): string {
    return `ledger:tier:${discordId}`;
  }

  /** Role ids for all tiers strictly below `target`, excluding `keepRoleId`. */
  private supersededRoleIds(target: PromotionTier, keepRoleId: string): string[] {
    const targetRank = tierRank(target);
    const ids = new Set<string>();
    for (const tier of PROMOTION_TIERS) {
      if (tierRank(tier) < targetRank) {
        const roleId = resolveTierRoleId(tier);
        if (roleId && roleId !== keepRoleId) {
          ids.add(roleId);
        }
      }
    }
    return Array.from(ids);
  }

  /**
   * Autonomously promote a contributor based on their lifetime credit score.
   * Triggered by credit-bearing Pulse events (PR merged / commit pushed).
   *
   * Determines the highest tier the user qualifies for, and if it exceeds the
   * tier they were last granted, assigns the tier's Discord role (removing
   * superseded lower-tier roles) and publishes LEDGER_ROLE_PROMOTED to instruct
   * the rest of the fleet.
   */
  async evaluateTierPromotion(discordId: string, credits: number): Promise<void> {
    const target = tierForCredits(credits);
    if (!target) return;

    const redis = getRedisClient().getClient();
    const markerKey = this.tierMarkerKey(discordId);

    const lastTierKey = await redis.get(markerKey);
    const lastTier =
      PROMOTION_TIERS.find((t) => t.key === lastTierKey) ?? null;

    // Only promote upward; never demote or re-fire for the same tier.
    if (tierRank(target) <= tierRank(lastTier)) {
      return;
    }

    const roleId = resolveTierRoleId(target);
    const user = await User.findOne({ discordId });

    if (!roleId) {
      logger.warn(
        `No Discord role configured for tier ${target.name} (${target.roleEnvVar}); ` +
          'emitting promotion event without applying a role.'
      );
    }

    // Apply the role change directly when our Discord client is connected.
    if (roleId && this.client.isReady()) {
      try {
        const guildId = process.env.DISCORD_GUILD_ID!;
        const guild = await this.client.guilds.fetch(guildId);
        const member = await guild.members.fetch(discordId);

        for (const supersededId of this.supersededRoleIds(target, roleId)) {
          if (member.roles.cache.has(supersededId)) {
            await member.roles.remove(supersededId);
          }
        }

        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
        }

        logger.info(
          `Promoted ${member.user.tag} to ${target.name} (>= ${target.minCredits} credits)`
        );
      } catch (error) {
        logger.error(`Failed to apply tier role for ${discordId}:`, error);
      }
    }

    // Keep the persisted user record in sync.
    if (user && roleId) {
      const superseded = this.supersededRoleIds(target, roleId);
      user.roles = user.roles.filter((r) => !superseded.includes(r));
      if (!user.roles.includes(roleId)) {
        user.roles.push(roleId);
      }
      await user.save();
    }

    // Record the tier so we never re-promote to the same level.
    await redis.set(markerKey, target.key);

    // Instruct the fleet (gateway/dashboard) about the promotion.
    const payload: LedgerRoleUpdatePayload = {
      userId: user?._id.toString() ?? discordId,
      discordId,
      username: user?.username ?? 'unknown',
      action: 'promoted',
      fromRole: lastTier?.name ?? 'None',
      toRole: target.name,
      newCredits: credits,
      threshold: target.minCredits,
    };

    try {
      await getEventBus().publish(EventTypes.LEDGER_ROLE_PROMOTED, payload);
    } catch (error) {
      logger.error('Failed to publish LEDGER_ROLE_PROMOTED:', error);
    }
  }
}

// ====================================
// SINGLETON
// ====================================

let roleManagerInstance: RoleManager | null = null;

export function getRoleManager(): RoleManager {
  if (!roleManagerInstance) {
    roleManagerInstance = new RoleManager();
  }
  return roleManagerInstance;
}
