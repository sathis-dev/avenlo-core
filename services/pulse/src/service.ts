// ====================================
// AVENLO CORE - PULSE SERVICE
// ====================================

import { Octokit } from '@octokit/rest';
import cron from 'node-cron';
import { 
  createLogger, 
  getRedisClient, 
  EventTypes,
  Dashboard,
  User,
} from '@avenlo/shared';

const logger = createLogger('pulse-service');

export interface GitHubPushPayload {
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
    html_url: string;
  };
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    author: { name: string; username?: string };
    timestamp: string;
    url: string;
  }>;
  pusher: { name: string };
  sender: { login: string; avatar_url: string };
}

export interface GitHubPRPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    merged: boolean;
    merged_by?: { login: string };
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
  };
}

export interface GitHubWorkflowPayload {
  action: string;
  workflow_run: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    run_started_at: string;
    updated_at: string;
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
  };
}

export class PulseService {
  private octokit: Octokit;
  private healthCheckJob?: cron.ScheduledTask;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async start(): Promise<void> {
    const redis = getRedisClient();

    // Subscribe to internal pulse events
    await redis.subscribe(EventTypes.PULSE_DASHBOARD_UPDATE, async (event) => {
      logger.debug('Dashboard update triggered:', event.payload);
    });

    // Start health check cron (every 5 minutes)
    this.healthCheckJob = cron.schedule('*/5 * * * *', async () => {
      await this.runHealthChecks();
    });

    logger.info('Pulse service event subscriptions established');
  }

  async stop(): Promise<void> {
    this.healthCheckJob?.stop();
    const redis = getRedisClient();
    await redis.unsubscribe(EventTypes.PULSE_DASHBOARD_UPDATE);
  }

  // ====================================
  // GITHUB WEBHOOK HANDLERS
  // ====================================

  async handlePush(payload: GitHubPushPayload): Promise<void> {
    const { repository, commits, sender } = payload;
    const branch = payload.ref.replace('refs/heads/', '');

    logger.info(`Push to ${repository.full_name}:${branch} - ${commits.length} commits`);

    // Find dashboard for this repo
    const dashboard = await Dashboard.findOne({
      'repository.owner': repository.owner.login,
      'repository.name': repository.name,
    });

    if (!dashboard) {
      logger.debug(`No dashboard found for ${repository.full_name}`);
      return;
    }

    // Update dashboard data
    dashboard.totalCommits += commits.length;
    dashboard.lastUpdatedAt = new Date();

    // Add recent commits
    const newCommits = commits.map((c) => ({
      sha: c.id,
      message: c.message,
      author: c.author.username || c.author.name,
      timestamp: new Date(c.timestamp),
      url: c.url,
    }));

    dashboard.recentCommits = [
      ...newCommits,
      ...dashboard.recentCommits,
    ].slice(0, 10);

    // Update active devs
    const existingDev = dashboard.activeDevs.find(
      (d) => d.githubUsername === sender.login
    );

    if (existingDev) {
      existingDev.lastCommitAt = new Date();
      existingDev.commitCount += commits.length;
    } else {
      // Try to find Discord mapping
      const user = await User.findOne({ githubUsername: sender.login });
      
      dashboard.activeDevs.push({
        discordId: user?.discordId || '',
        githubUsername: sender.login,
        lastCommitAt: new Date(),
        commitCount: commits.length,
      });
    }

    // Keep only recent active devs
    dashboard.activeDevs = dashboard.activeDevs
      .sort((a, b) => b.lastCommitAt.getTime() - a.lastCommitAt.getTime())
      .slice(0, 10);

    await dashboard.save();

    // Publish event for Gateway to update Discord message
    const redis = getRedisClient();
    await redis.publish(EventTypes.PULSE_COMMIT, {
      source: 'pulse',
      payload: {
        repository: repository.full_name,
        branch,
        commits: newCommits,
        dashboardId: dashboard._id.toString(),
      },
    });

    await redis.publish(EventTypes.PULSE_DASHBOARD_UPDATE, {
      source: 'pulse',
      payload: {
        dashboardId: dashboard._id.toString(),
        messageId: dashboard.messageId,
        channelId: dashboard.channelId,
        guildId: dashboard.guildId,
      },
    });

    // Award credits to contributors
    for (const commit of commits) {
      const username = commit.author.username || commit.author.name;
      const user = await User.findOne({ githubUsername: username });
      
      if (user) {
        await redis.publish(EventTypes.LEDGER_CREDIT_EARNED, {
          source: 'pulse',
          payload: {
            userId: user._id.toString(),
            discordId: user.discordId,
            amount: 5, // 5 credits per commit
            reason: 'commit',
            referenceType: 'commit',
            referenceId: commit.id,
            referenceUrl: commit.url,
          },
        });
      }
    }
  }

