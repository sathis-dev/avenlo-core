// ====================================
// FORENSIC REPORT SHEET
// The Crime Scene Investigator (CSI) Panel
// Glassmorphic forensic deep-dive into infractions
// ====================================

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Hash,
  MessageCircle,
  Gavel,
  Flag,
  ChevronRight,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { Infraction, LAYER_COLORS, SEVERITY_COLORS } from '../../types/guardian';
import InfractionPulse from './InfractionPulse';
import SieveLayer from './SieveLayer';
import AnalystLayer from './AnalystLayer';
import VisionaryLayer from './VisionaryLayer';
import ReputationDelta from './ReputationDelta';

interface ForensicReportSheetProps {
  infraction: Infraction | null;
  isOpen: boolean;
  onClose: () => void;
  onAppeal?: (infractionId: string) => void;
  onOverride?: (infractionId: string, reason: string) => void;
}

/**
 * Context Message Display
 * Shows the sliding window of messages for context
 */
function ContextWindow({ messages }: { messages: Infraction['messageContext'] }) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          Context Window ({messages.length} messages)
        </span>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
        {messages.map((msg, i) => (
          <motion.div
            key={msg.messageId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-2 p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className={`
              w-1 h-full rounded-full self-stretch
              ${msg.sentiment > 0.3 ? 'bg-success' : msg.sentiment < -0.3 ? 'bg-danger' : 'bg-gray-600'}
            `} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-300">{msg.authorUsername}</span>
                <span className="text-xs text-gray-600">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-400 truncate">{msg.content}</p>
            </div>
            <div className={`
              text-xs px-1.5 py-0.5 rounded
              ${msg.sentiment > 0.3 ? 'bg-success/20 text-success' : 
                msg.sentiment < -0.3 ? 'bg-danger/20 text-danger' : 
                'bg-gray-700 text-gray-400'}
            `}>
              {msg.sentiment.toFixed(2)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Social Context Display
 * Shows environmental telemetry at time of infraction
 */
function SocialContextPanel({ context }: { context: Infraction['socialContext'] }) {
  const heatColor = context.channelHeat > 70 ? 'text-danger' : 
                    context.channelHeat > 40 ? 'text-warning' : 
                    'text-success';

  return (
    <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-black/20 border border-avenlo-border/20">
      <div className="text-center">
        <div className={`text-lg font-bold ${heatColor}`}>{context.channelHeat}%</div>
        <div className="text-xs text-gray-500">Heat</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-avenlo-cyan">{context.messageVelocity}</div>
        <div className="text-xs text-gray-500">msg/min</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-avenlo-purple">{context.activeUsers}</div>
        <div className="text-xs text-gray-500">Active</div>
      </div>
      <div className="text-center">
        <div className={`text-lg font-bold ${context.sentimentDelta > 0 ? 'text-success' : 'text-danger'}`}>
          {context.sentimentDelta > 0 ? '+' : ''}{context.sentimentDelta.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500">Δ Sentiment</div>
      </div>
    </div>
  );
}

/**
 * Appeal Section
 */
function AppealSection({ 
  appeal, 
  infractionId,
  onAppeal 
}: { 
  appeal: Infraction['appeal'];
  infractionId: string;
  onAppeal?: (id: string) => void;
}) {
  if (!appeal.appealed) {
    return (
      <div className="p-4 rounded-xl bg-gray-800/30 border border-avenlo-border/30">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">No appeal submitted</span>
          {onAppeal && (
            <button
              onClick={() => onAppeal(infractionId)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-avenlo-cyan/10 text-avenlo-cyan hover:bg-avenlo-cyan/20 transition-colors"
            >
              Mark as Appeal
            </button>
          )}
        </div>
      </div>
    );
  }

  const statusColors = {
    PENDING: 'bg-warning/20 text-warning',
    UPHELD: 'bg-danger/20 text-danger',
    OVERTURNED: 'bg-success/20 text-success',
    REDUCED: 'bg-info/20 text-info',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 rounded-xl bg-gray-800/30 border border-avenlo-border/30 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Appeal Status</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[appeal.appealDecision || 'PENDING']}`}>
          {appeal.appealDecision || 'PENDING'}
        </span>
      </div>
      {appeal.appealReason && (
        <div className="text-sm text-gray-300">{appeal.appealReason}</div>
      )}
      {appeal.reviewNotes && (
        <div className="p-2 rounded-lg bg-black/20 text-xs text-gray-400">
          <span className="text-gray-500">Staff notes:</span> {appeal.reviewNotes}
        </div>
      )}
      {appeal.reviewedBy && (
        <div className="text-xs text-gray-500">
          Reviewed by {appeal.reviewedBy} • {new Date(appeal.reviewedAt || '').toLocaleString()}
        </div>
      )}
    </motion.div>
  );
}

export default function ForensicReportSheet({
  infraction,
  isOpen,
  onClose,
  onAppeal,
  onOverride,
}: ForensicReportSheetProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyInfractionId = () => {
    if (infraction) {
      navigator.clipboard.writeText(infraction.infractionId);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && infraction && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl overflow-hidden"
          >
            {/* Glassmorphic Container */}
            <div className="h-full flex flex-col bg-[#050505]/95 backdrop-blur-xl border-l border-avenlo-border/30">
              {/* Header */}
              <div className="flex-shrink-0 p-6 border-b border-avenlo-border/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={`p-3 rounded-2xl ${SEVERITY_COLORS[infraction.severity].bg} ${SEVERITY_COLORS[infraction.severity].glow}`}
                      animate={{
                        boxShadow: [
                          SEVERITY_COLORS[infraction.severity].glow,
                          SEVERITY_COLORS[infraction.severity].glow.replace('0.4', '0.6'),
                          SEVERITY_COLORS[infraction.severity].glow,
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Gavel className={`w-6 h-6 ${SEVERITY_COLORS[infraction.severity].text}`} />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Crime Scene Report</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 font-mono">{infraction.infractionId}</span>
                        <button onClick={copyInfractionId} className="hover:text-avenlo-cyan transition-colors">
                          <Copy className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Infraction Pulse */}
                <InfractionPulse
                  severity={infraction.severity}
                  actionTaken={infraction.actionTaken}
                  timestamp={infraction.createdAt}
                  automated={infraction.automated}
                />
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* User & Location Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-avenlo-border/20">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-avenlo-cyan to-avenlo-purple flex items-center justify-center">
                      {infraction.userAvatar ? (
                        <img src={infraction.userAvatar} alt="" className="w-full h-full rounded-full" />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{infraction.username}</div>
                      <div className="text-xs text-gray-500 font-mono">{infraction.userId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-avenlo-border/20">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                      <Hash className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{infraction.channelName || 'Unknown Channel'}</div>
                      <div className="text-xs text-gray-500 font-mono">{infraction.channelId}</div>
                    </div>
                  </div>
                </div>

                {/* Social Context */}
                <SocialContextPanel context={infraction.socialContext} />

                {/* Detection Layers */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-avenlo-border to-transparent" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Detection Pipeline</span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-avenlo-border to-transparent" />
                  </div>

                  {/* Layer 1: Sieve */}
                  <SieveLayer
                    messageContent={infraction.messageContent}
                    patternSignatures={infraction.aiReasoning.patternSignatures}
                    processingTimeMs={infraction.aiReasoning.detectionLayer === 'SIEVE' ? infraction.aiReasoning.processingTimeMs : 0}
                    isActive={infraction.aiReasoning.detectionLayer === 'SIEVE'}
                  />

                  {/* Connection Line */}
                  <div className="flex justify-center">
                    <ChevronRight className="w-5 h-5 text-gray-600 rotate-90" />
                  </div>

                  {/* Layer 2: Analyst */}
                  <AnalystLayer
                    aiReasoning={infraction.aiReasoning}
                    isActive={infraction.aiReasoning.detectionLayer === 'ANALYST'}
                  />

                  {/* Connection Line */}
                  <div className="flex justify-center">
                    <ChevronRight className="w-5 h-5 text-gray-600 rotate-90" />
                  </div>

                  {/* Layer 3: Visionary */}
                  <VisionaryLayer
                    imageAnalysis={infraction.imageAnalysis}
                    attachmentUrls={infraction.attachmentUrls}
                    isActive={infraction.aiReasoning.detectionLayer === 'VISIONARY'}
                  />
                </div>

                {/* Context Window */}
                <ContextWindow messages={infraction.messageContext} />

                {/* Reputation Delta */}
                <ReputationDelta userHistory={infraction.userHistorySnapshot} />

                {/* Tags */}
                {infraction.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {infraction.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 rounded-lg text-xs bg-avenlo-purple/10 text-avenlo-purple">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Appeal Section */}
                <AppealSection
                  appeal={infraction.appeal}
                  infractionId={infraction.infractionId}
                  onAppeal={onAppeal}
                />

                {/* False Positive Indicator */}
                {infraction.confirmedFalsePositive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 p-4 rounded-xl bg-success/10 border border-success/30"
                  >
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-sm text-success">Confirmed False Positive</span>
                    {infraction.staffOverrideReason && (
                      <span className="text-xs text-gray-400 ml-2">— {infraction.staffOverrideReason}</span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex-shrink-0 p-4 border-t border-avenlo-border/30 bg-black/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`
                      px-2 py-1 rounded-lg text-xs
                      ${LAYER_COLORS[infraction.aiReasoning.detectionLayer].bg}
                      ${LAYER_COLORS[infraction.aiReasoning.detectionLayer].text}
                    `}>
                      {infraction.aiReasoning.detectionLayer}
                    </span>
                    <span className="text-xs text-gray-500">
                      Processed in {infraction.aiReasoning.processingTimeMs}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOverride && !infraction.confirmedFalsePositive && (
                      <button
                        onClick={() => onOverride(infraction.infractionId, 'Staff override')}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors flex items-center gap-2"
                      >
                        <Flag className="w-4 h-4" />
                        Mark False Positive
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-avenlo-cyan/10 text-avenlo-cyan hover:bg-avenlo-cyan/20 transition-colors"
                    >
                      Close Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
