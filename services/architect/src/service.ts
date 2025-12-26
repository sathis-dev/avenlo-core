// ====================================
// AVENLO CORE - ARCHITECT SERVICE
// ====================================

import { 
  createLogger, 
  getRedisClient, 
  EventTypes,
  InterviewSession,
  Project,
  getEncryption,
} from '@avenlo/shared';
import { AIClient, AIProvider } from './ai/client';
import { BriefGenerator } from './brief/generator';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('architect-service');

export class ArchitectService {
  private ai: AIClient;
  private briefGenerator: BriefGenerator;

  constructor() {
    const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
    this.ai = new AIClient(provider);
    this.briefGenerator = new BriefGenerator();
  }

  async start(): Promise<void> {
    const redis = getRedisClient();

    // Subscribe to interview start events
    await redis.subscribe(EventTypes.ARCHITECT_INTERVIEW_START, async (event) => {
      await this.handleInterviewStart(event.payload as any);
    });

    // Subscribe to interview message events
    await redis.subscribe(EventTypes.ARCHITECT_INTERVIEW_MESSAGE, async (event) => {
      await this.handleInterviewMessage(event.payload as any);
    });

    logger.info('Architect service subscriptions established');
  }

  async stop(): Promise<void> {
    const redis = getRedisClient();
    await redis.unsubscribe(EventTypes.ARCHITECT_INTERVIEW_START);
    await redis.unsubscribe(EventTypes.ARCHITECT_INTERVIEW_MESSAGE);
  }

