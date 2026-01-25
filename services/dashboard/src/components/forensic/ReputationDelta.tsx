// ====================================
// REPUTATION DELTA COMPONENT
// Animated sparkline for shadow score changes
// Sovereign Tier: Interactive hover and impact ripple
// ====================================

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, TrendingUp, Shield, Clock, Award, AlertOctagon, Zap } from 'lucide-react';
import { UserHistorySnapshot } from '../../types/guardian';

interface ReputationDeltaProps {
  userHistory: UserHistorySnapshot;
  reputationBefore?: number;
  reputationAfter?: number;
}

/**
 * Generate sparkline points for reputation visualization
 */
function generateSparklinePoints(
  before: number,
  after: number,
  width: number,
  height: number,
  padding: number = 8
): string {
  // Generate a path that shows the drop
  const startY = height - padding - ((before / 100) * (height - padding * 2));
  const endY = height - padding - ((after / 100) * (height - padding * 2));

  // Create a curved path with some intermediate points
  const midX = width / 2;
  const controlX1 = width * 0.3;
  const controlX2 = width * 0.7;

  // Add some natural variance
  const variance = Math.abs(before - after) * 0.3;
  const midY = (startY + endY) / 2 + variance;

  return `M ${padding} ${startY} C ${controlX1} ${startY}, ${midX - 20} ${midY}, ${midX} ${midY} S ${controlX2} ${endY}, ${width - padding} ${endY}`;
}

/**
 * Reputation Gauge
 */
