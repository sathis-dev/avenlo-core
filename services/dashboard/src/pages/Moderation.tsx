import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Ban,
  Clock,
  MessageSquareOff,
  UserX,
  Search,
  CheckCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ModerationAction {
  id: string;
  action: string;
  targetId: string;
  targetName: string;
  moderatorId: string;
  moderatorName: string;
  reason: string;
  timestamp: string;
}

const actionConfig: Record<string, any> = {
  warn: { icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/20', label: 'Warning' },
  mute: { icon: MessageSquareOff, color: 'text-orange-400', bgColor: 'bg-orange-400/20', label: 'Mute' },
  kick: { icon: UserX, color: 'text-avenlo-pink', bgColor: 'bg-avenlo-pink/20', label: 'Kick' },
  ban: { icon: Ban, color: 'text-danger', bgColor: 'bg-danger/20', label: 'Ban' },
  unban: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'Unban' },
  timeout: { icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-400/20', label: 'Timeout' },
};

export default function Moderation() {
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchActions = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch('/api/moderation/actions', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch actions:', error);
      toast.error('Failed to load moderation actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // LIVE SYNC - refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchActions(false), 10000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  const stats = {
    total: actions.length,
    warns: actions.filter(a => a.action === 'warn').length,
    mutes: actions.filter(a => a.action === 'mute' || a.action === 'timeout').length,
    kicks: actions.filter(a => a.action === 'kick').length,
    bans: actions.filter(a => a.action === 'ban').length,
  };

  const filteredActions = actions.filter((action) => {
    const matchesSearch = 
      action.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.moderatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || action.action === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-avenlo-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moderation</h1>
          <p className="text-gray-400 mt-1">
            {actions.length} actions • Updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </p>
        </div>
        <button onClick={() => fetchActions(true)} disabled={refreshing} className="btn-icon">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        Live sync enabled - updates every 10s
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
          <Shield className="w-6 h-6 text-avenlo-cyan mb-2" />
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-gray-400 text-sm">Total Actions</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
          <AlertTriangle className="w-6 h-6 text-warning mb-2" />
          <div className="text-2xl font-bold">{stats.warns}</div>
          <div className="text-gray-400 text-sm">Warnings</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4">
          <MessageSquareOff className="w-6 h-6 text-orange-400 mb-2" />
          <div className="text-2xl font-bold">{stats.mutes}</div>
          <div className="text-gray-400 text-sm">Mutes</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
          <UserX className="w-6 h-6 text-avenlo-pink mb-2" />
          <div className="text-2xl font-bold">{stats.kicks}</div>
          <div className="text-gray-400 text-sm">Kicks</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-4">
          <Ban className="w-6 h-6 text-danger mb-2" />
          <div className="text-2xl font-bold">{stats.bans}</div>
          <div className="text-gray-400 text-sm">Bans</div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input w-40">
            <option value="all">All Types</option>
            <option value="warn">Warnings</option>
            <option value="mute">Mutes</option>
            <option value="kick">Kicks</option>
            <option value="ban">Bans</option>
          </select>
        </div>
      </div>

      {/* Actions List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        {filteredActions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No moderation actions found</p>
          </div>
        ) : (
          <div className="divide-y divide-avenlo-border">
            {filteredActions.map((action, index) => {
              const config = actionConfig[action.action] || actionConfig.warn;
              const ActionIcon = config.icon;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <ActionIcon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${config.bgColor} ${config.color}`}>{config.label}</span>
                        <span className="font-medium">{action.targetName}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{action.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>by {action.moderatorName}</span>
                        <span>{new Date(action.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div className="px-6 py-4 border-t border-avenlo-border">
          <p className="text-sm text-gray-500">Showing {filteredActions.length} of {actions.length} actions (from MongoDB)</p>
        </div>
      </motion.div>
    </div>
  );
}
