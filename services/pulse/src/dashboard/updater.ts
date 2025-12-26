// ====================================
// AVENLO CORE - DASHBOARD UPDATER
// ====================================

import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { 
  createLogger, 
  getRedisClient, 
  EventTypes,
  Dashboard,
  AvenloColors,
  AvenloBranding,
  AvenloEmojis,
  createProgressBar,
  getStatusColor,
} from '@avenlo/shared';

const logger = createLogger('pulse-dashboard');

export class DashboardUpdater {
  private client: Client;
  private updateQueue: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs = 5000; // Debounce updates by 5 seconds

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });
  }

  async start(): Promise<void> {
    // Login to Discord
    await this.client.login(process.env.DISCORD_TOKEN);
    logger.info('Dashboard updater Discord client connected');

    // Subscribe to dashboard update events
    const redis = getRedisClient();
    await redis.subscribe(EventTypes.PULSE_DASHBOARD_UPDATE, async (event) => {
      const payload = event.payload as {
        dashboardId: string;
        messageId: string;
        channelId: string;
        guildId: string;
      };

      // Debounce updates
      this.queueUpdate(payload.dashboardId);
    });

    logger.info('Dashboard updater subscriptions established');
  }

  async stop(): Promise<void> {
    // Clear all pending updates
    for (const timeout of this.updateQueue.values()) {
      clearTimeout(timeout);
    }
    this.updateQueue.clear();

    await this.client.destroy();
  }

  private queueUpdate(dashboardId: string): void {
    // Clear existing timeout for this dashboard
    const existing = this.updateQueue.get(dashboardId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new debounced update
    const timeout = setTimeout(async () => {
      this.updateQueue.delete(dashboardId);
      await this.updateDashboard(dashboardId);
    }, this.debounceMs);

    this.updateQueue.set(dashboardId, timeout);
  }

  private async updateDashboard(dashboardId: string): Promise<void> {
    try {
      const dashboard = await Dashboard.findById(dashboardId);
      if (!dashboard) {
        logger.warn(`Dashboard not found: ${dashboardId}`);
        return;
      }

      // Get the channel
      const channel = await this.client.channels.fetch(dashboard.channelId);
      if (!channel?.isTextBased()) {
        logger.warn(`Channel not found or not text-based: ${dashboard.channelId}`);
        return;
      }

      // Build the embed
      const embed = this.buildDashboardEmbed(dashboard);

      // Try to edit the existing message
      try {
        const message = await (channel as TextChannel).messages.fetch(dashboard.messageId);
        await message.edit({ embeds: [embed] });
        logger.debug(`Updated dashboard message ${dashboard.messageId}`);
      } catch (error: any) {
        if (error.code === 10008) {
          // Message not found, create new one
          logger.info(`Dashboard message not found, creating new one`);
          const newMessage = await (channel as TextChannel).send({ embeds: [embed] });
          dashboard.messageId = newMessage.id;
          await dashboard.save();
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(`Failed to update dashboard ${dashboardId}:`, error);
    }
  }

  private buildDashboardEmbed(dashboard: any): EmbedBuilder {
    const healthStatus = dashboard.health.status as 'online' | 'degraded' | 'offline' | 'unknown';
    const healthEmoji = {
      online: '🟢',
      degraded: '🟡',
      offline: '🔴',
      unknown: '⚪',
    }[healthStatus] || '⚪';

    const buildStatus = dashboard.lastBuild.status as 'success' | 'failure' | 'running' | 'pending';
    const buildEmoji = {
      success: '✅',
      failure: '❌',
      running: '🔄',
      pending: '⏳',
    }[buildStatus] || '⏳';

    const embed = new EmbedBuilder()
      .setColor(getStatusColor(dashboard.health.status))
      .setTitle(`${AvenloEmojis.CHART} ${dashboard.repository.owner}/${dashboard.repository.name}`)
      .setURL(dashboard.repository.url)
      .setDescription(`**Live Development Dashboard** • Branch: \`${dashboard.repository.branch}\``)
      .addFields(
        {
          name: '📊 Progress',
          value: `\`${createProgressBar(dashboard.progress)}\` **${dashboard.progress}%**`,
          inline: false,
        },
        {
          name: `${healthEmoji} System Health`,
          value: [
            `Status: **${dashboard.health.status.toUpperCase()}**`,
            `Latency: **${dashboard.health.latency}ms**`,
            `Uptime: **${(dashboard.health.uptime * 100).toFixed(1)}%**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: `${buildEmoji} Last Build`,
          value: [
            `Status: **${dashboard.lastBuild.status}**`,
            dashboard.lastBuild.duration ? `Duration: **${dashboard.lastBuild.duration}s**` : '',
            `<t:${Math.floor(dashboard.lastBuild.timestamp.getTime() / 1000)}:R>`,
          ].filter(Boolean).join('\n'),
          inline: true,
        },
        {
          name: '📈 Statistics',
          value: [
            `Commits: **${dashboard.totalCommits}**`,
            `PRs: **${dashboard.totalPRs}** (${dashboard.openPRs} open)`,
            `Issues: **${dashboard.openIssues}** open`,
          ].join('\n'),
          inline: true,
        }
      );

    // Active developers
    if (dashboard.activeDevs.length > 0) {
      const devList = dashboard.activeDevs
        .slice(0, 5)
        .map((dev: any) => {
          const mention = dev.discordId ? `<@${dev.discordId}>` : `\`${dev.githubUsername}\``;
          return `${mention} • ${dev.commitCount} commits`;
        })
        .join('\n');

      embed.addFields({
        name: `${AvenloEmojis.CODE} Active Developers`,
        value: devList,
        inline: false,
      });
    }

    // Recent commits
    if (dashboard.recentCommits.length > 0) {
      const commitList = dashboard.recentCommits
        .slice(0, 5)
        .map((c: any) => {
          const shortSha = c.sha.slice(0, 7);
          const shortMsg = c.message.split('\n')[0].slice(0, 50);
          return `[\`${shortSha}\`](${c.url}) ${shortMsg}${c.message.length > 50 ? '...' : ''}`;
        })
        .join('\n');

      embed.addFields({
        name: '📝 Recent Commits',
        value: commitList,
        inline: false,
      });
    }

    embed
      .setFooter({ 
        text: `Last updated • ${AvenloBranding.footer}`,
      })
      .setTimestamp(dashboard.lastUpdatedAt);

    return embed;
  }

  // Manual update trigger
  async forceUpdate(dashboardId: string): Promise<void> {
    await this.updateDashboard(dashboardId);
  }
}
