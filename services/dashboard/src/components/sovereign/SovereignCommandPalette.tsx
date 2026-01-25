// ====================================
// AVENLO CORE - SOVEREIGN COMMAND PALETTE
// The Voice of the Kinetic Intelligence Engine
// ====================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';

// ====================================
// TYPES & INTERFACES
// ====================================

export type CommandTier = 'sovereign' | 'strategic' | 'tactical';
export type CommandCategory = 'moderation' | 'policy' | 'forensics' | 'system' | 'analytics';

export interface SovereignCommand {
  id: string;
  name: string;
  description: string;
  tier: CommandTier;
  category: CommandCategory;
  syntax: string;
  shortcut?: string;
  icon: string;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
  parameters?: CommandParameter[];
  execute: (params: Record<string, string>) => Promise<CommandResult>;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'user' | 'channel' | 'number' | 'select' | 'boolean';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: RegExp;
}

export interface CommandResult {
  success: boolean;
  aiReasoning: string;
  intentVector: number[];
  socialContext: string;
  actionTaken: string;
  metadata?: Record<string, unknown>;
}

// ====================================
// TIER CONFIGURATION
// ====================================

const TierConfig: Record<CommandTier, { color: string; glow: string; label: string; icon: string }> = {
  sovereign: {
    color: '#FFD700',
    glow: 'rgba(255, 215, 0, 0.4)',
    label: 'Sovereign Scepter',
    icon: '👑',
  },
  strategic: {
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.4)',
    label: 'Strategic Shield',
    icon: '🛡️',
  },
  tactical: {
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.4)',
    label: 'Tactical Blade',
    icon: '🗡️',
  },
};

const CategoryIcons: Record<CommandCategory, string> = {
  moderation: '⚔️',
  policy: '📜',
  forensics: '🔍',
  system: '⚙️',
  analytics: '📊',
};

// ====================================
// COMMAND REGISTRY
// ====================================

