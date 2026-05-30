// ====================================
// SOVEREIGN COMMAND PALETTE
// CMD+K Keyboard-Driven Command Interface
// Kinetic Kernel Protocol v4.0
// ====================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Scan,
    Thermometer,
    Shield,
    Lock,
    FileText,
    Terminal,
    Zap,
    User,
    X,
    Command,
    ArrowRight,
} from 'lucide-react';

// ====================================
// TYPES
// ====================================

interface SovereignCommand {
    id: string;
    name: string;
    description: string;
    shortcut?: string;
    icon: React.ElementType;
    category: 'scan' | 'thermal' | 'moderation' | 'forensic' | 'system';
    action: (args?: string[]) => void | Promise<void>;
    dangerous?: boolean;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onExecute?: (commandId: string, args?: string[]) => void;
}

// ====================================
// COMMAND REGISTRY
// ====================================

const createCommandRegistry = (
    onExecute?: (commandId: string, args?: string[]) => void
): SovereignCommand[] => [
        {
            id: 'scan-deep',
            name: '/scan --depth 3',
            description: 'L1-L3 recursive scan on last 50 messages',
            shortcut: '⌘S',
            icon: Scan,
            category: 'scan',
            action: () => onExecute?.('scan-deep', ['--depth', '3']),
        },
        {
            id: 'scan-channel',
            name: '/scan --channel',
            description: 'Scan current channel for threats',
            icon: Scan,
            category: 'scan',
            action: () => onExecute?.('scan-channel'),
        },
        {
            id: 'thermal-focus',
            name: '/thermal --focus',
            description: 'Isolate 3D Prism to highest-flux channel',
            shortcut: '⌘T',
            icon: Thermometer,
            category: 'thermal',
            action: () => onExecute?.('thermal-focus'),
        },
        {
            id: 'thermal-map',
            name: '/thermal --map',
            description: 'Open full Thermal Heat Map view',
            icon: Thermometer,
            category: 'thermal',
            action: () => onExecute?.('thermal-map'),
        },
        {
            id: 'shadow-wipe',
            name: '/shadow-wipe [USER_ID]',
            description: 'Reset user momentum vector for rehabilitation',
            icon: User,
            category: 'moderation',
            action: (args) => onExecute?.('shadow-wipe', args),
        },
        {
            id: 'lockdown-kinetic',
            name: '/lockdown --kinetic',
            description: 'Global UI freeze + pause all new joins',
            shortcut: '⌘L',
            icon: Lock,
            category: 'moderation',
            action: () => onExecute?.('lockdown-kinetic'),
            dangerous: true,
        },
        {
            id: 'forensic-export',
            name: '/forensic --export',
            description: 'Generate PDF Crime Scene Report',
            shortcut: '⌘E',
            icon: FileText,
            category: 'forensic',
            action: () => onExecute?.('forensic-export'),
        },
        {
            id: 'forensic-timeline',
            name: '/forensic --timeline',
            description: 'Open Forensic Scrubber timeline',
            icon: FileText,
            category: 'forensic',
            action: () => onExecute?.('forensic-timeline'),
        },
        {
            id: 'system-status',
            name: '/status',
            description: 'Show Guardian system health',
            icon: Shield,
            category: 'system',
            action: () => onExecute?.('system-status'),
        },
    ];

// ====================================
// CATEGORY COLORS
// ====================================

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    scan: { bg: 'bg-neon-cyan/10', text: 'text-neon-cyan', border: 'border-neon-cyan/30' },
    thermal: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
    moderation: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/30' },
    forensic: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30' },
    system: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
};

// ====================================
// COMMAND PALETTE COMPONENT
// ====================================

