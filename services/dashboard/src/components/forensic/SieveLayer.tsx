// ====================================
// SIEVE LAYER COMPONENT
// Layer 1: Regex instant-match display
// Sovereign Tier: Inline pattern highlighting
// ====================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertOctagon, Code2, Timer } from 'lucide-react';

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

/**
 * Extract the pattern source from pattern signature
 * Pattern signatures look like "scam_link:discord\\.gift" or "phishing:verify.*account"
 */
function extractPatternSource(signature: string): string | null {
  const colonIndex = signature.indexOf(':');
  if (colonIndex !== -1) {
    return signature.substring(colonIndex + 1);
  }
  return null;
}

/**
 * Highlight matched patterns in the message content
 */
function HighlightedContent({
  content,
  patterns
}: {
  content: string;
  patterns: string[];
}) {
  const highlightedContent = useMemo(() => {
    if (patterns.length === 0) return null;

    const highlights: { start: number; end: number; pattern: string }[] = [];

    // Find all matches for each pattern
    patterns.forEach(signature => {
      const patternSource = extractPatternSource(signature);
      if (!patternSource) return;

      try {
        const regex = new RegExp(patternSource, 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          highlights.push({
            start: match.index,
            end: match.index + match[0].length,
            pattern: signature,
          });
        }
      } catch {
        // Invalid regex, try as literal string
        const index = content.toLowerCase().indexOf(patternSource.toLowerCase());
        if (index !== -1) {
          highlights.push({
            start: index,
            end: index + patternSource.length,
            pattern: signature,
          });
        }
      }
    });

    if (highlights.length === 0) return null;

    // Sort by start position
    highlights.sort((a, b) => a.start - b.start);

    // Build highlighted segments
    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    highlights.forEach((highlight, index) => {
      // Add non-highlighted text before this match
      if (highlight.start > lastEnd) {
        segments.push(
          <span key={`text-${index}`} className="text-gray-400">
            {content.slice(lastEnd, highlight.start)}
          </span>
        );
      }

      // Add highlighted match
      segments.push(
        <motion.span
          key={`highlight-${index}`}
          initial={{ backgroundColor: 'rgba(255, 59, 59, 0.6)' }}
          animate={{ backgroundColor: 'rgba(255, 59, 59, 0.3)' }}
          transition={{ duration: 0.8 }}
          className="text-neon-red font-semibold px-0.5 rounded border-b-2 border-neon-red"
          title={`Matched: ${highlight.pattern}`}
        >
          {content.slice(highlight.start, highlight.end)}
        </motion.span>
      );

      lastEnd = highlight.end;
    });

    // Add remaining text
    if (lastEnd < content.length) {
      segments.push(
        <span key="text-final" className="text-gray-400">
          {content.slice(lastEnd)}
        </span>
      );
    }

    return segments;
  }, [content, patterns]);

  if (!highlightedContent) {
    return <span className="text-red-400">{content}</span>;
  }

  return <>{highlightedContent}</>;
}

export default function SieveLayer({
  messageContent,
  patternSignatures,
  processingTimeMs,
  isActive,
}: SieveLayerProps) {
  const isInstant = processingTimeMs < 5;

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
            className={`p-2 rounded-lg ${isActive ? 'bg-red-500/20 shadow-neon-red' : 'bg-gray-700/50'}`}
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
          {/* Instant detection badge */}
          {isActive && isInstant && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-neon-red/20 border border-neon-red/50"
            >
              <Timer className="w-3 h-3 text-neon-red" />
              <span className="text-xs font-bold text-neon-red">0ms</span>
            </motion.div>
          )}
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
              className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 shadow-neon-red"
            >
              TRIGGERED
            </motion.span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Message Display with Inline Highlights */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Original Message</span>
            {isActive && patternSignatures.length > 0 && (
              <span className="text-xs text-neon-red">
                ({patternSignatures.length} pattern{patternSignatures.length > 1 ? 's' : ''} matched)
              </span>
            )}
          </div>
          <motion.div
            className={`
              p-4 rounded-lg font-mono text-sm leading-relaxed
              ${isActive
                ? 'bg-avenlo-obsidian border border-red-500/30'
                : 'bg-black/30 border border-avenlo-border/30'
              }
            `}
            initial={isActive ? { borderColor: 'rgba(255, 59, 59, 0.8)' } : {}}
            animate={isActive ? { borderColor: 'rgba(255, 59, 59, 0.3)' } : {}}
            transition={{ duration: 0.5 }}
          >
            {isActive ? (
              <HighlightedContent content={messageContent} patterns={patternSignatures} />
            ) : (
              <span className="text-gray-400">{messageContent}</span>
            )}
          </motion.div>
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
            background: 'radial-gradient(ellipse at center, rgba(255, 59, 59, 0.15) 0%, transparent 70%)',
          }}
        />
      )}
    </motion.div>
  );
}

