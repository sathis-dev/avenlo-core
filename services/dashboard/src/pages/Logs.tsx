import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText,
  Search,
  Download,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle,
  Terminal,
  Shield,
  Users,
  Settings,
  Zap,
} from 'lucide-react';

interface LogEntry {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const mockLogs: LogEntry[] = [
  {
    id: '1',
    level: 'success',
    source: 'Gateway',
    message: 'Bot connected successfully - Avenlo Core#6596',
    timestamp: '2024-12-29T10:30:15.234Z',
  },
  {
    id: '2',
    level: 'info',
    source: 'AI Moderation',
    message: 'Analyzed 150 messages in the last minute',
    timestamp: '2024-12-29T10:30:00.000Z',
  },
  {
    id: '3',
    level: 'warning',
    source: 'Rate Limiter',
    message: 'User SpamBot123 approaching rate limit (48/50 requests)',
    timestamp: '2024-12-29T10:29:45.123Z',
  },
  {
    id: '4',
    level: 'error',
    source: 'Database',
    message: 'Connection timeout - retrying in 5 seconds',
    timestamp: '2024-12-29T10:29:30.456Z',
  },
  {
    id: '5',
    level: 'info',
    source: 'Ticket System',
    message: 'New ticket #0042 created by ClientPro',
    timestamp: '2024-12-29T10:28:00.000Z',
  },
  {
    id: '6',
    level: 'success',
    source: 'Welcome System',
    message: 'Welcomed new member: CoolUser123',
    timestamp: '2024-12-29T10:27:30.789Z',
  },
  {
    id: '7',
    level: 'warning',
    source: 'Server Protection',
    message: 'Elevated join rate detected (8 joins/minute)',
    timestamp: '2024-12-29T10:25:00.000Z',
  },
  {
    id: '8',
    level: 'info',
    source: 'Role Manager',
    message: 'Auto-assigned Contributor role to NewUser456',
    timestamp: '2024-12-29T10:24:00.000Z',
  },
];

const levelConfig = {
  info: { icon: Info, color: 'text-info', bgColor: 'bg-info/20', label: 'INFO' },
  warning: { icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/20', label: 'WARN' },
  error: { icon: AlertCircle, color: 'text-danger', bgColor: 'bg-danger/20', label: 'ERROR' },
  success: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'OK' },
};

const sourceIcons: Record<string, typeof Terminal> = {
  Gateway: Zap,
  'AI Moderation': Shield,
  'Rate Limiter': AlertTriangle,
  Database: Terminal,
  'Ticket System': ScrollText,
  'Welcome System': Users,
  'Server Protection': Shield,
  'Role Manager': Settings,
};

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSource, setFilterSource] = useState('all');

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSource = filterSource === 'all' || log.source === filterSource;
    return matchesSearch && matchesLevel && matchesSource;
  });

  const sources = [...new Set(mockLogs.map((log) => log.source))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Logs</h1>
          <p className="text-gray-400 mt-1">Real-time bot activity and events</p>
        </div>
        <button className="px-4 py-2 bg-avenlo-card border border-avenlo-border rounded-xl hover:border-avenlo-cyan/50 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: '12,456', level: 'info' },
          { label: 'Warnings', value: '234', level: 'warning' },
          { label: 'Errors', value: '12', level: 'error' },
          { label: 'Success', value: '11,890', level: 'success' },
        ].map((stat, index) => {
          const config = levelConfig[stat.level as keyof typeof levelConfig];
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <config.icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12 font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="input w-32"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="success">Success</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="input w-40"
            >
              <option value="all">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="bg-avenlo-dark/50 px-4 py-2 border-b border-avenlo-border flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400 font-mono">Live Logs</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
            <span className="text-xs text-gray-500">Connected</span>
          </div>
        </div>

        <div className="divide-y divide-avenlo-border/50 max-h-[600px] overflow-y-auto font-mono text-sm">
          {filteredLogs.map((log, index) => {
            const config = levelConfig[log.level];
            const SourceIcon = sourceIcons[log.source] || Terminal;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Timestamp */}
                  <span className="text-gray-600 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>

                  {/* Level */}
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.bgColor} ${config.color}`}>
                    {config.label}
                  </span>

                  {/* Source */}
                  <div className="flex items-center gap-1 text-gray-500 min-w-[120px]">
                    <SourceIcon className="w-3 h-3" />
                    <span>{log.source}</span>
                  </div>

                  {/* Message */}
                  <span className="text-gray-300 flex-1">{log.message}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
