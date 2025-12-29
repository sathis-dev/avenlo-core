import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  Ticket,
  Shield,
  MessageSquare,
  UserPlus,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
} from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import StatsChart from '../components/StatsChart';
import ActivityFeed from '../components/ActivityFeed';
import QuickActions from '../components/QuickActions';

export default function Dashboard() {
  const { stats, isLoading, fetchStats } = useDashboardStore();

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers.toLocaleString(),
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'from-avenlo-cyan to-blue-500',
      bgColor: 'bg-avenlo-cyan/10',
    },
    {
      title: 'Online Now',
      value: stats.onlineMembers.toLocaleString(),
      change: `${Math.round((stats.onlineMembers / Math.max(stats.totalMembers, 1)) * 100)}%`,
      trend: 'up',
      icon: UserCheck,
      color: 'from-success to-emerald-400',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Open Tickets',
      value: stats.openTickets.toString(),
      subtext: `${stats.totalTickets} total`,
      icon: Ticket,
      color: 'from-avenlo-purple to-violet-400',
      bgColor: 'bg-avenlo-purple/10',
    },
    {
      title: 'Mod Actions',
      value: stats.moderationActions.toString(),
      change: '-8%',
      trend: 'down',
      icon: Shield,
      color: 'from-warning to-orange-400',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Messages/Day',
      value: stats.messagesPerDay.toLocaleString(),
      change: '+5%',
      trend: 'up',
      icon: MessageSquare,
      color: 'from-avenlo-pink to-rose-400',
      bgColor: 'bg-avenlo-pink/10',
    },
    {
      title: 'New Today',
      value: stats.newMembersToday.toString(),
      subtext: 'new members',
      icon: UserPlus,
      color: 'from-info to-sky-400',
      bgColor: 'bg-info/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-avenlo-border border-t-avenlo-cyan rounded-full animate-spin" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Last updated: Just now</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card-hover p-6 relative overflow-hidden group"
          >
            {/* Background glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bgColor} rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity`} />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} style={{ color: 'currentColor' }} />
                </div>
                {stat.change && (
                  <div className={`flex items-center gap-1 text-sm ${stat.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {stat.change}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm text-gray-400 mb-1">{stat.title}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stat.value}</span>
                  {stat.subtext && (
                    <span className="text-sm text-gray-500">{stat.subtext}</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Server Activity</h2>
              <p className="text-sm text-gray-400">Messages and joins over time</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm bg-avenlo-cyan/20 text-avenlo-cyan rounded-lg">
                7D
              </button>
              <button className="px-3 py-1 text-sm text-gray-400 hover:bg-white/5 rounded-lg transition-colors">
                30D
              </button>
              <button className="px-3 py-1 text-sm text-gray-400 hover:bg-white/5 rounded-lg transition-colors">
                90D
              </button>
            </div>
          </div>
          <StatsChart />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-avenlo-cyan" />
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <QuickActions />
        </motion.div>
      </div>

      {/* Activity Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-avenlo-cyan" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <button className="text-sm text-avenlo-cyan hover:underline">View all</button>
        </div>
        <ActivityFeed />
      </motion.div>
    </div>
  );
}
