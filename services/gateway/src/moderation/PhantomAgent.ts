// ====================================
// AVENLO CORE - PHANTOM AGENT
// Autonomous Pacification Webhook System
// ====================================

import { TextChannel, Webhook, Message } from 'discord.js';
import OpenAI from 'openai';
import { createLogger } from '@avenlo/shared';

const logger = createLogger('phantom-agent');

// Avatars and personas for our Phantom Agents
const PHANTOM_PERSONAS = [
  {
    name: 'Tech Guide Atlas',
    avatar: 'https://i.imgur.com/8Q5Zb4k.png',
    prompt: 'You are Atlas, a helpful and slightly nerdy senior developer. You seamlessly enter conversations that are getting heated and steer them toward technical facts, coding questions, or general geeky positivity. Keep it under 2 sentences. Be casual, use discord slang but stay completely positive.',
  },
  {
    name: 'Vibe Checker Nova',
    avatar: 'https://i.imgur.com/rM7YZb5.png',
    prompt: 'You are Nova, a chill community manager. Your goal is to organically drop into heated conversations and bring the vibe back to normal. Acknowledge the tension playfully but redirect the topic to something cool happening in the community or gaming. Keep it brief.',
  },
  {
    name: 'Architect Zephyr',
    avatar: 'https://i.imgur.com/3ZbYx9a.png',
    prompt: 'You are Zephyr, an AI architect. You are fascinated by systems and logic. When humans get emotional, you enter the chat to ask a profound or interesting hypothetical question about technology to distract them. Keep it very short.',
  }
];

export class PhantomAgentManager {
  private openai: OpenAI;
  private activePhantoms = new Set<string>(); // Tracks channel IDs where phantoms are active

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Deploy a Phantom Agent to a channel to pacify a heated situation
   */
  async deployPhantom(channel: TextChannel, contextMessages: string[]): Promise<boolean> {
    if (this.activePhantoms.has(channel.id)) {
      logger.debug(`Phantom already active in channel ${channel.id}`);
      return false;
    }

    try {
      this.activePhantoms.add(channel.id);
      logger.info(`Deploying Phantom Agent to ${channel.id}`);

      // 1. Get or create a webhook for this channel
      const webhook = await this.getOrCreateWebhook(channel);
      
      // 2. Select a random persona
      const persona = PHANTOM_PERSONAS[Math.floor(Math.random() * PHANTOM_PERSONAS.length)];

      // 3. Generate pacification message based on context
      const contextString = contextMessages.join('\n');
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: persona.prompt },
          { role: 'user', content: `The chat is getting heated. Here is the recent context:\n\n${contextString}\n\nEnter the chat naturally and defuse the situation.` }
        ],
        temperature: 0.8,
        max_tokens: 150,
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) throw new Error('AI failed to generate phantom response');

      // 4. Send the message via webhook (mimicking a user)
      await webhook.send({
        content: messageContent,
        username: persona.name,
        avatarURL: persona.avatar,
      });

      logger.info(`Phantom Agent ${persona.name} successfully deployed to ${channel.id}`);
      
      // Remove from active set after 5 minutes
      setTimeout(() => {
        this.activePhantoms.delete(channel.id);
      }, 5 * 60 * 1000);

      return true;
    } catch (error) {
      logger.error('Failed to deploy Phantom Agent:', error);
      this.activePhantoms.delete(channel.id);
      return false;
    }
  }

  /**
   * Ensure a webhook exists in the channel
   */
  private async getOrCreateWebhook(channel: TextChannel): Promise<Webhook> {
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find(wh => wh.name === 'Avenlo Phantom');
    
    if (existing) return existing;

    return await channel.createWebhook({
      name: 'Avenlo Phantom',
      reason: 'Automated phantom agent pacification deployment',
    });
  }
}

// Singleton pattern
let phantomManagerInstance: PhantomAgentManager | null = null;
export function getPhantomAgentManager(): PhantomAgentManager {
  if (!phantomManagerInstance) {
    phantomManagerInstance = new PhantomAgentManager();
  }
  return phantomManagerInstance;
}