  async handlePullRequest(payload: GitHubPRPayload): Promise<void> {
    const { action, pull_request, repository } = payload;

    logger.info(`PR ${action} on ${repository.full_name} - #${pull_request.number}`);

    // Find dashboard
    const dashboard = await Dashboard.findOne({
      'repository.owner': repository.owner.login,
      'repository.name': repository.name,
    });

    if (!dashboard) return;

    const redis = getRedisClient();

    switch (action) {
      case 'opened':
        dashboard.openPRs += 1;
        dashboard.totalPRs += 1;
        
        await redis.publish(EventTypes.PULSE_PR_OPENED, {
          source: 'pulse',
          payload: {
            repository: repository.full_name,
            prNumber: pull_request.number,
            title: pull_request.title,
            author: pull_request.user.login,
            action: 'opened',
          },
        });
        break;

      case 'closed':
        dashboard.openPRs = Math.max(0, dashboard.openPRs - 1);

        if (pull_request.merged) {
          // Award credits for merged PR
          const user = await User.findOne({ githubUsername: pull_request.user.login });
          
          if (user) {
            await redis.publish(EventTypes.LEDGER_CREDIT_EARNED, {
              source: 'pulse',
              payload: {
                userId: user._id.toString(),
                discordId: user.discordId,
                amount: 50, // 50 credits for merged PR
                reason: 'pr_merged',
                referenceType: 'pr',
                referenceId: pull_request.number.toString(),
                referenceUrl: pull_request.html_url,
              },
            });
          }

          await redis.publish(EventTypes.PULSE_PR_MERGED, {
            source: 'pulse',
            payload: {
              repository: repository.full_name,
              prNumber: pull_request.number,
              title: pull_request.title,
              author: pull_request.user.login,
              action: 'merged',
            },
          });
        } else {
          await redis.publish(EventTypes.PULSE_PR_CLOSED, {
            source: 'pulse',
            payload: {
              repository: repository.full_name,
              prNumber: pull_request.number,
              title: pull_request.title,
              author: pull_request.user.login,
              action: 'closed',
            },
          });
        }
        break;
    }

    dashboard.lastUpdatedAt = new Date();
    await dashboard.save();

    // Trigger dashboard update
    await redis.publish(EventTypes.PULSE_DASHBOARD_UPDATE, {
      source: 'pulse',
      payload: {
        dashboardId: dashboard._id.toString(),
        messageId: dashboard.messageId,
        channelId: dashboard.channelId,
        guildId: dashboard.guildId,
      },
    });
  }

