// ====================================
// AVENLO CORE - ORCHESTRATION ENGINE
// Multi-Agent Recursive Debate Protocol
// ====================================

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  createLogger,
  getEventBus,
  EventTypes,
  Project,
  IProjectBrief,
} from '@avenlo/shared';

import {
  AgentRegistry,
  AgentPersona,
  buildPrompt,
  InterviewPhases,
  InterviewPhase,
} from '../prompts/system-registry';

import {
  parseAlphaOutput,
  parseBetaOutput,
  calculateReflectionDelta,
  generateCorrectionPrompt,
  DebateHistory,
  AlphaOutput,
  BetaOutput,
  ReflectionDelta,
} from '../utils/reflection';

import { KnowledgeGraph } from '../utils/knowledge-graph';

const logger = createLogger('architect-orchestrator');

// ====================================
// TYPES
// ====================================

export type OrchestrationState =
  | 'INITIALIZING'
  | 'INTERVIEWING'
  | 'EXTRACTING'
  | 'DEBATING'
  | 'REVISING'
  | 'ESTIMATING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'HALTED'
  | 'ERROR';

export interface SessionConfig {
  sessionId: string;
  userId: string;
  username: string;
  guildId: string;
  channelId: string;
  threadId: string;
  maxDebateRounds: number;
  autoApproveThreshold: number;
}

export interface AgentThought {
  agentId: string;
  agentName: string;
  action: string;
  content: string;
  timestamp: Date;
  duration: number;
  tokenCount: number;
}

export interface OrchestrationResult {
  success: boolean;
  state: OrchestrationState;
  projectBrief?: IProjectBrief;
  debateHistory: DebateHistory;
  thoughts: AgentThought[];
  knowledgeGraph: KnowledgeGraph;
  error?: string;
}

export interface ThinkingProgressEvent {
  sessionId: string;
  agentId: string;
  agentName: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
  details?: string;
  timestamp: Date;
}

// ====================================
// AI CLIENT WRAPPER
// ====================================

class MultiProviderAI {
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(
    agent: AgentPersona,
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<{ content: string; tokenCount: number }> {
    const startTime = Date.now();

    if (agent.provider === 'openai') {
      return this.chatOpenAI(agent, systemPrompt, userMessage, conversationHistory);
    } else {
      return this.chatAnthropic(agent, systemPrompt, userMessage, conversationHistory);
    }
  }

  private async chatOpenAI(
    agent: AgentPersona,
    systemPrompt: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ content: string; tokenCount: number }> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await this.openai.chat.completions.create({
      model: agent.model,
      messages,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    });

    const content = response.choices[0]?.message?.content || '';
    const tokenCount = response.usage?.total_tokens || 0;

    return { content, tokenCount };
  }

  private async chatAnthropic(
    agent: AgentPersona,
    systemPrompt: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ content: string; tokenCount: number }> {
    const messages = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await (this.anthropic as any).messages.create({
      model: agent.model,
      max_tokens: agent.maxTokens,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block: any) => block.type === 'text');
    const content = textBlock?.text || '';
    const tokenCount = response.usage?.input_tokens + response.usage?.output_tokens || 0;

    return { content, tokenCount };
  }
}

// ====================================
// ORCHESTRATION ENGINE
// ====================================

export class OrchestrationEngine {
  private ai: MultiProviderAI;
  private config: SessionConfig;
  private state: OrchestrationState = 'INITIALIZING';
  private knowledgeGraph: KnowledgeGraph;
  private debateHistory: DebateHistory;
  private thoughts: AgentThought[] = [];
  private currentPhase: InterviewPhase = 'DISCOVERY';
  private interviewHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  constructor(config: SessionConfig) {
    this.config = config;
    this.ai = new MultiProviderAI();
    this.knowledgeGraph = new KnowledgeGraph(config.sessionId);
    this.debateHistory = new DebateHistory(config.maxDebateRounds);
  }

  // ====================================
  // STATE MACHINE
  // ====================================

  getState(): OrchestrationState {
    return this.state;
  }

  private setState(newState: OrchestrationState): void {
    logger.info(`State transition: ${this.state} → ${newState}`);
    this.state = newState;
  }

