import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TicketData {
  id: string;
  number: string;
  userId: string;
  userName: string;
  status: string;
  subject: string;
  createdAt: string;
  closedAt?: string;
}

const statusConfig: Record<string, any> = {
  open: { icon: AlertCircle, color: 'text-warning', bgColor: 'bg-warning/20', label: 'Open' },
  in_progress: { icon: Clock, color: 'text-info', bgColor: 'bg-info/20', label: 'In Progress' },
  resolved: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'Resolved' },
  closed: { icon: XCircle, color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Closed' },
};

export default function Tickets() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTickets = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch('/api/tickets', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // LIVE SYNC - refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchTickets(false), 15000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.number.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    return matchesSearch && matchesStatus;
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
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-gray-400 mt-1">
            {tickets.length} total tickets • Updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </p>
        </div>
        <button onClick={() => fetchTickets(true)} disabled={refreshing} className="btn-icon">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        Live sync enabled - updates every 15s
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-gray-400 text-sm">Total Tickets</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
          <div className="text-2xl font-bold text-warning">{stats.open}</div>
          <div className="text-gray-400 text-sm">Open</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4">
          <div className="text-2xl font-bold text-info">{stats.inProgress}</div>
          <div className="text-gray-400 text-sm">In Progress</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
          <div className="text-2xl font-bold text-success">{stats.resolved}</div>
          <div className="text-gray-400 text-sm">Resolved</div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input w-40">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-avenlo-border">
            {filteredTickets.map((ticket, index) => {
              const config = statusConfig[ticket.status] || statusConfig.open;
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-500">#{ticket.number}</span>
                          <span className="font-medium">{ticket.subject}</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          by {ticket.userName} • {new Date(ticket.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${config.bgColor} ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div className="px-6 py-4 border-t border-avenlo-border">
          <p className="text-sm text-gray-500">Showing {filteredTickets.length} of {tickets.length} tickets (from MongoDB)</p>
        </div>
      </motion.div>
    </div>
  );
}
