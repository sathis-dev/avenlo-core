// ====================================
// AVENLO CORE - WELCOME CONFIG PAGE
// Liquid Glass control panel + WYSIWYG live preview
// ====================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Sparkles,
  Save,
  RotateCcw,
  Image as ImageIcon,
  AtSign,
  Users,
  CalendarClock,
  Mail,
  Power,
  Shield,
  Brain,
  Repeat,
  Palette,
  Radio,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  useDashboardStore,
  type WelcomeConfigState,
  type ThemePresetKey,
  type LiveJoinEvent,
  DEFAULT_WELCOME_CONFIG_STATE,
} from '../stores/dashboardStore';
import { useAuthStore } from '../stores/authStore';

// ====================================
// THEME PRESET DEFINITIONS (mirror of server-side)
// ====================================

interface ThemePresetDef {
  key: ThemePresetKey;
  label: string;
  description: string;
  neonBorderColor: string;
  embedAccentColor: string;
  cardTagline: string;
  titleTemplate: string;
}

const THEME_PRESET_DEFS: ThemePresetDef[] = [
  {
    key: 'cyber',
    label: 'Cyber Neon',
    description: 'Cyan + gold, signature Avenlo look',
    neonBorderColor: '#00FFAA',
    embedAccentColor: '#FFD700',
    cardTagline: 'In Code We Trust',
    titleTemplate: '✨ Welcome, {member}',
  },
  {
    key: 'gold',
    label: 'Royal Gold',
    description: 'All-gold, premium feel',
    neonBorderColor: '#FFD700',
    embedAccentColor: '#FFD700',
    cardTagline: 'The Sovereign Lounge',
    titleTemplate: '👑 Welcome, {member}',
  },
  {
    key: 'halloween',
    label: 'Halloween',
    description: 'Orange + purple',
    neonBorderColor: '#FF6A00',
    embedAccentColor: '#9D00FF',
    cardTagline: 'Welcome to the dark side',
    titleTemplate: '🎃 Welcome, {member}',
  },
  {
    key: 'christmas',
    label: 'Christmas',
    description: 'Festive red + green',
    neonBorderColor: '#1ED760',
    embedAccentColor: '#FF3232',
    cardTagline: 'Tis the season',
    titleTemplate: '🎄 Welcome, {member}',
  },
  {
    key: 'minimal',
    label: 'Minimalist',
    description: 'Monochrome whites',
    neonBorderColor: '#FFFFFF',
    embedAccentColor: '#CCCCCC',
    cardTagline: 'Quiet luxury',
    titleTemplate: 'Welcome, {member}',
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'Free-form — tweak each value yourself',
    neonBorderColor: '#00FFAA',
    embedAccentColor: '#FFD700',
    cardTagline: 'In Code We Trust',
    titleTemplate: '✨ Welcome, {member}',
  },
];

// ====================================
// TYPES
// ====================================

interface ToggleFieldProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
}

interface TextFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  prefix?: string;
}

interface ColorFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string | null;
}

interface SelectFieldProps {
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
  emptyLabel?: string;
}