const createCommandRegistry = (): SovereignCommand[] => [
  // ========== SOVEREIGN SCEPTER COMMANDS ==========
  {
    id: 'pivot-vibe',
    name: 'Pivot Vibe Coefficient',
    description: 'Dynamically re-trains the L2 Analyst sensitivity weights in real-time',
    tier: 'sovereign',
    category: 'policy',
    syntax: '/avenlo --pivot [Vibe]',
    icon: '🎯',
    parameters: [
      {
        name: 'vibe',
        type: 'select',
        required: true,
        options: ['professional', 'casual', 'gaming', 'creative', 'support', 'trading'],
      },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Vibe coefficient recalibrated to "${params.vibe}" mode. L2 Analyst weights adjusted for contextual sensitivity.`,
      intentVector: [0.95, 0.02, 0.03],
      socialContext: 'Server-wide policy modification',
      actionTaken: `VIBE_PIVOT: ${params.vibe.toUpperCase()}`,
    }),
  },
  {
    id: 'nuke-protocol',
    name: 'Nuclear Safe-State',
    description: 'Immediate Safe-State Zero. All API keys rotated; all channels become read-only',
    tier: 'sovereign',
    category: 'system',
    syntax: '/avenlo --nuke',
    icon: '☢️',
    dangerous: true,
    requiresConfirmation: true,
    execute: async () => ({
      success: true,
      aiReasoning: 'CRITICAL: Safe-State Zero initiated. All external integrations suspended. Channels locked to read-only.',
      intentVector: [1.0, 0.0, 0.0],
      socialContext: 'Emergency protocol activation',
      actionTaken: 'SAFE_STATE_ZERO',
    }),
  },
  {
    id: 'rehabilitate-user',
    name: 'Rehabilitate User',
    description: 'Grants Legacy Trust flag, making user immune to L2 scrutiny',
    tier: 'sovereign',
    category: 'moderation',
    syntax: '/avenlo --rehabilitate [User]',
    icon: '🕊️',
    parameters: [
      { name: 'user', type: 'user', required: true, placeholder: '@username or ID' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `User ${params.user} granted Legacy Trust status. L2 Contextual Analyst bypass enabled.`,
      intentVector: [0.1, 0.85, 0.05],
      socialContext: 'Trust elevation ceremony',
      actionTaken: `LEGACY_TRUST_GRANTED: ${params.user}`,
    }),
  },
  {
    id: 'thermal-decay-config',
    name: 'Configure Thermal Decay',
    description: 'Adjust the thermal decay constant (λ) for sentiment flux calculations',
    tier: 'sovereign',
    category: 'system',
    syntax: '/avenlo --thermal-decay [λ]',
    icon: '🌡️',
    parameters: [
      { name: 'lambda', type: 'number', required: true, placeholder: '0.01 - 0.5' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Thermal decay constant adjusted to λ=${params.lambda}. Sentiment flux will now decay at modified rate.`,
      intentVector: [0.7, 0.2, 0.1],
      socialContext: 'Kinetic engine parameter adjustment',
      actionTaken: `THERMAL_DECAY_SET: λ=${params.lambda}`,
    }),
  },

  // ========== STRATEGIC SHIELD COMMANDS ==========
  {
    id: 'policy-inject',
    name: 'Inject Policy',
    description: 'Translate natural language into heuristic weights for L2 Analyst',
    tier: 'strategic',
    category: 'policy',
    syntax: '/policy --inject [Natural Language]',
    icon: '💉',
    parameters: [
      { name: 'policy', type: 'string', required: true, placeholder: "Don't allow toxic discussions about crypto" },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Policy injected: "${params.policy}". Heuristic weights generated and applied to L2 filter.`,
      intentVector: [0.6, 0.3, 0.1],
      socialContext: 'Policy layer modification',
      actionTaken: `POLICY_INJECTED: ${params.policy.slice(0, 50)}...`,
    }),
  },
  {
    id: 'lockdown-toggle',
    name: 'Toggle Lockdown',
    description: 'Toggles the Token-Bucket raid detector between Hard and Soft modes',
    tier: 'strategic',
    category: 'system',
    syntax: '/lockdown [Hard/Soft]',
    icon: '🔒',
    parameters: [
      { name: 'mode', type: 'select', required: true, options: ['hard', 'soft', 'disable'] },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Lockdown mode set to "${params.mode}". Raid detection sensitivity adjusted accordingly.`,
      intentVector: [0.8, 0.15, 0.05],
      socialContext: 'Defensive posture change',
      actionTaken: `LOCKDOWN_${params.mode.toUpperCase()}`,
    }),
  },
  {
    id: 'sieve-patch',
    name: 'Patch Entropic Sieve',
    description: 'Updates the L1 filter patterns without system restart',
    tier: 'strategic',
    category: 'moderation',
    syntax: '/sieve --patch [Pattern]',
    icon: '🩹',
    parameters: [
      { name: 'pattern', type: 'string', required: true, placeholder: 'Regex pattern or keyword' },
      { name: 'action', type: 'select', required: true, options: ['block', 'flag', 'monitor'] },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `L1 Entropic Sieve patched with new pattern. Action: ${params.action}`,
      intentVector: [0.5, 0.4, 0.1],
      socialContext: 'Filter layer hot-patch',
      actionTaken: `SIEVE_PATCHED: ${params.pattern} → ${params.action}`,
    }),
  },
  {
    id: 'channel-mute',
    name: 'Channel Mute',
    description: 'Temporarily mute a channel with optional duration',
    tier: 'strategic',
    category: 'moderation',
    syntax: '/channel --mute [Channel] [Duration]',
    icon: '🔇',
    parameters: [
      { name: 'channel', type: 'channel', required: true, placeholder: '#channel-name' },
      { name: 'duration', type: 'string', required: false, placeholder: '30m, 1h, 24h' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Channel ${params.channel} muted for ${params.duration || 'indefinite'}.`,
      intentVector: [0.7, 0.2, 0.1],
      socialContext: 'Channel isolation protocol',
      actionTaken: `CHANNEL_MUTED: ${params.channel}`,
    }),
  },

  // ========== TACTICAL BLADE COMMANDS ==========
  {
    id: 'thermal-view',
    name: 'Thermal Visualization',
    description: 'Opens the 3D Heat Prism visualization for current server state',
    tier: 'tactical',
    category: 'analytics',
    syntax: '/thermal',
    shortcut: 'T',
    icon: '🔥',
    execute: async () => ({
      success: true,
      aiReasoning: 'Thermal visualization initialized. Rendering 3D Heat Prism with current channel sentiment data.',
      intentVector: [0.1, 0.1, 0.8],
      socialContext: 'Analytics view request',
      actionTaken: 'THERMAL_VIEW_OPENED',
    }),
  },
  {
    id: 'forensic-inspect',
    name: 'Forensic Inspection',
    description: 'Opens the CSI Logic Sheet for detailed incident analysis',
    tier: 'tactical',
    category: 'forensics',
    syntax: '/forensic [ID]',
    shortcut: 'F',
    icon: '🔬',
    parameters: [
      { name: 'incidentId', type: 'string', required: true, placeholder: 'Incident ID or Message ID' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Forensic analysis loaded for incident ${params.incidentId}. CSI Logic Sheet populated.`,
      intentVector: [0.2, 0.3, 0.5],
      socialContext: 'Incident investigation',
      actionTaken: `FORENSIC_LOADED: ${params.incidentId}`,
    }),
  },
  {
    id: 'shadow-inspect',
    name: 'Shadow Score Inspect',
    description: 'Displays the 24-hour Reputation Sparkline for a user',
    tier: 'tactical',
    category: 'analytics',
    syntax: '/shadow [User]',
    shortcut: 'S',
    icon: '👤',
    parameters: [
      { name: 'user', type: 'user', required: true, placeholder: '@username or ID' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Shadow score timeline loaded for ${params.user}. Displaying 24-hour reputation sparkline.`,
      intentVector: [0.15, 0.25, 0.6],
      socialContext: 'User reputation analysis',
      actionTaken: `SHADOW_LOADED: ${params.user}`,
    }),
  },
  {
    id: 'orbit-view',
    name: 'Reputation Orbit',
    description: 'Opens the 3D Reputation Orbit visualization',
    tier: 'tactical',
    category: 'analytics',
    syntax: '/orbit',
    shortcut: 'O',
    icon: '🪐',
    execute: async () => ({
      success: true,
      aiReasoning: 'Reputation Orbit visualization initialized. Rendering user gravitational field.',
      intentVector: [0.1, 0.1, 0.8],
      socialContext: 'Analytics view request',
      actionTaken: 'ORBIT_VIEW_OPENED',
    }),
  },
  {
    id: 'activity-stream',
    name: 'Activity Stream',
    description: 'Opens the real-time Kinetic Feed of all shadow-score updates',
    tier: 'tactical',
    category: 'analytics',
    syntax: '/stream',
    shortcut: 'A',
    icon: '📡',
    execute: async () => ({
      success: true,
      aiReasoning: 'Kinetic Feed stream opened. Real-time shadow-score updates now visible.',
      intentVector: [0.1, 0.2, 0.7],
      socialContext: 'Real-time monitoring',
      actionTaken: 'KINETIC_FEED_OPENED',
    }),
  },
  {
    id: 'quick-warn',
    name: 'Quick Warn',
    description: 'Issue a quick warning to a user with AI-generated reasoning',
    tier: 'tactical',
    category: 'moderation',
    syntax: '/warn [User] [Reason]',
    shortcut: 'W',
    icon: '⚠️',
    parameters: [
      { name: 'user', type: 'user', required: true, placeholder: '@username or ID' },
      { name: 'reason', type: 'string', required: true, placeholder: 'Reason for warning' },
    ],
    execute: async (params) => ({
      success: true,
      aiReasoning: `Warning issued to ${params.user}. Reason: ${params.reason}. Shadow score impact: -5 points.`,
      intentVector: [0.6, 0.3, 0.1],
      socialContext: 'Disciplinary action',
      actionTaken: `USER_WARNED: ${params.user}`,
    }),
  },
];

// ====================================
// PALETTE COMPONENT
// ====================================

interface SovereignCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandExecute?: (result: CommandResult) => void;
}

export const SovereignCommandPalette: React.FC<SovereignCommandPaletteProps> = ({
  isOpen,
  onClose,
  onCommandExecute,
}) => {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<SovereignCommand | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paramInputRef = useRef<HTMLInputElement>(null);

  // Get user's tier based on role
  const userTier = useMemo((): CommandTier => {
    if (!user) return 'tactical';
    if (user.roles?.includes('owner')) return 'sovereign';
    if (user.roles?.includes('admin') || user.isAdmin) return 'strategic';
    return 'tactical';
  }, [user]);

  // Filter commands based on user tier
  const commands = useMemo(() => {
    const registry = createCommandRegistry();
    const tierHierarchy: CommandTier[] = ['tactical', 'strategic', 'sovereign'];
    const userTierIndex = tierHierarchy.indexOf(userTier);
    
    return registry.filter((cmd) => {
      const cmdTierIndex = tierHierarchy.indexOf(cmd.tier);
      return cmdTierIndex <= userTierIndex;
    });
  }, [userTier]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.syntax.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by tier
  const groupedCommands = useMemo(() => {
    const groups: Record<CommandTier, SovereignCommand[]> = {
      sovereign: [],
      strategic: [],
      tactical: [],
    };
    
    filteredCommands.forEach((cmd) => {
      groups[cmd.tier].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveCommand(null);
      setParamValues({});
      setLastResult(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Focus param input when command is selected
  useEffect(() => {
    if (activeCommand && activeCommand.parameters?.length) {
      setTimeout(() => paramInputRef.current?.focus(), 100);
    }
  }, [activeCommand]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmationPending) {
          setConfirmationPending(false);
        } else if (activeCommand) {
          setActiveCommand(null);
          setParamValues({});
        } else {
          onClose();
        }
        return;
      }

      if (activeCommand) return; // Let parameter inputs handle their own keys

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex]);
      }
    },
    [activeCommand, confirmationPending, filteredCommands, selectedIndex, onClose]
  );

  // Select a command
  const selectCommand = useCallback((cmd: SovereignCommand) => {
    if (cmd.parameters && cmd.parameters.length > 0) {
      setActiveCommand(cmd);
      setParamValues({});
    } else {
      executeCommand(cmd, {});
    }
  }, []);

  // Execute command
  const executeCommand = useCallback(
    async (cmd: SovereignCommand, params: Record<string, string>) => {
      if (cmd.requiresConfirmation && !confirmationPending) {
        setConfirmationPending(true);
        return;
      }

      setIsExecuting(true);
      setConfirmationPending(false);

      try {
        const result = await cmd.execute(params);
        setLastResult(result);
        onCommandExecute?.(result);

        // Auto-close after successful non-dangerous commands
        if (!cmd.dangerous) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } catch (error) {
        setLastResult({
          success: false,
          aiReasoning: `Command execution failed: ${error}`,
          intentVector: [0, 0, 0],
          socialContext: 'Error state',
          actionTaken: 'COMMAND_FAILED',
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [confirmationPending, onCommandExecute, onClose]
  );

  // Handle parameter submission
  const handleParamSubmit = useCallback(() => {
    if (!activeCommand) return;

    // Validate required parameters
    const missingParams = activeCommand.parameters?.filter(
      (p) => p.required && !paramValues[p.name]
    );

    if (missingParams && missingParams.length > 0) {
      return; // Don't submit if required params missing
    }

    executeCommand(activeCommand, paramValues);
  }, [activeCommand, paramValues, executeCommand]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-[15%] z-50 w-full max-w-2xl -translate-x-1/2"
            onKeyDown={handleKeyDown}
          >
            <div
              className="overflow-hidden rounded-2xl border border-white/10"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                backdropFilter: 'blur(40px)',
                boxShadow: `
                  0 0 0 1px rgba(255, 255, 255, 0.05),
                  0 25px 50px -12px rgba(0, 0, 0, 0.8),
                  0 0 100px ${TierConfig[userTier].glow}
                `,
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <span className="text-2xl">{TierConfig[userTier].icon}</span>
                <div className="flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(0);
                    }}
                    placeholder={`${TierConfig[userTier].label} Command Palette...`}
                    className="w-full bg-transparent text-lg text-white placeholder-white/40 outline-none"
                    disabled={!!activeCommand}
                  />
                </div>
                <kbd className="rounded bg-white/10 px-2 py-1 text-xs text-white/50">
                  ⌘K
                </kbd>
              </div>

              {/* Active Command Parameters */}
              {activeCommand && !lastResult && (
                <div className="border-b border-white/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">{activeCommand.icon}</span>
                    <span className="font-medium text-white">{activeCommand.name}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${TierConfig[activeCommand.tier].color}20`,
                        color: TierConfig[activeCommand.tier].color,
                      }}
                    >
                      {TierConfig[activeCommand.tier].label}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeCommand.parameters?.map((param, idx) => (
                      <div key={param.name}>
                        <label className="mb-1 block text-sm text-white/60">
                          {param.name}
                          {param.required && <span className="text-red-400"> *</span>}
                        </label>
                        {param.type === 'select' ? (
                          <select
                            value={paramValues[param.name] || ''}
                            onChange={(e) =>
                              setParamValues((v) => ({ ...v, [param.name]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                          >
                            <option value="">Select {param.name}...</option>
                            {param.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            ref={idx === 0 ? paramInputRef : undefined}
                            type={param.type === 'number' ? 'number' : 'text'}
                            value={paramValues[param.name] || ''}
                            onChange={(e) =>
                              setParamValues((v) => ({ ...v, [param.name]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleParamSubmit();
                              }
                            }}
                            placeholder={param.placeholder}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 outline-none focus:border-white/30"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Confirmation Dialog */}
                  {confirmationPending && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-red-400">
                        <span className="text-lg">⚠️</span>
                        <span className="font-medium">Dangerous Operation</span>
                      </div>
                      <p className="mb-3 text-sm text-white/70">
                        This action cannot be undone. Are you sure you want to proceed?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => executeCommand(activeCommand, paramValues)}
                          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                        >
                          Confirm Execution
                        </button>
                        <button
                          onClick={() => setConfirmationPending(false)}
                          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Execute Button */}
                  {!confirmationPending && (
                    <button
                      onClick={handleParamSubmit}
                      disabled={isExecuting}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 font-medium text-white transition-all"
                      style={{
                        backgroundColor: TierConfig[activeCommand.tier].color,
                        opacity: isExecuting ? 0.7 : 1,
                      }}
                    >
                      {isExecuting ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          >
                            ⚡
                          </motion.span>
                          Executing...
                        </>
                      ) : (
                        <>Execute Command</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Command Result */}
              {lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-b border-white/10 p-4"
                >
                  <div
                    className={`mb-3 flex items-center gap-2 ${
                      lastResult.success ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    <span className="text-lg">{lastResult.success ? '✓' : '✗'}</span>
                    <span className="font-medium">
                      {lastResult.success ? 'Command Executed' : 'Execution Failed'}
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-white/50">AI Reasoning:</span>
                      <p className="mt-1 text-white/80">{lastResult.aiReasoning}</p>
                    </div>

                    <div className="flex gap-4">
                      <div>
                        <span className="text-white/50">Intent Vector:</span>
                        <div className="mt-1 flex gap-1">
                          {lastResult.intentVector.map((v, i) => (
                            <div
                              key={i}
                              className="h-2 rounded-full"
                              style={{
                                width: `${v * 60}px`,
                                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'][i],
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-white/50">Action:</span>
                        <p className="mt-1 font-mono text-xs text-emerald-400">
                          {lastResult.actionTaken}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Command List */}
              {!activeCommand && !lastResult && (
                <div className="max-h-96 overflow-y-auto">
                  {(['sovereign', 'strategic', 'tactical'] as CommandTier[]).map((tier) => {
                    const tierCommands = groupedCommands[tier];
                    if (tierCommands.length === 0) return null;

                    // Only show tiers the user has access to
                    const tierHierarchy: CommandTier[] = ['tactical', 'strategic', 'sovereign'];
                    const userTierIndex = tierHierarchy.indexOf(userTier);
                    const currentTierIndex = tierHierarchy.indexOf(tier);
                    if (currentTierIndex > userTierIndex) return null;

                    return (
                      <div key={tier}>
                        <div
                          className="sticky top-0 flex items-center gap-2 px-4 py-2 text-xs font-medium"
                          style={{
                            backgroundColor: 'rgba(5, 5, 5, 0.98)',
                            color: TierConfig[tier].color,
                          }}
                        >
                          {TierConfig[tier].icon} {TierConfig[tier].label}
                        </div>

                        {tierCommands.map((cmd) => {
                          const isSelected =
                            filteredCommands[selectedIndex]?.id === cmd.id;

                          return (
                            <button
                              key={cmd.id}
                              onClick={() => selectCommand(cmd)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                              }`}
                              style={{
                                borderLeft: isSelected
                                  ? `3px solid ${TierConfig[tier].color}`
                                  : '3px solid transparent',
                              }}
                            >
                              <span className="text-xl">{cmd.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{cmd.name}</span>
                                  {cmd.dangerous && (
                                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                                      Dangerous
                                    </span>
                                  )}
                                  {cmd.shortcut && (
                                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
                                      {cmd.shortcut}
                                    </kbd>
                                  )}
                                </div>
                                <div className="text-sm text-white/50">{cmd.description}</div>
                              </div>
                              <span className="text-xs text-white/30">{CategoryIcons[cmd.category]}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {filteredCommands.length === 0 && (
                    <div className="px-4 py-8 text-center text-white/40">
                      No commands found for "{query}"
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-white/40">
                <div className="flex gap-4">
                  <span>
                    <kbd className="rounded bg-white/10 px-1">↑↓</kbd> Navigate
                  </span>
                  <span>
                    <kbd className="rounded bg-white/10 px-1">↵</kbd> Select
                  </span>
                  <span>
                    <kbd className="rounded bg-white/10 px-1">Esc</kbd> Close
                  </span>
                </div>
                <div>
                  {filteredCommands.length} commands available
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SovereignCommandPalette;
