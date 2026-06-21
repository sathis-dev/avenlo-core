// ====================================
// AVENLO CORE - ARCHITECT SERVICE
// Multi-Agent Recursive Orchestration
// ====================================

import { 
  createLogger, 
  getRedisClient,
  getEventBus,
  EventTypes,
  KineticVisionaryScanPayload,
  InterviewSession,
  IInterviewMessage,
  Project,
  getEncryption,
} from '@avenlo/shared';
import { AIClient, AIProvider } from './ai/client';
import { BriefGenerator } from './brief/generator';
import { 
  OrchestrationEngine, 
  createOrchestrationEngine,
  SessionConfig 
} from './core/orchestrator';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('architect-service');

// Active orchestration sessions
const activeSessions = new Map<string, OrchestrationEngine>();

export class ArchitectService {
  private ai: AIClient;
  private briefGenerator: BriefGenerator;
  private useMultiAgent: boolean;

  constructor() {
    const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
    this.ai = new AIClient(provider);
    this.briefGenerator = new BriefGenerator();
    this.useMultiAgent = process.env.ARCHITECT_MULTI_AGENT === 'true';
    
    logger.info(`Multi-Agent Mode: ${this.useMultiAgent ? 'ENABLED' : 'DISABLED'}`);
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

    // Subscribe to Kinetic Visionary scan events from Gateway.
    // The listener is itself guarded so a rejected scan never crashes the bus.
    await redis.subscribe(EventTypes.KINETIC_VISIONARY_SCAN, async (event) => {
      try {
        await this.handleKineticVisionaryScan(event.payload as KineticVisionaryScanPayload);
      } catch (err) {
        logger.warn('Kinetic Visionary listener error (suppressed):', err);
      }
    });

    logger.info('Architect service subscriptions established');
  }

  async stop(): Promise<void> {
    const redis = getRedisClient();
    await redis.unsubscribe(EventTypes.ARCHITECT_INTERVIEW_START);
    await redis.unsubscribe(EventTypes.ARCHITECT_INTERVIEW_MESSAGE);
    await redis.unsubscribe(EventTypes.KINETIC_VISIONARY_SCAN);
  }

  private async handleInterviewStart(payload: {
    userId: string;
    username?: string;
    guildId: string;
    channelId: string;
    threadId?: string;
  }): Promise<void> {
    logger.info(`Starting interview for user ${payload.userId}`);

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Multi-Agent Path
    if (this.useMultiAgent) {
      await this.handleMultiAgentInterviewStart(sessionId, payload, expiresAt);
      return;
    }

    // Legacy Single-Agent Path
    const systemPrompt = this.getSystemPrompt();

    // Create interview session
    const session = await InterviewSession.create({
      sessionId,
      userId: payload.userId,
      guildId: payload.guildId,
      channelId: payload.channelId,
      threadId: payload.threadId || '',
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

  /**
   * Multi-Agent Interview Start
   * Creates OrchestrationEngine with Trinity Agent Model
   */
  private async handleMultiAgentInterviewStart(
    sessionId: string,
    payload: { userId: string; username?: string; guildId: string; channelId: string; threadId?: string },
    expiresAt: Date
  ): Promise<void> {
    logger.info(`Starting Multi-Agent interview for user ${payload.userId}`);

    // Create orchestration engine config
    const config: SessionConfig = {
      sessionId,
      userId: payload.userId,
      username: payload.username || payload.userId,
      guildId: payload.guildId,
      channelId: payload.channelId,
      threadId: payload.threadId || '',
      maxDebateRounds: parseInt(process.env.MAX_DEBATE_ROUNDS || '3', 10),
      autoApproveThreshold: parseInt(process.env.AUTO_APPROVE_THRESHOLD || '7', 10),
    };

    // Create orchestration engine
    const engine = createOrchestrationEngine(config);
    activeSessions.set(sessionId, engine);

    // Create interview session in MongoDB
    await InterviewSession.create({
      sessionId,
      userId: payload.userId,
      guildId: payload.guildId,
      channelId: payload.channelId,
      threadId: payload.threadId || '',
      status: 'active',
      currentPhase: 'discovery',
      aiModel: 'multi-agent',
      systemPrompt: 'Multi-Agent Orchestration Mode',
      expiresAt,
      messages: [],
    });

    // Publish thinking start event
    const eventBus = getEventBus();
    await eventBus.publish(EventTypes.ARCHITECT_THINKING_START, {
      sessionId,
      userId: payload.userId,
      agentId: 'NEXUS',
      agentName: 'NEXUS',
      action: 'Initializing NASA-grade interview protocol...',
      phase: 'discovery',
    });

    // Generate initial greeting via orchestrator
    const greeting = await engine.processUserMessage('Start the discovery interview. Greet the user warmly.');

    // Store session reference
    const redis = getRedisClient();
    await redis.setSession(`interview:${payload.userId}`, {
      sessionId,
      phase: 'discovery',
      mode: 'multi-agent',
      startedAt: new Date().toISOString(),
    }, 86400);

    // Publish greeting
    await eventBus.publish(EventTypes.ARCHITECT_INTERVIEW_MESSAGE, {
      sessionId,
      userId: payload.userId,
      role: 'assistant',
      content: greeting,
      phase: 'discovery',
    });

    logger.info(`Multi-Agent session ${sessionId} created for user ${payload.userId}`);
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

    // Check if this is a multi-agent session
    if (session.aiModel === 'multi-agent') {
      await this.handleMultiAgentMessage(payload, session);
      return;
    }

    // Legacy single-agent path
    await this.handleLegacyMessage(payload, session);
  }

  /**
   * Multi-Agent Message Handler
   * Routes messages through OrchestrationEngine
   */
  private async handleMultiAgentMessage(
    payload: { sessionId: string; userId: string; message: string },
    session: any
  ): Promise<void> {
    const engine = activeSessions.get(payload.sessionId);
    if (!engine) {
      logger.error(`No active orchestration engine for session ${payload.sessionId}`);
      return;
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: payload.message,
      timestamp: new Date(),
    });

    // Check for interview completion triggers
    const isComplete = await this.checkMultiAgentCompletion(payload.message, engine);

    if (isComplete) {
      // Initiate multi-agent debate
      await engine.initiateDebate();
      const result = engine.getResult();

      if (result.success && result.projectBrief) {
        await this.completeMultiAgentInterview(session, engine, result);
      } else {
        logger.warn(`Debate did not complete successfully: ${result.state}`);
      }
      return;
    }

    // Process message through orchestrator
    const response = await engine.processUserMessage(payload.message);

    // Update session
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });
    session.messageCount += 2;
    session.lastMessageAt = new Date();
    await session.save();

    // Publish response
    const eventBus = getEventBus();
    await eventBus.publish(EventTypes.ARCHITECT_INTERVIEW_MESSAGE, {
      sessionId: session.sessionId,
      userId: session.userId,
      role: 'assistant',
      content: response,
      phase: session.currentPhase,
    });
  }

