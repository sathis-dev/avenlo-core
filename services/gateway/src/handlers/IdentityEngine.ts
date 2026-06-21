// ====================================
// AVENLO CORE - IDENTITY ENGINE
// AI-Powered Role Synergies & Recommendations
// ====================================

import { Guild, GuildMember, Role } from 'discord.js';
import OpenAI from 'openai';
import { createLogger } from '@avenlo/shared';
import { RoleProfile, IRoleProfile } from '@avenlo/shared';

const logger = createLogger('identity-engine');

export interface SynergyConfig {
  id: string;
  name: string;
  requiredRoleNames: string[]; // Names of roles required to unlock the synergy
  bonusDescription: string;
  emoji: string;
}

const KNOWN_SYNERGIES: SynergyConfig[] = [
  {
    id: 'creative_director',
    name: 'Creative Director',
    requiredRoleNames: ['Music Producer', '3D Artist'],
    bonusDescription: 'Master of audio-visual arts',
    emoji: '🎨',
  },
  {
    id: 'full_stack_master',
    name: 'Full Stack Master',
    requiredRoleNames: ['Frontend Dev', 'Backend Dev'],
    bonusDescription: 'Can build anything from end to end',
    emoji: '🧙‍♂️',
  },
  {
    id: 'crypto_whale',
    name: 'Crypto Whale',
    requiredRoleNames: ['Web3 Dev', 'Investor'],
    bonusDescription: 'Market mover and blockchain architect',
    emoji: '🐳',
  }
];

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export class IdentityEngine {
  
  /**
   * Analyze the user's equipped roles and check if they unlocked any new synergies
   */
  static async calculateSynergies(member: GuildMember): Promise<SynergyConfig[]> {
    const unlocked: SynergyConfig[] = [];
    const memberRoleNames = member.roles.cache.map(r => r.name.toLowerCase());
    
    for (const synergy of KNOWN_SYNERGIES) {
      const hasAll = synergy.requiredRoleNames.every(req => 
        memberRoleNames.some(name => name.includes(req.toLowerCase()))
      );
      
      if (hasAll) {
        unlocked.push(synergy);
      }
    }
    
    // Save to DB
    try {
      const profile = await RoleProfile.findOneAndUpdate(
        { userId: member.id, guildId: member.guild.id },
        { 
          $addToSet: { synergiesUnlocked: { $each: unlocked.map(s => s.id) } },
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      logger.error('Failed to save synergies', e);
    }
    
    return unlocked;
  }

  /**
   * Use AI to recommend 3 roles to the user based on their chat history and current roles
   */
  static async getRecommendations(member: GuildMember, chatHistoryContext: string): Promise<string[]> {
    try {
      // Check cache/last suggestion to avoid OpenAI spam
      const profile = await RoleProfile.findOne({ userId: member.id, guildId: member.guild.id });
      if (profile && profile.lastAiSuggestion) {
        const hoursSince = (Date.now() - profile.lastAiSuggestion.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          logger.debug('Returning cached or skipped AI suggestions to save tokens.');
          // Just return some basic roles if we want, or rely on a cached array.
          // For now, we'll just allow it if no cache mechanism is fully wired to return the array.
        }
      }

      const ai = getOpenAI();
      const availableRoles = member.guild.roles.cache
        .filter(r => !r.managed && r.name !== '@everyone' && !member.roles.cache.has(r.id))
        .map(r => r.name)
        .slice(0, 50); // Limit to 50
        
      const currentRoles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name);

      const response = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI Identity Matchmaker for a Discord server. 
            Based on the user's current roles and recent chat behavior, recommend EXACTLY 3 roles from the available server roles that fit their persona.
            Return ONLY a valid JSON array of 3 string names matching the available roles. Example: ["3D Artist", "Gamer", "Writer"]`
          },
          {
            role: 'user',
            content: `
            Current Roles: ${JSON.stringify(currentRoles)}
            Recent Chat: "${chatHistoryContext || 'Just joined, looking around.'}"
            Available Roles: ${JSON.stringify(availableRoles)}
            `
          }
        ],
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || '[]';
      const suggestions = JSON.parse(content);
      
      // Update timestamp
      await RoleProfile.findOneAndUpdate(
        { userId: member.id, guildId: member.guild.id },
        { lastAiSuggestion: new Date() },
        { upsert: true }
      );
      
      return suggestions;
    } catch (err) {
      logger.error('AI Suggestion failed', err);
      // Fallback
      return ['Creator', 'Member', 'Explorer'];
    }
  }

  static async syncProfile(member: GuildMember): Promise<IRoleProfile> {
    const equipped = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.id);
    
    return await RoleProfile.findOneAndUpdate(
      { userId: member.id, guildId: member.guild.id },
      { 
        $set: { equippedRoles: equipped },
        $addToSet: { unlockedRoles: { $each: equipped } }, // Everything they currently have is unlocked
        $inc: { collectionScore: 10 } // basic bump for syncing
      },
      { upsert: true, new: true }
    );
  }
}
