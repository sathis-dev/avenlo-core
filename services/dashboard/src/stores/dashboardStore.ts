import { create } from 'zustand';

export type ThemePresetKey =
  | 'cyber'
  | 'gold'
  | 'halloween'
  | 'christmas'
  | 'minimal'
  | 'custom';

export interface WelcomeConfigState {
  guildId: string;
  enabled: boolean;
  dmEnabled: boolean;
  mentionUser: boolean;
  cardEnabled: boolean;
  showMemberCount: boolean;
  showAccountAge: boolean;
  channelName: string;
  welcomeChannelId: string;
  rulesChannelId: string;
  rolesChannelId: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTagline: string;
  neonBorderColor: string;
  embedAccentColor: string;
  autoRoleIds: string[];
  verifiedRoleId: string;
  pendingRoleId: string;
  quarantineNewAccounts: boolean;
  quarantineHours: number;
  aiPersonalizedEnabled: boolean;
  returningMemberEnabled: boolean;
  themePreset: ThemePresetKey;
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
  welcomeChannelId: '',
  rulesChannelId: '',
  rolesChannelId: '',
  titleTemplate: '✨ Welcome, {member}',
  bodyTemplate: 'Hey {mention} — welcome to **{guild}**!',
  cardTagline: 'In Code We Trust',
  neonBorderColor: '#00FFAA',
  embedAccentColor: '#FFD700',
  autoRoleIds: [],
  verifiedRoleId: '',
  pendingRoleId: '',
  quarantineNewAccounts: false,
  quarantineHours: 24,
  aiPersonalizedEnabled: false,
  returningMemberEnabled: true,
  themePreset: 'cyber',
};

export interface DiscordChannelOption {
  id: string;
  name: string;
  parentName: string | null;
}

export interface DiscordRoleOption {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface LiveJoinEvent {
  type: string;
  guildId: string;
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  memberCount?: number;
  quarantined?: boolean;
  returning?: boolean;
  personalizedGreeting?: string;
  at: string;
}

export interface WelcomeFunnelStages {
  joined: number;
  welcomed: number;
  verified: number;
  engaged: number;
  quarantined: number;
  left: number;
}

export interface WelcomeAnalytics {
  windowDays: number;
  total: number;
  stages: WelcomeFunnelStages;
  recent: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    joinedAt: string;
    leftAt: string | null;
    priorJoins: number;
    quarantined: boolean;
    verified: boolean;
  }[];
}

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

  discordChannels: DiscordChannelOption[];
  discordRoles: DiscordRoleOption[];
  discordDirectoryLoading: boolean;
  fetchDiscordDirectory: () => Promise<void>;

  welcomeAnalytics: WelcomeAnalytics | null;
  welcomeAnalyticsLoading: boolean;
  fetchWelcomeAnalytics: () => Promise<void>;

  liveEvents: LiveJoinEvent[];
  pushLiveEvent: (event: LiveJoinEvent) => void;

  testWelcome: () => Promise<{ ok: true } | { ok: false; error: string }>;
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

  discordChannels: [],
  discordRoles: [],
  discordDirectoryLoading: false,
  fetchDiscordDirectory: async () => {
    try {
      set({ discordDirectoryLoading: true });
      const [channelsRes, rolesRes] = await Promise.all([
        fetch('/api/discord/channels', { credentials: 'include' }),
        fetch('/api/discord/roles', { credentials: 'include' }),
      ]);
      const channelsJson = channelsRes.ok
        ? ((await channelsRes.json()) as { channels: DiscordChannelOption[] })
        : { channels: [] };
      const rolesJson = rolesRes.ok
        ? ((await rolesRes.json()) as { roles: DiscordRoleOption[] })
        : { roles: [] };
      set({
        discordChannels: channelsJson.channels ?? [],
        discordRoles: rolesJson.roles ?? [],
        discordDirectoryLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch Discord directory:', error);
      set({ discordDirectoryLoading: false });
    }
  },

  welcomeAnalytics: null,
  welcomeAnalyticsLoading: false,
  fetchWelcomeAnalytics: async () => {
    try {
      set({ welcomeAnalyticsLoading: true });
      const r = await fetch('/api/welcome/analytics', { credentials: 'include' });
      if (r.ok) {
        const data = (await r.json()) as WelcomeAnalytics;
        set({ welcomeAnalytics: data, welcomeAnalyticsLoading: false });
      } else {
        set({ welcomeAnalyticsLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch welcome analytics:', error);
      set({ welcomeAnalyticsLoading: false });
    }
  },

  liveEvents: [],
  pushLiveEvent: (event) =>
    set((state) => ({ liveEvents: [event, ...state.liveEvents].slice(0, 30) })),

  testWelcome: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const r = await fetch('/api/welcome/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: body.error ?? `HTTP ${r.status}` };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  },
}));
