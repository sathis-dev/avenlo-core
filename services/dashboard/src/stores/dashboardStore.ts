import { create } from 'zustand';

export interface WelcomeConfigState {
  guildId: string;
  enabled: boolean;
  dmEnabled: boolean;
  mentionUser: boolean;
  cardEnabled: boolean;
  showMemberCount: boolean;
  showAccountAge: boolean;
  channelName: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTagline: string;
  neonBorderColor: string;
  embedAccentColor: string;
  autoRoleIds: string[];
}

export const DEFAULT_WELCOME_CONFIG_STATE: WelcomeConfigState = {
  guildId: '',
  enabled: true,
  dmEnabled: true,
  mentionUser: true,
  cardEnabled: true,
  showMemberCount: true,
  showAccountAge: true,
  channelName: 'welcome',
  titleTemplate: '✨ Welcome, {member}',
  bodyTemplate: 'Hey {mention} — welcome to **{guild}**!',
  cardTagline: 'In Code We Trust',
  neonBorderColor: '#00FFAA',
  embedAccentColor: '#FFD700',
  autoRoleIds: [],
};

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

  welcomeConfig: WelcomeConfigState;
  welcomeConfigLoading: boolean;
  welcomeConfigSaving: boolean;
  fetchWelcomeConfig: () => Promise<void>;
  updateWelcomeConfig: (patch: Partial<WelcomeConfigState>) => void;
  saveWelcomeConfig: () => Promise<{ ok: true } | { ok: false; error: string }>;
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

export const useDashboardStore = create<DashboardState>((set, get) => ({
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

  welcomeConfig: DEFAULT_WELCOME_CONFIG_STATE,
  welcomeConfigLoading: false,
  welcomeConfigSaving: false,

  fetchWelcomeConfig: async () => {
    try {
      set({ welcomeConfigLoading: true });
      const response = await fetch('/api/welcome-config', { credentials: 'include' });
      if (response.ok) {
        const data: { config: WelcomeConfigState } = await response.json();
        set({
          welcomeConfig: { ...DEFAULT_WELCOME_CONFIG_STATE, ...data.config },
          welcomeConfigLoading: false,
        });
      } else {
        set({ welcomeConfigLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch welcome config:', error);
      set({ welcomeConfigLoading: false });
    }
  },

  updateWelcomeConfig: (patch) =>
    set((state) => ({ welcomeConfig: { ...state.welcomeConfig, ...patch } })),

  saveWelcomeConfig: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      set({ welcomeConfigSaving: true });
      const current = get().welcomeConfig;
      const response = await fetch('/api/welcome-config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ error: 'Save failed' }))) as { error?: string };
        set({ welcomeConfigSaving: false });
        return { ok: false, error: errorBody.error || 'Save failed' };
      }
      const data: { config: WelcomeConfigState } = await response.json();
      set({
        welcomeConfig: { ...DEFAULT_WELCOME_CONFIG_STATE, ...data.config },
        welcomeConfigSaving: false,
      });
      return { ok: true };
    } catch (error) {
      console.error('Failed to save welcome config:', error);
      set({ welcomeConfigSaving: false });
      return { ok: false, error: error instanceof Error ? error.message : 'Save failed' };
    }
  },
}));
