// ====================================
// AVENLO CORE - RULES CONFIG PAGE
// Liquid Glass control panel + drag-reorder rule editor + WYSIWYG preview
// Mirrors the Welcome v3 dashboard pattern for Core consistency.
// ====================================

import { useEffect, useMemo, useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Save,
  RotateCcw,
  Power,
  ShieldCheck,
  Plus,
  Trash2,
  GripVertical,
  Megaphone,
  Sparkles,
  Pin,
  Lock,
  Type,
  KeyRound,
  Activity,
  ChevronRight,
} from 'lucide-react';
import {
  useDashboardStore,
  type RuleCardState,
  type RulesConfigState,
  type AcceptanceGateKey,
  type ThemePresetKey,
  type RuleSeverityKey,
  DEFAULT_RULES_CONFIG_STATE,
} from '../stores/dashboardStore';

// ====================================
// CONSTANTS
// ====================================

const SEVERITY_OPTIONS: {
  value: RuleSeverityKey;
  label: string;
  color: string;
  badge: string;
}[] = [
  { value: 'info', label: 'Info', color: '#5865F2', badge: '🟦' },
  { value: 'warn', label: 'Warning', color: '#FEE75C', badge: '🟡' },
  { value: 'mute', label: 'Mute', color: '#FF9F1C', badge: '🟠' },
  { value: 'kick', label: 'Kick', color: '#FF4B4B', badge: '🔴' },
  { value: 'ban', label: 'Ban', color: '#990000', badge: '⛔' },
];

const GATE_OPTIONS: { value: AcceptanceGateKey; label: string; description: string }[] = [
  {
    value: 'button',
    label: '✅ Button',
    description: 'One-click "I Accept" button — fastest path to access',
  },
  {
    value: 'captcha',
    label: '🧠 Captcha',
    description: 'Members must answer a question (anti-bot)',
  },
  {
    value: 'none',
    label: '🚫 None',
    description: 'Read-only — no acceptance required',
  },
];

const THEME_PRESETS: {
  key: ThemePresetKey;
  label: string;
  accent: string;
  description: string;
}[] = [
  { key: 'cyber', label: 'Cyber Neon', accent: '#00FFAA', description: 'Signature Avenlo look' },
  { key: 'gold', label: 'Royal Gold', accent: '#FFD700', description: 'Premium feel' },
  { key: 'halloween', label: 'Halloween', accent: '#FF6A00', description: 'Orange + purple' },
  { key: 'christmas', label: 'Christmas', accent: '#FF3232', description: 'Festive red + green' },
  { key: 'minimal', label: 'Minimalist', accent: '#FFFFFF', description: 'Monochrome whites' },
  { key: 'custom', label: 'Custom', accent: '#00FFAA', description: 'Tweak each value yourself' },
];

// ====================================
// GLASS PRIMITIVES
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

