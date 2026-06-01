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

// ====================================
// RULES TYPES
// ====================================

export type RuleSeverityKey = 'info' | 'warn' | 'mute' | 'kick' | 'ban';
export type AcceptanceGateKey = 'button' | 'captcha' | 'none';

export interface RuleCardState {
  id: string;
  number: number;
  icon: string;
  title: string;
  body: string;
  severity: RuleSeverityKey;
  autoEnforced: boolean;
}

export interface RulesConfigState {
  guildId: string;
  enabled: boolean;
  rulesChannelId: string;
  channelName: string;
  memberRoleId: string;
  acceptanceGate: AcceptanceGateKey;
  captchaPrompt: string;
  captchaAnswer: string;
  headerTitle: string;
  headerSubtitle: string;
  footerText: string;
  themePreset: ThemePresetKey;
  accentColor: string;
  pinAfterPost: boolean;
  rules: RuleCardState[];
  lastPostedAt?: string;
  lastPostedMessageId?: string;
}

export const DEFAULT_RULES_CONFIG_STATE: RulesConfigState = {
  guildId: '',
  enabled: true,
  rulesChannelId: '',
  channelName: 'rules',
  memberRoleId: '',
  acceptanceGate: 'button',
  captchaPrompt: 'What is 7 + 4?',
  captchaAnswer: '11',
  headerTitle: '📜 COMMUNITY GUIDELINES',
  headerSubtitle:
    'Welcome to our community! To keep this server productive and safe, please read and accept the rules below.',
  footerText:
    'By staying in this server you agree to follow these rules. Violations may result in warnings, mutes, or bans.',
  themePreset: 'cyber',
  accentColor: '#00FFAA',
  pinAfterPost: true,
  rules: [],
};

export interface RulesAnalyticsRecent {
  userId: string;
  username: string;
  method: 'button' | 'captcha' | 'command';
  memberRoleGranted: boolean;
  acceptedAt: string;
}

export interface RulesAnalytics {
  guildId: string;
  totalAccepted: number;
  last24h: number;
  last7d: number;
  byMethod: { method: string; count: number }[];
  recent: RulesAnalyticsRecent[];
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

  // ====================================
  // RULES
  // ====================================
  rulesConfig: RulesConfigState;
  rulesConfigLoading: boolean;
  rulesConfigSaving: boolean;
  rulesPublishing: boolean;
  fetchRulesConfig: () => Promise<void>;
  updateRulesConfig: (patch: Partial<RulesConfigState>) => void;
  addRule: () => void;
  updateRule: (id: string, patch: Partial<RuleCardState>) => void;
  deleteRule: (id: string) => void;
  reorderRules: (fromIndex: number, toIndex: number) => void;
  saveRulesConfig: () => Promise<{ ok: true } | { ok: false; error: string }>;
  publishRules: (
    opts?: { forceRepost?: boolean },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;

  rulesAnalytics: RulesAnalytics | null;
  rulesAnalyticsLoading: boolean;
  fetchRulesAnalytics: () => Promise<void>;
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

  // ====================================
  // RULES
  // ====================================
  rulesConfig: DEFAULT_RULES_CONFIG_STATE,
  rulesConfigLoading: false,
  rulesConfigSaving: false,
  rulesPublishing: false,

  fetchRulesConfig: async () => {
    try {
      set({ rulesConfigLoading: true });
      const r = await fetch('/api/rules-config', { credentials: 'include' });
      if (r.ok) {
        const data = (await r.json()) as { config: RulesConfigState };
        set({
          rulesConfig: { ...DEFAULT_RULES_CONFIG_STATE, ...data.config },
          rulesConfigLoading: false,
        });
      } else {
        set({ rulesConfigLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch rules config:', error);
      set({ rulesConfigLoading: false });
    }
  },

  updateRulesConfig: (patch) =>
    set((state) => ({ rulesConfig: { ...state.rulesConfig, ...patch } })),

  addRule: () =>
    set((state) => {
      const nextNumber = state.rulesConfig.rules.length + 1;
      const newRule: RuleCardState = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        number: nextNumber,
        icon: '📜',
        title: `Rule ${nextNumber}`,
        body: 'Describe this rule clearly so members know what to do (and not do).',
        severity: 'warn',
        autoEnforced: false,
      };
      return {
        rulesConfig: {
          ...state.rulesConfig,
          rules: [...state.rulesConfig.rules, newRule],
        },
      };
    }),

  updateRule: (id, patch) =>
    set((state) => ({
      rulesConfig: {
        ...state.rulesConfig,
        rules: state.rulesConfig.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    })),

  deleteRule: (id) =>
    set((state) => ({
      rulesConfig: {
        ...state.rulesConfig,
        rules: state.rulesConfig.rules
          .filter((r) => r.id !== id)
          .map((r, i) => ({ ...r, number: i + 1 })),
      },
    })),

  reorderRules: (fromIndex, toIndex) =>
    set((state) => {
      const rules = [...state.rulesConfig.rules];
      if (
        fromIndex < 0 ||
        fromIndex >= rules.length ||
        toIndex < 0 ||
        toIndex >= rules.length ||
        fromIndex === toIndex
      ) {
        return {};
      }
      const [moved] = rules.splice(fromIndex, 1);
      rules.splice(toIndex, 0, moved);
      return {
        rulesConfig: {
          ...state.rulesConfig,
          rules: rules.map((r, i) => ({ ...r, number: i + 1 })),
        },
      };
    }),

  saveRulesConfig: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      set({ rulesConfigSaving: true });
      const current = get().rulesConfig;
      const r = await fetch('/api/rules-config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        set({ rulesConfigSaving: false });
        return { ok: false, error: body.error ?? `HTTP ${r.status}` };
      }
      const data = (await r.json()) as { config: RulesConfigState };
      set({
        rulesConfig: { ...DEFAULT_RULES_CONFIG_STATE, ...data.config },
        rulesConfigSaving: false,
      });
      return { ok: true };
    } catch (error) {
      set({ rulesConfigSaving: false });
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Save failed',
      };
    }
  },

  publishRules: async (
    opts?: { forceRepost?: boolean },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      set({ rulesPublishing: true });
      const r = await fetch('/api/rules/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRepost: Boolean(opts?.forceRepost) }),
      });
      set({ rulesPublishing: false });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: body.error ?? `HTTP ${r.status}` };
      }
      return { ok: true };
    } catch (error) {
      set({ rulesPublishing: false });
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Publish failed',
      };
    }
  },

  rulesAnalytics: null,
  rulesAnalyticsLoading: false,
  fetchRulesAnalytics: async () => {
    try {
      set({ rulesAnalyticsLoading: true });
      const r = await fetch('/api/rules/analytics', { credentials: 'include' });
      if (r.ok) {
        const data = (await r.json()) as RulesAnalytics;
        set({ rulesAnalytics: data, rulesAnalyticsLoading: false });
      } else {
        set({ rulesAnalyticsLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch rules analytics:', error);
      set({ rulesAnalyticsLoading: false });
    }
  },
}));
