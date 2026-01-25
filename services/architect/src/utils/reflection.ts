// ====================================
// AVENLO CORE - REFLECTION UTILS
// Multi-Agent Debate Analysis
// ====================================

import { createLogger } from '@avenlo/shared';

const logger = createLogger('architect-reflection');

// ====================================
// TYPES
// ====================================

export interface RequirementItem {
  id: string;
  category: 'FUNC' | 'DATA' | 'INTG' | 'PERF' | 'SECU' | 'UI/UX' | 'INFER';
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  complexity: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface RiskItem {
  id: string;
  score: number;
  category: string;
  title: string;
  description: string;
  evidence: string;
  impact: string;
  mitigation: string;
}

export interface AlphaOutput {
  extractedRequirements: RequirementItem[];
  inferredRequirements: RequirementItem[];
  clarificationsNeeded: string[];
  technicalConstraints: string[];
  complexityAssessment: {
    overall: number;
    reasoning: string;
  };
  rawOutput: string;
}

export interface BetaOutput {
  risks: RiskItem[];
  criticalScore: number;
  approvalStatus: 'APPROVED' | 'NEEDS_REVISION' | 'CRITICAL_HALT';
  revisionInstructions: string[];
  warnings: string[];
  commendations: string[];
  rawOutput: string;
}

export interface ReflectionDelta {
  requirementsAffected: string[];
  risksIdentified: RiskItem[];
  corrections: CorrectionItem[];
  confidenceScore: number;
  iterationNeeded: boolean;
  summary: string;
}

export interface CorrectionItem {
  originalRequirement: string;
  issue: string;
  suggestedCorrection: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DebateRound {
  round: number;
  alphaOutput: AlphaOutput;
  betaOutput: BetaOutput;
  delta: ReflectionDelta;
  timestamp: Date;
}

// ====================================
// PARSING FUNCTIONS
// ====================================

/**
 * Parse NEXUS (Alpha) XML output into structured data
 */
export function parseAlphaOutput(rawOutput: string): AlphaOutput {
  const result: AlphaOutput = {
    extractedRequirements: [],
    inferredRequirements: [],
    clarificationsNeeded: [],
    technicalConstraints: [],
    complexityAssessment: {
      overall: 5,
      reasoning: '',
    },
    rawOutput,
  };

  try {
    // Extract requirements with regex
    const reqRegex = /\[(FUNC|DATA|INTG|PERF|SECU|UI\/UX)-(\d+)\]\s*(.+?)\s*\|\s*Priority:\s*(P[012])\s*\|\s*Complexity:\s*(\d+)/g;
    let match;

    while ((match = reqRegex.exec(rawOutput)) !== null) {
      result.extractedRequirements.push({
        id: `${match[1]}-${match[2]}`,
        category: match[1] as RequirementItem['category'],
        description: match[3].trim(),
        priority: match[4] as 'P0' | 'P1' | 'P2',
        complexity: parseInt(match[5], 10),
      });
    }

    // Extract inferred requirements
    const inferRegex = /\[INFER-(\d+)\]\s*(.+?)\s*\|\s*Confidence:\s*(high|medium|low)/g;
    while ((match = inferRegex.exec(rawOutput)) !== null) {
      result.inferredRequirements.push({
        id: `INFER-${match[1]}`,
        category: 'INFER',
        description: match[2].trim(),
        priority: 'P1',
        complexity: 3,
        confidence: match[3] as 'high' | 'medium' | 'low',
      });
    }

    // Extract clarifications
    const clarifyRegex = /\[CLARIFY-\d+\]\s*(.+?)(?=\n|$)/g;
    while ((match = clarifyRegex.exec(rawOutput)) !== null) {
      result.clarificationsNeeded.push(match[1].trim());
    }

    // Extract complexity assessment
    const complexityMatch = rawOutput.match(/Overall:\s*(\d+)/);
    if (complexityMatch) {
      result.complexityAssessment.overall = parseInt(complexityMatch[1], 10);
    }

    const reasoningMatch = rawOutput.match(/Reasoning:\s*(.+?)(?=<|$)/s);
    if (reasoningMatch) {
      result.complexityAssessment.reasoning = reasoningMatch[1].trim();
    }

    // Extract technical constraints
    const constraintSection = rawOutput.match(/<technical_constraints>([\s\S]*?)<\/technical_constraints>/);
    if (constraintSection) {
      const constraints = constraintSection[1].match(/-\s*(.+)/g);
      if (constraints) {
        result.technicalConstraints = constraints.map(c => c.replace(/^-\s*/, '').trim());
      }
    }

  } catch (error) {
    logger.error('Error parsing Alpha output:', error);
  }

  return result;
}

/**
 * Parse SENTINEL (Beta) XML output into structured data
 */
export function parseBetaOutput(rawOutput: string): BetaOutput {
  const result: BetaOutput = {
    risks: [],
    criticalScore: 0,
    approvalStatus: 'APPROVED',
    revisionInstructions: [],
    warnings: [],
    commendations: [],
    rawOutput,
  };

  try {
    // Extract risks with XML-like parsing
    const riskRegex = /<risk\s+id="(RISK-\d+)"\s+score="(\d+)"\s+category="([^"]+)">([\s\S]*?)<\/risk>/g;
    let match;