function SelectField({
  label,
  description,
  value,
  options,
  onChange,
  emptyLabel,
}: SelectFieldProps) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">{label}</div>
      {description && <div className="text-xs text-white/40 mb-2">{description}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
          'transition-all duration-300 ' +
          'focus:outline-none focus:border-[#00FFAA]/70 ' +
          'focus:shadow-[0_0_20px_rgba(0,255,170,0.4)] focus:bg-black/60'
        }
      >
        <option value="">{emptyLabel ?? '— not configured —'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}{o.sublabel ? ` · ${o.sublabel}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

// ====================================
// LIQUID GLASS PRIMITIVES
// ====================================

function GlassPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        'backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl ' +
        'shadow-[0_0_40px_rgba(0,255,170,0.04)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

function ToggleField({ label, description, icon, value, onChange }: ToggleFieldProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={
        'w-full flex items-center justify-between gap-4 p-4 rounded-xl ' +
        'bg-white/5 border border-white/10 ' +
        'transition-all duration-300 ' +
        'hover:bg-white/10 hover:border-[#00FFAA]/30 ' +
        'focus:outline-none focus:ring-2 focus:ring-[#00FFAA]/60 ' +
        'focus:shadow-[0_0_24px_rgba(0,255,170,0.45)]'
      }
    >
      <div className="flex items-start gap-3 text-left">
        <div
          className={
            'p-2 rounded-lg transition-colors duration-300 ' +
            (value ? 'bg-[#00FFAA]/15 text-[#00FFAA]' : 'bg-white/5 text-white/50')
          }
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-xs text-white/50 mt-0.5">{description}</div>
        </div>
      </div>
      <div
        className={
          'relative w-12 h-6 rounded-full transition-all duration-300 ' +
          (value
            ? 'bg-[#00FFAA] shadow-[0_0_18px_rgba(0,255,170,0.7)]'
            : 'bg-white/10')
        }
      >
        <span
          className={
            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ' +
            (value ? 'left-6' : 'left-0.5')
          }
        />
      </div>
    </button>
  );
}

function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  multiline,
  prefix,
}: TextFieldProps) {
  const baseClasses =
    'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
    'placeholder-white/30 transition-all duration-300 ' +
    'focus:outline-none focus:border-[#00FFAA]/70 ' +
    'focus:shadow-[0_0_20px_rgba(0,255,170,0.4)] focus:bg-black/60';

  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">{label}</div>
      {description && <div className="text-xs text-white/40 mb-2">{description}</div>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-white/40 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={baseClasses + (prefix ? ' pl-7' : '')}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={baseClasses + (prefix ? ' pl-7' : '')}
          />
        )}
      </div>
    </label>
  );
}

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">{label}</div>
      <div className="text-xs text-white/40 mb-2">{description}</div>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border border-white/10"
          style={{
            background: value,
            boxShadow: `0 0 18px ${value}55`,
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={
            'flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
            'font-mono transition-all duration-300 ' +
            'focus:outline-none focus:border-[#00FFAA]/70 ' +
            'focus:shadow-[0_0_20px_rgba(0,255,170,0.4)]'
          }
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
        />
      </div>
    </label>
  );
}

// ====================================
// LIVE PREVIEW (WYSIWYG mirror)
// ====================================

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (full, key: string) => {
    return key in vars ? vars[key] : full;
  });
}

interface PreviewProps {
  config: WelcomeConfigState;
  username: string;
  avatarUrl: string;
  guildName: string;
  memberCount: number;
}

function PreviewCard({ config, username, avatarUrl, guildName, memberCount }: PreviewProps) {
  const vars: Record<string, string> = {
    member: username,
    mention: `@${username}`,
    guild: guildName,
    memberCount: memberCount.toLocaleString(),
  };

  const title = interpolate(config.titleTemplate, vars);
  const body = interpolate(config.bodyTemplate, vars);

  return (
    <div
      className="rounded-xl overflow-hidden border-l-4"
      style={{ borderLeftColor: config.embedAccentColor, background: '#1E1F22' }}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: config.neonBorderColor }}
          >
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-white/80">
            AVENLO CORE • NEW ARRIVAL
          </span>
        </div>

        <div className="text-white text-lg font-bold mb-2">{title}</div>
        <div className="text-white/70 text-sm whitespace-pre-line mb-4">{body}</div>

        <div className="border-t border-white/10 my-3" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-white/50 text-xs uppercase mb-1">Get Started</div>
            <div className="text-white/80 leading-relaxed">
              <div>1. Read rules → #rules</div>
              <div>2. Get roles → #roles</div>
              <div>3. Info → #info</div>
            </div>
          </div>
          <div>
            <div className="text-white/50 text-xs uppercase mb-1">Server Stats</div>
            <div className="text-white/80 leading-relaxed">
              {config.showMemberCount && (
                <div>Member Count: <span className="font-mono">{memberCount.toLocaleString()}</span></div>
              )}
              <div>You are: Member #{memberCount}</div>
              <div>Status: ✅ Verified</div>
            </div>
          </div>
        </div>

        {config.cardEnabled && (
          <div
            className="mt-4 rounded-xl overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, #05060B 0%, #0A0C18 50%, #04050A 100%)',
              border: `2px solid ${config.neonBorderColor}`,
              boxShadow: `0 0 30px ${config.neonBorderColor}55`,
              minHeight: '160px',
            }}
          >
            <div className="flex items-center p-5 gap-5">
              <div
                className="rounded-full flex-shrink-0 relative"
                style={{
                  width: '110px',
                  height: '110px',
                  background: '#0F1118',
                  border: `3px solid ${config.neonBorderColor}`,
                  boxShadow: `0 0 24px ${config.neonBorderColor}99`,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-semibold tracking-widest mb-1"
                  style={{ color: config.neonBorderColor }}
                >
                  WELCOME TO {guildName.toUpperCase()}
                </div>
                <div className="text-white text-2xl font-bold truncate">{username}</div>
                <div
                  className="h-0.5 my-2"
                  style={{
                    background: `linear-gradient(90deg, ${config.neonBorderColor}, ${config.embedAccentColor})`,
                    width: '60%',
                  }}
                />
                <div className="text-white/60 text-sm">{config.cardTagline}</div>
                {config.showMemberCount && (
                  <div
                    className="text-xs font-bold mt-1"
                    style={{ color: config.embedAccentColor }}
                  >
                    MEMBER #{memberCount.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-white/10 my-3" />
        <div className="text-white/40 text-xs">
          Avenlo Core • Member #{memberCount}
        </div>
      </div>
    </div>
  );
}

// ====================================
// MAIN PAGE
// ====================================

export default function WelcomeConfig() {
  const {
    welcomeConfig,
    welcomeConfigLoading,
    welcomeConfigSaving,
    fetchWelcomeConfig,
    updateWelcomeConfig,
    saveWelcomeConfig,
    discordChannels,
    discordRoles,
    fetchDiscordDirectory,
    welcomeAnalytics,
    fetchWelcomeAnalytics,
    liveEvents,
    pushLiveEvent,
    testWelcome,
  } = useDashboardStore();

  const { user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [testing, setTesting] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([
        fetchWelcomeConfig(),
        fetchDiscordDirectory(),
        fetchWelcomeAnalytics(),
      ]);
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWelcomeConfig, fetchDiscordDirectory, fetchWelcomeAnalytics]);

  // Live events stream
  useEffect(() => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource('/api/welcome/live', { withCredentials: true });
    es.onmessage = (msg) => {
      try {
        const evt: LiveJoinEvent = JSON.parse(msg.data);
        if (evt && typeof evt.type === 'string') pushLiveEvent(evt);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // browsers auto-reconnect; nothing to do
    };
    sseRef.current = es;
    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [pushLiveEvent]);

  const applyThemePreset = (key: ThemePresetKey): void => {
    const def = THEME_PRESET_DEFS.find((p) => p.key === key);
    if (!def) return;
    if (key === 'custom') {
      updateWelcomeConfig({ themePreset: 'custom' });
      return;
    }
    updateWelcomeConfig({
      themePreset: key,
      neonBorderColor: def.neonBorderColor,
      embedAccentColor: def.embedAccentColor,
      cardTagline: def.cardTagline,
      titleTemplate: def.titleTemplate,
    });
  };

  const handleTestWelcome = async (): Promise<void> => {
    setTesting(true);
    const res = await testWelcome();
    setTesting(false);
    if (res.ok) {
      toast.success('Test welcome fired — check the channel + your DMs');
      void fetchWelcomeAnalytics();
    } else {
      toast.error(res.error);
    }
  };

  const previewUsername = useMemo(() => user?.username || 'NewMember', [user]);
  const previewAvatar = useMemo(() => {
    if (user?.id && user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }, [user]);

  const handleReset = () => {
    updateWelcomeConfig(DEFAULT_WELCOME_CONFIG_STATE);
    toast.success('Reset to defaults — click Save to persist');
  };

  const handleSave = async () => {
    const result = await saveWelcomeConfig();
    if (result.ok) {
      toast.success('Welcome config saved — gateway notified via Redis');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-10 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-[#00FFAA]/10 border border-[#00FFAA]/30 shadow-[0_0_18px_rgba(0,255,170,0.35)]">
              <Sparkles className="w-5 h-5 text-[#00FFAA]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Welcome System</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] font-semibold">
              SOVEREIGN
            </span>
          </div>
          <p className="text-white/50 text-sm">
            Dynamic canvas onboarding cards with hot-reloadable templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className={
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm ' +
              'bg-white/5 border border-white/10 text-white/80 ' +
              'transition-all duration-300 hover:bg-white/10 ' +
              'focus:outline-none focus:ring-2 focus:ring-white/30'
            }
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={welcomeConfigSaving || welcomeConfigLoading}
            className={
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ' +
              'bg-[#00FFAA] text-black border border-[#00FFAA] ' +
              'transition-all duration-300 ' +
              'hover:shadow-[0_0_24px_rgba(0,255,170,0.7)] ' +
              'disabled:opacity-50 disabled:cursor-not-allowed ' +
              'focus:outline-none focus:ring-2 focus:ring-[#00FFAA]/70'
            }
          >
            <Save className="w-4 h-4" />
            {welcomeConfigSaving ? 'Saving…' : 'Save & Publish'}
          </button>
        </div>
      </motion.div>

      {!hydrated && (
        <GlassPanel className="p-6 text-center text-white/60">
          Loading current welcome configuration…
        </GlassPanel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ===== CONTROLS ===== */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white/90 font-semibold mb-1 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#00FFAA]" /> Theme preset
                </div>
                <div className="text-white/40 text-xs">
                  Apply a curated color + template set — click “Custom” to tweak everything manually.
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestWelcome}
                disabled={testing}
                className={
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ' +
                  'bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] ' +
                  'transition-all duration-300 ' +
                  'hover:bg-[#FFD700]/25 hover:shadow-[0_0_18px_rgba(255,215,0,0.5)] ' +
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                }
              >
                <PlayCircle className="w-4 h-4" />
                {testing ? 'Firing…' : 'Test on me'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {THEME_PRESET_DEFS.map((def) => {
                const active = welcomeConfig.themePreset === def.key;
                return (
                  <button
                    type="button"
                    key={def.key}
                    onClick={() => applyThemePreset(def.key)}
                    className={
                      'group text-left p-3 rounded-xl border transition-all duration-300 ' +
                      (active
                        ? 'border-[#00FFAA] bg-[#00FFAA]/10 shadow-[0_0_24px_rgba(0,255,170,0.45)]'
                        : 'border-white/10 bg-white/5 hover:border-[#00FFAA]/40 hover:bg-white/10')
                    }
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{
                          background: def.neonBorderColor,
                          boxShadow: `0 0 10px ${def.neonBorderColor}88`,
                        }}
                      />
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{
                          background: def.embedAccentColor,
                          boxShadow: `0 0 10px ${def.embedAccentColor}88`,
                        }}
                      />
                      <span className="text-sm font-semibold text-white">{def.label}</span>
                    </div>
                    <div className="text-xs text-white/50 leading-snug">{def.description}</div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="text-white/90 font-semibold mb-1">Toggles</div>
            <div className="text-white/40 text-xs mb-4">
              Control which subsystems fire when a member joins.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ToggleField
                label="Master switch"
                description="Disable to silence all welcome messages."
                icon={<Power className="w-4 h-4" />}
                value={welcomeConfig.enabled}
                onChange={(v) => updateWelcomeConfig({ enabled: v })}
              />
              <ToggleField
                label="Canvas card"
                description="Render the dynamic image attachment."
                icon={<ImageIcon className="w-4 h-4" />}
                value={welcomeConfig.cardEnabled}
                onChange={(v) => updateWelcomeConfig({ cardEnabled: v })}
              />
              <ToggleField
                label="Mention user"
                description="Ping the new member in the channel message."
                icon={<AtSign className="w-4 h-4" />}
                value={welcomeConfig.mentionUser}
                onChange={(v) => updateWelcomeConfig({ mentionUser: v })}
              />
              <ToggleField
                label="DM welcome"
                description="Send a private welcome DM as well."
                icon={<Mail className="w-4 h-4" />}
                value={welcomeConfig.dmEnabled}
                onChange={(v) => updateWelcomeConfig({ dmEnabled: v })}
              />
              <ToggleField
                label="Show member count"
                description="Include live server stats in the embed."
                icon={<Users className="w-4 h-4" />}
                value={welcomeConfig.showMemberCount}
                onChange={(v) => updateWelcomeConfig({ showMemberCount: v })}
              />
              <ToggleField
                label="Show account age"
                description="Display how old the joining account is."
                icon={<CalendarClock className="w-4 h-4" />}
                value={welcomeConfig.showAccountAge}
                onChange={(v) => updateWelcomeConfig({ showAccountAge: v })}
              />
              <ToggleField
                label="Returning member"
                description="Detect rejoins and greet them with a ‘Welcome back’."
                icon={<Repeat className="w-4 h-4" />}
                value={welcomeConfig.returningMemberEnabled}
                onChange={(v) => updateWelcomeConfig({ returningMemberEnabled: v })}
              />
              <ToggleField
                label="AI personalized line"
                description="Generate a 1-line personalized greeting via OpenAI."
                icon={<Brain className="w-4 h-4" />}
                value={welcomeConfig.aiPersonalizedEnabled}
                onChange={(v) => updateWelcomeConfig({ aiPersonalizedEnabled: v })}
              />
              <ToggleField
                label="Quarantine new accounts"
                description="Auto-apply a Pending role to brand-new Discord accounts."
                icon={<Shield className="w-4 h-4" />}
                value={welcomeConfig.quarantineNewAccounts}
                onChange={(v) => updateWelcomeConfig({ quarantineNewAccounts: v })}
              />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="text-white/90 font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#00FFAA]" /> Channels & roles
            </div>
            <div className="text-white/40 text-xs mb-4">
              Pick real channels and roles from your server. Channel-ID is preferred over name —
              this is how the bot handles emoji-prefixed names like <code>🍑・welcome</code>.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Welcome channel"
                description="Where the welcome card is posted."
                value={welcomeConfig.welcomeChannelId}
                onChange={(v) => updateWelcomeConfig({ welcomeChannelId: v })}
                options={discordChannels.map((c) => ({
                  value: c.id,
                  label: `#${c.name}`,
                  sublabel: c.parentName,
                }))}
                emptyLabel="— fall back to channel name —"
              />
              <SelectField
                label="Rules channel"
                description="Linked in welcome embed buttons."
                value={welcomeConfig.rulesChannelId}
                onChange={(v) => updateWelcomeConfig({ rulesChannelId: v })}
                options={discordChannels.map((c) => ({
                  value: c.id,
                  label: `#${c.name}`,
                  sublabel: c.parentName,
                }))}
              />
              <SelectField
                label="Self-roles channel"
                description="Linked from the ‘Get Roles’ button."
                value={welcomeConfig.rolesChannelId}
                onChange={(v) => updateWelcomeConfig({ rolesChannelId: v })}
                options={discordChannels.map((c) => ({
                  value: c.id,
                  label: `#${c.name}`,
                  sublabel: c.parentName,
                }))}
              />
              <SelectField
                label="Verified role"
                description="Assigned when a user clicks “Verify” in DM."
                value={welcomeConfig.verifiedRoleId}
                onChange={(v) => updateWelcomeConfig({ verifiedRoleId: v })}
                options={discordRoles.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
              />
              <SelectField
                label="Pending / quarantine role"
                description="Auto-assigned to suspicious new accounts."
                value={welcomeConfig.pendingRoleId}
                onChange={(v) => updateWelcomeConfig({ pendingRoleId: v })}
                options={discordRoles.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
              />
              <TextField
                label="Quarantine threshold (hours)"
                description="Accounts younger than this get the pending role."
                value={String(welcomeConfig.quarantineHours)}
                onChange={(v) =>
                  updateWelcomeConfig({
                    quarantineHours: Number.parseInt(v, 10) || 0,
                  })
                }
                placeholder="24"
              />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="text-white/90 font-semibold mb-1">Templates</div>
            <div className="text-white/40 text-xs mb-4">
              Available variables: <code className="text-[#00FFAA]">{'{member}'}</code>,{' '}
              <code className="text-[#00FFAA]">{'{mention}'}</code>,{' '}
              <code className="text-[#00FFAA]">{'{guild}'}</code>,{' '}
              <code className="text-[#00FFAA]">{'{memberCount}'}</code>
            </div>

            <div className="space-y-4">
              <TextField
                label="Channel"
                description="Channel name (without #) the bot should look for."
                value={welcomeConfig.channelName}
                onChange={(v) => updateWelcomeConfig({ channelName: v })}
                placeholder="welcome"
                prefix="#"
              />
              <TextField
                label="Title template"
                value={welcomeConfig.titleTemplate}
                onChange={(v) => updateWelcomeConfig({ titleTemplate: v })}
                placeholder="✨ Welcome, {member}"
              />
              <TextField
                label="Body template"
                value={welcomeConfig.bodyTemplate}
                onChange={(v) => updateWelcomeConfig({ bodyTemplate: v })}
                multiline
                placeholder="Hey {mention} — welcome to **{guild}**!"
              />
              <TextField
                label="Card tagline"
                description="Short subtitle rendered onto the canvas card."
                value={welcomeConfig.cardTagline}
                onChange={(v) => updateWelcomeConfig({ cardTagline: v })}
                placeholder="In Code We Trust"
              />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="text-white/90 font-semibold mb-1">Colors</div>
            <div className="text-white/40 text-xs mb-4">
              Use hex notation (e.g. <code>#00FFAA</code>). Cyan governs the neon border, gold the
              embed accent line.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorField
                label="Neon border"
                description="Glow around the card and avatar."
                value={welcomeConfig.neonBorderColor}
                onChange={(v) => updateWelcomeConfig({ neonBorderColor: v })}
              />
              <ColorField
                label="Embed accent"
                description="Discord embed left bar + member count text."
                value={welcomeConfig.embedAccentColor}
                onChange={(v) => updateWelcomeConfig({ embedAccentColor: v })}
              />
            </div>
          </GlassPanel>
        </motion.div>

        {/* ===== PREVIEW ===== */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <GlassPanel className="p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white/90 font-semibold">Live preview</div>
                <div className="text-white/40 text-xs">
                  Mirror of the final Discord embed and canvas card.
                </div>
              </div>
              <span
                className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-full"
                style={{
                  background: 'rgba(0,255,170,0.1)',
                  border: '1px solid rgba(0,255,170,0.4)',
                  color: '#00FFAA',
                }}
              >
                WYSIWYG
              </span>
            </div>

            <PreviewCard
              config={welcomeConfig}
              username={previewUsername}
              avatarUrl={previewAvatar}
              guildName="Avenlo Studio"
              memberCount={1337}
            />
          </GlassPanel>

          {/* ===== FUNNEL ANALYTICS ===== */}
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-white/90 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00FFAA]" /> Onboarding funnel
                </div>
                <div className="text-white/40 text-xs">
                  Last {welcomeAnalytics?.windowDays ?? 30} days · {welcomeAnalytics?.total ?? 0} joins
                </div>
              </div>
              <button
                type="button"
                onClick={() => void fetchWelcomeAnalytics()}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
              >
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['joined', 'welcomed', 'verified', 'engaged', 'quarantined', 'left'] as const).map(
                (stage) => {
                  const count = welcomeAnalytics?.stages?.[stage] ?? 0;
                  const total = welcomeAnalytics?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div
                      key={stage}
                      className="rounded-xl bg-white/5 border border-white/10 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-white/40">
                        {stage}
                      </div>
                      <div className="text-2xl font-bold text-white">{count}</div>
                      <div className="text-xs text-white/40">{pct}%</div>
                    </div>
                  );
                },
              )}
            </div>
          </GlassPanel>

          {/* ===== LIVE JOINS FEED ===== */}
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-[#00FFAA] animate-pulse" />
              <div className="text-white/90 font-semibold">Live joins</div>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#00FFAA]/10 border border-[#00FFAA]/30 text-[#00FFAA]">
                SSE
              </span>
            </div>
            {liveEvents.length === 0 ? (
              <div className="text-white/40 text-sm py-8 text-center">
                Waiting for activity… new joins will appear here in real-time.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {liveEvents.slice(0, 12).map((evt, idx) => (
                  <div
                    key={`${evt.userId ?? 'na'}-${evt.at}-${idx}`}
                    className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-2"
                  >
                    {evt.avatarUrl ? (
                      <img
                        src={evt.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {evt.displayName ?? evt.username ?? 'unknown'}
                      </div>
                      <div className="text-[11px] text-white/40 truncate">
                        {evt.type.replace('member:', '')}
                        {evt.memberCount ? ` · #${evt.memberCount}` : ''}
                        {evt.returning ? ' · returning' : ''}
                      </div>
                    </div>
                    {evt.quarantined && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> quarantined
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}
