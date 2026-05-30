// ====================================
// AVENLO CORE - LEDGER CONSUMER
// Production-Ready Credit Processing
// ====================================

import mongoose, { ClientSession } from 'mongoose';
import {
  createLogger,
  initEventBus,
  getEventBus,
  createStreamConsumer,
  StreamConsumer,
  ProcessingContext,
  EventTypes,
  EventType,
  PayloadFor,
  LedgerCreditsEarnedPayload,
  TicketResolvedPayload,
  PulseCommitPayload,
  PulsePRPayload,
  User,
  Transaction,
} from '@avenlo/shared';
import { getRoleManager } from './roles/manager';

const logger = createLogger('ledger-consumer');

// ====================================
// CREDIT VALUES CONFIGURATION
// ====================================

export const CreditValues = {
  // Pulse Events
  commit: 5,
  commit_large: 15, // > 100 lines changed
  commit_significant: 25, // > 500 lines changed
  pr_opened: 10,
  pr_merged: 50,
  pr_merged_large: 100, // > 500 lines changed
  code_review: 15,
  
  // Ticket Events
  ticket_claimed: 5,
  ticket_resolved: 20,
  ticket_resolved_fast: 35, // Resolved within SLA
  ticket_resolved_urgent: 50, // Urgent ticket resolved
  
  // Project Events
  milestone_reached: 100,
  project_completed: 200,
  
  // Other
  issue_closed: 20,
  bug_report: 10,
  documentation: 15,
} as const;

// ====================================
// LEDGER CONSUMER CLASS
// ====================================

export class LedgerConsumer {
  private consumer: StreamConsumer;
  private isInitialized = false;

  constructor() {
    // Create stream consumer for ledger-relevant events
    this.consumer = createStreamConsumer({
      groupName: 'ledger-service',
      consumerId: `ledger-${process.env.HOSTNAME || 'local'}-${Date.now()}`,
      eventTypes: [
        EventTypes.TICKET_RESOLVED,
        EventTypes.TICKET_CLAIMED,
        EventTypes.PULSE_COMMIT_PUSHED,
        EventTypes.PULSE_PR_MERGED,
        EventTypes.PULSE_PR_OPENED,
      ],
      batchSize: 50,
      blockTimeout: 5000,
      maxRetries: 3,
      processPendingOnStartup: true,
    });

    this.registerHandlers();
  }

  // ====================================
  // HANDLER REGISTRATION
  // ====================================

  private registerHandlers(): void {
    // Ticket Events
    this.consumer.on(EventTypes.TICKET_RESOLVED, this.handleTicketResolved.bind(this));
    this.consumer.on(EventTypes.TICKET_CLAIMED, this.handleTicketClaimed.bind(this));

    // Pulse Events
    this.consumer.on(EventTypes.PULSE_COMMIT_PUSHED, this.handleCommitPushed.bind(this));
    this.consumer.on(EventTypes.PULSE_PR_MERGED, this.handlePRMerged.bind(this));
    this.consumer.on(EventTypes.PULSE_PR_OPENED, this.handlePROpened.bind(this));

    logger.info('Registered all event handlers');
  }

  // ====================================
  // TICKET HANDLERS
  // ====================================

