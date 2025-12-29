import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

interface TicketData {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  creator: {
    id: string;
    username: string;
    avatar?: string;
  };
  assignee?: {
    id: string;
    username: string;
  };
  createdAt: string;
  lastActivity: string;
  messageCount: number;
}

const mockTickets: TicketData[] = [
  {
    id: '1',
    ticketId: '#0042',
    subject: 'Payment issue with project',
    category: 'Billing',
    status: 'open',
    priority: 'high',
    creator: { id: '1', username: 'ClientPro' },
    createdAt: '2024-12-29T08:30:00',
    lastActivity: '10 minutes ago',
    messageCount: 5,
  },
  {
    id: '2',
    ticketId: '#0041',
    subject: 'Need help with API integration',
    category: 'Technical',
    status: 'in_progress',
    priority: 'medium',
    creator: { id: '2', username: 'DevUser' },
    assignee: { id: 'a1', username: 'SeniorDev' },
    createdAt: '2024-12-28T14:20:00',
    lastActivity: '2 hours ago',
    messageCount: 12,
  },
  {
    id: '3',
    ticketId: '#0040',
    subject: 'Feature request: Dark mode',
    category: 'Feature Request',
    status: 'resolved',
    priority: 'low',
    creator: { id: '3', username: 'NiceUser' },
    assignee: { id: 'a2', username: 'Developer' },
    createdAt: '2024-12-27T10:00:00',
    lastActivity: '1 day ago',
    messageCount: 8,
  },
  {
    id: '4',
    ticketId: '#0039',
    subject: 'Urgent: Server downtime',
    category: 'Technical',
    status: 'closed',
    priority: 'urgent',
    creator: { id: '4', username: 'CriticalClient' },
    assignee: { id: 'a1', username: 'SeniorDev' },
    createdAt: '2024-12-26T22:45:00',
    lastActivity: '2 days ago',
    messageCount: 24,
  },
];

const statusConfig = {
  open: { icon: AlertCircle, color: 'text-warning', bgColor: 'bg-warning/20', label: 'Open' },
  in_progress: { icon: Clock, color: 'text-info', bgColor: 'bg-info/20', label: 'In Progress' },
  resolved: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'Resolved' },
  closed: { icon: XCircle, color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Closed' },
};

const priorityConfig = {
  low: { color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  medium: { color: 'text-info', bgColor: 'bg-info/20' },
  high: { color: 'text-warning', bgColor: 'bg-warning/20' },
  urgent: { color: 'text-danger', bgColor: 'bg-danger/20' },
};

export default function Tickets() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const stats = {
    total: 156,
    open: 12,
    inProgress: 8,
    resolved: 136,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-gray-400 mt-1">Manage support tickets and requests</p>
        </div>
        <button className="btn-glow flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tickets', value: stats.total, icon: Ticket, color: 'text-avenlo-cyan', bg: 'bg-avenlo-cyan/10' },
          { label: 'Open', value: stats.open, icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card-hover p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
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
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-40"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button className="btn-icon">
              <Filter className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="divide-y divide-avenlo-border">
          {mockTickets.map((ticket, index) => {
            const status = statusConfig[ticket.status];
            const priority = priorityConfig[ticket.priority];
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${status.bgColor}`}>
                    <status.icon className={`w-5 h-5 ${status.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-avenlo-cyan font-mono text-sm">{ticket.ticketId}</span>
                      <span className={`badge ${status.bgColor} ${status.color}`}>
                        {status.label}
                      </span>
                      <span className={`badge ${priority.bgColor} ${priority.color} capitalize`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ticket.creator.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {ticket.messageCount} messages
                      </span>
                      <span>{ticket.lastActivity}</span>
                    </div>
                  </div>

                  {ticket.assignee && (
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-avenlo-dark rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-avenlo-purple to-avenlo-pink flex items-center justify-center text-xs font-bold">
                        {ticket.assignee.username.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-400">{ticket.assignee.username}</span>
                    </div>
                  )}

                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-avenlo-cyan group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
