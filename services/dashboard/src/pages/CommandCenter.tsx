// ====================================
// AVENLO CORE - SOVEREIGN COMMAND CENTER
// The Central Nervous System Dashboard
// ====================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSovereign, ForensicSideSheet, KineticActivityFeed, QuantumGrid } from '../components/sovereign';
import { useAuthStore } from '../stores/authStore';

// ====================================
// QUICK ACTION BUTTONS
// ====================================

interface QuickActionProps {
  icon: string;
  label: string;
  shortcut?: string;
  tier: 'sovereign' | 'strategic' | 'tactical';
  onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, shortcut, tier, onClick }) => {
  const tierColors = {
    sovereign: '#FFD700',
    strategic: '#F59E0B',
    tactical: '#10B981',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex items-center gap-3 rounded-xl border border-white/10 p-4 text-left transition-all hover:border-white/20"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="font-medium text-white">{label}</div>
        {shortcut && (
          <kbd className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
            {shortcut}
          </kbd>
        )}
      </div>
      <div
        className="h-2 w-2 rounded-full opacity-50 group-hover:opacity-100"
        style={{ backgroundColor: tierColors[tier] }}
      />
    </motion.button>
  );
};

// ====================================
// SYSTEM STATUS CARD
// ====================================

interface SystemStatusProps {
  layer: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: string;
  lastCheck: string;
}

const SystemStatus: React.FC<SystemStatusProps> = ({ layer, name, status, latency, lastCheck }) => {
  const statusColors = {
    online: '#10B981',
    degraded: '#F59E0B',
    offline: '#EF4444',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: statusColors[status],
            boxShadow: `0 0 8px ${statusColors[status]}`,
          }}
        />
        <div>
          <div className="text-sm font-medium text-white">{layer}</div>
          <div className="text-xs text-white/50">{name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-white/70">{latency}</div>
        <div className="text-xs text-white/40">{lastCheck}</div>
      </div>
    </div>
  );
};

// ====================================
// MAIN PAGE COMPONENT
// ====================================

const CommandCenter: React.FC = () => {
  const { openPalette } = useSovereign();
  const { user } = useAuthStore();
  const [forensicOpen, setForensicOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<string | undefined>();

  // Determine user tier
  const userTier = user?.roles?.includes('owner') 
    ? 'sovereign' 
    : (user?.roles?.includes('admin') || user?.isAdmin) 
      ? 'strategic' 
      : 'tactical';

  const tierLabels = {
    sovereign: { icon: '👑', name: 'Sovereign Scepter', color: '#FFD700' },
    strategic: { icon: '🛡️', name: 'Strategic Shield', color: '#F59E0B' },
    tactical: { icon: '🗡️', name: 'Tactical Blade', color: '#10B981' },
  };

  const openForensic = (incidentId: string) => {
    setSelectedIncident(incidentId);
    setForensicOpen(true);
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#050505' }}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sovereign Command Center</h1>
          <p className="mt-1 text-white/50">Kinetic Intelligence Engine v1.0</p>
        </div>

        <div className="flex items-center gap-4">
          {/* User Tier Badge */}
          <div
            className="flex items-center gap-2 rounded-full border px-4 py-2"
            style={{
              borderColor: `${tierLabels[userTier].color}40`,
              backgroundColor: `${tierLabels[userTier].color}10`,
            }}
          >
            <span className="text-lg">{tierLabels[userTier].icon}</span>
            <span
              className="text-sm font-medium"
              style={{ color: tierLabels[userTier].color }}
            >
              {tierLabels[userTier].name}
            </span>
          </div>

          {/* Command Palette Trigger */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openPalette}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
          >
            <span>⌘</span>
            <span>Command Palette</span>
            <kbd className="rounded bg-white/10 px-2 py-0.5 text-xs">K</kbd>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Quick Actions & Status */}
        <div className="col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>⚡</span> Quick Actions
            </h2>
            <div className="space-y-3">
              <QuickAction
                icon="🔥"
                label="Thermal Visualization"
                shortcut="T"
                tier="tactical"
                onClick={() => window.location.href = '/kinetics'}
              />
              <QuickAction
                icon="🔬"
                label="Open Forensics"
                shortcut="F"
                tier="tactical"
                onClick={() => openForensic('incident-001')}
              />
              <QuickAction
                icon="🪐"
                label="Reputation Orbit"
                shortcut="O"
                tier="tactical"
                onClick={() => window.location.href = '/kinetics'}
              />
              {(userTier === 'sovereign' || userTier === 'strategic') && (
                <QuickAction
                  icon="🔒"
                  label="Toggle Lockdown"
                  tier="strategic"
                  onClick={openPalette}
                />
              )}
              {userTier === 'sovereign' && (
                <QuickAction
                  icon="☢️"
                  label="Nuclear Safe-State"
                  tier="sovereign"
                  onClick={openPalette}
                />
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🔌</span> Neural Defense Status
            </h2>
            <div className="space-y-3">
              <SystemStatus
                layer="L1-ES"
                name="Entropic Sieve"
                status="online"
                latency="<5ms"
                lastCheck="2s ago"
              />
              <SystemStatus
                layer="L2-CA"
                name="Contextual Analyst"
                status="online"
                latency="<100ms"
                lastCheck="5s ago"
              />
              <SystemStatus
                layer="L3-OV"
                name="Optical Visionary"
                status="online"
                latency="<500ms"
                lastCheck="10s ago"
              />
            </div>
          </div>

          {/* Thermal Overview */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🌡️</span> Thermal Overview
            </h2>
            <div className="space-y-3">
              {[
                { channel: '#general', heat: 25, status: 'Normal' },
                { channel: '#dev-chat', heat: 45, status: 'Elevated' },
                { channel: '#trading', heat: 78, status: 'Critical' },
                { channel: '#help', heat: 15, status: 'Normal' },
              ].map((ch) => (
                <div key={ch.channel} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-white/70">{ch.channel}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ch.heat}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        backgroundColor:
                          ch.heat > 70 ? '#EF4444' : ch.heat > 30 ? '#F59E0B' : '#10B981',
                      }}
                    />
                  </div>
                  <span
                    className="w-8 text-right font-mono text-xs"
                    style={{
                      color: ch.heat > 70 ? '#EF4444' : ch.heat > 30 ? '#F59E0B' : '#10B981',
                    }}
                  >
                    {ch.heat}°
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Activity Feed & Quantum Grid */}
        <div className="col-span-8 flex flex-col gap-6">
          <div className="h-[500px]">
             <QuantumGrid />
          </div>
          <div className="h-[calc(100vh-690px)] min-h-[300px]">
            <KineticActivityFeed maxEvents={100} simulateEvents={true} />
          </div>
        </div>
      </div>

      {/* Forensic Side Sheet */}
      <ForensicSideSheet
        isOpen={forensicOpen}
        onClose={() => setForensicOpen(false)}
        incidentId={selectedIncident}
      />
    </div>
  );
};

export default CommandCenter;
