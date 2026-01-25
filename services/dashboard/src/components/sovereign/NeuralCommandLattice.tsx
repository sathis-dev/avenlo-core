// ====================================
// NEURAL COMMAND LATTICE
// Command Chaining + Kinetic Feedback + Predictive Suggestions
// Sovereign v6.0 Release
// ====================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ====================================
// KINETIC FEEDBACK RIPPLE
// Success/Error pulse animation
// ====================================

interface KineticRippleProps {
    type: 'success' | 'warning' | 'error' | 'gold';
    trigger: boolean;
    onComplete?: () => void;
}

export function KineticRipple({ type, trigger, onComplete }: KineticRippleProps) {
    const colors = {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        gold: '#D4AF37',
    };

    useEffect(() => {
        if (trigger && onComplete) {
            const timer = setTimeout(onComplete, 800);
            return () => clearTimeout(timer);
        }
    }, [trigger, onComplete]);

    return (
        <AnimatePresence>
            {trigger && (
                <motion.div
                    initial={{ opacity: 1, scale: 0 }}
                    animate={{ opacity: 0, scale: 2.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute inset-0 pointer-events-none z-50"
                    style={{
                        background: `radial-gradient(circle at center, ${colors[type]}40, transparent 70%)`,
                        borderRadius: 'inherit',
                    }}
                />
            )}
        </AnimatePresence>
    );
}

// ====================================
// COMMAND CHAIN PARSER
// Parses: /lockdown --then /audit --where "condition"
// ====================================

export interface ChainedCommand {
    command: string;
    args: string[];
    condition?: string;
}

export function parseCommandChain(input: string): ChainedCommand[] {
    const chains: ChainedCommand[] = [];

    // Split by --then
    const segments = input.split(/\s+--then\s+/);

    for (const segment of segments) {
        // Check for --where condition
        const whereMatch = segment.match(/(.+?)\s+--where\s+"([^"]+)"$/);

        if (whereMatch) {
            const [, cmdPart, condition] = whereMatch;
            const parts = cmdPart.trim().split(/\s+/);
            chains.push({
                command: parts[0],
                args: parts.slice(1),
                condition,
            });
        } else {
            const parts = segment.trim().split(/\s+/);
            chains.push({
                command: parts[0],
                args: parts.slice(1),
            });
        }
    }

    return chains;
}

// ====================================
// PREDICTIVE SUGGESTION ENGINE
// Suggests commands based on current context
// ====================================

export interface PredictiveSuggestion {
    command: string;
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    heatCorrelation?: number;
}

export function generatePredictiveSuggestions(
    currentHeat: number,
    recentInfractions: number,
    activeUsers: number
): PredictiveSuggestion[] {
    const suggestions: PredictiveSuggestion[] = [];

    // High heat → suggest thermal view
    if (currentHeat > 60) {
        suggestions.push({
            command: '/thermal',
            reason: `Channel heat at ${currentHeat}% - view thermal map`,
            urgency: currentHeat > 80 ? 'critical' : 'high',
            heatCorrelation: currentHeat / 100,
        });
    }

    // Many recent infractions → suggest forensics
    if (recentInfractions > 5) {
        suggestions.push({
            command: '/forensic --audit',
            reason: `${recentInfractions} recent infractions - review AI decisions`,
            urgency: recentInfractions > 10 ? 'critical' : 'medium',
        });
    }

    // Heat spike → suggest lockdown
    if (currentHeat > 85) {
        suggestions.push({
            command: '/lockdown soft',
            reason: 'Heat spike detected - consider soft lockdown',
            urgency: 'critical',
            heatCorrelation: currentHeat / 100,
        });
    }

    // Low activity → suggest analytics
    if (activeUsers < 10 && currentHeat < 20) {
        suggestions.push({
            command: '/orbit',
            reason: 'Low activity period - review reputation trends',
            urgency: 'low',
        });
    }

    return suggestions.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
}

// ====================================
// GHOST INPUT FIELD
// Translucent, blur-backed input with autocomplete
// ====================================

interface GhostInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    suggestions?: PredictiveSuggestion[];
    onSuggestionSelect?: (suggestion: PredictiveSuggestion) => void;
    disabled?: boolean;
}