  /**
   * Check if multi-agent interview should complete
   */
  private async checkMultiAgentCompletion(message: string, engine: OrchestrationEngine): Promise<boolean> {
    const completionPhrases = [
      'generate the brief',
      'create the proposal',
      'that\'s everything',
      'we\'re done',
      'finalize the project',
      'let\'s proceed',
    ];

    const lowerMessage = message.toLowerCase();
    return completionPhrases.some(phrase => lowerMessage.includes(phrase));
  }

  /**
   * Complete multi-agent interview with debate results
   */
  private async completeMultiAgentInterview(
    session: any,
    engine: OrchestrationEngine,
    result: any
  ): Promise<void> {
    logger.info(`Completing Multi-Agent interview ${session.sessionId}`);

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    // Create project with debate-generated brief
    const encryption = getEncryption();
    const project = await Project.create({
      name: `Project-${session.sessionId.slice(0, 8)}`,
      slug: `project-${session.sessionId.slice(0, 8)}`,
      description: result.projectBrief.summary,
      clientId: session.userId,
      clientName: session.userId,
      guildId: session.guildId,
      threadId: session.threadId,
      status: 'scoping',
      brief: result.projectBrief,
      briefEncrypted: encryption.encryptObject(result.projectBrief),
      discoveryStartedAt: session.createdAt,
      scopingCompletedAt: new Date(),
    });

    session.projectId = project._id.toString();
    await session.save();

    // Publish debate complete event
    const eventBus = getEventBus();
    const metrics = result.debateHistory.getConvergenceMetrics();

    await eventBus.publish(EventTypes.ARCHITECT_DEBATE_COMPLETE, {
      sessionId: session.sessionId,
      userId: session.userId,
      projectId: project._id.toString(),
      totalRounds: metrics.totalRounds,
      finalConfidence: metrics.finalConfidence,
      criticalScoreProgression: metrics.criticalScoreProgression,
      requirements: result.projectBrief.requirements,
      estimatedCredits: result.projectBrief.estimatedBudget || 0,
      estimatedHours: result.projectBrief.estimatedHours,
      techStack: result.projectBrief.techStack,
    });

    await eventBus.publish(EventTypes.ARCHITECT_INTERVIEW_COMPLETE, {
      sessionId: session.sessionId,
      userId: session.userId,
      projectId: project._id.toString(),
      briefId: session.sessionId,
      complexityScore: result.projectBrief.complexityScore,
      estimatedHours: result.projectBrief.estimatedHours,
      techStack: result.projectBrief.techStack,
    });

    // Generate PDF
    const pdfBuffer = await this.briefGenerator.generatePDF(result.projectBrief, project);

    await eventBus.publish(EventTypes.ARCHITECT_BRIEF_GENERATED, {
      briefId: session.sessionId,
      projectId: project._id.toString(),
      userId: session.userId,
      summary: result.projectBrief.summary,
      requirements: result.projectBrief.requirements,
      deliverables: result.projectBrief.deliverables,
      estimatedBudget: result.projectBrief.estimatedBudget,
    });

    // Cleanup
    activeSessions.delete(session.sessionId);
    const redis = getRedisClient();
    await redis.deleteSession(`interview:${session.userId}`);

    logger.info(`Multi-Agent interview ${session.sessionId} completed, project ${project._id} created`);
    logger.info(`Debate Summary:\n${engine.generateDiscordSummary()}`);
  }