    while ((match = riskRegex.exec(rawOutput)) !== null) {
      const riskContent = match[4];
      
      const titleMatch = riskContent.match(/<title>(.+?)<\/title>/);
      const descMatch = riskContent.match(/<description>(.+?)<\/description>/s);
      const evidenceMatch = riskContent.match(/<evidence>(.+?)<\/evidence>/s);
      const impactMatch = riskContent.match(/<impact>(.+?)<\/impact>/s);
      const mitigationMatch = riskContent.match(/<mitigation>(.+?)<\/mitigation>/s);

      result.risks.push({
        id: match[1],
        score: parseInt(match[2], 10),
        category: match[3],
        title: titleMatch?.[1]?.trim() || '',
        description: descMatch?.[1]?.trim() || '',
        evidence: evidenceMatch?.[1]?.trim() || '',
        impact: impactMatch?.[1]?.trim() || '',
        mitigation: mitigationMatch?.[1]?.trim() || '',
      });
    }

    // Extract critical score
    const criticalMatch = rawOutput.match(/<critical_score>(\d+)<\/critical_score>/);
    if (criticalMatch) {
      result.criticalScore = parseInt(criticalMatch[1], 10);
    } else {
      // Calculate from risks
      result.criticalScore = Math.max(...result.risks.map(r => r.score), 0);
    }

    // Extract approval status
    const approvalMatch = rawOutput.match(/<approval_status>(APPROVED|NEEDS_REVISION|CRITICAL_HALT)<\/approval_status>/);
    if (approvalMatch) {
      result.approvalStatus = approvalMatch[1] as BetaOutput['approvalStatus'];
    } else {
      // Derive from critical score
      if (result.criticalScore >= 10) {
        result.approvalStatus = 'CRITICAL_HALT';
      } else if (result.criticalScore >= 8) {
        result.approvalStatus = 'NEEDS_REVISION';
      } else {
        result.approvalStatus = 'APPROVED';
      }
    }

    // Extract revision instructions
    const revisionSection = rawOutput.match(/<revision_instructions>([\s\S]*?)<\/revision_instructions>/);
    if (revisionSection) {
      const instructions = revisionSection[1].match(/[-•]\s*(.+)/g);
      if (instructions) {
        result.revisionInstructions = instructions.map(i => i.replace(/^[-•]\s*/, '').trim());
      }
    }

    // Extract warnings
    const warningsSection = rawOutput.match(/<warnings>([\s\S]*?)<\/warnings>/);
    if (warningsSection) {
      const warnings = warningsSection[1].match(/-\s*(.+)/g);
      if (warnings) {
        result.warnings = warnings.map(w => w.replace(/^-\s*/, '').trim());
      }
    }

    // Extract commendations
    const commendationsSection = rawOutput.match(/<commendations>([\s\S]*?)<\/commendations>/);
    if (commendationsSection) {
      const commendations = commendationsSection[1].match(/-\s*(.+)/g);
      if (commendations) {
        result.commendations = commendations.map(c => c.replace(/^-\s*/, '').trim());
      }
    }

  } catch (error) {
    logger.error('Error parsing Beta output:', error);
  }

