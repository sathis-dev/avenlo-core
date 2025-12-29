import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Analytics() {
  // Member Growth Chart
  const memberGrowthData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Members',
        data: [120, 145, 180, 220, 265, 310, 380, 420, 490, 580, 650, 720],
        borderColor: '#00D4FF',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Activity by Hour
  const activityByHourData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Messages',
        data: [12, 8, 5, 3, 2, 4, 15, 45, 78, 92, 105, 98, 110, 95, 88, 102, 115, 125, 98, 76, 54, 38, 28, 18],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  // Role Distribution
  const roleDistributionData = {
    labels: ['Members', 'Contributors', 'Developers', 'Moderators', 'Admins'],
    datasets: [
      {
        data: [450, 150, 80, 15, 5],
        backgroundColor: [
          'rgba(107, 114, 128, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1A1A2E',
        titleColor: '#fff',
        bodyColor: '#9CA3AF',
        borderColor: '#2D2D44',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6B7280' },
      },
      y: {
        grid: { color: 'rgba(45, 45, 68, 0.5)' },
        ticks: { color: '#6B7280' },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#9CA3AF',
          usePointStyle: true,
          padding: 20,
        },
      },
    },
    cutout: '60%',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-gray-400 mt-1">Server insights and statistics</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-avenlo-card rounded-xl border border-avenlo-border">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Last 30 days</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Members', value: '720', change: '+12%', trend: 'up', icon: Users, color: 'from-avenlo-cyan to-blue-500' },
          { label: 'Messages/Day', value: '2.4K', change: '+8%', trend: 'up', icon: MessageSquare, color: 'from-avenlo-purple to-violet-500' },
          { label: 'Avg. Session', value: '24m', change: '+5%', trend: 'up', icon: BarChart3, color: 'from-success to-emerald-500' },
          { label: 'Churn Rate', value: '2.3%', change: '-15%', trend: 'down', icon: TrendingDown, color: 'from-warning to-orange-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card-hover p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
                <div className={`flex items-center gap-1 mt-2 text-sm ${stat.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  {stat.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {stat.change}
                </div>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-20`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Growth */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Member Growth</h3>
              <p className="text-sm text-gray-400">Total members over time</p>
            </div>
            <div className="flex items-center gap-1 text-success text-sm">
              <ArrowUpRight className="w-4 h-4" />
              +500% this year
            </div>
          </div>
          <div className="h-[280px]">
            <Line data={memberGrowthData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Role Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Role Distribution</h3>
            <p className="text-sm text-gray-400">Members by role</p>
          </div>
          <div className="h-[280px]">
            <Doughnut data={roleDistributionData} options={doughnutOptions} />
          </div>
        </motion.div>
      </div>

      {/* Activity by Hour */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Activity by Hour</h3>
            <p className="text-sm text-gray-400">Peak hours: 5 PM - 7 PM</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-avenlo-purple/20 text-avenlo-purple rounded-lg">
              Today
            </button>
            <button className="px-3 py-1 text-sm text-gray-400 hover:bg-white/5 rounded-lg">
              This Week
            </button>
          </div>
        </div>
        <div className="h-[200px]">
          <Bar data={activityByHourData} options={chartOptions} />
        </div>
      </motion.div>

      {/* Top Channels */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Top Channels</h3>
            <p className="text-sm text-gray-400">By message count</p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { name: '#general', messages: 12450, percentage: 100 },
            { name: '#development', messages: 8320, percentage: 67 },
            { name: '#support', messages: 5890, percentage: 47 },
            { name: '#announcements', messages: 3210, percentage: 26 },
            { name: '#off-topic', messages: 2890, percentage: 23 },
          ].map((channel, index) => (
            <div key={channel.name} className="flex items-center gap-4">
              <span className="w-8 text-center text-gray-500">#{index + 1}</span>
              <span className="w-32 font-medium">{channel.name}</span>
              <div className="flex-1">
                <div className="h-2 bg-avenlo-dark rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${channel.percentage}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className="h-full bg-gradient-to-r from-avenlo-cyan to-avenlo-purple rounded-full"
                  />
                </div>
              </div>
              <span className="w-20 text-right text-gray-400 text-sm">
                {channel.messages.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
