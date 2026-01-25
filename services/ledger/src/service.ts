// ====================================
// AVENLO CORE - LEDGER SERVICE
// ====================================

import { v4 as uuidv4 } from 'uuid';
import { 
  createLogger, 
  getRedisClient, 
  EventTypes,
  User,
  Transaction,
  TransactionReason,
} from '@avenlo/shared';

const logger = createLogger('ledger-service');

// Credit values for different actions
export const CreditValues: Record<string, number> = {
  commit: 5,
  pr_merged: 50,
  pr_opened: 10,
  code_review: 15,
  issue_closed: 20,
  ticket_resolved: 20,
  project_completed: 200,
  milestone_reached: 100,
};

export class LedgerService {
  constructor() {}

  async start(): Promise<void> {
    const redis = getRedisClient();

    // Subscribe to credit earning events
    await redis.subscribe(EventTypes.LEDGER_CREDITS_EARNED, async (event) => {
      await this.handleCreditEarned(event.payload as any);
    });

    // Subscribe to credit spending events
    await redis.subscribe(EventTypes.LEDGER_CREDITS_SPENT, async (event) => {
      await this.handleCreditSpent(event.payload as any);
    });

    logger.info('Ledger service subscriptions established');
  }

  async stop(): Promise<void> {
    const redis = getRedisClient();
    await redis.unsubscribe(EventTypes.LEDGER_CREDITS_EARNED);
    await redis.unsubscribe(EventTypes.LEDGER_CREDITS_SPENT);
  }

  private async handleCreditEarned(payload: {
    userId: string;
    discordId: string;
    amount: number;
    reason: TransactionReason;
    referenceType?: string;
    referenceId?: string;
    referenceUrl?: string;
  }): Promise<void> {
    logger.info(`Processing credit earn: ${payload.discordId} +${payload.amount} (${payload.reason})`);

    try {
      // Find or create user
      let user = await User.findOne({ discordId: payload.discordId });

      if (!user) {
        logger.warn(`User not found for Discord ID: ${payload.discordId}`);
        return;
      }

      const balanceBefore = user.credits;
      const amount = payload.amount || CreditValues[payload.reason] || 0;

      // Update user credits
      user.credits += amount;
      user.totalEarned += amount;
      user.lastActiveAt = new Date();
      user.lastContributionAt = new Date();

      // Update contribution counts
      switch (payload.reason) {
        case 'commit':
          user.contributions.commits += 1;
          break;
        case 'pr_merged':
          user.contributions.pullRequests += 1;
          break;
        case 'code_review':
          user.contributions.reviews += 1;
          break;
        case 'issue_closed':
          user.contributions.issues += 1;
          break;
        case 'ticket_resolved':
          user.contributions.tickets += 1;
          break;
      }

      // Update streak
      user.streak = await this.calculateStreak(user.discordId);

      await user.save();

      // Create transaction record
      await Transaction.create({
        transactionId: uuidv4(),
        userId: user._id.toString(),
        discordId: payload.discordId,
        type: 'earn',
        reason: payload.reason,
        amount,
        balanceBefore,
        balanceAfter: user.credits,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        referenceUrl: payload.referenceUrl,
        description: this.getTransactionDescription(payload.reason, amount),
      });

      logger.info(`Credit earned: ${payload.discordId} now has ${user.credits} credits`);

      // Check for leaderboard updates
      await this.checkLeaderboardPosition(user);

    } catch (error) {
      logger.error('Failed to process credit earn:', error);
    }
  }

  private async handleCreditSpent(payload: {
    userId: string;
    discordId: string;
    amount: number;
    reason: TransactionReason;
    item?: string;
  }): Promise<void> {
    logger.info(`Processing credit spend: ${payload.discordId} -${payload.amount} (${payload.reason})`);

    try {
      const user = await User.findOne({ discordId: payload.discordId });

      if (!user) {
        logger.warn(`User not found for Discord ID: ${payload.discordId}`);
        return;
      }

      // Check if user has enough credits
      if (user.credits < payload.amount) {
        logger.warn(`Insufficient credits: ${user.credits} < ${payload.amount}`);
        return;
      }

      const balanceBefore = user.credits;

      // Deduct credits
      user.credits -= payload.amount;
      user.totalSpent += payload.amount;
      await user.save();

      // Create transaction record
      await Transaction.create({
        transactionId: uuidv4(),
        userId: user._id.toString(),
        discordId: payload.discordId,
        type: 'spend',
        reason: payload.reason,
        amount: -payload.amount,
        balanceBefore,
        balanceAfter: user.credits,
        description: `${payload.item || payload.reason} purchase`,
      });

      logger.info(`Credit spent: ${payload.discordId} now has ${user.credits} credits`);

    } catch (error) {
      logger.error('Failed to process credit spend:', error);
    }
  }