  return result;
}

// ====================================
// REFLECTION DELTA CALCULATION
// ====================================

/**
 * Calculate the delta between Alpha's proposal and Beta's critique
 * This determines what needs to be corrected
 */
export function calculateReflectionDelta(
  alpha: AlphaOutput,
  beta: BetaOutput
): ReflectionDelta {
  const corrections: CorrectionItem[] = [];
  const requirementsAffected: string[] = [];

  // Analyze each risk and map to requirements
  for (const risk of beta.risks) {
    // Find which requirements are affected by this risk
    const allRequirements = [...alpha.extractedRequirements, ...alpha.inferredRequirements];
    
    for (const req of allRequirements) {
      // Check if the risk evidence mentions this requirement
      const isAffected = 
        risk.evidence.toLowerCase().includes(req.description.toLowerCase().slice(0, 30)) ||
        risk.description.toLowerCase().includes(req.category.toLowerCase());

      if (isAffected && !requirementsAffected.includes(req.id)) {
        requirementsAffected.push(req.id);

        // Create a correction item
        corrections.push({
          originalRequirement: req.description,
          issue: risk.description,
          suggestedCorrection: risk.mitigation,
          severity: mapScoreToSeverity(risk.score),
        });
      }
    }
  }

  // Calculate confidence score (inverse of risk severity)
  const avgRiskScore = beta.risks.length > 0
    ? beta.risks.reduce((sum, r) => sum + r.score, 0) / beta.risks.length
    : 0;
  const confidenceScore = Math.max(0, 100 - (avgRiskScore * 10));

  // Determine if iteration is needed
  const iterationNeeded = beta.approvalStatus !== 'APPROVED';

  // Generate summary
  const summary = generateDeltaSummary(alpha, beta, corrections);

  return {
    requirementsAffected,
    risksIdentified: beta.risks,
    corrections,
    confidenceScore,
    iterationNeeded,
    summary,
  };
}

/**
 * Map risk score to severity level
 */
