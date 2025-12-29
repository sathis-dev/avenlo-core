import { create } from 'zustand';

interface Stats {
  totalMembers: number;
  onlineMembers: number;
  totalTickets: number;
  openTickets: number;
  moderationActions: number;
  messagesPerDay: number;
  newMembersToday: number;
  activeProjects: number;
}

interface DashboardState {
  stats: Stats;
  isLoading: boolean;
  recentActivity: ActivityItem[];
  fetchStats: () => Promise<void>;
}

interface ActivityItem {
  id: string;
  type: 'join' | 'leave' | 'ticket' | 'moderation' | 'message';
  user: {
    id: string;
    username: string;
    avatar: string;
  };
  action: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: {
    totalMembers: 0,
    onlineMembers: 0,
    totalTickets: 0,
    openTickets: 0,
    moderationActions: 0,
    messagesPerDay: 0,
    newMembersToday: 0,
    activeProjects: 0,
  },
  isLoading: true,
  recentActivity: [],

  fetchStats: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/dashboard/stats');
      
      if (response.ok) {
        const data = await response.json();
        set({ 
          stats: data.stats, 
          recentActivity: data.activity || [],
          isLoading: false 
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({ isLoading: false });
    }
  },
}));