  private async calculateStreak(discordId: string): Promise<number> {
    const transactions = await Transaction.find({
      discordId,
      type: 'earn',
    })
      .sort({ createdAt: -1 })
      .limit(30);

    if (transactions.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const transactionDates = new Set(
      transactions.map((t) => {
        const date = new Date(t.createdAt);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    while (transactionDates.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  private async checkLeaderboardPosition(user: any): Promise<void> {
    const redis = getRedisClient();

    // Check if user is now in top 10
    const rank = await User.countDocuments({ credits: { $gt: user.credits } }) + 1;

    if (rank <= 10) {
      await redis.publish(EventTypes.LEDGER_LEADERBOARD_UPDATE, {
        source: 'ledger',
        payload: {
          userId: user._id.toString(),
          discordId: user.discordId,
          rank,
          credits: user.credits,
        },
      });
    }
  }

  private getTransactionDescription(reason: TransactionReason, amount: number): string {
    const descriptions: Record<TransactionReason, string> = {
      commit: `Code commit (+${amount} credits)`,
      pr_merged: `Pull request merged (+${amount} credits)`,
      issue_closed: `Issue resolved (+${amount} credits)`,
      code_review: `Code review (+${amount} credits)`,
      ticket_resolved: `Support ticket resolved (+${amount} credits)`,
      project_completed: `Project completed (+${amount} credits)`,
      milestone_reached: `Milestone achieved (+${amount} credits)`,
      bonus_manual: `Bonus awarded (+${amount} credits)`,
      perk_purchase: `Perk purchased`,
      role_purchase: `Role purchased`,
      transfer_out: `Credits transferred`,
      transfer_in: `Credits received`,
      penalty: `Penalty applied`,
    };

    return descriptions[reason] || `Transaction (+${amount} credits)`;
  }

  // ====================================
  // PUBLIC METHODS
  // ====================================

  async getBalance(discordId: string): Promise<number> {
    const user = await User.findOne({ discordId });
    return user?.credits || 0;
  }

  async getTransactionHistory(discordId: string, limit: number = 10): Promise<any[]> {
    return Transaction.find({ discordId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getLeaderboard(limit: number = 10): Promise<any[]> {
    return User.find()
      .sort({ credits: -1 })
      .limit(limit)
      .select('discordId username credits contributions isStudioLead');
  }

  async transferCredits(
    fromDiscordId: string,
    toDiscordId: string,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    const fromUser = await User.findOne({ discordId: fromDiscordId });
    const toUser = await User.findOne({ discordId: toDiscordId });

    if (!fromUser) return { success: false, error: 'Sender not found' };
    if (!toUser) return { success: false, error: 'Recipient not found' };
    if (fromUser.credits < amount) return { success: false, error: 'Insufficient credits' };

    // Perform transfer
    const fromBalanceBefore = fromUser.credits;
    const toBalanceBefore = toUser.credits;

    fromUser.credits -= amount;
    fromUser.totalSpent += amount;
    await fromUser.save();

    toUser.credits += amount;
    toUser.totalEarned += amount;
    await toUser.save();

    // Create transaction records
    const transactionId = uuidv4();

    await Transaction.create({
      transactionId: `${transactionId}-out`,
      userId: fromUser._id.toString(),
      discordId: fromDiscordId,
      type: 'transfer',
      reason: 'transfer_out',
      amount: -amount,
      balanceBefore: fromBalanceBefore,
      balanceAfter: fromUser.credits,
      description: `Transfer to ${toUser.username}`,
    });

    await Transaction.create({
      transactionId: `${transactionId}-in`,
      userId: toUser._id.toString(),
      discordId: toDiscordId,
      type: 'transfer',
      reason: 'transfer_in',
      amount,
      balanceBefore: toBalanceBefore,
      balanceAfter: toUser.credits,
      description: `Transfer from ${fromUser.username}`,
    });

    return { success: true };
  }
}