export default function CommandPalette({
    isOpen,
    onClose,
    onExecute,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isExecuting, setIsExecuting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const commands = useMemo(() => createCommandRegistry(onExecute), [onExecute]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query) return commands;
        const lowerQuery = query.toLowerCase();
        return commands.filter(
            cmd =>
                cmd.name.toLowerCase().includes(lowerQuery) ||
                cmd.description.toLowerCase().includes(lowerQuery) ||
                cmd.category.includes(lowerQuery)
        );
    }, [query, commands]);

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, SovereignCommand[]> = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onClose]);

    // Execute command
    const executeCommand = async (cmd: SovereignCommand) => {
        setIsExecuting(true);
        try {
            // Parse args from query if present
            const args = query.includes(' ')
                ? query.split(' ').slice(1).filter(a => a && !a.startsWith('/'))
                : undefined;
            await cmd.action(args);
            onClose();
        } catch (error) {
            console.error('Command execution failed:', error);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-avenlo-obsidian/80 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[600px] max-h-[60vh] z-50 overflow-hidden rounded-2xl border border-avenlo-border/50 bg-avenlo-obsidian shadow-2xl"
                        style={{ boxShadow: '0 0 60px rgba(0, 212, 255, 0.1)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 p-4 border-b border-avenlo-border/30">
                            <div className="p-2 rounded-lg bg-neon-cyan/10">
                                <Terminal className="w-5 h-5 text-neon-cyan" />
                            </div>
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a command or search..."
                                    className="w-full pl-10 pr-4 py-2 bg-black/30 border border-avenlo-border/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50 font-mono"
                                />
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-avenlo-card/50 border border-avenlo-border/30">
                                <Command className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-500">K</span>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-avenlo-card/50 transition-colors">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        {/* Commands List */}
                        <div className="max-h-[400px] overflow-y-auto p-2">
                            {Object.entries(groupedCommands).map(([category, cmds]) => (
                                <div key={category} className="mb-3">
                                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {category}
                                    </div>
                                    {cmds.map((cmd) => {
                                        const isSelected = filteredCommands[selectedIndex]?.id === cmd.id;
                                        const colors = categoryColors[cmd.category];
                                        const Icon = cmd.icon;

                                        return (
                                            <motion.button
                                                key={cmd.id}
                                                onClick={() => executeCommand(cmd)}
                                                className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                          ${isSelected
                                                        ? `${colors.bg} border ${colors.border}`
                                                        : 'hover:bg-avenlo-card/50 border border-transparent'
                                                    }
                        `}
                                                whileHover={{ x: 4 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <div className={`p-2 rounded-lg ${colors.bg}`}>
                                                    <Icon className={`w-4 h-4 ${colors.text}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-mono text-sm ${isSelected ? colors.text : 'text-white'}`}>
                                                            {cmd.name}
                                                        </span>
                                                        {cmd.dangerous && (
                                                            <span className="px-1.5 py-0.5 rounded text-xs bg-neon-red/20 text-neon-red">
                                                                DANGEROUS
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-500 truncate block">
                                                        {cmd.description}
                                                    </span>
                                                </div>
                                                {cmd.shortcut && (
                                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-avenlo-card/50 border border-avenlo-border/30">
                                                        <span className="text-xs text-gray-400 font-mono">{cmd.shortcut}</span>
                                                    </div>
                                                )}
                                                <ArrowRight className={`w-4 h-4 ${isSelected ? colors.text : 'text-gray-600'}`} />
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            ))}

                            {filteredCommands.length === 0 && (
                                <div className="py-8 text-center">
                                    <Zap className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                                    <p className="text-gray-500">No commands found</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-avenlo-border/30 bg-black/20">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-avenlo-card/50 border border-avenlo-border/30">↑↓</kbd>
                                    Navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-avenlo-card/50 border border-avenlo-border/30">↵</kbd>
                                    Execute
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-avenlo-card/50 border border-avenlo-border/30">Esc</kbd>
                                    Close
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Shield className="w-3 h-3" />
                                <span>Sovereign Kernel v4.0</span>
                            </div>
                        </div>

                        {/* Executing overlay */}
                        <AnimatePresence>
                            {isExecuting && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-avenlo-obsidian/90 flex items-center justify-center"
                                >
                                    <div className="text-center">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto mb-3"
                                        />
                                        <p className="text-neon-cyan font-mono">Executing...</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ====================================
// KEYBOARD HOOK
// ====================================

export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // CMD+K or Ctrl+K
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev),
    };
}
