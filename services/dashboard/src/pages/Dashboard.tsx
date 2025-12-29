import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  Ticket,
  Shield,
  MessageSquare,
  UserPlus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import StatsChart from '../components/StatsChart';
import ActivityFeed from '../components/ActivityFeed';
import QuickActions from '../components/QuickActions';

interface DashboardStats {
  totalMembers: number;
  onlineMembers: number;
  totalTickets: number;
  openTickets: number;
  moderationActions: number;
  messagesPerDay: number;
  newMembersToday: number;
  activeProjects: number;
}

interface Activity {
  id: string;
  type: string;
  user: { id: string; username: string; avatar: string };
  action: string;
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch('/api/dashboard/stats', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setActivity(data.activity || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // LIVE SYNC - refresh every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchDashboard(false), 20000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-avenlo-cyan" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Members',
      value: stats.totalMembers.toLocaleString(),
      icon: Users,
      trend: null,
      color: 'from-avenlo-cyan/20 to-avenlo-cyan/5',
      iconColor: 'text-avenlo-cyan',
    },
    {
      label: 'Online Now',
      value: stats.onlineMembers.toLocaleString(),
      icon: UserCheck,
      trend: null,
      color: 'from-success/20 to-success/5',
      iconColor: 'text-success',
    },
    {
      label: 'Open Tickets',
      value: stats.openTickets.toString(),
      icon: Ticket,
      subtext: `${stats.totalTickets} total`,
      color: 'from-avenlo-purple/20 to-avenlo-purple/5',
      iconColor: 'text-avenlo-purple',
    },
    {
      label: 'Mod Actions',
      value: stats.moderationActions.toString(),
      icon: Shield,
      trend: null,
      color: 'from-warning/20 to-warning/5',
      iconColor: 'text-warning',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Live sync
          </div>
          <span className="text-sm text-gray-500">
            Updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </span>
          <button onClick={() => fetchDashboard(true)} disabled={refreshing} className="btn-icon">
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`glass-card p-6 bg-gradient-to-br ${stat.color}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
                {stat.subtext && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                )}
              </div>
              <div className={`p-3 rounded-xl bg-avenlo-dark/50`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StatsChart />
        </div>
        <QuickActions />
      </div>

      {/* Activity Feed */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-avenlo-cyan" />
            Recent Activity
          </h3>
          <span className="text-xs text-gray-500">From MongoDB (live)</span>
        </div>
        {activity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activity.slice(0, 10).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-avenlo-dark/30 hover:bg-avenlo-dark/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-avenlo-cyan to-avenlo-purple flex items-center justify-center text-xs font-bold">
                  {item.user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.user.username}</span>{' '}
                    <span className="text-gray-400">{item.action}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
