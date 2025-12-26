// ====================================
// AVENLO CORE - AI CLIENT
// ====================================

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@avenlo/shared';

const logger = createLogger('architect-ai');

export type AIProvider = 'openai' | 'anthropic';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIClient {
  private provider: AIProvider;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private model: string;

  constructor(provider: AIProvider = 'openai') {
    this.provider = provider;
    this.model = process.env.AI_MODEL || (provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022');

    if (provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    logger.info(`AI client initialized with ${provider} (${this.model})`);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      if (this.provider === 'openai') {
        return await this.chatOpenAI(messages);
      } else {
        return await this.chatAnthropic(messages);
      }
    } catch (error) {
      logger.error('AI chat error:', error);
      throw error;
    }
  }

  private async chatOpenAI(messages: ChatMessage[]): Promise<string> {
    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || 'I apologize, but I encountered an issue. Could you repeat that?';
  }

  private async chatAnthropic(messages: ChatMessage[]): Promise<string> {
    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await (this.anthropic as any).messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemMessage,
      messages: conversationMessages,
    });

    const textBlock = response.content.find((block: any) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : 'I apologize, but I encountered an issue. Could you repeat that?';
  }

  async analyze(content: string, instruction: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: instruction,
      },
      {
        role: 'user',
        content: content,
      },
    ];

    return this.chat(messages);
  }

  async generateJSON<T>(content: string, schema: string): Promise<T> {
    const instruction = `Analyze the following content and generate a JSON object that matches this schema:
${schema}

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await this.analyze(content, instruction);
    
    // Clean response and parse
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedResponse);
  }
}
