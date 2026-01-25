// ====================================
// AVENLO CORE - KNOWLEDGE GRAPH
// Token-Optimized Context Management
// ====================================

import { createLogger } from '@avenlo/shared';
import { RequirementItem, RiskItem } from './reflection';

const logger = createLogger('architect-knowledge');

// ====================================
// TYPES
// ====================================

export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  description: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EntityType =
  | 'requirement'
  | 'feature'
  | 'constraint'
  | 'technology'
  | 'integration'
  | 'stakeholder'
  | 'milestone'
  | 'risk'
  | 'decision';

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  weight: number;
  properties?: Record<string, unknown>;
}

export type RelationType =
  | 'depends_on'
  | 'blocks'
  | 'implements'
  | 'requires'
  | 'conflicts_with'
  | 'enables'
  | 'part_of'
  | 'related_to'
  | 'mitigates';

export interface Decision {
  id: string;
  topic: string;
  decision: string;
  reasoning: string;
  alternatives: string[];
  madeAt: Date;
  confidence: number;
}

export interface ConversationTurn {
  turnId: number;
  role: 'user' | 'assistant' | 'agent';
  agentId?: string;
  content: string;
  extractedEntities: string[];
  tokenCount: number;
  timestamp: Date;
}

export interface KnowledgeGraphState {
  sessionId: string;
  entities: Map<string, Entity>;
  relationships: Relationship[];
  decisions: Decision[];
  conversationHistory: ConversationTurn[];
  openQuestions: string[];
  summary: string;
  totalTokens: number;
  compressionRatio: number;
}

// ====================================
// KNOWLEDGE GRAPH CLASS
// ====================================

export class KnowledgeGraph {
  private state: KnowledgeGraphState;
  private readonly MAX_TOKENS = 128000;
  private readonly COMPRESSION_THRESHOLD = 50000;
  private entityCounter = 0;
  private relationCounter = 0;
  private decisionCounter = 0;

  constructor(sessionId: string) {
    this.state = {
      sessionId,
      entities: new Map(),
      relationships: [],
      decisions: [],
      conversationHistory: [],
      openQuestions: [],
      summary: '',
      totalTokens: 0,
      compressionRatio: 1,
    };
  }

  // ====================================
  // ENTITY MANAGEMENT
  // ====================================

  /**
   * Add an entity to the knowledge graph
   */
  addEntity(
    type: EntityType,
    label: string,
    description: string,
    properties: Record<string, unknown> = {},
    confidence: number = 1.0
  ): Entity {
    const id = `E${++this.entityCounter}`;
    
    const entity: Entity = {
      id,
      type,
      label,
      description,
      properties,
      confidence,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.state.entities.set(id, entity);
    logger.debug(`Added entity: ${id} (${type}): ${label}`);
    
    return entity;
  }

  /**
   * Update an existing entity
   */
  updateEntity(id: string, updates: Partial<Entity>): Entity | null {
    const entity = this.state.entities.get(id);
    if (!entity) return null;

    const updated = {
      ...entity,
      ...updates,
      updatedAt: new Date(),
    };

    this.state.entities.set(id, updated);
    return updated;
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | undefined {
    return this.state.entities.get(id);
  }

  /**
   * Find entities by type
   */
  getEntitiesByType(type: EntityType): Entity[] {
    return Array.from(this.state.entities.values()).filter(e => e.type === type);
  }

  /**
   * Search entities by label or description
   */
  searchEntities(query: string): Entity[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.state.entities.values()).filter(e =>
      e.label.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery)
    );
  }

  // ====================================
  // RELATIONSHIP MANAGEMENT
  // ====================================

  /**
   * Add a relationship between entities
   */
  addRelationship(
    fromId: string,
    toId: string,
    type: RelationType,
    weight: number = 1.0,
    properties?: Record<string, unknown>
  ): Relationship | null {
    if (!this.state.entities.has(fromId) || !this.state.entities.has(toId)) {
      logger.warn(`Cannot create relationship: entity not found`);
      return null;
    }

    const id = `R${++this.relationCounter}`;
    
    const relationship: Relationship = {
      id,
      from: fromId,
      to: toId,
      type,
      weight,
      properties,
    };

    this.state.relationships.push(relationship);
    return relationship;
  }

  /**
   * Get all relationships for an entity
   */
  getRelationships(entityId: string): Relationship[] {
    return this.state.relationships.filter(
      r => r.from === entityId || r.to === entityId
    );
  }

