// ====================================
// AVENLO CORE - GITHUB WEBHOOK ROUTE
// Proof-of-Value Ledger: PR Merge Credits
// ====================================

import express, { Request, Response } from 'express';
import {
  createLogger,
  getRedisClient,
  getEventBus,
  EventTypes,
  User,
} from '@avenlo/shared';

const logger = createLogger('ledger-github-webhook');

// ====================================
// TYPES
// ====================================

interface GitHubPRPayload {
  action: string;
  pull_request?: {
    merged: boolean;
    user: { login: string };
    html_url: string;
    number: number;
    title: string;
  };
}

// ====================================
// ROUTER
// ====================================

export const githubWebhookRouter: express.Router = express.Router();

/**
 * POST /api/webhooks/github
 * Listens for GitHub `pull_request` events.
 * When action is `closed` and merged === true, awards 500 Kinetic Credits
 * to the user whose GitHub username maps to a Discord ID.
 */
githubWebhookRouter.post('/github', async (req: Request, res: Response): Promise<void> => {
  // Acknowledge receipt immediately to prevent GitHub retries from backing up
  res.status(202).json({ status: 'accepted' });

  const eventType = req.headers['x-github-event'] as string | undefined;
  const payload = req.body as GitHubPRPayload;

  if (eventType !== 'pull_request') {
    logger.debug(`Ignoring GitHub event type: ${eventType}`);
    return;
  }

  if (!payload.pull_request) {
    logger.warn('GitHub PR webhook missing pull_request payload');
    return;
  }

  const { merged, user: prUser, html_url, number, title } = payload.pull_request;

  // Only process merged PRs
  if (!merged) {
    logger.debug(`PR #${number} closed but not merged — no credits awarded`);
    return;
  }

  const githubUsername = prUser.login;
  logger.info(`GitHub PR merged by ${githubUsername}: #${number} — ${title}`);

  try {
    // Map GitHub username to Discord user via MongoDB
    const user = await User.findOne({ githubUsername });

    if (!user) {
      logger.warn(`No Avenlo user found for GitHub username: ${githubUsername}`);
      return;
    }

    const PR_MERGE_CREDITS = 500;
    const balanceBefore = user.credits;
    const balanceAfter = balanceBefore + PR_MERGE_CREDITS;

    // Publish credit-earn event (Ledger consumer will persist atomically)
    const redis = getRedisClient();
    await redis.publish(EventTypes.LEDGER_CREDITS_EARNED, {
      source: 'ledger',
      payload: {
        userId: user._id.toString(),
        discordId: user.discordId,
        username: user.username,
        amount: PR_MERGE_CREDITS,
        reason: 'pr_merged',
        balanceBefore,
        balanceAfter,
        referenceType: 'pr',
        referenceId: String(number),
        referenceUrl: html_url,
      },
    });

    logger.info(`Awarded ${PR_MERGE_CREDITS} credits to ${user.username} for PR #${number}`);
  } catch (err) {
    logger.error('GitHub webhook processing failed:', err);
  }
});
