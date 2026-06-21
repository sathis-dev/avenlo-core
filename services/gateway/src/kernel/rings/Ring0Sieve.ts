// ====================================
// AVENLO CORE - RING 0: SIEVE
// Instant Defense (Regex, Rate Limiting, IP/Domain Rep)
// ====================================

import { Message, GuildMember } from 'discord.js';
import { createLogger, getRedisClient } from '@avenlo/shared';

const logger = createLogger('ring0-sieve');

// ====================================
// CONSTANTS
// ====================================

const CRITICAL_PATTERNS = {
  scamLinks: [
    /discord\.gift/i,
    /discordnitro\.gift/i,
    /steamcommunity\.com\.(?!$)/i,
    /free-?nitro/i,
    /nitro-?gift/i,
    /@everyone.*http/i,
    /airdrop.*connect.*wallet/i,
    /claim.*free.*nft/i,
    /mint.*free.*token/i,
  ],
  extremeSlurs: [
    /\bn[i1]gg[e3]r/i,
    /\bk[i1]k[e3]/i,
    /\bf[a@]gg[o0]t/i,
  ],
  phishing: [
    /verify.*account.*suspend/i,
    /your.*account.*locked/i,
    /click.*here.*verify/i,
    /limited.*time.*offer/i,
    /urgent.*action.*required/i,
  ],
  cryptoDrainer: [
    /connect.*wallet.*claim/i,
    /airdrop.*eligib/i,
    /claim.*before.*expires/i,
    /free.*eth.*claim/i,
    /nft.*giveaway.*connect/i,
  ],
};

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export interface Ring0Result {
  blocked: boolean;
  reason?: string;
  threatVector?: string;
  threatAmount?: number;
}

// ====================================
// RING 0 IMPLEMENTATION
// ====================================

export class Ring0Sieve {
  private static instance: Ring0Sieve;

  private constructor() {}

  public static getInstance(): Ring0Sieve {
    if (!Ring0Sieve.instance) {
      Ring0Sieve.instance = new Ring0Sieve();
    }
    return Ring0Sieve.instance;
  }

  /**
   * Process a message through the instant sieve.
   * Returns early if the message is blatantly malicious.
   */
  async processMessage(message: Message): Promise<Ring0Result> {
    const content = message.content;
    
    // 1. High-speed regex checks
    const regexResult = this.checkPatterns(content);
    if (regexResult.blocked) return regexResult;

    // 2. Domain Blocklist Check
    const urls = content.match(URL_REGEX);
    if (urls && urls.length > 0) {
      const domainResult = await this.checkDomains(urls);
      if (domainResult.blocked) return domainResult;
    }

    // 3. User Message Rate Limit (Spam)
    const rateLimitResult = await this.checkMessageRateLimit(message.author.id, message.guild!.id);
    if (rateLimitResult.blocked) return rateLimitResult;

    return { blocked: false };
  }

  /**
   * Process a member join through the instant sieve.
   */
  async processMemberJoin(member: GuildMember): Promise<Ring0Result> {
    // Check join velocity gate (handled natively in SecurityKernel, but we can do account age blocks here)
    const ageDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    
    if (ageDays < 1) {
       // Just flag it, the Kernel will decide whether to kick based on DEFCON
       return {
         blocked: false, // Don't hard block yet, let Kernel consensus decide
         threatVector: 'EVASION',
         threatAmount: 20
       };
    }

    return { blocked: false };
  }

  // ====================================
  // INTERNAL CHECKS
  // ====================================

  private checkPatterns(content: string): Ring0Result {
    // Extreme Slurs -> Block & High Threat
    if (CRITICAL_PATTERNS.extremeSlurs.some(r => r.test(content))) {
      return { blocked: true, reason: 'Extreme Slur', threatVector: 'TOXICITY', threatAmount: 50 };
    }

    // Scam Links -> Block & High Threat
    if (CRITICAL_PATTERNS.scamLinks.some(r => r.test(content))) {
      return { blocked: true, reason: 'Scam Link', threatVector: 'PHISHING', threatAmount: 40 };
    }

    // Crypto Drainers -> Block & High Threat
    if (CRITICAL_PATTERNS.cryptoDrainer.some(r => r.test(content))) {
      return { blocked: true, reason: 'Crypto Drainer', threatVector: 'PHISHING', threatAmount: 40 };
    }

    // Phishing -> Block & Medium Threat
    if (CRITICAL_PATTERNS.phishing.some(r => r.test(content))) {
      return { blocked: true, reason: 'Phishing Pattern', threatVector: 'PHISHING', threatAmount: 30 };
    }

    return { blocked: false };
  }

  private async checkDomains(urls: RegExpMatchArray): Promise<Ring0Result> {
    const redis = getRedisClient().getClient();
    
    for (const urlStr of urls) {
      try {
        const url = new URL(urlStr);
        const domain = url.hostname.replace('www.', '');
        
        // Fast Redis set lookup for known bad domains
        const isBad = await redis.sismember('kernel:domains:blacklist', domain);
        if (isBad) {
          return { blocked: true, reason: 'Blacklisted Domain', threatVector: 'PHISHING', threatAmount: 45 };
        }
      } catch (e) {
        // Invalid URL
      }
    }
    
    return { blocked: false };
  }

  private async checkMessageRateLimit(userId: string, guildId: string): Promise<Ring0Result> {
    const redis = getRedisClient().getClient();
    const key = `kernel:ratelimit:msg:${guildId}:${userId}`;
    
    // Allow 5 messages per 5 seconds
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 5);
    }
    
    if (count > 5) {
      return { blocked: true, reason: 'Message Rate Limit', threatVector: 'SPAM', threatAmount: 10 };
    }
    
    return { blocked: false };
  }
}
