// ====================================
// AVENLO CORE - AI WELCOME LINE
// Generates a 1-line personalized greeting for new members using OpenAI.
// Falls back silently to undefined if the API key is missing or the call fails,
// so the welcome flow continues uninterrupted.
// ====================================

import { createLogger } from '@avenlo/shared';

const logger = createLogger('ai-welcome');

export interface PersonalizedGreetingInput {
  username: string;
  displayName: string;
  guildName: string;
}

/**
 * Generate a short, friendly, 1-line personalized greeting.
 * Hard-capped at ~140 characters. Returns undefined on any error or when
 * OPENAI_API_KEY is not configured.
 */
export async function generatePersonalizedGreeting(
  input: PersonalizedGreetingInput,
): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const prompt =
    `Write a single warm, friendly welcome line (max 140 chars, no emojis at the start, ` +
    `no quotes) for a new Discord member. Use their display name. ` +
    `Server: "${input.guildName}". ` +
    `Username: "${input.username}". ` +
    `Display name: "${input.displayName}". ` +
    `Keep it natural, not corporate. Avoid "welcome to" — assume that's already said. ` +
    `Output only the line itself.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.85,
        max_tokens: 60,
        messages: [
          { role: 'system', content: 'You are an upbeat community greeter.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      logger.debug(`OpenAI returned ${response.status} — skipping personalization`);
      return undefined;
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim();
    if (!raw) return undefined;
    return raw.slice(0, 200);
  } catch (err) {
    logger.debug('Personalized greeting failed', err);
    return undefined;
  }
}