  // ====================================
  // PROGRESS EVENTS
  // ====================================

  private async publishThinkingProgress(
    agentId: string,
    agentName: string,
    action: string,
    status: 'started' | 'completed' | 'failed',
    details?: string
  ): Promise<void> {
    try {
      const eventBus = getEventBus();
      
      // Use a custom event type for thinking progress
      await eventBus.publish(EventTypes.ARCHITECT_INTERVIEW_MESSAGE as any, {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        role: 'system',
        content: JSON.stringify({
          type: 'thinking_progress',
          agentId,
          agentName,
          action,
          status,
          details,
          timestamp: new Date().toISOString(),
        }),
        phase: this.currentPhase.toLowerCase() as any,
      });
    } catch (error) {
      logger.warn('Failed to publish thinking progress:', error);
    }
  }

  private recordThought(
    agentId: string,
    agentName: string,
    action: string,
    content: string,
    duration: number,
    tokenCount: number
  ): void {
    this.thoughts.push({
      agentId,
      agentName,
      action,
      content,
      timestamp: new Date(),
      duration,
      tokenCount,
    });
  }

  // ====================================
  // INTERVIEW FLOW
  // ====================================

  /**
   * Process a user message through the interview
   */
  async processUserMessage(message: string): Promise<string> {
    // Add to knowledge graph
    this.knowledgeGraph.addConversationTurn('user', message);
    this.interviewHistory.push({ role: 'user', content: message });

    // Update state
    this.setState('INTERVIEWING');

    // Get NEXUS (Alpha) to respond to the user
    const alphaAgent = AgentRegistry.ALPHA;
    const systemPrompt = buildPrompt(alphaAgent, {
      knowledgeGraph: this.knowledgeGraph.toContextString(),
      projectContext: `Phase: ${this.currentPhase}\nUser: ${this.config.username}`,
    });

    await this.publishThinkingProgress(
      alphaAgent.id,
      alphaAgent.name,
      'Analyzing your message...',
      'started'
    );

    const startTime = Date.now();
    const { content: response, tokenCount } = await this.ai.chat(
      alphaAgent,
      systemPrompt,
      message,
      this.interviewHistory.slice(-10) // Last 10 turns for context
    );
    const duration = Date.now() - startTime;

    await this.publishThinkingProgress(
      alphaAgent.id,
      alphaAgent.name,
      'Analyzing your message...',
      'completed',
      `Processed in ${duration}ms`
    );

    this.recordThought(alphaAgent.id, alphaAgent.name, 'interview_response', response, duration, tokenCount);
    this.knowledgeGraph.addConversationTurn('agent', response, alphaAgent.id);
    this.interviewHistory.push({ role: 'assistant', content: response });

    // Check if interview phase is complete
    await this.checkPhaseCompletion(message, response);

    return response;
  }

  /**
   * Check if current interview phase is complete and advance
   */
  private async checkPhaseCompletion(userMessage: string, assistantResponse: string): Promise<void> {
    const phases: InterviewPhase[] = ['DISCOVERY', 'REQUIREMENTS', 'TECHNICAL', 'TIMELINE', 'BUDGET'];
    const currentIndex = phases.indexOf(this.currentPhase);

    // Simple heuristics for phase completion
    const phaseComplete = this.isPhaseComplete(userMessage, assistantResponse);

    if (phaseComplete && currentIndex < phases.length - 1) {
      this.currentPhase = phases[currentIndex + 1];
      logger.info(`Advanced to phase: ${this.currentPhase}`);
    } else if (phaseComplete && currentIndex === phases.length - 1) {
      // All phases complete - start extraction and debate
      await this.initiateDebate();
    }
  }

  /**
   * Simple heuristic to determine if a phase is complete
   */
  private isPhaseComplete(userMessage: string, response: string): boolean {
    // Check for completion indicators
    const completionIndicators = [
      'understood',
      'got it',
      'makes sense',
      "let's move on",
      'next',
      'continue',
      'that covers',
    ];

    const lowerUser = userMessage.toLowerCase();
    return completionIndicators.some(indicator => lowerUser.includes(indicator));
  }