function mapScoreToSeverity(score: number): CorrectionItem['severity'] {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Generate a human-readable summary of the delta
 */
function generateDeltaSummary(
  alpha: AlphaOutput,
  beta: BetaOutput,
  corrections: CorrectionItem[]
): string {
  const parts: string[] = [];

  // Requirements summary
  const totalReqs = alpha.extractedRequirements.length + alpha.inferredRequirements.length;
  parts.push(`Analyzed ${totalReqs} requirements.`);

  // Risk summary
  if (beta.risks.length === 0) {
    parts.push('No critical risks identified.');
  } else {
    const criticalRisks = beta.risks.filter(r => r.score >= 8).length;
    const moderateRisks = beta.risks.filter(r => r.score >= 5 && r.score < 8).length;
    
    if (criticalRisks > 0) {
      parts.push(`Found ${criticalRisks} critical risk${criticalRisks > 1 ? 's' : ''} requiring revision.`);
    }
    if (moderateRisks > 0) {
      parts.push(`${moderateRisks} moderate risk${moderateRisks > 1 ? 's' : ''} flagged for awareness.`);
    }
  }

  // Approval status
  switch (beta.approvalStatus) {
    case 'APPROVED':
      parts.push('Proposal APPROVED for cost estimation.');
      break;
    case 'NEEDS_REVISION':
      parts.push(`Proposal requires ${corrections.length} correction${corrections.length > 1 ? 's' : ''} before approval.`);
      break;
    case 'CRITICAL_HALT':
      parts.push('CRITICAL: Proposal contains impossible constraints. Manual intervention required.');
      break;
  }

  return parts.join(' ');
}

// ====================================
// SELF-CORRECTION GENERATION
// ====================================

/**
 * Generate correction instructions for Alpha based on Beta's critique
 */
export function generateCorrectionPrompt(
  alpha: AlphaOutput,
  beta: BetaOutput,
  delta: ReflectionDelta
): string {
  const prompt: string[] = [
    '## Self-Correction Required',
    '',
    'SENTINEL has identified issues with your requirements analysis. Please revise.',
    '',
    '### Critical Issues to Address:',
  ];

  // Add critical risks
  const criticalRisks = beta.risks.filter(r => r.score >= 7);
  for (const risk of criticalRisks) {
    prompt.push(`
**${risk.id}: ${risk.title}** (Severity: ${risk.score}/10)
- Issue: ${risk.description}
- Evidence: "${risk.evidence}"
- Required Fix: ${risk.mitigation}
`);
  }

  // Add specific revision instructions
  if (beta.revisionInstructions.length > 0) {
    prompt.push('', '### Specific Revisions Required:', '');
    for (const instruction of beta.revisionInstructions) {
      prompt.push(`- ${instruction}`);
    }
  }

  // Add requirements that need updating
  if (delta.requirementsAffected.length > 0) {
    prompt.push('', '### Requirements to Revise:', '');
    for (const correction of delta.corrections) {
      if (correction.severity === 'critical' || correction.severity === 'high') {
        prompt.push(`- "${correction.originalRequirement}" → ${correction.suggestedCorrection}`);
      }
    }
  }

  prompt.push('', '### Instructions:', '');
  prompt.push('1. Address each critical issue above');
  prompt.push('2. Update affected requirements with realistic constraints');
  prompt.push('3. Add [REVISED] tag to modified requirements');
  prompt.push('4. Maintain the same output format');

  return prompt.join('\n');
}

// ====================================
// DEBATE HISTORY MANAGEMENT
// ====================================

export class DebateHistory {
  private rounds: DebateRound[] = [];
  private maxRounds: number = 5;

  constructor(maxRounds: number = 5) {
    this.maxRounds = maxRounds;
  }

  /**
   * Add a new debate round
   */
  addRound(alphaOutput: AlphaOutput, betaOutput: BetaOutput): DebateRound {
    const delta = calculateReflectionDelta(alphaOutput, betaOutput);
    
    const round: DebateRound = {
      round: this.rounds.length + 1,
      alphaOutput,
      betaOutput,
      delta,
      timestamp: new Date(),
    };

    this.rounds.push(round);
    return round;
  }

  /**
   * Get the latest round
   */
  getLatestRound(): DebateRound | null {
    return this.rounds.length > 0 ? this.rounds[this.rounds.length - 1] : null;
  }

  /**
   * Get all rounds
   */
  getAllRounds(): DebateRound[] {
    return [...this.rounds];
  }

  /**
   * Check if debate has reached consensus
   */
  hasConsensus(): boolean {
    const latest = this.getLatestRound();
    return latest !== null && latest.betaOutput.approvalStatus === 'APPROVED';
  }

  /**
   * Check if max iterations reached
   */
  hasReachedLimit(): boolean {
    return this.rounds.length >= this.maxRounds;
  }

  /**
   * Get convergence metrics
   */
  getConvergenceMetrics(): {
    totalRounds: number;
    criticalScoreProgression: number[];
    requirementsEvolution: number[];
    finalConfidence: number;
  } {
    return {
      totalRounds: this.rounds.length,
      criticalScoreProgression: this.rounds.map(r => r.betaOutput.criticalScore),
      requirementsEvolution: this.rounds.map(r => 
        r.alphaOutput.extractedRequirements.length + r.alphaOutput.inferredRequirements.length
      ),
      finalConfidence: this.getLatestRound()?.delta.confidenceScore || 0,
    };
  }

  /**
   * Generate debate summary for logging
   */
  generateSummary(): string {
    const metrics = this.getConvergenceMetrics();
    const latest = this.getLatestRound();

    return `
Debate Summary:
- Rounds: ${metrics.totalRounds}
- Risk Score Progression: ${metrics.criticalScoreProgression.join(' → ')}
- Final Status: ${latest?.betaOutput.approvalStatus || 'N/A'}
- Final Confidence: ${metrics.finalConfidence.toFixed(1)}%
- Requirements Refined: ${metrics.requirementsEvolution.join(' → ')}
`.trim();
  }
}
