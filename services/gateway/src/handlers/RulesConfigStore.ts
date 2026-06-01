// ====================================
// AVENLO CORE - RULES CONFIG STORE
// In-memory cache, hot-reloaded via Redis (mirrors WelcomeConfigStore).
// ====================================

import {
  createLogger,
  EventTypes,
  DEFAULT_RULES_CONFIG,
  RulesConfig,
  type BaseEvent,
  type IRulesConfig,
  type RedisClient,
  type RulesConfigData,
  type RulesConfigUpdatedPayload,
} from '@avenlo/shared';

const logger = createLogger('rules-config-store');

function toData(doc: IRulesConfig): RulesConfigData {
  return {
    guildId: doc.guildId,
    enabled: doc.enabled,
    rulesChannelId: doc.rulesChannelId,
    channelName: doc.channelName,
    memberRoleId: doc.memberRoleId,
    acceptanceGate: doc.acceptanceGate,
    captchaPrompt: doc.captchaPrompt,
    captchaAnswer: doc.captchaAnswer,
    headerTitle: doc.headerTitle,
    headerSubtitle: doc.headerSubtitle,
    footerText: doc.footerText,
    themePreset: doc.themePreset,
    accentColor: doc.accentColor,
    lastPostedAt: doc.lastPostedAt ? doc.lastPostedAt.toISOString() : undefined,
    lastPostedMessageId: doc.lastPostedMessageId,
    pinAfterPost: doc.pinAfterPost,
    rules: doc.rules.map((r) => ({
      id: r.id,
      number: r.number,
      icon: r.icon,
      title: r.title,
      body: r.body,
      severity: r.severity,
      autoEnforced: r.autoEnforced,
    })),
  };
}

function defaultsFor(guildId: string): RulesConfigData {
  return { guildId, ...DEFAULT_RULES_CONFIG };
}

/**
 * Caches rules configs in memory per guild and subscribes to the
 * `RULES_CONFIG_UPDATED` Redis event so dashboard changes are reflected
 * immediately without restarting the gateway.
 */
class RulesConfigStore {
  private cache = new Map<string, RulesConfigData>();
  private subscribed = false;

  async get(guildId: string): Promise<RulesConfigData> {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    const fresh = await this.loadFromMongo(guildId);
    this.cache.set(guildId, fresh);
    return fresh;
  }

  async refresh(guildId: string): Promise<RulesConfigData> {
    const fresh = await this.loadFromMongo(guildId);
    this.cache.set(guildId, fresh);
    logger.info(`🔁 Rules config refreshed for guild ${guildId}`);
    return fresh;
  }

  clear(): void {
    this.cache.clear();
  }

  async startSubscription(redis: RedisClient): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    await redis.subscribe(EventTypes.RULES_CONFIG_UPDATED, async (event: BaseEvent) => {
      const payload = event.payload as RulesConfigUpdatedPayload | undefined;
      if (!payload?.guildId) {
        logger.warn('Received RULES_CONFIG_UPDATED with no guildId', { event });
        return;
      }
      try {
        await this.refresh(payload.guildId);
      } catch (err) {
        logger.error(`Failed to refresh rules config for ${payload.guildId}`, err);
      }
    });

    logger.info('Subscribed to RULES_CONFIG_UPDATED events');
  }

  private async loadFromMongo(guildId: string): Promise<RulesConfigData> {
    try {
      const doc = await RulesConfig.findOne({ guildId }).exec();
      if (!doc) {
        logger.debug(`No rules config for ${guildId}, using defaults`);
        return defaultsFor(guildId);
      }
      return toData(doc);
    } catch (err) {
      logger.error(`Failed to load rules config for ${guildId}`, err);
      return defaultsFor(guildId);
    }
  }
}

export const rulesConfigStore = new RulesConfigStore();