export function GhostInput({
    value,
    onChange,
    onSubmit,
    placeholder = 'Enter command...',
    suggestions = [],
    onSuggestionSelect,
    disabled = false,
}: GhostInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(0);

    // Filter suggestions based on input
    const filteredSuggestions = useMemo(() => {
        if (!value || !value.startsWith('/')) return suggestions;
        return suggestions.filter(s =>
            s.command.toLowerCase().includes(value.toLowerCase())
        );
    }, [value, suggestions]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (showSuggestions && filteredSuggestions[selectedSuggestion]) {
                onSuggestionSelect?.(filteredSuggestions[selectedSuggestion]);
                setShowSuggestions(false);
            } else {
                onSubmit();
            }
        } else if (e.key === 'ArrowDown' && showSuggestions) {
            e.preventDefault();
            setSelectedSuggestion(i => Math.min(i + 1, filteredSuggestions.length - 1));
        } else if (e.key === 'ArrowUp' && showSuggestions) {
            e.preventDefault();
            setSelectedSuggestion(i => Math.max(i - 1, 0));
        } else if (e.key === 'Tab' && filteredSuggestions.length > 0) {
            e.preventDefault();
            onSuggestionSelect?.(filteredSuggestions[0]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    }, [showSuggestions, filteredSuggestions, selectedSuggestion, onSubmit, onSuggestionSelect]);

    useEffect(() => {
        setShowSuggestions(value.startsWith('/') && filteredSuggestions.length > 0);
        setSelectedSuggestion(0);
    }, [value, filteredSuggestions.length]);

    const urgencyColors = {
        low: 'text-gray-400',
        medium: 'text-warning',
        high: 'text-neon-red',
        critical: 'text-neon-red animate-pulse',
    };

    return (
        <div className="relative">
            {/* Input container */}
            <div
                className="flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all"
                style={{
                    background: 'rgba(5, 5, 5, 0.8)',
                    backdropFilter: 'blur(20px)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 0 40px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.02)',
                }}
            >
                <span className="text-2xl">⌘</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-lg text-white placeholder-white/30 outline-none font-mono"
                    autoComplete="off"
                />
                <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/40">
                    ↵
                </kbd>
            </div>

            {/* Predictive suggestions dropdown */}
            <AnimatePresence>
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden z-50"
                        style={{
                            background: 'rgba(5, 5, 5, 0.95)',
                            backdropFilter: 'blur(20px)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <div className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider border-b border-white/10">
                            Predictive Suggestions
                        </div>
                        {filteredSuggestions.map((suggestion, i) => (
                            <button
                                key={suggestion.command}
                                onClick={() => {
                                    onSuggestionSelect?.(suggestion);
                                    setShowSuggestions(false);
                                }}
                                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${i === selectedSuggestion ? 'bg-white/10' : 'hover:bg-white/5'}
                `}
                            >
                                <div className={`w-2 h-2 rounded-full ${urgencyColors[suggestion.urgency]}`} />
                                <div className="flex-1">
                                    <div className="font-mono text-white">{suggestion.command}</div>
                                    <div className="text-xs text-white/50">{suggestion.reason}</div>
                                </div>
                                {suggestion.heatCorrelation && (
                                    <div className="flex items-center gap-1">
                                        <div
                                            className="h-1 rounded-full"
                                            style={{
                                                width: `${suggestion.heatCorrelation * 40}px`,
                                                background: `linear-gradient(to right, #F59E0B, #EF4444)`,
                                            }}
                                        />
                                        <span className="text-xs text-white/40">
                                            {Math.round(suggestion.heatCorrelation * 100)}%
                                        </span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ====================================
// COMMAND EXECUTION INDICATOR
// Animated border pulse during execution
// ====================================

interface ExecutionIndicatorProps {
    isExecuting: boolean;
    tier: 'sovereign' | 'strategic' | 'tactical';
}

export function ExecutionIndicator({ isExecuting, tier }: ExecutionIndicatorProps) {
    const tierColors = {
        sovereign: '#D4AF37',
        strategic: '#F59E0B',
        tactical: '#10B981',
    };

    return (
        <AnimatePresence>
            {isExecuting && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                        background: `conic-gradient(from 0deg, ${tierColors[tier]}, transparent, ${tierColors[tier]})`,
                        padding: 2,
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                    }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-full h-full rounded-2xl"
                        style={{
                            background: `conic-gradient(from 0deg, ${tierColors[tier]}, transparent 30%, transparent 70%, ${tierColors[tier]})`,
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ====================================
// LATTICE COMMAND TYPES
// Extended command interface with chaining
// ====================================

export interface LatticeCommand {
    id: string;
    name: string;
    syntax: string;
    tier: 'sovereign' | 'strategic' | 'tactical';
    category: 'intercept' | 'pulse' | 'shadow' | 'lattice' | 'scepter' | 'policy';
    description: string;
    icon: string;
    chainable?: boolean;
}

// Neural Command Lattice v6.0 Commands
export const LATTICE_COMMANDS: LatticeCommand[] = [
    // ========== TACTICAL SUITE ==========
    {
        id: 'intercept',
        name: 'Intercept User',
        syntax: '/intercept [User]',
        tier: 'tactical',
        category: 'intercept',
        description: 'Isolates user messages into private Analyst stream for 60s',
        icon: '🎯',
        chainable: true,
    },
    {
        id: 'pulse-heat',
        name: 'Heat Pulse',
        syntax: '/pulse --heat',
        tier: 'tactical',
        category: 'pulse',
        description: 'Visualizes Heat Wave propagation across server',
        icon: '💫',
    },
    {
        id: 'shadow-inspect',
        name: 'Shadow Inspect',
        syntax: '/shadow --inspect [User]',
        tier: 'tactical',
        category: 'shadow',
        description: 'Deep-dive into reputation history and intent-delta',
        icon: '🔍',
        chainable: true,
    },

    // ========== SOVEREIGN SUITE ==========
    {
        id: 'lattice-sync',
        name: 'Lattice Sync',
        syntax: '/lattice --sync',
        tier: 'sovereign',
        category: 'lattice',
        description: 'Forces Redis (Heat) ↔ MongoDB (Forensics) synchronization',
        icon: '🔄',
    },
    {
        id: 'scepter-override',
        name: 'Scepter Override',
        syntax: '/scepter --override [ActionID]',
        tier: 'sovereign',
        category: 'scepter',
        description: 'Reverses L1/L2 decision and trains AI on mistake',
        icon: '⚖️',
        chainable: true,
    },
    {
        id: 'policy-inject',
        name: 'Policy Inject',
        syntax: '/policy --inject [Vibe]',
        tier: 'sovereign',
        category: 'policy',
        description: 'Updates global Community Vibe coefficients',
        icon: '💉',
    },
];