function ReputationGauge({ score, label }: { score: number; label: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-success';
    if (s >= 60) return 'text-avenlo-cyan';
    if (s >= 40) return 'text-warning';
    if (s >= 20) return 'text-orange-400';
    return 'text-danger';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-success';
    if (s >= 60) return 'bg-avenlo-cyan';
    if (s >= 40) return 'bg-warning';
    if (s >= 20) return 'bg-orange-400';
    return 'bg-danger';
  };

  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-2">
        {/* Background ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(45, 45, 68, 0.5)"
            strokeWidth="4"
          />
          <motion.circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            className={getBgColor(score).replace('bg-', 'stroke-')}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 176} 176`}
            initial={{ strokeDasharray: '0 176' }}
            animate={{ strokeDasharray: `${(score / 100) * 176} 176` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        {/* Score */}
        <div className={`absolute inset-0 flex items-center justify-center ${getScoreColor(score)}`}>
          <span className="text-lg font-bold">{score}</span>
        </div>
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

/**
 * History Stat
 */
function HistoryStat({
  icon: Icon,
  label,
  value,
  subtext,
  highlight
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-xl
      ${highlight ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-black/20'}
    `}>
      <div className={`p-2 rounded-lg ${highlight ? 'bg-orange-500/20' : 'bg-gray-800/50'}`}>
        <Icon className={`w-4 h-4 ${highlight ? 'text-orange-400' : 'text-gray-500'}`} />
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-400">{label}</div>
        <div className={`text-sm font-semibold ${highlight ? 'text-orange-400' : 'text-white'}`}>
          {value}
        </div>
        {subtext && <div className="text-xs text-gray-600">{subtext}</div>}
      </div>
    </div>
  );
}

export default function ReputationDelta({
  userHistory,
  reputationBefore = userHistory.reputationScore + 15,
  reputationAfter = userHistory.reputationScore,
}: ReputationDeltaProps) {
  const delta = reputationAfter - reputationBefore;
  const isNegative = delta < 0;
  const isSevere = Math.abs(delta) >= 10;
  const [isHovered, setIsHovered] = useState(false);

  // Generate sparkline
  const sparklinePath = useMemo(() => {
    return generateSparklinePoints(reputationBefore, reputationAfter, 200, 60);
  }, [reputationBefore, reputationAfter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`forensic-layer rounded-xl border ${isNegative && isSevere ? 'border-danger/50' : 'border-avenlo-border/30'} bg-avenlo-card/30 overflow-hidden`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-avenlo-border/30">
        <div className="flex items-center gap-3">
          <motion.div
            className={`p-2 rounded-lg ${isNegative ? 'bg-danger/20' : 'bg-success/20'} ${isNegative && isSevere ? 'shadow-neon-red' : ''}`}
            animate={isNegative && isSevere ? {
              boxShadow: [
                '0 0 5px rgba(239, 68, 68, 0.3)',
                '0 0 15px rgba(239, 68, 68, 0.5)',
                '0 0 5px rgba(239, 68, 68, 0.3)',
              ],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {isNegative ? (
              <TrendingDown className="w-4 h-4 text-danger" />
            ) : (
              <TrendingUp className="w-4 h-4 text-success" />
            )}
          </motion.div>
          <div>
            <h4 className="font-semibold text-white flex items-center gap-2">
              Reputation Delta
              {isNegative && isSevere && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-danger/20 text-danger"
                >
                  <Zap className="w-3 h-3" />
                  IMPACT
                </motion.span>
              )}
            </h4>
            <p className="text-xs text-gray-500">Shadow Score Impact Analysis</p>
          </div>
        </div>

        {/* Delta Badge with impact ripple */}
        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`
              px-3 py-1.5 rounded-xl font-mono font-bold text-lg relative z-10
              ${isNegative ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}
              ${isSevere ? (isNegative ? 'shadow-neon-red' : 'shadow-neon-cyan') : ''}
            `}
          >
            {delta > 0 ? '+' : ''}{delta}
          </motion.div>

          {/* Impact ripple for severe negative deltas */}
          {isNegative && isSevere && (
            <motion.div
              className="absolute inset-0 rounded-xl border border-danger"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Sparkline Visualization */}
        <div className="flex items-center gap-4">
          <ReputationGauge score={reputationBefore} label="Before" />

          {/* Sparkline */}
          <div className="flex-1 h-16 relative">
            <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
              {/* Gradient definition */}
              <defs>
                <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isNegative ? '#10B981' : '#EF4444'} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={isNegative ? '#EF4444' : '#10B981'} stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isNegative ? '#EF4444' : '#10B981'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isNegative ? '#EF4444' : '#10B981'} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[20, 40, 60, 80].map(y => (
                <line
                  key={y}
                  x1="0"
                  y1={60 - (y / 100) * 44 - 8}
                  x2="200"
                  y2={60 - (y / 100) * 44 - 8}
                  stroke="rgba(45, 45, 68, 0.3)"
                  strokeDasharray="2 4"
                />
              ))}

              {/* Sparkline path */}
              <motion.path
                d={sparklinePath}
                fill="none"
                stroke="url(#sparklineGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />

              {/* End dot */}
              <motion.circle
                cx="192"
                cy={60 - 8 - ((reputationAfter / 100) * 44)}
                r="4"
                fill={isNegative ? '#EF4444' : '#10B981'}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.3 }}
              />
            </svg>

            {/* Arrow indicator */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <span className={`text-2xl ${isNegative ? 'text-danger' : 'text-success'}`}>
                {isNegative ? '↘' : '↗'}
              </span>
            </motion.div>
          </div>

          <ReputationGauge score={reputationAfter} label="After" />
        </div>

        {/* User History Stats */}
        <div className="grid grid-cols-2 gap-3">
          <HistoryStat
            icon={Clock}
            label="Account Age"
            value={`${userHistory.accountAgeDays} days`}
            subtext={userHistory.accountAgeDays < 7 ? 'New account' : undefined}
            highlight={userHistory.accountAgeDays < 7}
          />
          <HistoryStat
            icon={Shield}
            label="Server Tenure"
            value={`${userHistory.serverTenureDays} days`}
            subtext={userHistory.serverTenureDays < 3 ? 'Very new member' : undefined}
            highlight={userHistory.serverTenureDays < 3}
          />
          <HistoryStat
            icon={AlertOctagon}
            label="Previous Infractions"
            value={userHistory.previousInfractions}
            highlight={userHistory.previousInfractions > 2}
          />
          <HistoryStat
            icon={Award}
            label="Positive Contributions"
            value={userHistory.positiveContributions}
          />
        </div>

        {/* Elevated Observation Warning */}
        {userHistory.wasElevatedObservation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30"
          >
            <AlertOctagon className="w-5 h-5 text-orange-400" />
            <span className="text-sm text-orange-400">
              User was under Elevated Observation at time of infraction
            </span>
          </motion.div>
        )}

        {/* Roles */}
        {userHistory.roles.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Roles at Time</span>
            <div className="flex flex-wrap gap-2">
              {userHistory.roles.slice(0, 5).map((role, i) => (
                <span key={i} className="px-2 py-1 rounded-full text-xs bg-gray-800/50 text-gray-400">
                  {role}
                </span>
              ))}
              {userHistory.roles.length > 5 && (
                <span className="px-2 py-1 rounded-full text-xs bg-gray-800/50 text-gray-500">
                  +{userHistory.roles.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
