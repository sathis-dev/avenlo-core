// ====================================
// AVENLO CORE - DASHBOARD SERVER
// Express + Discord OAuth2 + API
// ====================================

console.log('🔄 Starting dashboard server...');

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  EventTypes,
  WelcomeConfig,
  DEFAULT_WELCOME_CONFIG,
  JoinEvent,
  THEME_PRESETS,
  type ThemePreset,
  initRedis,
  type RedisClient,
  type WelcomeConfigData,
  type WelcomeConfigUpdatedPayload,
} from '@avenlo/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`📍 Current file: ${__filename}`);
console.log(`📍 Current dir: ${__dirname}`);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('📦 Environment loaded');

const app = express();
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3001;

// Determine the base URL
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.DASHBOARD_URL || 'http://localhost:5173');

// Calculate static path early for serving files
const staticPath = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(staticPath, 'index.html');

console.log(`📁 Static path: ${staticPath}`);
console.log(`📁 Index path: ${indexHtmlPath}`);
console.log(`📁 Index exists: ${fs.existsSync(indexHtmlPath)}`);

// ====================================
// HEALTH CHECK (before other middleware)
// ====================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'dashboard' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'dashboard', timestamp: new Date().toISOString() });
});

// ====================================
// MIDDLEWARE (must be before static files)
// ====================================

app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Trust proxy for Railway (needed for secure cookies)
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'avenlo-dashboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'none' to 'lax' for same-site redirects
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// ====================================
// STATIC FILES (after session middleware)
// ====================================
app.use(express.static(staticPath));

// ====================================
// DISCORD OAUTH2
// ====================================

const ADMIN_ROLES = [
  process.env.ROLE_MANAGEMENT,
].filter(Boolean);

const MODERATOR_ROLES = [
  process.env.ROLE_MODERATOR,
  process.env.ROLE_MANAGEMENT,
].filter(Boolean);

const ALLOWED_ROLES = [
  process.env.ROLE_MANAGEMENT,
  process.env.ROLE_MODERATOR,
  process.env.ROLE_STUDIO_LEAD,
  process.env.ROLE_DEVELOPER,
].filter(Boolean);

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Determine callback URL dynamically
console.log('🔍 DISCORD_CALLBACK_URL env:', process.env.DISCORD_CALLBACK_URL);
console.log('🔍 RAILWAY_PUBLIC_DOMAIN env:', process.env.RAILWAY_PUBLIC_DOMAIN);

