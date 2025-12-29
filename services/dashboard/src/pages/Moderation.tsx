import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Ban,
  Clock,
  MessageSquareOff,
  UserX,
  Eye,
  Search,
  CheckCircle,
} from 'lucide-react';

interface ModerationAction {
  id: string;
  type: 'warn' | 'mute' | 'kick' | 'ban' | 'unban';
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  moderator: {
    id: string;
    username: string;
  };
  reason: string;
  timestamp: string;
  duration?: string;
  aiDetected?: boolean;
}

const mockActions: ModerationAction[] = [
  {
    id: '1',
    type: 'ban',
    user: { id: '1', username: 'ToxicUser99' },
    moderator: { id: 'm1', username: 'Moderator' },
    reason: 'Repeated harassment and spam',
    timestamp: '2024-12-29T10:30:00',
    aiDetected: true,
  },
  {
    id: '2',
    type: 'mute',
    user: { id: '2', username: 'SpamBot123' },
    moderator: { id: 'ai', username: 'AI Moderation' },
    reason: 'Detected spam: 15 messages in 10 seconds',
    timestamp: '2024-12-29T09:45:00',
    duration: '1 hour',
    aiDetected: true,
  },
  {
    id: '3',
    type: 'warn',
    user: { id: '3', username: 'NewUser456' },
    moderator: { id: 'm2', username: 'SeniorMod' },
    reason: 'Inappropriate language in general chat',
    timestamp: '2024-12-29T08:20:00',
  },
  {
    id: '4',
    type: 'kick',
    user: { id: '4', username: 'RaidAccount' },
    moderator: { id: 'ai', username: 'AI Moderation' },
    reason: 'Raid detected: Account age < 1 hour',
    timestamp: '2024-12-28T23:15:00',
    aiDetected: true,
  },
  {
    id: '5',
    type: 'unban',
    user: { id: '5', username: 'ReformedUser' },
    moderator: { id: 'm1', username: 'Moderator' },
    reason: 'Appeal accepted after 30 days',
    timestamp: '2024-12-28T14:00:00',
  },
];

const actionConfig = {
  warn: { icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/20', label: 'Warning' },
  mute: { icon: MessageSquareOff, color: 'text-orange-400', bgColor: 'bg-orange-400/20', label: 'Mute' },
  kick: { icon: UserX, color: 'text-avenlo-pink', bgColor: 'bg-avenlo-pink/20', label: 'Kick' },
  ban: { icon: Ban, color: 'text-danger', bgColor: 'bg-danger/20', label: 'Ban' },
  unban: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'Unban' },
};

export default function Moderation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const stats = {
    totalActions: 156,
    aiDetected: 89,
    warnings: 45,
    mutes: 32,
    kicks: 18,
    bans: 12,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moderation</h1>
          <p className="text-gray-400 mt-1">AI-powered moderation with full history</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-warning/20 text-warning rounded-xl hover:bg-warning/30 transition-colors flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Warn User
          </button>
          <button className="px-4 py-2 bg-danger/20 text-danger rounded-xl hover:bg-danger/30 transition-colors flex items-center gap-2">
            <Ban className="w-4 h-4" />
            Ban User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Actions', value: stats.totalActions, icon: Shield, color: 'text-avenlo-cyan' },
          { label: 'AI Detected', value: stats.aiDetected, icon: Eye, color: 'text-avenlo-purple' },
          { label: 'Warnings', value: stats.warnings, icon: AlertTriangle, color: 'text-warning' },
          { label: 'Mutes', value: stats.mutes, icon: MessageSquareOff, color: 'text-orange-400' },
          { label: 'Kicks', value: stats.kicks, icon: UserX, color: 'text-avenlo-pink' },
          { label: 'Bans', value: stats.bans, icon: Ban, color: 'text-danger' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-card p-4 text-center"
          >
            <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* AI Moderation Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-avenlo-cyan to-avenlo-purple flex items-center justify-center">
              <Eye className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">AI Moderation Active</h3>
              <p className="text-gray-400 text-sm">GPT-4 analyzing all messages in real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">99.2%</p>
              <p className="text-xs text-gray-500">Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-avenlo-cyan">&lt;50ms</p>
              <p className="text-xs text-gray-500">Response Time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-avenlo-purple">12.5K</p>
              <p className="text-xs text-gray-500">Scanned Today</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-success pulse-dot" />
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by username or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input w-40"
          >
            <option value="all">All Types</option>
            <option value="warn">Warnings</option>
            <option value="mute">Mutes</option>
            <option value="kick">Kicks</option>
            <option value="ban">Bans</option>
          </select>
        </div>
      </div>

      {/* Actions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="divide-y divide-avenlo-border">
          {mockActions.map((action, index) => {
            const config = actionConfig[action.type];
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${config.bgColor}`}>
                    <config.icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      {action.aiDetected && (
                        <span className="badge bg-avenlo-purple/20 text-avenlo-purple">
                          🤖 AI Detected
                        </span>
                      )}
                      {action.duration && (
                        <span className="badge bg-white/5 text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {action.duration}
                        </span>
                      )}
                    </div>
                    <p className="font-medium">
                      <span className="text-avenlo-cyan">{action.user.username}</span>
                      <span className="text-gray-400"> by </span>
                      <span>{action.moderator.username}</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{action.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(action.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
