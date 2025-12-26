// ====================================
// AVENLO CORE - BRIEF GENERATOR
// ====================================

import PDFDocument from 'pdfkit';
import { createLogger, IProjectBrief, IProject, IInterviewSession } from '@avenlo/shared';
import { AIClient } from '../ai/client';

const logger = createLogger('architect-brief');

export class BriefGenerator {
  private ai: AIClient;

  constructor() {
    this.ai = new AIClient((process.env.AI_PROVIDER || 'openai') as any);
  }

  async generate(session: IInterviewSession): Promise<IProjectBrief> {
    logger.info(`Generating brief for session ${session.sessionId}`);

    // Build conversation summary
    const conversationText = session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Generate structured brief using AI
    const briefSchema = `{
  "summary": "2-3 sentence project summary",
  "requirements": ["array of specific requirements"],
  "techStack": ["array of recommended technologies"],
  "deliverables": ["array of deliverables"],
  "complexityScore": number (1-10),
  "estimatedHours": number,
  "estimatedBudget": number (optional),
  "timeline": "estimated timeline string",
  "notes": "additional notes (optional)"
}`;

    const instruction = `You are a senior project manager analyzing a client discovery conversation.
Based on the conversation below, generate a comprehensive project brief.

CONVERSATION:
${conversationText}

EXTRACTED DATA:
Project Type: ${session.extractedData.projectType || 'Not specified'}
Tech Stack Mentioned: ${session.extractedData.techStack?.join(', ') || 'Not specified'}
Features: ${session.extractedData.features?.join(', ') || 'Not specified'}
Budget: ${session.extractedData.budget || 'Not specified'}
Timeline: ${session.extractedData.timeline || 'Not specified'}

COMPLEXITY SCORING GUIDE:
1-2: Simple landing page, basic static site
3-4: Small web app with basic CRUD, simple mobile app
5-6: Medium complexity app with auth, integrations
7-8: Complex application with real-time features, multiple integrations
9-10: Enterprise-level, highly complex with advanced features

HOUR ESTIMATION GUIDE:
- Consider discovery, design, development, testing, deployment
- Add 20% buffer for unknowns
- Be realistic, not optimistic

Return ONLY the JSON object matching this schema:
${briefSchema}`;

    try {
      const brief = await this.ai.generateJSON<IProjectBrief>(
        instruction,
        briefSchema
      );

      // Validate and sanitize
      const sanitizedBrief: IProjectBrief = {
        summary: brief.summary || 'Project summary pending review.',
        requirements: brief.requirements || [],
        techStack: brief.techStack || session.extractedData.techStack || [],
        deliverables: brief.deliverables || [],
        complexityScore: Math.min(10, Math.max(1, brief.complexityScore || 5)),
        estimatedHours: brief.estimatedHours || 40,
        estimatedBudget: brief.estimatedBudget,
        timeline: brief.timeline,
        notes: brief.notes,
      };

      logger.info(`Brief generated with complexity ${sanitizedBrief.complexityScore}/10, ${sanitizedBrief.estimatedHours} hours`);

      return sanitizedBrief;
    } catch (error) {
      logger.error('Failed to generate brief:', error);

      // Fallback brief
      return {
        summary: 'Project brief pending manual review due to generation error.',
        requirements: [],
        techStack: session.extractedData.techStack || [],
        deliverables: [],
        complexityScore: 5,
        estimatedHours: 40,
        notes: 'Brief generation encountered an error. Manual review required.',
      };
    }
  }