  /**
   * Get connected entities
   */
  getConnectedEntities(entityId: string): Entity[] {
    const relationships = this.getRelationships(entityId);
    const connectedIds = new Set<string>();
    
    for (const rel of relationships) {
      if (rel.from === entityId) connectedIds.add(rel.to);
      if (rel.to === entityId) connectedIds.add(rel.from);
    }

    return Array.from(connectedIds)
      .map(id => this.state.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  // ====================================
  // DECISION TRACKING
  // ====================================

  /**
   * Record a decision
   */
  addDecision(
    topic: string,
    decision: string,
    reasoning: string,
    alternatives: string[] = [],
    confidence: number = 1.0
  ): Decision {
    const id = `D${++this.decisionCounter}`;
    
    const decisionRecord: Decision = {
      id,
      topic,
      decision,
      reasoning,
      alternatives,
      madeAt: new Date(),
      confidence,
    };

    this.state.decisions.push(decisionRecord);
    return decisionRecord;
  }

  /**
   * Get all decisions
   */
  getDecisions(): Decision[] {
    return this.state.decisions;
  }

  // ====================================
  // CONVERSATION HISTORY
  // ====================================

  /**
   * Add a conversation turn
   */
  addConversationTurn(
    role: 'user' | 'assistant' | 'agent',
    content: string,
    agentId?: string
  ): ConversationTurn {
    const tokenCount = this.estimateTokens(content);
    
    const turn: ConversationTurn = {
      turnId: this.state.conversationHistory.length + 1,
      role,
      agentId,
      content,
      extractedEntities: [],
      tokenCount,
      timestamp: new Date(),
    };

    this.state.conversationHistory.push(turn);
    this.state.totalTokens += tokenCount;

    // Check if compression is needed
    if (this.state.totalTokens > this.COMPRESSION_THRESHOLD) {
      this.compress();
    }

    return turn;
  }

  /**
   * Estimate token count for a string (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  // ====================================
  // OPEN QUESTIONS
  // ====================================

  /**
   * Add an open question
   */
  addOpenQuestion(question: string): void {
    if (!this.state.openQuestions.includes(question)) {
      this.state.openQuestions.push(question);
    }
  }

  /**
   * Mark question as resolved
   */
  resolveQuestion(question: string): void {
    const index = this.state.openQuestions.indexOf(question);
    if (index !== -1) {
      this.state.openQuestions.splice(index, 1);
    }
  }

  /**
   * Get open questions
   */
  getOpenQuestions(): string[] {
    return this.state.openQuestions;
  }

  // ====================================
  // COMPRESSION & SUMMARIZATION
  // ====================================

  /**
   * Compress conversation history to stay within token limits
   */
  compress(): void {
    logger.info('Compressing knowledge graph...');

    const oldTokens = this.state.totalTokens;

    // Keep only the most recent 10 turns in full
    const recentTurns = this.state.conversationHistory.slice(-10);
    const oldTurns = this.state.conversationHistory.slice(0, -10);

    // Summarize old turns
    if (oldTurns.length > 0) {
      const summaryContent = this.generateTurnSummary(oldTurns);
      
      // Create a summary turn
      const summaryTurn: ConversationTurn = {
        turnId: 0,
        role: 'assistant',
        agentId: 'CONDENSER',
        content: `[COMPRESSED HISTORY]\n${summaryContent}`,
        extractedEntities: [],
        tokenCount: this.estimateTokens(summaryContent),
        timestamp: new Date(),
      };

      this.state.conversationHistory = [summaryTurn, ...recentTurns];
    }

    // Recalculate total tokens
    this.state.totalTokens = this.state.conversationHistory.reduce(
      (sum, turn) => sum + turn.tokenCount,
      0
    );

    this.state.compressionRatio = oldTokens / this.state.totalTokens;
    
    logger.info(`Compressed: ${oldTokens} → ${this.state.totalTokens} tokens (${this.state.compressionRatio.toFixed(2)}x)`);
  }

  /**
   * Generate summary of conversation turns
   */
  private generateTurnSummary(turns: ConversationTurn[]): string {
    const keyPoints: string[] = [];

    for (const turn of turns) {
      // Extract key information based on role
      if (turn.role === 'user') {
        // Extract user requirements/requests
        const reqMatch = turn.content.match(/(?:need|want|require|must have|should)\s+(.+?)(?:\.|$)/gi);
        if (reqMatch) {
          keyPoints.push(...reqMatch.map(r => `User stated: ${r.trim()}`));
        }
      } else if (turn.role === 'agent' || turn.role === 'assistant') {
        // Extract decisions and conclusions
        const decisions = turn.content.match(/(?:decided|concluded|determined|confirmed)\s+(.+?)(?:\.|$)/gi);
        if (decisions) {
          keyPoints.push(...decisions.map(d => `${turn.agentId || 'System'}: ${d.trim()}`));
        }
      }
    }

    // Deduplicate and limit
    const uniquePoints = [...new Set(keyPoints)].slice(0, 20);
    
    return uniquePoints.length > 0
      ? uniquePoints.join('\n')
      : `${turns.length} conversation turns processed. Key details preserved in entities.`;
  }

  // ====================================
  // IMPORT FROM REQUIREMENTS
  // ====================================

  /**
   * Import requirements from Alpha output
   */
  importRequirements(requirements: RequirementItem[]): Entity[] {
    const entities: Entity[] = [];

    for (const req of requirements) {
      const entity = this.addEntity(
        'requirement',
        req.id,
        req.description,
        {
          category: req.category,
          priority: req.priority,
          complexity: req.complexity,
          confidence: req.confidence,
        },
        req.confidence === 'high' ? 1.0 : req.confidence === 'medium' ? 0.7 : 0.4
      );
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Import risks from Beta output
   */
  importRisks(risks: RiskItem[]): Entity[] {
    const entities: Entity[] = [];

    for (const risk of risks) {
      const entity = this.addEntity(
        'risk',
        risk.id,
        risk.title,
        {
          score: risk.score,
          category: risk.category,
          description: risk.description,
          impact: risk.impact,
          mitigation: risk.mitigation,
        },
        1 - (risk.score / 10) // Lower confidence for higher risk
      );
      entities.push(entity);
    }

    return entities;
  }

  // ====================================
  // SERIALIZATION
  // ====================================

  /**
   * Export to structured format for context injection
   */
  toContextString(): string {
    const lines: string[] = ['<knowledge_graph>'];

    // Entities
    lines.push('  <entities>');
    for (const entity of this.state.entities.values()) {
      lines.push(`    <entity id="${entity.id}" type="${entity.type}">`);
      lines.push(`      <label>${entity.label}</label>`);
      lines.push(`      <description>${entity.description}</description>`);
      if (Object.keys(entity.properties).length > 0) {
        lines.push(`      <properties>${JSON.stringify(entity.properties)}</properties>`);
      }
      lines.push(`    </entity>`);
    }
    lines.push('  </entities>');

    // Relationships
    if (this.state.relationships.length > 0) {
      lines.push('  <relationships>');
      for (const rel of this.state.relationships) {
        lines.push(`    <rel from="${rel.from}" to="${rel.to}" type="${rel.type}" weight="${rel.weight}"/>`);
      }
      lines.push('  </relationships>');
    }

    // Decisions
    if (this.state.decisions.length > 0) {
      lines.push('  <decisions>');
      for (const decision of this.state.decisions) {
        lines.push(`    <decision topic="${decision.topic}">${decision.decision}</decision>`);
      }
      lines.push('  </decisions>');
    }

    // Open questions
    if (this.state.openQuestions.length > 0) {
      lines.push('  <open_questions>');
      for (const q of this.state.openQuestions) {
        lines.push(`    - ${q}`);
      }
      lines.push('  </open_questions>');
    }

    // Summary
    if (this.state.summary) {
      lines.push(`  <conversation_summary>${this.state.summary}</conversation_summary>`);
    }

    lines.push('</knowledge_graph>');

    return lines.join('\n');
  }

  /**
   * Get stats about the knowledge graph
   */
  getStats(): {
    entities: number;
    relationships: number;
    decisions: number;
    openQuestions: number;
    conversationTurns: number;
    totalTokens: number;
    compressionRatio: number;
  } {
    return {
      entities: this.state.entities.size,
      relationships: this.state.relationships.length,
      decisions: this.state.decisions.length,
      openQuestions: this.state.openQuestions.length,
      conversationTurns: this.state.conversationHistory.length,
      totalTokens: this.state.totalTokens,
      compressionRatio: this.state.compressionRatio,
    };
  }

  /**
   * Update the summary
   */
  setSummary(summary: string): void {
    this.state.summary = summary;
  }

  /**
   * Get recent conversation for context
   */
  getRecentConversation(maxTurns: number = 5): ConversationTurn[] {
    return this.state.conversationHistory.slice(-maxTurns);
  }

  /**
   * Export full state for persistence
   */
  exportState(): KnowledgeGraphState {
    return {
      ...this.state,
      entities: new Map(this.state.entities),
    };
  }

  /**
   * Import state from persistence
   */
  static fromState(state: KnowledgeGraphState): KnowledgeGraph {
    const graph = new KnowledgeGraph(state.sessionId);
    graph.state = {
      ...state,
      entities: new Map(state.entities),
    };
    return graph;
  }
}
