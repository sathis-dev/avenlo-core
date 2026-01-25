// ====================================
// INFRACTION PULSE COMPONENT
// Glowing status badge with severity state
// ====================================

import { motion } from 'framer-motion';
import { AlertTriangle, Ban, Clock, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-between"
    >
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <motion.div
          className={`relative p-3 rounded-2xl ${colors.bg} ${colors.glow}`}
          animate={{
            boxShadow: [
              colors.glow,
              colors.glow.replace('0.4', '0.6').replace('0.5', '0.7'),
              colors.glow,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ActionIcon className={`w-6 h-6 ${colors.text}`} />
          
          {/* Pulse ring */}
          <motion.div
            className={`absolute inset-0 rounded-2xl border-2 ${colors.text.replace('text', 'border')}`}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
        </motion.div>

        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${colors.text}`}>
              {formatAction(actionTaken)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
              {severity}
            </span>
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

      {/* Timestamp */}
      <div className="text-right">
        <div className="text-xs text-gray-500 font-mono">
          {new Date(timestamp).toLocaleString()}
        </div>
        <div className="flex items-center justify-end gap-1 mt-1">
          <motion.div
            className={`w-2 h-2 rounded-full ${colors.bg.replace('/20', '')}`}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-xs text-gray-400">Active</span>
        </div>
      </div>
    </motion.div>
  );
}