const CALLBACK_URL = process.env.DISCORD_CALLBACK_URL 
  || (process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/discord/callback`
      : 'http://localhost:3001/auth/discord/callback');

console.log('🔍 Final CALLBACK_URL:', CALLBACK_URL);

// Check for required Discord OAuth environment variables
if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables: DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET');
  console.error('   Please set these in your Railway service variables');
  console.log('⚠️  Starting server without Discord OAuth - only health endpoints will work');
} else {
  console.log('✅ Discord OAuth configured');
  console.log('🔍 Client ID:', process.env.DISCORD_CLIENT_ID);
  console.log('🔍 Secret length:', process.env.DISCORD_CLIENT_SECRET?.length);
}

// Only initialize Discord OAuth if credentials are available
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  scope: ['identify', 'email', 'guilds', 'guilds.members.read'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Fetch guild member to check roles
    const guildId = process.env.DISCORD_GUILD_ID;
    console.log('🔍 Checking roles for guild:', guildId);
    console.log('🔍 User:', profile.username);
    
    const memberResponse = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('🔍 Member API response status:', memberResponse.status);

    let roles: string[] = [];
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      roles = memberData.roles || [];
      console.log('🔍 User roles:', roles);
    } else {
      const errorText = await memberResponse.text();
      console.log('❌ Member API error:', errorText);
    }

    console.log('🔍 Allowed roles:', ALLOWED_ROLES);
    
    // Check if user has required role
    const hasAccess = roles.some(role => ALLOWED_ROLES.includes(role));
    console.log('🔍 Has access:', hasAccess);
    
    if (!hasAccess) {
      console.log('❌ Access denied - no matching roles');
      return done(null, false, { message: 'You do not have permission to access this dashboard.' });
    }

    const user = {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      email: profile.email,
      roles,
      isAdmin: roles.some(role => ADMIN_ROLES.includes(role)),
      isModerator: roles.some(role => MODERATOR_ROLES.includes(role)),
    };

    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error as Error);
  }
}));
} // End of Discord OAuth conditional

// ====================================
// AUTH ROUTES
// ====================================

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'dashboard',
  });
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login?error=unauthorized' }),
  (req, res) => {
    // Set user data in session
    console.log('✅ OAuth callback successful, user:', (req.user as any)?.username);
    // Redirect to dashboard after successful login
    res.redirect('/dashboard');
  }
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// ====================================
// API MIDDLEWARE
// ====================================

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated() && (req.user as any).isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

// ====================================
// API ROUTES
// ====================================

// Check if user is authenticated (no auth required)
app.get('/api/auth/check', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_TOKEN;
    
    // Fetch real guild data from Discord API
    let totalMembers = 0;
    let onlineMembers = 0;
    
    if (botToken && guildId) {
      try {
        // Get guild info
        const guildResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (guildResponse.ok) {
          const guildData = await guildResponse.json();
          totalMembers = guildData.approximate_member_count || 0;
          onlineMembers = guildData.approximate_presence_count || 0;
        }
      } catch (e) {
        console.error('Failed to fetch Discord guild:', e);
      }
    }
    
    // Fetch real ticket/moderation data from MongoDB
    let openTickets = 0;
    let totalTickets = 0;
    let moderationActions = 0;
    
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Count tickets
        const ticketsCollection = db.collection('tickets');
        totalTickets = await ticketsCollection.countDocuments();
        openTickets = await ticketsCollection.countDocuments({ status: 'open' });
        
        // Count moderation actions
        const modCollection = db.collection('moderationlogs');
        moderationActions = await modCollection.countDocuments();
      }
    } catch (e) {
      console.error('Failed to fetch from MongoDB:', e);
    }
    
    const stats = {
      totalMembers,
      onlineMembers,
      totalTickets,
      openTickets,
      moderationActions,
      messagesPerDay: 0, // Would need message tracking
      newMembersToday: 0, // Would need join tracking
      activeProjects: 0,
    };

    // Fetch recent activity from MongoDB
    let activity: any[] = [];
    try {
      const db = mongoose.connection.db;
      if (db) {
        const modLogs = await db.collection('moderationlogs')
          .find()
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();
        
        activity = modLogs.map((log: any) => ({
          id: log._id.toString(),
          type: 'moderation',
          user: { id: log.moderatorId, username: log.moderatorName || 'Moderator', avatar: '' },
          action: `${log.action} on ${log.targetName || 'user'}`,
          timestamp: log.createdAt,
        }));
      }
    } catch (e) {
      console.error('Failed to fetch activity:', e);
    }

    res.json({ stats, activity });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Members list
app.get('/api/members', requireAuth, async (req, res) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_TOKEN;
    
    if (!botToken || !guildId) {
      return res.json({ members: [], total: 0 });
    }
    
    // Fetch members from Discord API
    const membersResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=100`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    
    if (!membersResponse.ok) {
      console.error('Failed to fetch members:', await membersResponse.text());
      return res.json({ members: [], total: 0 });
    }
    
    const membersData = await membersResponse.json();
    const members = membersData.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.nick || m.user.global_name || m.user.username,
      avatar: m.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
        : null,
      roles: m.roles,
      joinedAt: m.joined_at,
      isBot: m.user.bot || false,
    }));
    
    res.json({ members, total: members.length });
  } catch (error) {
    console.error('Failed to fetch members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Moderation actions
app.get('/api/moderation/actions', requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.json({ actions: [], total: 0 });
    }
    
    const actions = await db.collection('moderationlogs')
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    
    const formattedActions = actions.map((a: any) => ({
      id: a._id.toString(),
      action: a.action,
      targetId: a.targetId,
      targetName: a.targetName || 'Unknown',
      moderatorId: a.moderatorId,
      moderatorName: a.moderatorName || 'System',
      reason: a.reason,
      timestamp: a.createdAt,
    }));
    
    res.json({ actions: formattedActions, total: actions.length });
  } catch (error) {
    console.error('Failed to fetch actions:', error);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// Tickets
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.json({ tickets: [], total: 0 });
    }
    
    const tickets = await db.collection('tickets')
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    
    const formattedTickets = tickets.map((t: any) => ({
      id: t._id.toString(),
      number: t.ticketNumber || t._id.toString().slice(-4),
      userId: t.userId,
      userName: t.userName || 'Unknown',
      status: t.status || 'open',
      subject: t.subject || 'Support Request',
      createdAt: t.createdAt,
      closedAt: t.closedAt,
    }));
    
    res.json({ tickets: formattedTickets, total: tickets.length });
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ====================================
// REDIS (best-effort) for publishing config events
// ====================================

let redisClient: RedisClient | null = null;

function tryInitRedis(): void {
  if (redisClient || !process.env.REDIS_URL) return;
  try {
    redisClient = initRedis({
      url: process.env.REDIS_URL,
      keyPrefix: 'avenlo:',
    });
    redisClient.connect()
      .then(() => console.log('✅ Dashboard Redis publisher connected'))
      .catch((err: unknown) => {
        console.log('⚠️ Dashboard Redis publisher connect failed:', err);
        redisClient = null;
      });
  } catch (err) {
    console.log('⚠️ Failed to initialize dashboard Redis publisher:', err);
    redisClient = null;
  }
}

tryInitRedis();

// ====================================
// WELCOME CONFIG API
// ====================================

function toWelcomeConfigData(
  guildId: string,
  doc: { toObject?: () => Record<string, unknown> } | null
): WelcomeConfigData {
  if (!doc) {
    return { guildId, ...DEFAULT_WELCOME_CONFIG };
  }
  const obj = (doc.toObject ? doc.toObject() : doc) as Record<string, unknown>;
  const preset = String(obj.themePreset ?? DEFAULT_WELCOME_CONFIG.themePreset);
  const themePreset: ThemePreset = (THEME_PRESETS as readonly string[]).includes(preset)
    ? (preset as ThemePreset)
    : DEFAULT_WELCOME_CONFIG.themePreset;
  return {
    guildId,
    enabled: Boolean(obj.enabled ?? DEFAULT_WELCOME_CONFIG.enabled),
    dmEnabled: Boolean(obj.dmEnabled ?? DEFAULT_WELCOME_CONFIG.dmEnabled),
    mentionUser: Boolean(obj.mentionUser ?? DEFAULT_WELCOME_CONFIG.mentionUser),
    cardEnabled: Boolean(obj.cardEnabled ?? DEFAULT_WELCOME_CONFIG.cardEnabled),
    showMemberCount: Boolean(obj.showMemberCount ?? DEFAULT_WELCOME_CONFIG.showMemberCount),
    showAccountAge: Boolean(obj.showAccountAge ?? DEFAULT_WELCOME_CONFIG.showAccountAge),
    channelName: String(obj.channelName ?? DEFAULT_WELCOME_CONFIG.channelName),
    welcomeChannelId: String(obj.welcomeChannelId ?? DEFAULT_WELCOME_CONFIG.welcomeChannelId),
    rulesChannelId: String(obj.rulesChannelId ?? DEFAULT_WELCOME_CONFIG.rulesChannelId),
    rolesChannelId: String(obj.rolesChannelId ?? DEFAULT_WELCOME_CONFIG.rolesChannelId),
    titleTemplate: String(obj.titleTemplate ?? DEFAULT_WELCOME_CONFIG.titleTemplate),
    bodyTemplate: String(obj.bodyTemplate ?? DEFAULT_WELCOME_CONFIG.bodyTemplate),
    cardTagline: String(obj.cardTagline ?? DEFAULT_WELCOME_CONFIG.cardTagline),
    neonBorderColor: String(obj.neonBorderColor ?? DEFAULT_WELCOME_CONFIG.neonBorderColor),
    embedAccentColor: String(obj.embedAccentColor ?? DEFAULT_WELCOME_CONFIG.embedAccentColor),
    autoRoleIds: Array.isArray(obj.autoRoleIds) ? (obj.autoRoleIds as string[]) : [],
    verifiedRoleId: String(obj.verifiedRoleId ?? DEFAULT_WELCOME_CONFIG.verifiedRoleId),
    pendingRoleId: String(obj.pendingRoleId ?? DEFAULT_WELCOME_CONFIG.pendingRoleId),
    quarantineNewAccounts: Boolean(
      obj.quarantineNewAccounts ?? DEFAULT_WELCOME_CONFIG.quarantineNewAccounts,
    ),
    quarantineHours: Number(obj.quarantineHours ?? DEFAULT_WELCOME_CONFIG.quarantineHours),
    aiPersonalizedEnabled: Boolean(
      obj.aiPersonalizedEnabled ?? DEFAULT_WELCOME_CONFIG.aiPersonalizedEnabled,
    ),
    returningMemberEnabled: Boolean(
      obj.returningMemberEnabled ?? DEFAULT_WELCOME_CONFIG.returningMemberEnabled,
    ),
    themePreset,
  };
}

function resolveGuildId(req: express.Request): string | null {
  const fromQuery = typeof req.query.guildId === 'string' ? req.query.guildId : null;
  return fromQuery || process.env.DISCORD_GUILD_ID || null;
}

app.get('/api/welcome-config', requireAuth, async (req, res) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      res.status(400).json({ error: 'guildId is required (query or DISCORD_GUILD_ID env)' });
      return;
    }
    const doc = await WelcomeConfig.findOne({ guildId }).exec();
    res.json({ config: toWelcomeConfigData(guildId, doc) });
  } catch (err) {
    console.error('Failed to fetch welcome config:', err);
    res.status(500).json({ error: 'Failed to fetch welcome config' });
  }
});

