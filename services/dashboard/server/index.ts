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
// SERVE STATIC FILES EARLY
// ====================================
app.use(express.static(staticPath));

// Serve index.html for root and SPA routes
app.get('/', (req, res) => {
  console.log('📥 Root request received');
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(500).send(`index.html not found at ${indexHtmlPath}`);
  }
});

// ====================================
// MIDDLEWARE
// ====================================

app.use(cors({
  origin: BASE_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'avenlo-dashboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));
app.use(passport.initialize());
app.use(passport.session());

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
const CALLBACK_URL = process.env.DISCORD_CALLBACK_URL 
  || (process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/discord/callback`
      : 'http://localhost:3001/auth/discord/callback');

// Check for required Discord OAuth environment variables
if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables: DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET');
  console.error('   Please set these in your Railway service variables');
  console.log('⚠️  Starting server without Discord OAuth - only health endpoints will work');
} else {
  console.log('✅ Discord OAuth configured');
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
    const memberResponse = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let roles: string[] = [];
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      roles = memberData.roles || [];
    }

    // Check if user has required role
    const hasAccess = roles.some(role => ALLOWED_ROLES.includes(role));
    if (!hasAccess) {
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
  passport.authenticate('discord', {
    failureRedirect: '/login?error=unauthorized',
    successRedirect: '/',
  })
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

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    // In production, these would come from Discord API and database
    const stats = {
      totalMembers: 720,
      onlineMembers: 156,
      totalTickets: 156,
      openTickets: 12,
      moderationActions: 89,
      messagesPerDay: 2400,
      newMembersToday: 8,
      activeProjects: 5,
    };

    const activity = [
      {
        id: '1',
        type: 'join',
        user: { id: '1', username: 'CoolUser123', avatar: '' },
        action: 'joined the server',
        timestamp: new Date(),
      },
      {
        id: '2',
        type: 'ticket',
        user: { id: '2', username: 'ClientPro', avatar: '' },
        action: 'opened ticket #0042',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
    ];

    res.json({ stats, activity });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Members list
app.get('/api/members', requireAuth, async (req, res) => {
  try {
    // Would fetch from Discord API
    res.json({ members: [], total: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Moderation actions
app.get('/api/moderation/actions', requireAuth, async (req, res) => {
  try {
    // Would fetch from database
    res.json({ actions: [], total: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// Tickets
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    // Would fetch from database
    res.json({ tickets: [], total: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
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