  // ====================================
  // MULTI-AGENT DEBATE
  // ====================================

  /**
   * Initiate the Trinity Agent Debate
   */
  async initiateDebate(): Promise<void> {
    logger.info('Initiating Multi-Agent Debate Protocol...');
    this.setState('EXTRACTING');

    // Step 1: NEXUS (Alpha) extracts final requirements
    const alphaOutput = await this.runAlphaExtraction();

    // Step 2: SENTINEL (Beta) critiques
    this.setState('DEBATING');
    let betaOutput = await this.runBetaCritique(alphaOutput);

    // Step 3: Recursive Reflection Loop
    let round = 1;
    while (betaOutput.approvalStatus === 'NEEDS_REVISION' && !this.debateHistory.hasReachedLimit()) {
      logger.info(`Debate Round ${round}: Revision required`);
      this.setState('REVISING');

      // Generate correction prompt
      const delta = calculateReflectionDelta(alphaOutput, betaOutput);
      const correctionPrompt = generateCorrectionPrompt(alphaOutput, betaOutput, delta);

      // Alpha self-corrects
      const revisedAlpha = await this.runAlphaRevision(correctionPrompt, alphaOutput);

      // Beta re-evaluates
      this.setState('DEBATING');
      betaOutput = await this.runBetaCritique(revisedAlpha);

      // Record round
      this.debateHistory.addRound(revisedAlpha, betaOutput);
      round++;
    }

    // Check final status
    if (betaOutput.approvalStatus === 'CRITICAL_HALT') {
      this.setState('HALTED');
      logger.error('Debate halted: Critical issues found');
      return;
    }

    if (betaOutput.approvalStatus === 'APPROVED') {
      // Step 4: ORACLE (Gamma) estimates costs
      this.setState('ESTIMATING');
      await this.runGammaEstimation(alphaOutput, betaOutput);
      this.setState('COMPLETED');
    }
  }

  /**
   * Run Alpha (NEXUS) requirement extraction
   */
  private async runAlphaExtraction(): Promise<AlphaOutput> {
    const agent = AgentRegistry.ALPHA;
    
    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Extracting technical requirements...',
      'started'
    );

    const systemPrompt = buildPrompt(agent, {
      knowledgeGraph: this.knowledgeGraph.toContextString(),
      conversationHistory: this.interviewHistory.map(h => `${h.role}: ${h.content}`).join('\n'),
    });

    const extractionPrompt = `
Based on the complete interview conversation, perform your Chain-of-Density extraction.
Generate the full requirement_analysis with all categories.

Conversation Summary:
${this.interviewHistory.slice(-20).map(h => `${h.role}: ${h.content}`).join('\n')}
`;

