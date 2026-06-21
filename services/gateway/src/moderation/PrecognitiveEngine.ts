// ====================================
// AVENLO CORE - PRECOGNITIVE ENGINE
// L4 Moderation: Temporal Vector Drift Prediction
// ====================================

import OpenAI from 'openai';
import { createLogger, getRedisClient, AvenloColors } from '@avenlo/shared';
import { Message, TextChannel, EmbedBuilder } from 'discord.js';

const logger = createLogger('precognitive-engine');

export interface TemporalVector {
  timestamp: number;
  toxicityScore: number;
  provocationScore: number;
  volatility: number;
}

export class PrecognitiveEngine {
  private openai: OpenAI;
  private userVectors: Map<string, TemporalVector[]> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze message and calculate temporal drift to predict future violations
   */
  async analyzeDrift(message: Message): Promise<void> {
    const userId = message.author.id;
    const channelId = message.channel.id;
    
    // 1. Get quick zero-shot embedding approximation (using fast GPT-4o-mini classification for speed)
    const vector = await this.calculateVectorFast(message.content);
    
    let history = this.userVectors.get(userId) || [];
    history.push(vector);
    
    // Keep last 10 messages (sliding window)
    if (history.length > 10) history.shift();
    this.userVectors.set(userId, history);

    // 2. Need at least 3 messages to calculate drift
    if (history.length < 3) return;

    // 3. Calculate Vector Drift (Acceleration of toxicity)
    const drift = this.calculateDriftAcceleration(history);

    logger.debug(`User ${message.author.username} drift acceleration: ${drift.toFixed(2)}`);

    // 4. Pre-Emptive Jitter Trigger
    if (drift > 1.5) { // Highly accelerating toward a violation
      logger.warn(`PRECOGNITION ALERT: User ${message.author.username} is drifting rapidly toward a severe violation.`);
      
      // Trigger Pre-Emptive Jitter (Slowmode)
      await this.applyPreEmptiveJitter(message.channel as TextChannel, message.author.username, drift);
      
      // Reset history to prevent infinite loops
      this.userVectors.delete(userId);
    }
  }

  /**
   * Fast approximation of conversational vector
   */
  private async calculateVectorFast(content: string): Promise<TemporalVector> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Output JSON: {"toxicity": 0.0-1.0, "provocation": 0.0-1.0, "volatility": 0.0-1.0}' },
          { role: 'user', content }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 50,
      });

      const data = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        timestamp: Date.now(),
        toxicityScore: data.toxicity || 0,
        provocationScore: data.provocation || 0,
        volatility: data.volatility || 0,
      };
    } catch (err) {
      return { timestamp: Date.now(), toxicityScore: 0, provocationScore: 0, volatility: 0 };
    }
  }

  /**
   * Calculates the acceleration (second derivative) of the user's vector
   */
  private calculateDriftAcceleration(history: TemporalVector[]): number {
    const recent = history.slice(-3); // Look at last 3 vectors
    
    const v1 = recent[0].toxicityScore + recent[0].provocationScore;
    const v2 = recent[1].toxicityScore + recent[1].provocationScore;
    const v3 = recent[2].toxicityScore + recent[2].provocationScore;

    // Velocity
    const vel1 = v2 - v1;
    const vel2 = v3 - v2;

    // Acceleration (Drift)
    const acceleration = vel2 - vel1;
    
    // Return weighted drift factoring in raw volatility
    return (acceleration * 2.0) + recent[2].volatility;
  }

  /**
   * Apply Pre-Emptive Jitter (Channel Slowmode increase) to frustrate the user
   */
  private async applyPreEmptiveJitter(channel: TextChannel, username: string, drift: number): Promise<void> {
    try {
      const currentSlowmode = channel.rateLimitPerUser || 0;
      
      // Jitter the slowmode by 5 seconds
      const newSlowmode = Math.min(currentSlowmode + 5, 21600);
      
      await channel.setRateLimitPerUser(newSlowmode, `Precognitive Engine: Jitter triggered for ${username} (Drift: ${drift.toFixed(2)})`);
      
      logger.info(`Applied Pre-Emptive Jitter to ${channel.name} (${newSlowmode}s)`);

      // Optionally, send a stealth log to the mod channel
      const guild = channel.guild;
      const logChannelId = process.env.CHANNEL_LOGS || '';
      if (logChannelId) {
         const logChannel = guild.channels.cache.get(logChannelId) as TextChannel;
         if (logChannel) {
             const embed = new EmbedBuilder()
                .setColor(AvenloColors.PURPLE)
                .setTitle('🔮 Precognitive Engine Intervention')
                .setDescription(`**User:** ${username}\n**Channel:** <#${channel.id}>\n**Action:** Applied ${newSlowmode}s Jitter\n**Reason:** Vector drift acceleration detected (${drift.toFixed(2)}). Predicted incoming violation.`)
                .setTimestamp();
             await logChannel.send({ embeds: [embed] }).catch(() => {});
         }
      }
      
      // Revert jitter after 2 minutes
      setTimeout(async () => {
         try {
             await channel.setRateLimitPerUser(currentSlowmode, 'Precognitive Engine: Jitter decay');
         } catch(e) {}
      }, 120000);

    } catch (err) {
      logger.error('Failed to apply Pre-Emptive Jitter:', err);
    }
  }
}

// Singleton
let precognitiveEngineInstance: PrecognitiveEngine | null = null;
export function getPrecognitiveEngine(): PrecognitiveEngine {
  if (!precognitiveEngineInstance) {
    precognitiveEngineInstance = new PrecognitiveEngine();
  }
  return precognitiveEngineInstance;
}
