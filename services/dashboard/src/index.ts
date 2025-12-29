// ====================================
// AVENLO CORE - ADMIN DASHBOARD
// Express Server with Discord OAuth2
// ====================================

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import jwt from 'jsonwebtoken';
import { createLogger, getRedisClient, MongoClient } from '@avenlo/shared';
import apiRoutes from './routes/api';

const logger = createLogger('dashboard');

// Initialize Express
const app = express();
const PORT = process.env.DASHBOARD_PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:4000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.ENCRYPTION_KEY || 'avenlo-dashboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Discord OAuth2 Strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    callbackURL: `${process.env.DASHBOARD_URL || 'http://localhost:4000'}/auth/discord/callback`,
    scope: ['identify', 'guilds'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user is an admin (has management role in the main guild)
      const guilds = profile.guilds || [];
      const mainGuild = guilds.find((g: any) => g.id === process.env.DISCORD_GUILD_ID);
      
      const user = {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        accessToken,
        refreshToken,
        isAdmin: mainGuild ? (BigInt(mainGuild.permissions) & BigInt(0x8)) !== BigInt(0) : false, // Check for ADMINISTRATOR
        guilds: guilds.map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
          permissions: g.permissions,
        })),
      };
      
      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Static files (Dashboard UI)
app.use(express.static(path.join(__dirname, '../public')));

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { user: req.user },
      process.env.ENCRYPTION_KEY || 'secret',
      { expiresIn: '7d' }
    );
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.clearCookie('auth_token');
    res.redirect('/login');
  });
});

app.get('/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user, authenticated: true });
  } else {
    res.json({ user: null, authenticated: false });
  }
});

// API Routes
app.use('/api', apiRoutes);

// Serve dashboard for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
async function start() {
  try {
    // Connect to database
    const mongo = new MongoClient({
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DB || 'avenlo',
    });
    await mongo.connect();
    logger.info('📦 Connected to MongoDB');
    
    // Connect to Redis
    const redis = getRedisClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: 'avenlo:',
    });
    await redis.connect();
    logger.info('🔴 Connected to Redis');
    
    app.listen(PORT, () => {
      logger.info(`🎛️ Dashboard running at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start dashboard:', error);
    process.exit(1);
  }
}

start();