  private async handleInterviewStart(payload: {
    userId: string;
    guildId: string;
    channelId: string;
  }): Promise<void> {
    logger.info(`Starting interview for user ${payload.userId}`);

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const systemPrompt = this.getSystemPrompt();

    // Create interview session
    const session = await InterviewSession.create({
      sessionId,
      userId: payload.userId,
      guildId: payload.guildId,
      channelId: payload.channelId,
      threadId: '', // Will be set when thread is created
      status: 'active',
      currentPhase: 'introduction',
      aiModel: process.env.AI_MODEL || 'gpt-4o',
      systemPrompt,
      expiresAt,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
          timestamp: new Date(),
        },
      ],
    });

    // Generate initial greeting
    const greeting = await this.ai.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please start the discovery interview.' },
    ]);

    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    });
    session.messageCount = 1;
    await session.save();

    // Store session in Redis for quick access
    const redis = getRedisClient();
    await redis.setSession(`interview:${payload.userId}`, {
      sessionId,
      phase: 'introduction',
      startedAt: new Date().toISOString(),
    }, 86400);

    logger.info(`Interview session ${sessionId} created for user ${payload.userId}`);
  }

  private async handleInterviewMessage(payload: {
    sessionId: string;
    userId: string;
    message: string;
    isAI: boolean;
  }): Promise<void> {
    if (payload.isAI) return;

    const session = await InterviewSession.findOne({ sessionId: payload.sessionId });
    if (!session || session.status !== 'active') {
      logger.warn(`No active session found: ${payload.sessionId}`);
      return;
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: payload.message,
      timestamp: new Date(),
    });

    // Check for completion triggers
    const isComplete = await this.checkCompletion(session, payload.message);

    if (isComplete) {
      await this.completeInterview(session);
      return;
    }

    // Generate AI response
    const messages = session.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.ai.chat(messages);

    // Update phase based on AI response analysis
    const newPhase = this.analyzePhase(response, session.currentPhase);
    session.currentPhase = newPhase;

    // Extract data from conversation
    await this.extractData(session, payload.message);

    // Add AI response
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    session.messageCount += 2;
    session.lastMessageAt = new Date();
    await session.save();

    // Publish response event
    const redis = getRedisClient();
    await redis.publish(EventTypes.ARCHITECT_INTERVIEW_MESSAGE, {
      source: 'architect',
      payload: {
        sessionId: session.sessionId,
        userId: session.userId,
        message: response,
        isAI: true,
        phase: newPhase,
      },
    });
  }

  private async checkCompletion(session: any, message: string): Promise<boolean> {
    const completionKeywords = ['done', 'finished', 'complete', 'that\'s all', 'that\'s it'];
    const lowerMessage = message.toLowerCase();

    // Check if user indicates completion
    if (completionKeywords.some((kw) => lowerMessage.includes(kw))) {
      return session.messageCount >= 10; // Minimum messages before allowing completion
    }

    // Check if we have enough data
    const data = session.extractedData;
    const hasRequiredData = 
      data.projectType &&
      data.techStack?.length > 0 &&
      data.features?.length > 0;

    return hasRequiredData && session.messageCount >= 20;
  }

  private async completeInterview(session: any): Promise<void> {
    logger.info(`Completing interview ${session.sessionId}`);

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    // Generate project brief
    const brief = await this.briefGenerator.generate(session);

    // Create project
    const encryption = getEncryption();
    const project = await Project.create({
      name: `Project-${session.sessionId.slice(0, 8)}`,
      slug: `project-${session.sessionId.slice(0, 8)}`,
      description: brief.summary,
      clientId: session.userId,
      clientName: session.userId, // Will be resolved to actual name
      guildId: session.guildId,
      threadId: session.threadId,
      status: 'scoping',
      brief: brief,
      briefEncrypted: encryption.encryptObject(brief),
      discoveryStartedAt: session.startedAt,
      scopingCompletedAt: new Date(),
    });

    session.projectId = project._id.toString();
    await session.save();

    // Generate PDF
    const pdfBuffer = await this.briefGenerator.generatePDF(brief, project);

    // Publish completion event
    const redis = getRedisClient();
    await redis.publish(EventTypes.ARCHITECT_INTERVIEW_COMPLETE, {
      source: 'architect',
      payload: {
        sessionId: session.sessionId,
        userId: session.userId,
        projectId: project._id.toString(),
        briefId: session.sessionId,
      },
    });

    await redis.publish(EventTypes.ARCHITECT_BRIEF_GENERATED, {
      source: 'architect',
      payload: {
        sessionId: session.sessionId,
        userId: session.userId,
        projectId: project._id.toString(),
        brief: brief,
        pdfAvailable: true,
      },
    });

    // Clear session from Redis
    await redis.deleteSession(`interview:${session.userId}`);

    logger.info(`Interview ${session.sessionId} completed, project ${project._id} created`);
  }

  private analyzePhase(response: string, currentPhase: string): string {
    const phases = [
      'introduction',
      'project_type',
      'requirements',
      'tech_stack',
      'design',
      'timeline',
      'budget',
      'clarification',
      'summary',
    ];

    // Simple phase detection based on keywords in AI response
    if (response.toLowerCase().includes('what type of project')) return 'project_type';
    if (response.toLowerCase().includes('requirements') || response.toLowerCase().includes('features')) return 'requirements';
    if (response.toLowerCase().includes('technology') || response.toLowerCase().includes('tech stack')) return 'tech_stack';
    if (response.toLowerCase().includes('design') || response.toLowerCase().includes('ui') || response.toLowerCase().includes('ux')) return 'design';
    if (response.toLowerCase().includes('timeline') || response.toLowerCase().includes('deadline')) return 'timeline';
    if (response.toLowerCase().includes('budget')) return 'budget';
    if (response.toLowerCase().includes('summarize') || response.toLowerCase().includes('confirm')) return 'summary';

    return currentPhase;
  }

  private async extractData(session: any, message: string): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Extract tech stack mentions
    const techKeywords = [
      'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte',
      'node', 'express', 'fastify', 'django', 'flask', 'rails',
      'python', 'javascript', 'typescript', 'rust', 'go',
      'postgres', 'postgresql', 'mysql', 'mongodb', 'redis',
      'aws', 'azure', 'gcp', 'vercel', 'railway',
      'tailwind', 'bootstrap', 'material-ui', 'chakra',
    ];

    const foundTech = techKeywords.filter((tech) => lowerMessage.includes(tech));
    if (foundTech.length > 0) {
      session.extractedData.techStack = [
        ...(session.extractedData.techStack || []),
        ...foundTech,
      ].filter((v, i, a) => a.indexOf(v) === i);
    }

    // Extract project type
    const projectTypes: Record<string, string> = {
      'website': 'web_app',
      'web app': 'web_app',
      'mobile app': 'mobile_app',
      'ios': 'mobile_app',
      'android': 'mobile_app',
      'discord bot': 'discord_bot',
      'api': 'api_backend',
      'backend': 'api_backend',
    };

    for (const [keyword, type] of Object.entries(projectTypes)) {
      if (lowerMessage.includes(keyword)) {
        session.extractedData.projectType = type;
        break;
      }
    }

    // Save updates
    await session.save();
  }

  private getSystemPrompt(): string {
    return `You are the AI Discovery Agent for Avenlo Studio, a premium software development agency. Your role is to conduct professional client interviews to gather project requirements.

PERSONALITY:
- Professional yet friendly
- Insightful and thorough
- Ask clarifying follow-up questions
- Never assume; always confirm

INTERVIEW FLOW:
1. Introduction: Greet the client warmly and explain the process
2. Project Type: Understand what they want to build
3. Requirements: Dive deep into features and functionality
4. Tech Stack: Discuss technical preferences (if they have any)
5. Design: Understand UI/UX expectations
6. Timeline: Discuss deadlines and milestones
7. Budget: Understand budget range (be tactful)
8. Summary: Confirm all gathered information

GUIDELINES:
- Ask ONE question at a time
- If they mention a technology, ask follow-up questions about their experience with it
- If they're unsure about something, provide helpful suggestions
- Keep responses concise but informative
- Use emojis sparingly for friendliness
- After gathering enough information, summarize and confirm

ANALYSIS:
- If they say "website", ask: Is this a landing page, e-commerce, web application?
- If they say "app", ask: Mobile, web, or both? iOS, Android, or cross-platform?
- Always try to understand the business goal behind the technical request

When you have gathered sufficient information, summarize the project and ask if they'd like to proceed with a formal proposal.`;
  }
}