    const startTime = Date.now();
    const { content, tokenCount } = await this.ai.chat(agent, systemPrompt, extractionPrompt);
    const duration = Date.now() - startTime;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Extracting technical requirements...',
      'completed',
      `Extracted ${tokenCount} tokens in ${duration}ms`
    );

    this.recordThought(agent.id, agent.name, 'requirement_extraction', content, duration, tokenCount);

    const parsed = parseAlphaOutput(content);
    
    // Import into knowledge graph
    this.knowledgeGraph.importRequirements([
      ...parsed.extractedRequirements,
      ...parsed.inferredRequirements,
    ]);

    return parsed;
  }

  /**
   * Run Beta (SENTINEL) technical critique
   */
  private async runBetaCritique(alphaOutput: AlphaOutput): Promise<BetaOutput> {
    const agent = AgentRegistry.BETA;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Analyzing for technical risks...',
      'started'
    );

    const systemPrompt = buildPrompt(agent, {
      knowledgeGraph: this.knowledgeGraph.toContextString(),
    });

    const critiquePrompt = `
## Requirements from NEXUS to Review

${alphaOutput.rawOutput}

## Your Task
Perform your technical skeptic analysis. Find hallucinations, impossible constraints, and hidden complexity.
Generate the full technical_review with risk assessment.
`;

    const startTime = Date.now();
    const { content, tokenCount } = await this.ai.chat(agent, systemPrompt, critiquePrompt);
    const duration = Date.now() - startTime;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Analyzing for technical risks...',
      'completed',
      `Found ${tokenCount} tokens of analysis in ${duration}ms`
    );

    this.recordThought(agent.id, agent.name, 'technical_critique', content, duration, tokenCount);

    const parsed = parseBetaOutput(content);

    // Import risks into knowledge graph
    this.knowledgeGraph.importRisks(parsed.risks);

    return parsed;
  }

  /**
   * Run Alpha (NEXUS) self-correction
   */
  private async runAlphaRevision(
    correctionPrompt: string,
    originalOutput: AlphaOutput
  ): Promise<AlphaOutput> {
    const agent = AgentRegistry.ALPHA;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Self-correcting based on SENTINEL feedback...',
      'started'
    );

    const systemPrompt = buildPrompt(agent, {
      knowledgeGraph: this.knowledgeGraph.toContextString(),
      previousAgentOutput: originalOutput.rawOutput,
    });

    const startTime = Date.now();
    const { content, tokenCount } = await this.ai.chat(agent, systemPrompt, correctionPrompt);
    const duration = Date.now() - startTime;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Self-correcting based on SENTINEL feedback...',
      'completed',
      `Revised in ${duration}ms`
    );

    this.recordThought(agent.id, agent.name, 'self_correction', content, duration, tokenCount);

    return parseAlphaOutput(content);
  }

  /**
   * Run Gamma (ORACLE) cost estimation
   */
  private async runGammaEstimation(
    alphaOutput: AlphaOutput,
    betaOutput: BetaOutput
  ): Promise<IProjectBrief> {
    const agent = AgentRegistry.GAMMA;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Calculating costs and milestones...',
      'started'
    );

    const systemPrompt = buildPrompt(agent, {
      knowledgeGraph: this.knowledgeGraph.toContextString(),
    });

    const estimationPrompt = `
## APPROVED Requirements from NEXUS

${alphaOutput.rawOutput}

## Risk Assessment from SENTINEL

Critical Score: ${betaOutput.criticalScore}/10
Warnings: ${betaOutput.warnings.join(', ')}
Commendations: ${betaOutput.commendations.join(', ')}

## Your Task
Generate the complete project_estimate with:
1. Total credits calculation
2. Milestone breakdown
3. Tech stack recommendations
4. Timeline (min/max weeks)
5. Risk reserve
`;

    const startTime = Date.now();
    const { content, tokenCount } = await this.ai.chat(agent, systemPrompt, estimationPrompt);
    const duration = Date.now() - startTime;

    await this.publishThinkingProgress(
      agent.id,
      agent.name,
      'Calculating costs and milestones...',
      'completed',
      `Estimated in ${duration}ms`
    );

    this.recordThought(agent.id, agent.name, 'cost_estimation', content, duration, tokenCount);

    // Parse and create project brief
    const brief = this.parseGammaToProjectBrief(content, alphaOutput);
    
    return brief;
  }

  /**
   * Parse Gamma output into project brief
   */
  private parseGammaToProjectBrief(gammaOutput: string, alphaOutput: AlphaOutput): IProjectBrief {
    // Extract key values from gamma output
    const complexityMatch = gammaOutput.match(/<complexity_score>(\d+)<\/complexity_score>/);
    const creditsMatch = gammaOutput.match(/<total_credits>(\d+)<\/total_credits>/);
    const hoursMatch = gammaOutput.match(/<estimated_hours>(\d+)<\/estimated_hours>/);
    const timelineMatch = gammaOutput.match(/<timeline_weeks>(\d+)-(\d+)<\/timeline_weeks>/);

    const techStackMatch = gammaOutput.match(/<primary>(.+?)<\/primary>/);
    const techStack = techStackMatch?.[1]?.split(',').map(t => t.trim()) || [];

    const deliverables = alphaOutput.extractedRequirements
      .filter(r => r.priority === 'P0')
      .map(r => r.description);

    return {
      summary: `Project scoped through Multi-Agent Debate Protocol. ${alphaOutput.extractedRequirements.length} requirements identified.`,
      requirements: alphaOutput.extractedRequirements.map(r => r.description),
      techStack,
      deliverables,
      complexityScore: parseInt(complexityMatch?.[1] || '5', 10),
      estimatedHours: parseInt(hoursMatch?.[1] || '40', 10),
      estimatedBudget: parseInt(creditsMatch?.[1] || '200', 10),
      timeline: timelineMatch ? `${timelineMatch[1]}-${timelineMatch[2]} weeks` : '4-6 weeks',
      notes: `Debate rounds: ${this.debateHistory.getAllRounds().length}. Final confidence: ${this.debateHistory.getConvergenceMetrics().finalConfidence.toFixed(1)}%`,
    };
  }

  // ====================================
  // TOOL USE - PROJECT TEMPLATES
  // ====================================

  /**
   * Query existing projects for template matching
   */
  async queryProjectTemplates(techStack: string[]): Promise<Array<{
    name: string;
    techStack: string[];
    complexityScore: number;
    estimatedHours: number;
  }>> {
    try {
      const projects = await Project.find({
        status: 'completed',
        'brief.techStack': { $in: techStack },
      })
        .select('name brief.techStack brief.complexityScore brief.estimatedHours')
        .limit(5)
        .lean();

      return projects.map(p => ({
        name: p.name,
        techStack: p.brief?.techStack || [],
        complexityScore: p.brief?.complexityScore || 5,
        estimatedHours: p.brief?.estimatedHours || 40,
      }));
    } catch (error) {
      logger.error('Error querying project templates:', error);
      return [];
    }
  }

  // ====================================
  // RESULT AGGREGATION
  // ====================================

  /**
   * Get the final orchestration result
   */
  getResult(): OrchestrationResult {
    const latestRound = this.debateHistory.getLatestRound();

    return {
      success: this.state === 'COMPLETED',
      state: this.state,
      projectBrief: latestRound ? this.parseGammaToProjectBrief(
        '', // Would need to store gamma output
        latestRound.alphaOutput
      ) : undefined,
      debateHistory: this.debateHistory,
      thoughts: this.thoughts,
      knowledgeGraph: this.knowledgeGraph,
      error: this.state === 'ERROR' ? 'Orchestration failed' : undefined,
    };
  }

  /**
   * Generate a summary of the orchestration for Discord
   */
  generateDiscordSummary(): string {
    const metrics = this.debateHistory.getConvergenceMetrics();
    const stats = this.knowledgeGraph.getStats();

    return `
\`\`\`ansi
[2;34m╔══════════════════════════════════════════════════════════╗[0m
[2;34m║[0m [1;36m⬡ AVENLO ARCHITECT - MULTI-AGENT SCOPING COMPLETE[0m [2;34m║[0m
[2;34m╠══════════════════════════════════════════════════════════╣[0m
[2;34m║[0m                                                          [2;34m║[0m
[2;34m║[0m  [1;32m✓[0m [0;37mDebate Rounds:[0m ${metrics.totalRounds.toString().padStart(3)}                               [2;34m║[0m
[2;34m║[0m  [1;32m✓[0m [0;37mRequirements:[0m ${stats.entities.toString().padStart(4)}                               [2;34m║[0m
[2;34m║[0m  [1;32m✓[0m [0;37mConfidence:[0m ${metrics.finalConfidence.toFixed(1)}%                             [2;34m║[0m
[2;34m║[0m  [1;32m✓[0m [0;37mRisk Progression:[0m ${metrics.criticalScoreProgression.join(' → ')}             [2;34m║[0m
[2;34m║[0m                                                          [2;34m║[0m
[2;34m║[0m  [0;33mAgents:[0m NEXUS (α) • SENTINEL (β) • ORACLE (γ)           [2;34m║[0m
[2;34m║[0m                                                          [2;34m║[0m
[2;34m╚══════════════════════════════════════════════════════════╝[0m
\`\`\`
`;
  }
}

// ====================================
// FACTORY
// ====================================

export function createOrchestrationEngine(config: SessionConfig): OrchestrationEngine {
  return new OrchestrationEngine(config);
}