function ToggleField({
  label,
  description,
  icon,
  value,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={
        'w-full flex items-center justify-between gap-4 p-4 rounded-xl ' +
        'bg-white/5 border border-white/10 transition-all duration-300 ' +
        'hover:bg-white/10 hover:border-[#00FFAA]/30 ' +
        'focus:outline-none focus:ring-2 focus:ring-[#00FFAA]/60'
      }
    >
      <div className="flex items-start gap-3 text-left">
        <div
          className={
            'p-2 rounded-lg ' +
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
          (value ? 'bg-[#00FFAA] shadow-[0_0_18px_rgba(0,255,170,0.7)]' : 'bg-white/10')
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
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
    'placeholder-white/30 transition-all duration-300 ' +
    'focus:outline-none focus:border-[#00FFAA]/70 focus:shadow-[0_0_20px_rgba(0,255,170,0.4)]';
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; sublabel?: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
          'transition-all duration-300 focus:outline-none focus:border-[#00FFAA]/70 ' +
          'focus:shadow-[0_0_20px_rgba(0,255,170,0.4)]'
        }
      >
        <option value="">— not configured —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.sublabel ? ` · ${o.sublabel}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

// ====================================
// RULE CARD EDITOR
// ====================================

function RuleEditor({
  rule,
  onChange,
  onDelete,
  index,
}: {
  rule: RuleCardState;
  onChange: (patch: Partial<RuleCardState>) => void;
  onDelete: () => void;
  index: number;
}) {
  const severityMeta = SEVERITY_OPTIONS.find((s) => s.value === rule.severity);
  return (
    <Reorder.Item
      value={rule}
      className={
        'group rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md ' +
        'p-4 transition-all duration-300 hover:border-[#00FFAA]/30'
      }
    >
      <div className="flex items-start gap-3">
        <div className="cursor-grab active:cursor-grabbing pt-2 text-white/40 hover:text-white/70">
          <GripVertical size={18} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={
                'flex items-center justify-center w-10 h-10 rounded-lg text-lg ' +
                'bg-white/5 border border-white/10'
              }
            >
              {rule.icon || '📜'}
            </div>
            <input
              type="text"
              value={rule.icon}
              onChange={(e) => onChange({ icon: e.target.value.slice(0, 4) })}
              placeholder="🤝"
              maxLength={4}
              className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center"
            />
            <input
              type="text"
              value={rule.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Rule title"
              className={
                'flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
                'focus:outline-none focus:border-[#00FFAA]/70 focus:shadow-[0_0_18px_rgba(0,255,170,0.4)]'
              }
            />
            <div className="text-xs text-white/40 px-2">#{index + 1}</div>
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10"
              title="Delete this rule"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <textarea
            value={rule.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Describe this rule clearly so members know what to do (and not do)."
            rows={2}
            className={
              'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
              'placeholder-white/30 focus:outline-none focus:border-[#00FFAA]/70 ' +
              'focus:shadow-[0_0_18px_rgba(0,255,170,0.4)]'
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs uppercase tracking-wider text-white/40">Severity:</div>
            {SEVERITY_OPTIONS.map((sev) => (
              <button
                key={sev.value}
                type="button"
                onClick={() => onChange({ severity: sev.value })}
                className={
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-300 ' +
                  (rule.severity === sev.value
                    ? 'border-transparent text-black shadow-md'
                    : 'border-white/10 text-white/60 hover:text-white hover:border-white/30')
                }
                style={
                  rule.severity === sev.value
                    ? { background: sev.color }
                    : undefined
                }
              >
                {sev.badge} {sev.label}
              </button>
            ))}

            <label className="flex items-center gap-2 ml-auto text-xs text-white/60">
              <input
                type="checkbox"
                checked={rule.autoEnforced}
                onChange={(e) => onChange({ autoEnforced: e.target.checked })}
                className="accent-[#00FFAA]"
              />
              Auto-enforce (L1 sieve)
            </label>
          </div>

          {severityMeta && (
            <div className="text-[10px] uppercase tracking-wider text-white/30">
              Linked enforcement tier:{' '}
              <span style={{ color: severityMeta.color }}>{severityMeta.label}</span>
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

// ====================================
// LIVE PREVIEW (mimics the Discord embed)
// ====================================

function PreviewEmbed({ config }: { config: RulesConfigState }) {
  const accent = config.accentColor || '#00FFAA';
  return (
    <div className="bg-[#2B2D31] rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-l-4"
      style={{ borderLeftColor: accent }}
    >
      <div className="text-sm font-bold text-white mb-1">{config.headerTitle}</div>
      <div className="text-sm text-[#B5BAC1] whitespace-pre-wrap">{config.headerSubtitle}</div>
      <div className="my-3 h-px bg-white/10" />
      <div className="space-y-2">
        {config.rules.length === 0 && (
          <div className="text-xs italic text-white/30">
            No rules configured — click "Add rule" to start.
          </div>
        )}
        {config.rules.map((rule) => {
          const sev = SEVERITY_OPTIONS.find((s) => s.value === rule.severity);
          return (
            <div key={rule.id} className="text-sm text-white">
              <div className="font-bold">
                {rule.icon} Rule {rule.number}: {rule.title}
              </div>
              {sev && (
                <div className="text-xs" style={{ color: sev.color }}>
                  {sev.badge} {sev.label.toUpperCase()}
                </div>
              )}
              <div className="text-xs text-[#B5BAC1] whitespace-pre-wrap">{rule.body}</div>
            </div>
          );
        })}
      </div>
      <div className="my-3 h-px bg-white/10" />
      <div className="text-xs text-[#B5BAC1] whitespace-pre-wrap">{config.footerText}</div>

      {config.acceptanceGate !== 'none' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#248046] text-white"
          >
            {config.acceptanceGate === 'captcha' ? '✅ I Accept (with captcha)' : '✅ I Accept the Rules'}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#4E5058] text-white"
          >
            🎫 Ask Staff
          </button>
        </div>
      )}
    </div>
  );
}

// ====================================
// MAIN PAGE
// ====================================

function isDirty(a: RulesConfigState, b: RulesConfigState): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export default function RulesConfigPage() {
  const rulesConfig = useDashboardStore((s) => s.rulesConfig);
  const rulesConfigLoading = useDashboardStore((s) => s.rulesConfigLoading);
  const rulesConfigSaving = useDashboardStore((s) => s.rulesConfigSaving);
  const rulesPublishing = useDashboardStore((s) => s.rulesPublishing);
  const fetchRulesConfig = useDashboardStore((s) => s.fetchRulesConfig);
  const updateRulesConfig = useDashboardStore((s) => s.updateRulesConfig);
  const addRule = useDashboardStore((s) => s.addRule);
  const updateRule = useDashboardStore((s) => s.updateRule);
  const deleteRule = useDashboardStore((s) => s.deleteRule);
  const saveRulesConfig = useDashboardStore((s) => s.saveRulesConfig);
  const publishRules = useDashboardStore((s) => s.publishRules);
  const fetchRulesAnalytics = useDashboardStore((s) => s.fetchRulesAnalytics);
  const rulesAnalytics = useDashboardStore((s) => s.rulesAnalytics);

  const discordChannels = useDashboardStore((s) => s.discordChannels);
  const discordRoles = useDashboardStore((s) => s.discordRoles);
  const discordDirectoryLoading = useDashboardStore((s) => s.discordDirectoryLoading);
  const fetchDiscordDirectory = useDashboardStore((s) => s.fetchDiscordDirectory);

  const [baseline, setBaseline] = useState<RulesConfigState>(DEFAULT_RULES_CONFIG_STATE);

  useEffect(() => {
    fetchRulesConfig();
    fetchRulesAnalytics();
    fetchDiscordDirectory();
  }, [fetchRulesConfig, fetchRulesAnalytics, fetchDiscordDirectory]);

  useEffect(() => {
    setBaseline(rulesConfig);
    // Only re-baseline when the underlying guild context shifts; in-page edits
    // should NOT silently reset the dirty marker.
  }, [rulesConfig.guildId]);

  const dirty = useMemo(() => isDirty(baseline, rulesConfig), [baseline, rulesConfig]);

  const handleSave = async () => {
    const toastId = toast.loading('Saving rules…');
    const result = await saveRulesConfig();
    toast.dismiss(toastId);
    if (result.ok) {
      toast.success('Rules saved — gateway hot-reloading…');
      setBaseline(rulesConfig);
    } else {
      toast.error(`Save failed: ${result.error}`);
    }
  };

  const handleReset = () => {
    updateRulesConfig(baseline);
    toast('Reverted to last saved values', { icon: '↩️' });
  };

  const handlePublish = async () => {
    if (dirty) {
      toast('Save your changes before publishing', { icon: '💾' });
      return;
    }
    const toastId = toast.loading('Publishing to Discord…');
    const result = await publishRules({ forceRepost: false });
    toast.dismiss(toastId);
    if (result.ok) {
      toast.success('Rules published / refreshed in Discord');
      fetchRulesAnalytics();
    } else {
      toast.error(`Publish failed: ${result.error}`);
    }
  };

  const handleForceRepost = async () => {
    if (dirty) {
      toast('Save your changes before publishing', { icon: '💾' });
      return;
    }
    if (!window.confirm('Force-repost? This will send a new rules message even if one exists.')) {
      return;
    }
    const toastId = toast.loading('Re-posting rules…');
    const result = await publishRules({ forceRepost: true });
    toast.dismiss(toastId);
    if (result.ok) {
      toast.success('Rules re-posted to Discord');
      fetchRulesAnalytics();
    } else {
      toast.error(`Publish failed: ${result.error}`);
    }
  };

  const applyThemePreset = (key: ThemePresetKey) => {
    const preset = THEME_PRESETS.find((t) => t.key === key);
    if (!preset) return;
    updateRulesConfig({
      themePreset: key,
      accentColor: key === 'custom' ? rulesConfig.accentColor : preset.accent,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Sparkles className="text-[#00FFAA]" size={28} />
              Rules System
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Configure your server's rules embed, acceptance gate, and reward role. Saves hot-reload
              the gateway via Redis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty || rulesConfigSaving}
              className={
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ' +
                'bg-white/5 border border-white/10 text-white/70 ' +
                'hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              <RotateCcw size={16} /> Revert
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || rulesConfigSaving}
              className={
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ' +
                'bg-[#00FFAA] text-black shadow-[0_0_20px_rgba(0,255,170,0.5)] ' +
                'hover:shadow-[0_0_30px_rgba(0,255,170,0.8)] ' +
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
              }
            >
              <Save size={16} /> {rulesConfigSaving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={rulesPublishing || rulesConfigLoading}
              className={
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ' +
                'bg-[#FFD700] text-black shadow-[0_0_20px_rgba(255,215,0,0.5)] ' +
                'hover:shadow-[0_0_30px_rgba(255,215,0,0.7)] ' +
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
              }
            >
              <Megaphone size={16} />
              {rulesPublishing ? 'Publishing…' : 'Publish to channel'}
            </button>
          </div>
        </div>

        {rulesConfig.lastPostedAt && (
          <div className="mt-2 text-xs text-white/40">
            Last posted {new Date(rulesConfig.lastPostedAt).toLocaleString()}
            {rulesConfig.lastPostedMessageId && (
              <>
                {' '}
                · message id <code className="text-white/60">{rulesConfig.lastPostedMessageId}</code>
              </>
            )}
            {'  '}
            <button
              type="button"
              onClick={handleForceRepost}
              className="ml-2 underline hover:text-white/80"
            >
              force repost
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: configuration */}
        <div className="xl:col-span-2 space-y-6">
          {/* Master toggles */}
          <GlassPanel className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ToggleField
                label="Enable rules system"
                description="Master switch — turns the entire rules pipeline on or off."
                icon={<Power size={16} />}
                value={rulesConfig.enabled}
                onChange={(v) => updateRulesConfig({ enabled: v })}
              />
              <ToggleField
                label="Pin after posting"
                description="Pin the rules message in the channel after publish."
                icon={<Pin size={16} />}
                value={rulesConfig.pinAfterPost}
                onChange={(v) => updateRulesConfig({ pinAfterPost: v })}
              />
            </div>
          </GlassPanel>

          {/* Channel + role pickers */}
          <GlassPanel className="p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <ChevronRight size={16} /> Discord wiring
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Rules channel"
                value={rulesConfig.rulesChannelId}
                options={discordChannels.map((c) => ({
                  value: c.id,
                  label: `#${c.name}`,
                  sublabel: c.parentName ?? undefined,
                }))}
                onChange={(v) => updateRulesConfig({ rulesChannelId: v })}
              />
              <SelectField
                label="Member role (assigned on accept)"
                value={rulesConfig.memberRoleId}
                options={discordRoles.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                onChange={(v) => updateRulesConfig({ memberRoleId: v })}
              />
            </div>
            {discordDirectoryLoading && (
              <div className="text-xs text-white/40">Loading channels & roles from gateway…</div>
            )}
            <TextField
              label="Fallback channel name (legacy resolver)"
              value={rulesConfig.channelName}
              onChange={(v) => updateRulesConfig({ channelName: v })}
              placeholder="rules"
            />
          </GlassPanel>

          {/* Acceptance gate */}
          <GlassPanel className="p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Lock size={16} /> Acceptance gate
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {GATE_OPTIONS.map((opt) => {
                const active = rulesConfig.acceptanceGate === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateRulesConfig({ acceptanceGate: opt.value })}
                    className={
                      'rounded-xl p-4 text-left border transition-all duration-300 ' +
                      (active
                        ? 'border-[#00FFAA] bg-[#00FFAA]/10 shadow-[0_0_22px_rgba(0,255,170,0.35)]'
                        : 'border-white/10 bg-white/5 hover:border-white/30')
                    }
                  >
                    <div className="text-sm font-semibold text-white">{opt.label}</div>
                    <div className="text-xs text-white/50 mt-1">{opt.description}</div>
                  </button>
                );
              })}
            </div>
            {rulesConfig.acceptanceGate === 'captcha' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  label="Captcha question"
                  value={rulesConfig.captchaPrompt}
                  onChange={(v) => updateRulesConfig({ captchaPrompt: v })}
                  placeholder="What is 7 + 4?"
                />
                <TextField
                  label="Expected answer"
                  value={rulesConfig.captchaAnswer}
                  onChange={(v) => updateRulesConfig({ captchaAnswer: v })}
                  placeholder="11"
                />
              </div>
            )}
          </GlassPanel>

          {/* Theme preset */}
          <GlassPanel className="p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Sparkles size={16} /> Theme preset
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {THEME_PRESETS.map((p) => {
                const active = rulesConfig.themePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyThemePreset(p.key)}
                    className={
                      'rounded-xl p-3 text-left border transition-all duration-300 ' +
                      (active
                        ? 'border-transparent shadow-[0_0_22px_rgba(0,255,170,0.35)]'
                        : 'border-white/10 hover:border-white/30')
                    }
                    style={
                      active
                        ? {
                            background:
                              `linear-gradient(135deg, ${p.accent}33 0%, transparent 80%)`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ background: p.accent }}
                      />
                      <span className="text-sm font-semibold text-white">{p.label}</span>
                    </div>
                    <div className="text-xs text-white/50 mt-1">{p.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Accent color (hex)"
                value={rulesConfig.accentColor}
                onChange={(v) => updateRulesConfig({ accentColor: v })}
                placeholder="#00FFAA"
              />
            </div>
          </GlassPanel>

          {/* Copy */}
          <GlassPanel className="p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Type size={16} /> Copy
            </h2>
            <TextField
              label="Header title"
              value={rulesConfig.headerTitle}
              onChange={(v) => updateRulesConfig({ headerTitle: v })}
            />
            <TextField
              label="Header subtitle / intro"
              value={rulesConfig.headerSubtitle}
              onChange={(v) => updateRulesConfig({ headerSubtitle: v })}
              multiline
            />
            <TextField
              label="Footer text"
              value={rulesConfig.footerText}
              onChange={(v) => updateRulesConfig({ footerText: v })}
              multiline
            />
          </GlassPanel>

          {/* Rules list (drag-reorder) */}
          <GlassPanel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
                <ShieldCheck size={16} /> Rules ({rulesConfig.rules.length})
              </h2>
              <button
                type="button"
                onClick={addRule}
                className={
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ' +
                  'bg-[#00FFAA]/15 text-[#00FFAA] border border-[#00FFAA]/30 ' +
                  'hover:bg-[#00FFAA]/25'
                }
              >
                <Plus size={16} /> Add rule
              </button>
            </div>

            {rulesConfig.rules.length === 0 ? (
              <div className="text-sm text-white/40 italic px-4 py-6 text-center border border-dashed border-white/10 rounded-xl">
                No rules yet — click "Add rule" to create your first one. Drag to reorder.
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={rulesConfig.rules}
                onReorder={(next: RuleCardState[]) =>
                  updateRulesConfig({
                    rules: next.map((r, i) => ({ ...r, number: i + 1 })),
                  })
                }
                className="space-y-3"
              >
                {rulesConfig.rules.map((rule, index) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    index={index}
                    onChange={(patch) => updateRule(rule.id, patch)}
                    onDelete={() => deleteRule(rule.id)}
                  />
                ))}
              </Reorder.Group>
            )}
          </GlassPanel>
        </div>

        {/* RIGHT: preview + analytics */}
        <div className="space-y-6">
          <GlassPanel className="p-5 space-y-3">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <KeyRound size={16} /> Live preview
            </h2>
            <PreviewEmbed config={rulesConfig} />
          </GlassPanel>

          <GlassPanel className="p-5 space-y-3">
            <h2 className="text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Activity size={16} /> Acceptance analytics
            </h2>
            {!rulesAnalytics ? (
              <div className="text-xs text-white/40 italic">Loading…</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <StatBlock label="Total" value={rulesAnalytics.totalAccepted} />
                  <StatBlock label="24h" value={rulesAnalytics.last24h} />
                  <StatBlock label="7d" value={rulesAnalytics.last7d} />
                </div>
                <div className="text-xs text-white/50">By method:</div>
                {rulesAnalytics.byMethod.length === 0 && (
                  <div className="text-xs text-white/30 italic">No acceptances yet</div>
                )}
                {rulesAnalytics.byMethod.map((m) => (
                  <motion.div
                    key={m.method}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-white/70">{m.method}</span>
                    <span className="text-white/90 font-mono">{m.count}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="p-5 space-y-3">
            <h2 className="text-sm uppercase tracking-wider text-white/60">Recent acceptances</h2>
            {!rulesAnalytics || rulesAnalytics.recent.length === 0 ? (
              <div className="text-xs text-white/30 italic">No one has accepted yet</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {rulesAnalytics.recent.map((r) => (
                  <div
                    key={`${r.userId}-${r.acceptedAt}`}
                    className="text-xs flex items-center justify-between gap-3 p-2 rounded bg-white/5"
                  >
                    <div className="text-white truncate">{r.username || r.userId}</div>
                    <div className="text-white/40 shrink-0">
                      {r.method} · {new Date(r.acceptedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 p-3 text-center">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-xl font-bold text-[#00FFAA]">{value}</div>
    </div>
  );
}