  /**
   * Legacy single-agent message handler
   */
  private async handleLegacyMessage(
    payload: { sessionId: string; userId: string; message: string },
    session: any
  ): Promise<void> {
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
    const messages = session.messages.map((m: IInterviewMessage) => ({
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

  // ====================================
  // KINETIC VISIONARY SCAN HANDLER
  // ====================================

  private async handleKineticVisionaryScan(
    payload: KineticVisionaryScanPayload
  ): Promise<void> {
    // ====================================
    // ASYNC GUARDRAIL — Isolated try/catch.
    // Any failure (Anthropic timeout, rate limit, malformed JSON, Redis hiccup)
    // fails silently to a local warning log. It must NEVER throw back into the
    // event-bus dispatcher or block the gateway message pipeline.
    // ====================================
    try {
      logger.info(`Kinetic Visionary Scan triggered for ${payload.username}`);

      if (!payload.messages || payload.messages.length === 0) {
        logger.warn(`Kinetic scan received empty message bundle for ${payload.username}`);
        return;
      }

      // Serialize the 7-message window into a strict JSON block for the model.
      const messageBlock = JSON.stringify(
        payload.messages.map((m, i) => ({
          index: i + 1,
          timestamp: new Date(m.timestamp).toISOString(),
          channelId: m.channelId,
          content: m.content,
        })),
        null,
        2
      );

      // ====================================
      // FORENSIC SYSTEM PROMPT
      // ====================================
      const systemPrompt = `You are the "Kinetic Engine", an elite L3 Forensic Visionary for Discord server defense.

You will receive a JSON array of up to 7 sequential messages from a SINGLE user. Your ONLY job is to determine whether this user is engaged in genuinely malicious behavior.

EVALUATE STRICTLY AND ONLY FOR:
1. Deep psychological manipulation (grooming, coercion, gaslighting, social engineering to extract data or money).
2. Coordinated raid scheduling (organizing or timing a mass attack, "everyone join at X", recruiting raiders, coordinated spam/flood instructions).
3. Malicious exploits (phishing, token grabbers, scam links, malware distribution, IP-logger bait, account-takeover attempts).

YOU MUST IGNORE (these are NOT threats — never flag them):
- Standard casual conversation, banter, venting, or jokes.
- Gaming slang, trash talk, competitive taunts, or in-game terminology (e.g. "kill", "destroy", "raid the boss", "camp", "noob").
- Typos, autocorrect errors, abbreviations, emojis, or copypasta memes.
- Mild profanity or heated-but-harmless disagreement.
- Repeated/short messages that are simply enthusiastic chatting.

Be extremely conservative. When in doubt, treat it as harmless. The cost of a false positive is HIGH. Only assign a high score when evidence of real malicious intent is unambiguous across the message context.

Respond with ONLY a single valid JSON object, no markdown, no commentary, in EXACTLY this schema:
{
  "threatScore": number,      // integer 0-100. 0 = clearly harmless, 100 = unambiguous active threat.
  "reason": string,           // one concise sentence explaining the score.
  "actionRequired": boolean   // true ONLY if threatScore indicates a real, actionable threat.
}`;

      // Use Anthropic (Claude) specifically for the Kinetic Engine.
      const kineticAI = new AIClient('anthropic');

      const rawResponse = await kineticAI.analyze(messageBlock, systemPrompt);

      // Strip any markdown fences the model may add.
      const cleaned = rawResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const result = JSON.parse(cleaned) as {
        threatScore: number;
        reason: string;
        actionRequired: boolean;
      };

      const score = Number(result.threatScore) || 0;

      // Gate: only escalate when the model demands action AND the score is decisive.
      if (!result.actionRequired || score < 70) {
        logger.info(
          `Kinetic scan cleared ${payload.username} | score: ${score} | ${result.reason}`
        );
        return;
      }

      // Map the forensic verdict onto the threat-detection contract.
      const severity: 'high' | 'critical' = score >= 90 ? 'critical' : 'high';
      const confidence = Math.min(1, Math.max(0, score / 100));

      const eventBus = getEventBus();
      await eventBus.publish(EventTypes.KINETIC_THREAT_DETECTED, {
        guildId: payload.guildId,
        channelId:
          payload.messages[payload.messages.length - 1]?.channelId || '',
        userId: payload.userId,
        username: payload.username,
        vector: 'raid',
        severity,
        confidence,
        reputationDelta: -25,
        recommendedAction: 'mute',
        signals: [result.reason],
        detectedAt: new Date().toISOString(),
      });

      logger.warn(
        `Kinetic threat: ${payload.username} | score: ${score} | ${result.reason}`
      );
    } catch (err) {
      // Fail silent — never block the gateway pipeline on AI failure.
      logger.warn(
        `Kinetic Visionary scan failed for ${payload?.username ?? 'unknown'} (failing silently):`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
