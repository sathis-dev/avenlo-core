// ====================================
// ANALYST LAYER COMPONENT
// Layer 2: GPT-4o Intent Analysis Display
// Sovereign Tier: Interactive Intent Gradient
// ====================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, MessageSquare, Scale, Lightbulb, AlertTriangle } from 'lucide-react';
import { AIReasoning, IntentClassification, INTENT_COLORS } from '../../types/guardian';

interface AnalystLayerProps {
  aiReasoning: AIReasoning;
  isActive: boolean;
}

/**
 * Intent Gradient Slider
 * Visual representation of intent classification on a spectrum
 * Sovereign Tier: Interactive hover states and tooltips
 */
function IntentGradient({ intent, confidence }: { intent: IntentClassification; confidence: number }) {
  const intentData = INTENT_COLORS[intent];
  const [isHovered, setIsHovered] = useState(false);

  // Get intent description for tooltip
  const getIntentDescription = (i: IntentClassification): string => {
    const descriptions: Record<IntentClassification, string> = {
      EDUCATIONAL: 'User is sharing knowledge or asking questions in good faith',
      HOSTILE: 'User displays clear intent to harm, attack, or harass',
      SARCASTIC: 'Message contains sarcasm that may be misinterpreted',
      DEFENSIVE: 'User is responding to perceived criticism or attack',
      NEUTRAL: 'No clear emotional intent detected',
      DECEPTIVE: 'User may be attempting to deceive or manipulate',
      PROVOCATIVE: 'Message designed to provoke emotional response',
    };
    return descriptions[i];
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span className="text-success">Educational</span>
        <span className="text-gray-500">Neutral</span>
        <span className="text-danger">Hostile</span>
      </div>

      {/* Gradient Track */}
      <div
        className="relative h-4 rounded-full overflow-visible bg-black/50 border border-avenlo-border/30 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #10B981 0%, #6B7280 40%, #F59E0B 60%, #EF4444 100%)',
            opacity: isHovered ? 0.5 : 0.3,
            transition: 'opacity 0.2s ease',
          }}
        />

        {/* Position marker */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer z-10"
          style={{
            backgroundColor: intentData.color,
            boxShadow: isHovered
              ? `0 0 15px ${intentData.color}, 0 0 30px ${intentData.color}40`
              : `0 0 10px ${intentData.color}60`,
          }}
          initial={{ left: '50%', scale: 0 }}
          animate={{
            left: `calc(${intentData.position}% - 10px)`,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
          whileHover={{ scale: 1.3 }}
        >
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: intentData.color }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Tooltip on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: -10 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-avenlo-obsidian border border-avenlo-border/50 whitespace-nowrap z-20"
                style={{ boxShadow: `0 0 20px ${intentData.color}30` }}
              >
                <div className="text-xs font-semibold" style={{ color: intentData.color }}>
                  {intent}
                </div>
                <div className="text-xs text-gray-400 max-w-48">
                  {getIntentDescription(intent)}
                </div>
                {/* Arrow */}
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
                  style={{ borderTopColor: 'rgba(45, 45, 68, 0.5)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Intent Label with animated confidence */}
      <div className="flex items-center justify-center gap-2">
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-3 py-1 rounded-full text-sm font-semibold"
          style={{
            backgroundColor: `${intentData.color}20`,
            color: intentData.color,
            boxShadow: `0 0 10px ${intentData.color}20`,
          }}
        >
          {intent}
        </motion.span>
        <motion.span
          className="text-xs text-gray-500 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {confidence}
          </motion.span>
          % confidence
        </motion.span>
      </div>
    </div>
  );
}


/**
 * Factors Display
 * Shows mitigating vs aggravating factors
 */
function FactorsDisplay({
  mitigating,
  aggravating
}: {
  mitigating: string[];
  aggravating: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Mitigating */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center">
            <Lightbulb className="w-3.5 h-3.5 text-success" />
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Mitigating</span>
        </div>
        <div className="space-y-1">
          {mitigating.length > 0 ? (
            mitigating.map((factor, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-xs text-gray-300 px-2 py-1.5 rounded-lg bg-success/10 border border-success/20"
              >
                + {factor}
              </motion.div>
            ))
          ) : (
            <div className="text-xs text-gray-600 italic">None identified</div>
          )}
        </div>
      </div>

      {/* Aggravating */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-danger/20 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Aggravating</span>
        </div>
        <div className="space-y-1">
          {aggravating.length > 0 ? (
            aggravating.map((factor, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-xs text-gray-300 px-2 py-1.5 rounded-lg bg-danger/10 border border-danger/20"
              >
                − {factor}
              </motion.div>
            ))
          ) : (
            <div className="text-xs text-gray-600 italic">None identified</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalystLayer({ aiReasoning, isActive }: AnalystLayerProps) {
  const isAnalystLayer = aiReasoning.detectionLayer === 'ANALYST';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`
        forensic-layer relative overflow-hidden rounded-xl border
        ${isActive && isAnalystLayer
          ? 'border-avenlo-purple/50 bg-avenlo-purple/5'
          : 'border-avenlo-border/30 bg-avenlo-card/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-avenlo-border/30">
        <div className="flex items-center gap-3">
          <motion.div
            className={`p-2 rounded-lg ${isActive && isAnalystLayer ? 'bg-avenlo-purple/20' : 'bg-gray-700/50'}`}
            animate={isActive && isAnalystLayer ? {
              boxShadow: ['0 0 10px rgba(139,92,246,0)', '0 0 20px rgba(139,92,246,0.4)', '0 0 10px rgba(139,92,246,0)']
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className={`w-4 h-4 ${isActive && isAnalystLayer ? 'text-avenlo-purple' : 'text-gray-500'}`} />
          </motion.div>
          <div>
            <h4 className="font-semibold text-white">Layer 2: ANALYST</h4>
            <p className="text-xs text-gray-500">GPT-4o Intent Classification • Context-Aware</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-1 rounded-full text-xs font-mono
            ${isActive && isAnalystLayer ? 'bg-avenlo-purple/20 text-avenlo-purple' : 'bg-gray-700/50 text-gray-400'}
          `}>
            {aiReasoning.processingTimeMs}ms
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {aiReasoning.tokenCount} tokens
          </span>
          {isActive && isAnalystLayer && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 rounded-full text-xs font-bold bg-avenlo-purple/20 text-avenlo-purple"
            >
              DETECTED
            </motion.span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Intent Gradient */}
        <IntentGradient
          intent={aiReasoning.intentClassification}
          confidence={aiReasoning.confidence}
        />

        {/* AI Reasoning */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">AI Reasoning</span>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-lg bg-black/30 border border-avenlo-border/30 text-sm text-gray-300 leading-relaxed"
          >
            {aiReasoning.reasoning}
          </motion.div>
        </div>

        {/* Factors Scale */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Decision Factors</span>
          </div>
          <FactorsDisplay
            mitigating={aiReasoning.mitigatingFactors}
            aggravating={aiReasoning.aggravatingFactors}
          />
        </div>

        {/* Alternative Interpretations */}
        {aiReasoning.alternativeInterpretations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2 pt-2 border-t border-avenlo-border/20"
          >
            <span className="text-xs text-gray-500">Alternative Interpretations Considered:</span>
            <div className="flex flex-wrap gap-2">
              {aiReasoning.alternativeInterpretations.map((alt, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded bg-gray-800/50 text-gray-400">
                  {alt}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Model Badge */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-avenlo-border/20">
          <span className="text-xs text-gray-600">Model:</span>
          <span className="text-xs px-2 py-0.5 rounded bg-avenlo-purple/10 text-avenlo-purple font-mono">
            {aiReasoning.modelUsed}
          </span>
        </div>
      </div>

      {/* Active glow effect */}
      {isActive && isAnalystLayer && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          }}
        />
      )}
    </motion.div>
  );
}
