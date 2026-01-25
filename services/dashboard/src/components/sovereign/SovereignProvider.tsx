// ====================================
// AVENLO CORE - SOVEREIGN PROVIDER
// Global Command Palette Context
// ====================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SovereignCommandPalette, CommandResult } from './SovereignCommandPalette';

// ====================================
// CONTEXT TYPES
// ====================================

interface SovereignContextType {
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  isPaletteOpen: boolean;
  lastCommandResult: CommandResult | null;
  executeQuickCommand: (commandId: string) => void;
}

const SovereignContext = createContext<SovereignContextType | null>(null);

// ====================================
// HOOK
// ====================================

export const useSovereign = (): SovereignContextType => {
  const context = useContext(SovereignContext);
  if (!context) {
    throw new Error('useSovereign must be used within SovereignProvider');
  }
  return context;
};

// ====================================
// PROVIDER COMPONENT
// ====================================

interface SovereignProviderProps {
  children: React.ReactNode;
}

export const SovereignProvider: React.FC<SovereignProviderProps> = ({ children }) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [lastCommandResult, setLastCommandResult] = useState<CommandResult | null>(null);

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  const togglePalette = useCallback(() => setIsPaletteOpen((prev) => !prev), []);

  // Global keyboard shortcut: CMD/CTRL + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePalette]);

  // Execute quick command by ID
  const executeQuickCommand = useCallback((commandId: string) => {
    // This would integrate with the command registry
    console.log(`Quick execute: ${commandId}`);
    openPalette();
  }, [openPalette]);

  const handleCommandExecute = useCallback((result: CommandResult) => {
    setLastCommandResult(result);
    
    // Log to console for debugging
    console.log('Command Executed:', result);

    // Here you would dispatch to your event system
    // Example: emit to Redis via WebSocket
  }, []);

  const value: SovereignContextType = {
    openPalette,
    closePalette,
    togglePalette,
    isPaletteOpen,
    lastCommandResult,
    executeQuickCommand,
  };

  return (
    <SovereignContext.Provider value={value}>
      {children}
      <SovereignCommandPalette
        isOpen={isPaletteOpen}
        onClose={closePalette}
        onCommandExecute={handleCommandExecute}
      />
    </SovereignContext.Provider>
  );
};

export default SovereignProvider;
