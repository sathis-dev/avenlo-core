// ====================================
// AVENLO CORE - DASHBOARD API ROUTES
// ====================================

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Ticket, User, ModerationLog } from '@avenlo/shared';
import { createLogger, getRedisClient } from '@avenlo/shared';

const router = Router();
const logger = createLogger('dashboard-api');

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ENCRYPTION_KEY || 'secret') as any;
    (req as any).user = decoded.user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// ====================================
// STATS ENDPOINTS
// ====================================

router.get('/stats/overview', requireAuth, async (_req, res) => {
  try {
    const redis = getRedisClient();
    
    // Get cached stats or compute them
    const cachedStats = await redis.getCache<object>('dashboard:stats:overview');
    if (cachedStats) {
      return res.json(cachedStats);
    }
    
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      totalUsers,
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'open' }),
      Ticket.countDocuments({ status: 'resolved' }),
      User.countDocuments(),
    ]);
    
    const stats = {
      totalTickets,
      openTickets,
      resolvedTickets,
      closedTickets: await Ticket.countDocuments({ status: 'closed' }),
      totalUsers,
      activeUsers: await User.countDocuments({ 
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      totalCredits: await User.aggregate([
        { $group: { _id: null, total: { $sum: '$credits' } } }
      ]).then(r => r[0]?.total || 0),
      moderationActions: await ModerationLog?.countDocuments() || 0,
    };
    
    // Cache for 5 minutes
    await redis.setCache('dashboard:stats:overview', stats, 300);
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get overview stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/stats/charts', requireAuth, async (_req, res) => {
  try {
    // Get ticket stats for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const ticketsByDay = await Ticket.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    
    const ticketsByCategory = await Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    const ticketsByPriority = await Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);
    
    res.json({
      ticketsByDay,
      ticketsByCategory,
      ticketsByPriority,
    });
  } catch (error) {
    logger.error('Failed to get chart stats:', error);
    res.status(500).json({ error: 'Failed to get chart stats' });
  }
});

// ====================================
// TICKET ENDPOINTS
// ====================================

router.get('/tickets', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, search } = req.query;
    
    const query: any = {};
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (search) {
      query.$or = [
        { ticketId: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
      ];
    }
    
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    
    const total = await Ticket.countDocuments(query);
    
    res.json({
      tickets,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    logger.error('Failed to get tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

router.get('/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    logger.error('Failed to get ticket:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

router.patch('/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.body;
    
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.id },
      { 
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedTo && { assignedTo }),
        updatedAt: new Date(),
      },
      { new: true }
    );
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    logger.error('Failed to update ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

router.delete('/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ ticketId: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// ====================================
// USER ENDPOINTS
// ====================================

router.get('/users', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'credits' } = req.query;
    
    const query: any = {};
    if (search) {
      query.$or = [
        { discordId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }
    
    const sortOrder: any = {};
    sortOrder[sort as string] = -1;
    
    const users = await User.find(query)
      .sort(sortOrder)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Failed to get user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.patch('/users/:id/credits', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    const user = await User.findOneAndUpdate(
      { discordId: req.params.id },
      { 
        $inc: { credits: amount },
        $push: {
          transactions: {
            amount,
            reason: reason || 'Admin adjustment',
            timestamp: new Date(),
            adminId: (req as any).user.id,
          }
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Failed to update user credits:', error);
    res.status(500).json({ error: 'Failed to update credits' });
  }
});

// ====================================
// MODERATION ENDPOINTS
// ====================================

router.get('/moderation/logs', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    
    const query: any = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;
    
    const logs = await ModerationLog?.find(query)
      .sort({ timestamp: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)) || [];
    
    const total = await ModerationLog?.countDocuments(query) || 0;
    
    res.json({
      logs,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    logger.error('Failed to get moderation logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// ====================================
// SETTINGS ENDPOINTS
// ====================================

router.get('/settings', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const redis = getRedisClient();
    const settings = await redis.getCache<object>('dashboard:settings');
    
    res.json(settings ? settings : {
      welcomeEnabled: true,
      aiModerationEnabled: true,
      antiRaidEnabled: true,
      antiNukeEnabled: true,
      autoRoleEnabled: true,
      ticketSystemEnabled: true,
      aiThresholds: {
        warn: 40,
        mute: 60,
        kick: 80,
        ban: 95,
      },
    });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const redis = getRedisClient();
    await redis.setCache('dashboard:settings', req.body);
    
    res.json({ success: true, settings: req.body });
  } catch (error) {
    logger.error('Failed to save settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ====================================
// BOT STATUS ENDPOINT
// ====================================

router.get('/bot/status', requireAuth, async (_req, res) => {
  try {
    const redis = getRedisClient();
    const status = await redis.getCache<object>('bot:status');
    
    res.json(status ? status : {
      online: true,
      uptime: 0,
      guilds: 1,
      users: 0,
      latency: 0,
    });
  } catch (error) {
    logger.error('Failed to get bot status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