  async generatePDF(brief: IProjectBrief, project: IProject): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Project Brief - ${project.name}`,
            Author: 'Avenlo Studio',
            Subject: 'Project Discovery Brief',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Colors
        const primaryColor = '#00FFAA';
        const textColor = '#333333';
        const lightGray = '#F5F5F5';

        // Header
        doc
          .fontSize(28)
          .fillColor(primaryColor)
          .text('AVENLO', 50, 50)
          .fontSize(12)
          .fillColor('#666666')
          .text('STUDIO', 145, 58);

        doc
          .moveDown(2)
          .fontSize(24)
          .fillColor(textColor)
          .text('Project Discovery Brief', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .fillColor('#666666')
          .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' })
          .moveDown(2);

        // Project Info Box
        doc
          .rect(50, doc.y, doc.page.width - 100, 60)
          .fill(lightGray);

        const boxY = doc.y + 15;
        doc
          .fontSize(14)
          .fillColor(textColor)
          .text(`Project: ${project.name}`, 70, boxY)
          .text(`Client ID: ${project.clientId}`, 70, boxY + 20)
          .text(`Status: ${project.status.toUpperCase()}`, 350, boxY)
          .text(`Slug: ${project.slug}`, 350, boxY + 20);

        doc.moveDown(4);

        // Summary Section
        doc
          .fontSize(16)
          .fillColor(primaryColor)
          .text('📋 Project Summary', 50)
          .moveDown(0.5)
          .fontSize(11)
          .fillColor(textColor)
          .text(brief.summary, { width: doc.page.width - 100 })
          .moveDown(1.5);

        // Metrics Row
        const metricsY = doc.y;
        const colWidth = (doc.page.width - 100) / 3;

        // Complexity
        doc
          .rect(50, metricsY, colWidth - 10, 70)
          .fill(lightGray);
        doc
          .fontSize(10)
          .fillColor('#666666')
          .text('Complexity Score', 60, metricsY + 10)
          .fontSize(24)
          .fillColor(this.getComplexityColor(brief.complexityScore))
          .text(`${brief.complexityScore}/10`, 60, metricsY + 30);

        // Hours
        doc
          .rect(50 + colWidth, metricsY, colWidth - 10, 70)
          .fill(lightGray);
        doc
          .fontSize(10)
          .fillColor('#666666')
          .text('Estimated Hours', 60 + colWidth, metricsY + 10)
          .fontSize(24)
          .fillColor(textColor)
          .text(`${brief.estimatedHours}h`, 60 + colWidth, metricsY + 30);

        // Budget (if available)
        doc
          .rect(50 + colWidth * 2, metricsY, colWidth - 10, 70)
          .fill(lightGray);
        doc
          .fontSize(10)
          .fillColor('#666666')
          .text('Est. Budget', 60 + colWidth * 2, metricsY + 10)
          .fontSize(24)
          .fillColor(textColor)
          .text(
            brief.estimatedBudget ? `$${brief.estimatedBudget.toLocaleString()}` : 'TBD',
            60 + colWidth * 2,
            metricsY + 30
          );

        doc.y = metricsY + 90;

        // Requirements
        if (brief.requirements.length > 0) {
          doc
            .fontSize(16)
            .fillColor(primaryColor)
            .text('📝 Requirements', 50)
            .moveDown(0.5);

          brief.requirements.forEach((req, i) => {
            doc
              .fontSize(11)
              .fillColor(textColor)
              .text(`${i + 1}. ${req}`, 60, doc.y, { width: doc.page.width - 120 })
              .moveDown(0.3);
          });
          doc.moveDown(1);
        }

        // Tech Stack
        if (brief.techStack.length > 0) {
          doc
            .fontSize(16)
            .fillColor(primaryColor)
            .text('⚡ Technology Stack', 50)
            .moveDown(0.5);

          doc
            .fontSize(11)
            .fillColor(textColor)
            .text(brief.techStack.join(' • '), { width: doc.page.width - 100 })
            .moveDown(1.5);
        }

        // Deliverables
        if (brief.deliverables.length > 0) {
          doc
            .fontSize(16)
            .fillColor(primaryColor)
            .text('📦 Deliverables', 50)
            .moveDown(0.5);

          brief.deliverables.forEach((del, i) => {
            doc
              .fontSize(11)
              .fillColor(textColor)
              .text(`☐ ${del}`, 60, doc.y, { width: doc.page.width - 120 })
              .moveDown(0.3);
          });
          doc.moveDown(1);
        }

        // Timeline
        if (brief.timeline) {
          doc
            .fontSize(16)
            .fillColor(primaryColor)
            .text('📅 Timeline', 50)
            .moveDown(0.5)
            .fontSize(11)
            .fillColor(textColor)
            .text(brief.timeline, { width: doc.page.width - 100 })
            .moveDown(1.5);
        }

        // Notes
        if (brief.notes) {
          doc
            .fontSize(16)
            .fillColor(primaryColor)
            .text('📌 Additional Notes', 50)
            .moveDown(0.5)
            .fontSize(11)
            .fillColor(textColor)
            .text(brief.notes, { width: doc.page.width - 100 })
            .moveDown(1);
        }

        // Footer
        doc
          .fontSize(9)
          .fillColor('#999999')
          .text(
            '© 2025 Avenlo Studio • This document is confidential and intended for the recipient only.',
            50,
            doc.page.height - 50,
            { align: 'center' }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private getComplexityColor(score: number): string {
    if (score <= 3) return '#57F287'; // Green
    if (score <= 6) return '#FFD700'; // Gold
    if (score <= 8) return '#FFA500'; // Orange
    return '#FF4B4B'; // Red
  }
}