  async handleWorkflowRun(payload: GitHubWorkflowPayload): Promise<void> {
    const { action, workflow_run, repository } = payload;

    logger.info(`Workflow ${action} on ${repository.full_name} - ${workflow_run.name}`);

    const dashboard = await Dashboard.findOne({
      'repository.owner': repository.owner.login,
      'repository.name': repository.name,
    });

    if (!dashboard) return;

    const redis = getRedisClient();

    // Calculate duration
    const startTime = new Date(workflow_run.run_started_at).getTime();
    const endTime = new Date(workflow_run.updated_at).getTime();
    const duration = Math.round((endTime - startTime) / 1000);

    switch (action) {
      case 'requested':
      case 'in_progress':
        dashboard.lastBuild = {
          status: 'running',
          buildId: workflow_run.id.toString(),
          timestamp: new Date(),
        };

        await redis.publish(EventTypes.PULSE_BUILD_START, {
          source: 'pulse',
          payload: {
            repository: repository.full_name,
            buildId: workflow_run.id.toString(),
            status: 'running',
          },
        });
        break;

      case 'completed':
        const conclusion = workflow_run.conclusion;
        const status = conclusion === 'success' ? 'success' : 'failure';

        dashboard.lastBuild = {
          status,
          buildId: workflow_run.id.toString(),
          duration,
          timestamp: new Date(),
        };

        const eventType = status === 'success' 
          ? EventTypes.PULSE_BUILD_SUCCESS 
          : EventTypes.PULSE_BUILD_FAILURE;

        await redis.publish(eventType, {
          source: 'pulse',
          payload: {
            repository: repository.full_name,
            buildId: workflow_run.id.toString(),
            status,
            duration,
          },
        });
        break;
    }

    dashboard.lastUpdatedAt = new Date();
    await dashboard.save();

    // Trigger dashboard update
    await redis.publish(EventTypes.PULSE_DASHBOARD_UPDATE, {
      source: 'pulse',
      payload: {
        dashboardId: dashboard._id.toString(),
        messageId: dashboard.messageId,
        channelId: dashboard.channelId,
        guildId: dashboard.guildId,
      },
    });
  }

  // ====================================
  // HEALTH CHECKS
  // ====================================

  private async runHealthChecks(): Promise<void> {
    logger.debug('Running health checks...');

    const dashboards = await Dashboard.find({});

    for (const dashboard of dashboards) {
      try {
        // Simple health check - just verify repo exists
        const start = Date.now();
        await this.octokit.repos.get({
          owner: dashboard.repository.owner,
          repo: dashboard.repository.name,
        });
        const latency = Date.now() - start;

        dashboard.health = {
          status: latency < 1000 ? 'online' : 'degraded',
          latency,
          lastCheckedAt: new Date(),
          uptime: dashboard.health.uptime || 1,
        };

        // Get open issues count
        const { data: repoData } = await this.octokit.repos.get({
          owner: dashboard.repository.owner,
          repo: dashboard.repository.name,
        });
        dashboard.openIssues = repoData.open_issues_count;

        await dashboard.save();
      } catch (error) {
        logger.error(`Health check failed for ${dashboard.repository.owner}/${dashboard.repository.name}:`, error);
        
        dashboard.health = {
          status: 'offline',
          latency: 0,
          lastCheckedAt: new Date(),
          uptime: Math.max(0, (dashboard.health.uptime || 1) - 0.01),
        };
        await dashboard.save();
      }
    }

    // Publish health event
    const redis = getRedisClient();
    await redis.publish(EventTypes.PULSE_HEALTH_CHECK, {
      source: 'pulse',
      payload: {
        checkedAt: new Date().toISOString(),
        dashboardCount: dashboards.length,
      },
    });
  }

  // ====================================
  // GITHUB API HELPERS
  // ====================================

  async getRepositoryStats(owner: string, repo: string) {
    try {
      const [repoData, commits, pullRequests] = await Promise.all([
        this.octokit.repos.get({ owner, repo }),
        this.octokit.repos.listCommits({ owner, repo, per_page: 10 }),
        this.octokit.pulls.list({ owner, repo, state: 'open' }),
      ]);

      return {
        repo: repoData.data,
        recentCommits: commits.data,
        openPRs: pullRequests.data,
      };
    } catch (error) {
      logger.error(`Failed to get repo stats for ${owner}/${repo}:`, error);
      throw error;
    }
  }
}