const BOOLEAN_FIELDS = [
  'enabled',
  'dmEnabled',
  'mentionUser',
  'cardEnabled',
  'showMemberCount',
  'showAccountAge',
  'quarantineNewAccounts',
  'aiPersonalizedEnabled',
  'returningMemberEnabled',
] as const;

const STRING_FIELDS = [
  'channelName',
  'welcomeChannelId',
  'rulesChannelId',
  'rolesChannelId',
  'titleTemplate',
  'bodyTemplate',
  'cardTagline',
  'neonBorderColor',
  'embedAccentColor',
  'verifiedRoleId',
  'pendingRoleId',
] as const;

const NUMBER_FIELDS = ['quarantineHours'] as const;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

app.put('/api/welcome-config', requireAdmin, async (req, res) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      res.status(400).json({ error: 'guildId is required (query or DISCORD_GUILD_ID env)' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    for (const field of BOOLEAN_FIELDS) {
      if (field in body) update[field] = Boolean(body[field]);
    }

    for (const field of STRING_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (typeof value !== 'string') {
          res.status(400).json({ error: `${field} must be a string` });
          return;
        }
        if (
          (field === 'neonBorderColor' || field === 'embedAccentColor') &&
          !HEX_COLOR_RE.test(value)
        ) {
          res.status(400).json({ error: `${field} must be a 6-digit hex color (e.g. #00FFAA)` });
          return;
        }
        update[field] = value;
      }
    }

    if ('autoRoleIds' in body) {
      const ids = body.autoRoleIds;
      if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) {
        res.status(400).json({ error: 'autoRoleIds must be an array of strings' });
        return;
      }
      update.autoRoleIds = ids;
    }

    for (const field of NUMBER_FIELDS) {
      if (field in body) {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) {
          res.status(400).json({ error: `${field} must be a positive number` });
          return;
        }
        update[field] = value;
      }
    }

    if ('themePreset' in body) {
      const v = body.themePreset;
      if (typeof v !== 'string' || !(THEME_PRESETS as readonly string[]).includes(v)) {
        res
          .status(400)
          .json({ error: `themePreset must be one of ${THEME_PRESETS.join(', ')}` });
        return;
      }
      update.themePreset = v;
    }

    const doc = await WelcomeConfig.findOneAndUpdate(
      { guildId },
      { $set: update, $setOnInsert: { guildId } },
      { upsert: true, new: true, runValidators: true }
    ).exec();

    const config = toWelcomeConfigData(guildId, doc);

    // Best-effort publish to gateway via Redis pub/sub
    if (redisClient) {
      const payload: WelcomeConfigUpdatedPayload = {
        guildId,
        updatedBy: 'dashboard',
        committedAt: new Date().toISOString(),
      };
      redisClient
        .publish(EventTypes.WELCOME_CONFIG_UPDATED, {
          source: 'dashboard',
          payload,
        })
        .catch((err: unknown) => console.error('Failed to publish welcome config event:', err));
    } else {
      console.warn('⚠️ Redis publisher not available — gateway will pick up on next cache miss');
    }

    res.json({ config });
  } catch (err) {
    console.error('Failed to update welcome config:', err);
    res.status(500).json({ error: 'Failed to update welcome config' });
  }
});