  /**
   * Handle TICKET_RESOLVED event
   * Awards credits to the developer who resolved the ticket
   */
  private async handleTicketResolved(
    ctx: ProcessingContext<typeof EventTypes.TICKET_RESOLVED>
  ): Promise<void> {
    const payload = ctx.event.payload;
    
    logger.info(`Processing TICKET_RESOLVED: ${payload.ticketId} by ${payload.developerName}`);

    // Use MongoDB transaction for atomic credit update
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Find the developer
        const user = await User.findOne({ discordId: payload.developerId }).session(session);

        if (!user) {
          logger.warn(`User not found for Discord ID: ${payload.developerId}`);
          return;
        }

        // Calculate credits based on ticket details
        let credits = payload.sessionCredits || CreditValues.ticket_resolved;

        // Bonus for meeting SLA
        if (payload.slaMet) {
          credits = Math.floor(credits * 1.5); // 50% bonus
          logger.debug(`SLA met - applying 1.5x bonus: ${credits} credits`);
        }

        const balanceBefore = user.credits;
        const balanceAfter = balanceBefore + credits;

        // Update user credits atomically
        await User.updateOne(
          { _id: user._id },
          {
            $inc: { 
              credits: credits,
              totalEarned: credits,
              'contributions.tickets': 1,
            },
            $set: {
              lastActiveAt: new Date(),
              lastContributionAt: new Date(),
            },
          },
          { session }
        );

        // Create transaction record
        await Transaction.create(
          [
            {
              transactionId: ctx.event.meta.eventId,
              userId: user._id,
              discordId: payload.developerId,
              type: 'credit',
              amount: credits,
              balanceBefore,
              balanceAfter,
              reason: 'ticket_resolved',
              description: `Resolved ticket ${payload.ticketId}${payload.slaMet ? ' (SLA met)' : ''}`,
              referenceType: 'ticket',
              referenceId: payload.ticketId,
              metadata: {
                ticketId: payload.ticketId,
                resolution: payload.resolution,
                totalTime: payload.totalTime,
                slaMet: payload.slaMet,
              },
            },
          ],
          { session }
        );

        logger.info(
          `Awarded ${credits} credits to ${payload.developerName} for resolving ${payload.ticketId}`,
          { balanceBefore, balanceAfter }
        );

        // Emit credit earned event for other services (e.g., role updates)
        await this.emitCreditsEarned({
          userId: user._id.toString(),
          discordId: payload.developerId,
          username: payload.developerName,
          amount: credits,
          reason: 'ticket_resolved',
          balanceBefore,
          balanceAfter,
          referenceType: 'ticket',
          referenceId: payload.ticketId,
        });
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Handle TICKET_CLAIMED event
   * Awards small credit bonus for claiming a ticket
   */
  private async handleTicketClaimed(
    ctx: ProcessingContext<typeof EventTypes.TICKET_CLAIMED>
  ): Promise<void> {
    const payload = ctx.event.payload;

    logger.info(`Processing TICKET_CLAIMED: ${payload.ticketId} by ${payload.developerName}`);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const user = await User.findOne({ discordId: payload.developerId }).session(session);

        if (!user) {
          logger.warn(`User not found for Discord ID: ${payload.developerId}`);
          return;
        }

        const credits = CreditValues.ticket_claimed;
        const balanceBefore = user.credits;
        const balanceAfter = balanceBefore + credits;

        await User.updateOne(
          { _id: user._id },
          {
            $inc: { credits: credits, totalEarned: credits },
            $set: { lastActiveAt: new Date() },
          },
          { session }
        );

        await Transaction.create(
          [
            {
              transactionId: ctx.event.meta.eventId,
              userId: user._id,
              discordId: payload.developerId,
              type: 'credit',
              amount: credits,
              balanceBefore,
              balanceAfter,
              reason: 'ticket_claimed',
              description: `Claimed ticket ${payload.ticketId}`,
              referenceType: 'ticket',
              referenceId: payload.ticketId,
            },
          ],
          { session }
        );

        logger.info(`Awarded ${credits} credits to ${payload.developerName} for claiming ticket`);
      });
    } finally {
      await session.endSession();
    }
  }

  // ====================================
  // PULSE HANDLERS (GitHub Events)
  // ====================================

  /**
   * Handle PULSE_COMMIT event
   * Awards credits for each commit based on size
   */
  private async handleCommitPushed(
    ctx: ProcessingContext<typeof EventTypes.PULSE_COMMIT_PUSHED>
  ): Promise<void> {
    const payload = ctx.event.payload;

    logger.info(`Processing PULSE_COMMIT: ${payload.commits.length} commits to ${payload.repository}`);

    const session = await mongoose.startSession();
    const promotionTargets = new Map<string, number>();

    try {
      await session.withTransaction(async () => {
        // Process each commit
        for (const commit of payload.commits) {
          // Find user by GitHub username
          const user = await User.findOne({ 
            githubUsername: commit.authorUsername 
          }).session(session);

          if (!user) {
            logger.debug(`User not found for GitHub: ${commit.authorUsername}`);
            continue;
          }

          // Calculate credits based on commit size
          const linesChanged = commit.additions + commit.deletions;
          let credits: number = CreditValues.commit;

          if (linesChanged > 500) {
            credits = CreditValues.commit_significant;
          } else if (linesChanged > 100) {
            credits = CreditValues.commit_large;
          }

          const balanceBefore = user.credits;
          const balanceAfter = balanceBefore + credits;
          promotionTargets.set(user.discordId, balanceAfter);

          await User.updateOne(
            { _id: user._id },
            {
              $inc: { 
                credits: credits, 
                totalEarned: credits,
                'contributions.commits': 1,
              },
              $set: { 
                lastActiveAt: new Date(),
                lastContributionAt: new Date(),
              },
            },
            { session }
          );

          await Transaction.create(
            [
              {
                transactionId: `${ctx.event.meta.eventId}-${commit.sha}`,
                userId: user._id,
                discordId: user.discordId,
                type: 'credit',
                amount: credits,
                balanceBefore,
                balanceAfter,
                reason: 'commit',
                description: `Commit: ${commit.message.substring(0, 50)}`,
                referenceType: 'commit',
                referenceId: commit.sha,
                referenceUrl: commit.url,
                metadata: {
                  repository: payload.repository,
                  branch: payload.branch,
                  additions: commit.additions,
                  deletions: commit.deletions,
                },
              },
            ],
            { session }
          );

          logger.info(
            `Awarded ${credits} credits to ${commit.authorUsername} for commit ${commit.shortSha}`
          );

          await this.emitCreditsEarned({
            userId: user._id.toString(),
            discordId: user.discordId,
            username: user.username,
            amount: credits,
            reason: 'commit',
            balanceBefore,
            balanceAfter,
            referenceType: 'commit',
            referenceId: commit.sha,
            referenceUrl: commit.url,
          });
        }
      });

      // Proof-of-Value: evaluate tier promotion for each contributor touched.
      for (const [discordId, credits] of promotionTargets) {
        await getRoleManager().evaluateTierPromotion(discordId, credits);
      }
    } finally {
      await session.endSession();
    }
  }

  /**
   * Handle PULSE_PR_MERGED event
   * Awards credits for merged pull requests
   */
  private async handlePRMerged(
    ctx: ProcessingContext<typeof EventTypes.PULSE_PR_MERGED>
  ): Promise<void> {
    const payload = ctx.event.payload;

    logger.info(`Processing PULSE_PR_MERGED: PR #${payload.prNumber} in ${payload.repository}`);

    const session = await mongoose.startSession();
    const promotionTargets = new Map<string, number>();

    try {
      await session.withTransaction(async () => {
        const user = await User.findOne({ 
          githubUsername: payload.authorUsername 
        }).session(session);

        if (!user) {
          logger.debug(`User not found for GitHub: ${payload.authorUsername}`);
          return;
        }

        // Calculate credits based on PR size
        const linesChanged = payload.additions + payload.deletions;
        let credits: number = CreditValues.pr_merged;

        if (linesChanged > 500) {
          credits = CreditValues.pr_merged_large;
        }

        const balanceBefore = user.credits;
        const balanceAfter = balanceBefore + credits;
        promotionTargets.set(user.discordId, balanceAfter);

        await User.updateOne(
          { _id: user._id },
          {
            $inc: { 
              credits: credits, 
              totalEarned: credits,
              'contributions.pullRequests': 1,
            },
            $set: { 
              lastActiveAt: new Date(),
              lastContributionAt: new Date(),
            },
          },
          { session }
        );

        await Transaction.create(
          [
            {
              transactionId: ctx.event.meta.eventId,
              userId: user._id,
              discordId: user.discordId,
              type: 'credit',
              amount: credits,
              balanceBefore,
              balanceAfter,
              reason: 'pr_merged',
              description: `PR #${payload.prNumber}: ${payload.title.substring(0, 50)}`,
              referenceType: 'pr',
              referenceId: payload.prNumber.toString(),
              referenceUrl: payload.url,
              metadata: {
                repository: payload.repository,
                additions: payload.additions,
                deletions: payload.deletions,
                changedFiles: payload.changedFiles,
              },
            },
          ],
          { session }
        );

        logger.info(
          `Awarded ${credits} credits to ${payload.authorUsername} for PR #${payload.prNumber}`
        );

        await this.emitCreditsEarned({
          userId: user._id.toString(),
          discordId: user.discordId,
          username: user.username,
          amount: credits,
          reason: 'pr_merged',
          balanceBefore,
          balanceAfter,
          referenceType: 'pr',
          referenceId: payload.prNumber.toString(),
          referenceUrl: payload.url,
        });
      });

      // Proof-of-Value: evaluate tier promotion against the new balance.
      for (const [discordId, credits] of promotionTargets) {
        await getRoleManager().evaluateTierPromotion(discordId, credits);
      }
    } finally {
      await session.endSession();
    }
  }

  /**
   * Handle PULSE_PR_OPENED event
   * Awards small credit for opening a PR
   */
  private async handlePROpened(
    ctx: ProcessingContext<typeof EventTypes.PULSE_PR_OPENED>
  ): Promise<void> {
    const payload = ctx.event.payload;

    logger.info(`Processing PULSE_PR_OPENED: PR #${payload.prNumber} in ${payload.repository}`);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const user = await User.findOne({ 
          githubUsername: payload.authorUsername 
        }).session(session);

        if (!user) {
          logger.debug(`User not found for GitHub: ${payload.authorUsername}`);
          return;
        }

        const credits = CreditValues.pr_opened;
        const balanceBefore = user.credits;
        const balanceAfter = balanceBefore + credits;

        await User.updateOne(
          { _id: user._id },
          {
            $inc: { credits: credits, totalEarned: credits },
            $set: { lastActiveAt: new Date() },
          },
          { session }
        );

        await Transaction.create(
          [
            {
              transactionId: ctx.event.meta.eventId,
              userId: user._id,
              discordId: user.discordId,
              type: 'credit',
              amount: credits,
              balanceBefore,
              balanceAfter,
              reason: 'pr_opened',
              description: `Opened PR #${payload.prNumber}: ${payload.title.substring(0, 50)}`,
              referenceType: 'pr',
              referenceId: payload.prNumber.toString(),
              referenceUrl: payload.url,
            },
          ],
          { session }
        );

        logger.info(
          `Awarded ${credits} credits to ${payload.authorUsername} for opening PR #${payload.prNumber}`
        );
      });
    } finally {
      await session.endSession();
    }
  }

  // ====================================
  // HELPER METHODS
  // ====================================

  /**
   * Emit a CREDITS_EARNED event for other services to react to
   */
  private async emitCreditsEarned(
    payload: PayloadFor<typeof EventTypes.LEDGER_CREDITS_EARNED>
  ): Promise<void> {
    try {
      const eventBus = getEventBus();
      await eventBus.publish(EventTypes.LEDGER_CREDITS_EARNED, payload);
    } catch (err) {
      logger.error('Failed to emit CREDITS_EARNED event:', err);
      // Don't throw - the transaction already succeeded
    }
  }

  // ====================================
  // LIFECYCLE
  // ====================================

  /**
   * Start the ledger consumer
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Ledger consumer is already running');
      return;
    }

    logger.info('Starting Ledger Consumer...');
    await this.consumer.start();
    this.isInitialized = true;
    logger.info('Ledger Consumer started successfully');
  }

  /**
   * Stop the ledger consumer gracefully
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Stopping Ledger Consumer...');
    await this.consumer.stop();
    this.isInitialized = false;
    logger.info('Ledger Consumer stopped');
  }

  /**
   * Get consumer statistics
   */
  getStats() {
    return this.consumer.getStats();
  }

  /**
   * Check if consumer is running
   */
  isRunning(): boolean {
    return this.consumer.isActive();
  }
}

// ====================================
// SINGLETON INSTANCE
// ====================================

let ledgerConsumerInstance: LedgerConsumer | null = null;

export function getLedgerConsumer(): LedgerConsumer {
  if (!ledgerConsumerInstance) {
    ledgerConsumerInstance = new LedgerConsumer();
  }
  return ledgerConsumerInstance;
}

export function createLedgerConsumer(): LedgerConsumer {
  return new LedgerConsumer();
}
