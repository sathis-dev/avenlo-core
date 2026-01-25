// ====================================
// INFRACTION PULSE COMPONENT
// Glowing status badge with severity state
// Sovereign Tier: Enhanced neon indicators
// ====================================

import { motion } from 'framer-motion';
import { AlertTriangle, Ban, Clock, Shield, ShieldAlert, ShieldCheck, Radio } from 'lucide-react';
import { InfractionSeverity, ModActionTaken, SEVERITY_COLORS } from '../../types/guardian';

interface InfractionPulseProps {
  severity: InfractionSeverity;
  actionTaken: ModActionTaken;
  timestamp: string;
  automated: boolean;
}

/**
 * Get the appropriate icon for the action taken
 */
function getActionIcon(action: ModActionTaken) {
  switch (action) {
    case 'BAN':
      return Ban;
    case 'KICK':
    case 'TIMEOUT_24H':
    case 'TIMEOUT_1H':
    case 'TIMEOUT_30M':
    case 'TIMEOUT_5M':
      return Clock;
    case 'WARNING':
      return AlertTriangle;
    case 'LOCKDOWN':
      return ShieldAlert;
    case 'MESSAGE_DELETE':
      return Shield;
    default:
      return ShieldCheck;
  }
}

/**
 * Get neon shadow class based on severity
 */
function getNeonShadow(severity: InfractionSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'shadow-neon-red';
    case 'HIGH':
      return 'shadow-neon-amber';
    case 'MEDIUM':
      return 'shadow-neon-amber';
    case 'LOW':
      return 'shadow-neon-cyan';
    default:
      return '';
  }
}

/**
 * Format the action for display
 */
function formatAction(action: ModActionTaken): string {
  switch (action) {
    case 'TIMEOUT_5M': return '5m Timeout';
    case 'TIMEOUT_30M': return '30m Timeout';
    case 'TIMEOUT_1H': return '1h Timeout';
    case 'TIMEOUT_24H': return '24h Timeout';
    case 'MESSAGE_DELETE': return 'Deleted';
    default: return action.replace('_', ' ');
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function InfractionPulse({
  severity,
  actionTaken,
  timestamp,
  automated,
}: InfractionPulseProps) {
  const colors = SEVERITY_COLORS[severity];
  const ActionIcon = getActionIcon(actionTaken);
  const neonShadow = getNeonShadow(severity);
  const isCritical = severity === 'CRITICAL' || severity === 'HIGH';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-between"
    >
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <motion.div
          className={`relative p-3 rounded-2xl ${colors.bg} ${neonShadow}`}
          animate={isCritical ? {
            boxShadow: [
              '0 0 10px rgba(255, 59, 59, 0.5), 0 0 20px rgba(255, 59, 59, 0.3)',
              '0 0 20px rgba(255, 59, 59, 0.7), 0 0 40px rgba(255, 59, 59, 0.5), 0 0 60px rgba(255, 59, 59, 0.3)',
              '0 0 10px rgba(255, 59, 59, 0.5), 0 0 20px rgba(255, 59, 59, 0.3)',
            ],
          } : {
            boxShadow: [
              colors.glow,
              colors.glow.replace('0.4', '0.6').replace('0.5', '0.7'),
              colors.glow,
            ],
          }}
          transition={{ duration: isCritical ? 1.5 : 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ActionIcon className={`w-6 h-6 ${colors.text}`} />

          {/* Pulse ring */}
          <motion.div
            className={`absolute inset-0 rounded-2xl border-2 ${colors.text.replace('text', 'border')}`}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: isCritical ? 1 : 1.5, repeat: Infinity, ease: 'easeOut' }}
          />

          {/* Secondary pulse for critical */}
          {isCritical && (
            <motion.div
              className="absolute inset-0 rounded-2xl border border-neon-red"
              initial={{ opacity: 0.4, scale: 1 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
            />
          )}
        </motion.div>

        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${colors.text}`}>
              {formatAction(actionTaken)}
            </span>
            <motion.span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
              animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {severity}
            </motion.span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{formatRelativeTime(timestamp)}</span>
            <span className="text-gray-600">•</span>
            <span className={automated ? 'text-avenlo-cyan' : 'text-avenlo-purple'}>
              {automated ? 'AI Automated' : 'Staff Action'}
            </span>
          </div>
        </div>
      </div>

      {/* Timestamp & Live Indicator */}
      <div className="text-right">
        <div className="text-xs text-gray-500 font-mono">
          {new Date(timestamp).toLocaleString()}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          {/* Live indicator with breathing animation */}
          <motion.div
            className="flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className={`w-2 h-2 rounded-full ${isCritical ? 'bg-neon-red' : 'bg-neon-green'}`}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.6, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <Radio className={`w-3 h-3 ${isCritical ? 'text-neon-red' : 'text-gray-500'}`} />
          </motion.div>
          <span className={`text-xs ${isCritical ? 'text-neon-red font-medium' : 'text-gray-400'}`}>
            {isCritical ? 'LIVE' : 'Active'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