// ====================================
// DISCORD DISCOVERY PROXY (channels, roles)
// ====================================

const GATEWAY_INTERNAL_URL =
  process.env.GATEWAY_INTERNAL_URL || `http://localhost:${process.env.GATEWAY_PORT || 3000}`;

async function proxyGateway<T>(path: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const url = `${GATEWAY_INTERNAL_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) {
      return { ok: false, status: r.status, error: `Gateway returned ${r.status}` };
    }
    const data = (await r.json()) as T;
    return { ok: true, status: r.status, data };
  } catch (err) {
    return { ok: false, status: 502, error: (err as Error).message };
  }
}

app.get('/api/discord/channels', requireAuth, async (req, res) => {
  const guildId = resolveGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const result = await proxyGateway<{ channels: unknown[] }>(
    `/api/discord/channels?guildId=${encodeURIComponent(guildId)}`,
  );
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error, channels: [] });
  }
  return res.json(result.data);
});

app.get('/api/discord/roles', requireAuth, async (req, res) => {
  const guildId = resolveGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const result = await proxyGateway<{ roles: unknown[] }>(
    `/api/discord/roles?guildId=${encodeURIComponent(guildId)}`,
  );
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error, roles: [] });
  }
  return res.json(result.data);
});

// ====================================
// WELCOME ANALYTICS (funnel)
// ====================================

app.get('/api/welcome/analytics', requireAuth, async (req, res) => {
  const guildId = resolveGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await JoinEvent.find({ guildId, joinedAt: { $gte: since } })
      .sort({ joinedAt: -1 })
      .limit(500)
      .lean()
      .exec();

    const stagesCount = {
      joined: events.length,
      welcomed: 0,
      verified: 0,
      engaged: 0,
      quarantined: 0,
      left: 0,
    };
    for (const e of events) {
      for (const s of e.stages ?? []) {
        if (s.stage in stagesCount) {
          stagesCount[s.stage as keyof typeof stagesCount] += 1;
        }
      }
    }

    return res.json({
      windowDays: 30,
      total: events.length,
      stages: stagesCount,
      recent: events.slice(0, 20).map((e) => ({
        userId: e.userId,
        username: e.username,
        displayName: e.displayName,
        avatarUrl: e.avatarUrl,
        joinedAt: e.joinedAt,
        leftAt: e.leftAt ?? null,
        priorJoins: e.priorJoins,
        quarantined: e.quarantined,
        verified: e.verified,
      })),
    });
  } catch (err) {
    console.error('Failed to compute welcome analytics:', err);
    return res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// ====================================
// LIVE EVENTS STREAM (Server-Sent Events)
// Subscribes to the gateway's Redis live-bus and pushes to dashboard clients.
// ====================================

const LIVE_BUS_CHANNEL = 'avenlo:live-bus';
type LiveEvent = Record<string, unknown> & { type: string };

interface SSEClient {
  id: number;
  res: express.Response;
}
const sseClients = new Set<SSEClient>();
let sseClientCounter = 0;
let liveBusSubscribed = false;

async function ensureLiveBusSubscribed(): Promise<void> {
  if (liveBusSubscribed || !redisClient) return;
  try {
    await redisClient.rawSubscribe(LIVE_BUS_CHANNEL, (_channel, message) => {
      for (const client of sseClients) {
        try {
          client.res.write(`data: ${message}\n\n`);
        } catch (err) {
          console.debug('SSE write failed', err);
        }
      }
    });
    liveBusSubscribed = true;
    console.log(`📡 Subscribed to ${LIVE_BUS_CHANNEL} for live dashboard events`);
  } catch (err) {
    console.warn('⚠️ Failed to subscribe to live bus:', err);
  }
}

app.get('/api/welcome/live', requireAuth, async (req, res) => {
  await ensureLiveBusSubscribed();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const client: SSEClient = { id: ++sseClientCounter, res };
  sseClients.add(client);
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  // Replay recent buffered events (best-effort via gateway HTTP)
  try {
    const replay = await proxyGateway<{ events: LiveEvent[] }>(`/api/discord/live-events`);
    if (replay.ok && replay.data?.events) {
      for (const e of replay.data.events.slice().reverse()) {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      }
    }
  } catch {
    // ignore
  }

  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // ignore
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(client);
  });
});

// ====================================
// TEST WELCOME (admin button on dashboard)
// Triggers the full welcome flow on the authenticated user.
// ====================================

app.post('/api/welcome/test', requireAdmin, async (req, res) => {
  const guildId = resolveGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const user = req.user as { id?: string } | undefined;
  const userId = (req.body?.userId as string | undefined) || user?.id;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const url = `${GATEWAY_INTERNAL_URL}/api/welcome/test`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, userId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Test welcome proxy failed:', err);
    return res.status(502).json({ error: (err as Error).message });
  }
});

// Settings
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    // Would fetch from database
    res.json({
      ai_moderation_enabled: true,
      auto_mute: true,
      warn_threshold: 40,
      ban_threshold: 95,
      welcome_enabled: true,
      anti_raid: true,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    // Would save to database
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Moderation actions
app.post('/api/moderation/warn', requireAuth, async (req, res) => {
  const { userId, reason } = req.body;
  // Would send to gateway service via Redis
  res.json({ success: true });
});

app.post('/api/moderation/mute', requireAuth, async (req, res) => {
  const { userId, duration, reason } = req.body;
  res.json({ success: true });
});

app.post('/api/moderation/kick', requireAuth, async (req, res) => {
  const { userId, reason } = req.body;
  res.json({ success: true });
});

app.post('/api/moderation/ban', requireAuth, async (req, res) => {
  const { userId, reason, deleteDays } = req.body;
  res.json({ success: true });
});

// Server actions
app.post('/api/server/lockdown', requireAdmin, async (req, res) => {
  // Would send to gateway
  res.json({ success: true });
});

app.post('/api/server/unlock', requireAdmin, async (req, res) => {
  res.json({ success: true });
});

// ====================================
// SPA FALLBACK (for client-side routing)
// ====================================

app.get('*', (req, res, next) => {
  // Skip API and auth routes
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return next();
  }
  console.log(`🔄 SPA fallback for: ${req.path}`);
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(404).send('Page not found');
  }
});

// ====================================
// START SERVER
// ====================================

console.log('📡 Initializing server...');

async function start() {
  try {
    // Connect to MongoDB (optional for development)
    if (process.env.MONGODB_URI) {
      console.log('🔌 Connecting to MongoDB...');
      mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      })
        .then(() => console.log('✅ Connected to MongoDB'))
        .catch(err => console.log('⚠️ MongoDB connection failed:', err.message));
    } else {
      console.log('⚠️ No MONGODB_URI - running without database');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Dashboard server running on port ${PORT}`);
      console.log(`📊 Base URL: ${BASE_URL}`);
      console.log(`🔗 OAuth Callback: ${CALLBACK_URL}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
