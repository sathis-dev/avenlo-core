// ====================================
// AVENLO CORE - WELCOME CONFIG STORE
// In-memory cache, hot-reloaded via Redis
// ====================================

import {
  createLogger,
  EventTypes,
  DEFAULT_WELCOME_CONFIG,
  WelcomeConfig,
  type BaseEvent,
  type IWelcomeConfig,
  type RedisClient,
  type WelcomeConfigData,
  type WelcomeConfigUpdatedPayload,
} from '@avenlo/shared';

const logger = createLogger('welcome-config-store');

function toData(doc: IWelcomeConfig): WelcomeConfigData {
  return {
    guildId: doc.guildId,
    enabled: doc.enabled,
    dmEnabled: doc.dmEnabled,
    mentionUser: doc.mentionUser,
    cardEnabled: doc.cardEnabled,
    showMemberCount: doc.showMemberCount,
    showAccountAge: doc.showAccountAge,
    channelName: doc.channelName,
    welcomeChannelId: doc.welcomeChannelId,
    rulesChannelId: doc.rulesChannelId,
    rolesChannelId: doc.rolesChannelId,
    titleTemplate: doc.titleTemplate,
    bodyTemplate: doc.bodyTemplate,
    cardTagline: doc.cardTagline,
    neonBorderColor: doc.neonBorderColor,
    embedAccentColor: doc.embedAccentColor,
    autoRoleIds: doc.autoRoleIds,
    verifiedRoleId: doc.verifiedRoleId,
    pendingRoleId: doc.pendingRoleId,
    quarantineNewAccounts: doc.quarantineNewAccounts,
    quarantineHours: doc.quarantineHours,
    aiPersonalizedEnabled: doc.aiPersonalizedEnabled,
    returningMemberEnabled: doc.returningMemberEnabled,
    themePreset: doc.themePreset,
  };
}

function defaultsFor(guildId: string): WelcomeConfigData {
  return { guildId, ...DEFAULT_WELCOME_CONFIG };
}

/**
 * Caches welcome configs in memory per guild and subscribes to the
 * `WELCOME_CONFIG_UPDATED` Redis event so the gateway can pick up dashboard
 * changes without a reboot.
 */
class WelcomeConfigStore {
  private cache = new Map<string, WelcomeConfigData>();
  private subscribed = false;

  /**
   * Get the welcome config for a guild. Loads from Mongo on a cache miss
   * and falls back to defaults if the document doesn't exist.
   */
  async get(guildId: string): Promise<WelcomeConfigData> {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    const fresh = await this.loadFromMongo(guildId);
    this.cache.set(guildId, fresh);
    return fresh;
  }

  /**
   * Force-refresh the cache entry for a guild from Mongo. No-op if the
   * Mongo lookup fails — keeps the old cached value.
   */
  async refresh(guildId: string): Promise<WelcomeConfigData> {
    const fresh = await this.loadFromMongo(guildId);
    this.cache.set(guildId, fresh);
    logger.info(`🔁 Welcome config refreshed for guild ${guildId}`);
    return fresh;
  }

  /** Clear the entire cache (mostly useful for tests). */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Subscribe to the Redis `WELCOME_CONFIG_UPDATED` channel so dashboard
   * edits are reflected instantly in this process.
   */
  async startSubscription(redis: RedisClient): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    await redis.subscribe(EventTypes.WELCOME_CONFIG_UPDATED, async (event: BaseEvent) => {
      const payload = event.payload as WelcomeConfigUpdatedPayload | undefined;
      if (!payload?.guildId) {
        logger.warn('Received WELCOME_CONFIG_UPDATED with no guildId', { event });
        return;
      }
      try {
        await this.refresh(payload.guildId);
      } catch (err) {
        logger.error(`Failed to refresh welcome config for ${payload.guildId}`, err);
      }
    });

    logger.info('Subscribed to WELCOME_CONFIG_UPDATED events');
  }

  private async loadFromMongo(guildId: string): Promise<WelcomeConfigData> {
    try {
      const doc = await WelcomeConfig.findOne({ guildId }).exec();
      if (!doc) {
        logger.debug(`No welcome config for ${guildId}, using defaults`);
        return defaultsFor(guildId);
      }
      return toData(doc);
    } catch (err) {
      logger.error(`Failed to load welcome config for ${guildId}`, err);
      return defaultsFor(guildId);
    }
  }
}

export const welcomeConfigStore = new WelcomeConfigStore();
