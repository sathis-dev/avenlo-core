// ====================================
// SIEVE LAYER COMPONENT
// Layer 1: Regex instant-match display
// ====================================

import { motion } from 'framer-motion';
import { Zap, AlertOctagon, Code2 } from 'lucide-react';

interface SieveLayerProps {
  messageContent: string;
  patternSignatures: string[];
  processingTimeMs: number;
  isActive: boolean;
}

/**
 * Get severity color for pattern type
 */
function getPatternColor(pattern: string): string {
  if (pattern.includes('slur') || pattern.includes('extremism')) return 'text-red-500 bg-red-500/20';
  if (pattern.includes('scam') || pattern.includes('phish')) return 'text-orange-500 bg-orange-500/20';
  if (pattern.includes('spam') || pattern.includes('mention')) return 'text-yellow-500 bg-yellow-500/20';
  return 'text-avenlo-cyan bg-avenlo-cyan/20';
}

export default function SieveLayer({
  messageContent,
  patternSignatures,
  processingTimeMs,
  isActive,
}: SieveLayerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        forensic-layer relative overflow-hidden rounded-xl border
        ${isActive 
          ? 'border-red-500/50 bg-red-500/5' 
          : 'border-avenlo-border/30 bg-avenlo-card/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-avenlo-border/30">
        <div className="flex items-center gap-3">
          <motion.div
            className={`p-2 rounded-lg ${isActive ? 'bg-red-500/20' : 'bg-gray-700/50'}`}
            animate={isActive ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Zap className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-gray-500'}`} />
          </motion.div>
          <div>
            <h4 className="font-semibold text-white">Layer 1: SIEVE</h4>
            <p className="text-xs text-gray-500">Regex Pattern Matcher • Instant Detection</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-1 rounded-full text-xs font-mono
            ${isActive ? 'bg-red-500/20 text-red-400' : 'bg-gray-700/50 text-gray-400'}
          `}>
            {processingTimeMs}ms
          </span>
          {isActive && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400"
            >
              TRIGGERED
            </motion.span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Message Display */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Original Message</span>
          </div>
          <div className={`
            p-4 rounded-lg font-mono text-sm leading-relaxed
            ${isActive 
              ? 'bg-black/50 border border-red-500/30' 
              : 'bg-black/30 border border-avenlo-border/30'
            }
          `}>
            {isActive ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400"
              >
                {messageContent}
              </motion.span>
            ) : (
              <span className="text-gray-400">{messageContent}</span>
            )}
          </div>
        </div>

        {/* Pattern Signatures */}
        {isActive && patternSignatures.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                Pattern Signatures Matched
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {patternSignatures.map((pattern, index) => (
                <motion.span
                  key={pattern}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-mono
                    ${getPatternColor(pattern)}
                  `}
                >
                  {pattern}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bypass indicator when not triggered */}
        {!isActive && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-px bg-gray-600 flex-1" />
            <span>Passed to Layer 2</span>
            <div className="w-4 h-px bg-gray-600 flex-1" />
          </div>
        )}
      </div>

      {/* Active glow effect */}
      {isActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
          }}
        />
      )}
    </motion.div>
  );
}
