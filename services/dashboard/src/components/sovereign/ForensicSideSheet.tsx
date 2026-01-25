// ====================================
// AVENLO CORE - FORENSIC SIDE SHEET
// The CSI Logic Sheet for Incident Analysis
// ====================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ====================================
// TYPES & INTERFACES
// ====================================

export interface ForensicIncident {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  userAvatar?: string;
  channelId: string;
  channelName: string;
  messageContent: string;
  
  // AI Analysis
  aiReasoning: string;
  intentVector: [number, number, number]; // [Hostile, Neutral, Friendly]
  confidenceScore: number;
  detectionLayer: 'L1-ES' | 'L2-CA' | 'L3-OV';
  
  // Factors
  aggravatingFactors: AggravatingFactor[];
  mitigatingFactors: MitigatingFactor[];
  
  // Action
  actionTaken: ForensicAction;
  actionReason: string;
  
  // Context
  messageHistory: ContextMessage[];
  userReputation: UserReputationSnapshot;
  channelHeat: number;
}

export interface AggravatingFactor {
  type: 'pattern_match' | 'velocity' | 'history' | 'context' | 'severity';
  description: string;
  weight: number;
  evidence?: string;
}

export interface MitigatingFactor {
  type: 'reputation' | 'context' | 'first_offense' | 'community_standing';
  description: string;
  weight: number;
}

export interface ForensicAction {
  type: 'none' | 'flag' | 'warn' | 'mute' | 'kick' | 'ban';
  duration?: number;
  automated: boolean;
  reversible: boolean;
}

export interface ContextMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  isTarget?: boolean;
}

export interface UserReputationSnapshot {
  shadowScore: number;
  trend: 'rising' | 'stable' | 'falling';
  accountAge: number;
  messageCount: number;
  priorInfractions: number;
  trustLevel: 'new' | 'regular' | 'trusted' | 'legacy';
}

// ====================================
// MOCK DATA GENERATOR
// ====================================

const generateMockIncident = (id: string): ForensicIncident => ({
  id,
  timestamp: new Date().toISOString(),
  userId: '123456789',
  username: 'suspicious_user',
  channelId: 'general',
  channelName: '#general',
  messageContent: 'Hey everyone! Check out this amazing crypto opportunity! 🚀💰 DM me for details!',
  
  aiReasoning: 'Message exhibits multiple high-risk patterns: unsolicited financial promotion, emoji spam indicative of scam messaging, DM solicitation. L1 pattern match on "crypto opportunity" combined with L2 social context analysis indicates spam/scam behavior.',
  intentVector: [0.85, 0.10, 0.05],
  confidenceScore: 0.92,
  detectionLayer: 'L2-CA',
  
  aggravatingFactors: [
    { type: 'pattern_match', description: 'Crypto scam keyword pattern', weight: 0.4, evidence: '"crypto opportunity"' },
    { type: 'velocity', description: 'First message in channel', weight: 0.2 },
    { type: 'history', description: 'Similar messages in 3 other channels', weight: 0.3 },
    { type: 'severity', description: 'Financial harm potential', weight: 0.5 },
  ],
  
  mitigatingFactors: [
    { type: 'first_offense', description: 'No prior infractions', weight: 0.2 },
  ],
  
  actionTaken: {
    type: 'mute',
    duration: 30,
    automated: true,
    reversible: true,
  },
  actionReason: 'Automated response to suspected scam/spam activity',
  
  messageHistory: [
    { id: '1', userId: '111', username: 'alice', content: 'Anyone here into web3?', timestamp: '2 min ago' },
    { id: '2', userId: '222', username: 'bob', content: 'Yeah, been learning Solidity', timestamp: '1 min ago' },
    { id: '3', userId: '123456789', username: 'suspicious_user', content: 'Hey everyone! Check out this amazing crypto opportunity! 🚀💰 DM me for details!', timestamp: 'Just now', isTarget: true },
  ],
  
  userReputation: {
    shadowScore: 35,
    trend: 'falling',
    accountAge: 2,
    messageCount: 5,
    priorInfractions: 0,
    trustLevel: 'new',
  },
  
  channelHeat: 42,
});

// ====================================
// COMPONENT
// ====================================

interface ForensicSideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId?: string;
}

export const ForensicSideSheet: React.FC<ForensicSideSheetProps> = ({
  isOpen,
  onClose,
  incidentId,
}) => {
  const [incident, setIncident] = useState<ForensicIncident | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'context' | 'history'>('analysis');

  useEffect(() => {
    if (incidentId && isOpen) {
      // Simulate API call
      setTimeout(() => {
        setIncident(generateMockIncident(incidentId));
      }, 300);
    }
  }, [incidentId, isOpen]);

  const getActionColor = (type: ForensicAction['type']) => {
    const colors = {
      none: '#6B7280',
      flag: '#F59E0B',
      warn: '#F59E0B',
      mute: '#EF4444',
      kick: '#DC2626',
      ban: '#991B1B',
    };
    return colors[type];
  };

  const getTrustColor = (level: UserReputationSnapshot['trustLevel']) => {
    const colors = {
      new: '#6B7280',
      regular: '#10B981',
      trusted: '#3B82F6',
      legacy: '#FFD700',
    };
    return colors[level];
  };

  const getLayerInfo = (layer: ForensicIncident['detectionLayer']) => {
    const info = {
      'L1-ES': { name: 'Entropic Sieve', color: '#EF4444', latency: '<5ms' },
      'L2-CA': { name: 'Contextual Analyst', color: '#F59E0B', latency: '<100ms' },
      'L3-OV': { name: 'Optical Visionary', color: '#8B5CF6', latency: '<500ms' },
    };
    return info[layer];
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
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Side Sheet */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-hidden"
            style={{
              background: 'rgba(5, 5, 5, 0.95)',
              backdropFilter: 'blur(40px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔬</span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Forensic Analysis</h2>
                  <p className="text-sm text-white/50">CSI Logic Sheet</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {incident ? (
              <div className="h-[calc(100%-72px)] overflow-y-auto">
                {/* Detection Banner */}
                <div
                  className="border-b border-white/10 p-4"
                  style={{
                    background: `linear-gradient(135deg, ${getLayerInfo(incident.detectionLayer).color}15, transparent)`,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ backgroundColor: getLayerInfo(incident.detectionLayer).color }}
                      />
                      <span className="text-sm font-medium" style={{ color: getLayerInfo(incident.detectionLayer).color }}>
                        {incident.detectionLayer}
                      </span>
                      <span className="text-white/50">•</span>
                      <span className="text-sm text-white/70">
                        {getLayerInfo(incident.detectionLayer).name}
                      </span>
                    </div>
                    <span className="text-xs text-white/40">
                      {getLayerInfo(incident.detectionLayer).latency}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👤</span>
                      <div>
                        <div className="font-medium text-white">{incident.username}</div>
                        <div className="text-xs text-white/50">{incident.channelName}</div>
                      </div>
                    </div>
                    <div
                      className="rounded-lg px-3 py-1 text-sm font-medium uppercase"
                      style={{
                        backgroundColor: `${getActionColor(incident.actionTaken.type)}20`,
                        color: getActionColor(incident.actionTaken.type),
                      }}
                    >
                      {incident.actionTaken.type}
                      {incident.actionTaken.duration && ` ${incident.actionTaken.duration}m`}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-white/10">
                  {(['analysis', 'context', 'history'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'border-b-2 border-amber-500 text-white'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {activeTab === 'analysis' && (
                    <div className="space-y-6">
                      {/* Intent Vector */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">Intent Vector</h3>
                        <div className="space-y-2">
                          {[
                            { label: 'Hostile', value: incident.intentVector[0], color: '#EF4444' },
                            { label: 'Neutral', value: incident.intentVector[1], color: '#F59E0B' },
                            { label: 'Friendly', value: incident.intentVector[2], color: '#10B981' },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center gap-3">
                              <span className="w-16 text-sm text-white/60">{item.label}</span>
                              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.value * 100}%` }}
                                  transition={{ duration: 0.5, delay: 0.2 }}
                                  className="absolute left-0 top-0 h-full rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                              </div>
                              <span className="w-12 text-right text-sm text-white/70">
                                {(item.value * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">AI Reasoning</h3>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <p className="text-sm leading-relaxed text-white/80">{incident.aiReasoning}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-white/40">Confidence:</span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${incident.confidenceScore * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-white/60">
                              {(incident.confidenceScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Aggravating Factors */}
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-red-400">
                          <span>⚠️</span> Aggravating Factors
                        </h3>
                        <div className="space-y-2">
                          {incident.aggravatingFactors.map((factor, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-red-500/20 bg-red-500/10 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">
                                  {factor.description}
                                </span>
                                <span className="text-xs text-red-400">+{(factor.weight * 100).toFixed(0)}%</span>
                              </div>
                              {factor.evidence && (
                                <p className="mt-1 font-mono text-xs text-white/50">
                                  Evidence: {factor.evidence}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Mitigating Factors */}
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
                          <span>🛡️</span> Mitigating Factors
                        </h3>
                        <div className="space-y-2">
                          {incident.mitigatingFactors.map((factor, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">
                                  {factor.description}
                                </span>
                                <span className="text-xs text-emerald-400">-{(factor.weight * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'context' && (
                    <div className="space-y-6">
                      {/* Message Context */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">Message Context</h3>
                        <div className="space-y-2">
                          {incident.messageHistory.map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-lg border p-3 ${
                                msg.isTarget
                                  ? 'border-red-500/30 bg-red-500/10'
                                  : 'border-white/10 bg-white/5'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <span className={`text-sm font-medium ${msg.isTarget ? 'text-red-400' : 'text-white/70'}`}>
                                  {msg.username}
                                </span>
                                <span className="text-xs text-white/40">{msg.timestamp}</span>
                              </div>
                              <p className="text-sm text-white/80">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Channel Heat */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">Channel Thermal Flux</h3>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-2xl font-bold text-white">{incident.channelHeat}</span>
                            <span
                              className="rounded-full px-2 py-1 text-xs font-medium"
                              style={{
                                backgroundColor:
                                  incident.channelHeat > 70
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : incident.channelHeat > 30
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(16, 185, 129, 0.2)',
                                color:
                                  incident.channelHeat > 70
                                    ? '#EF4444'
                                    : incident.channelHeat > 30
                                    ? '#F59E0B'
                                    : '#10B981',
                              }}
                            >
                              {incident.channelHeat > 70
                                ? 'Critical'
                                : incident.channelHeat > 30
                                ? 'Elevated'
                                : 'Normal'}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${incident.channelHeat}%` }}
                              className="h-full rounded-full"
                              style={{
                                backgroundColor:
                                  incident.channelHeat > 70
                                    ? '#EF4444'
                                    : incident.channelHeat > 30
                                    ? '#F59E0B'
                                    : '#10B981',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="space-y-6">
                      {/* User Reputation */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">User Reputation Snapshot</h3>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {incident.userReputation.shadowScore}
                              </div>
                              <div className="text-sm text-white/50">Shadow Score</div>
                            </div>
                            <div className="text-right">
                              <span
                                className="rounded-full px-2 py-1 text-xs font-medium uppercase"
                                style={{
                                  backgroundColor: `${getTrustColor(incident.userReputation.trustLevel)}20`,
                                  color: getTrustColor(incident.userReputation.trustLevel),
                                }}
                              >
                                {incident.userReputation.trustLevel}
                              </span>
                              <div className="mt-1 flex items-center justify-end gap-1 text-xs">
                                <span
                                  className={
                                    incident.userReputation.trend === 'rising'
                                      ? 'text-emerald-400'
                                      : incident.userReputation.trend === 'falling'
                                      ? 'text-red-400'
                                      : 'text-white/40'
                                  }
                                >
                                  {incident.userReputation.trend === 'rising'
                                    ? '↑'
                                    : incident.userReputation.trend === 'falling'
                                    ? '↓'
                                    : '→'}
                                </span>
                                <span className="text-white/50">{incident.userReputation.trend}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                            <div>
                              <div className="text-lg font-medium text-white">
                                {incident.userReputation.accountAge}d
                              </div>
                              <div className="text-xs text-white/50">Account Age</div>
                            </div>
                            <div>
                              <div className="text-lg font-medium text-white">
                                {incident.userReputation.messageCount}
                              </div>
                              <div className="text-xs text-white/50">Messages</div>
                            </div>
                            <div>
                              <div className="text-lg font-medium text-white">
                                {incident.userReputation.priorInfractions}
                              </div>
                              <div className="text-xs text-white/50">Prior Infractions</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Taken */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-white/70">Action Taken</h3>
                        <div
                          className="rounded-lg border p-4"
                          style={{
                            borderColor: `${getActionColor(incident.actionTaken.type)}40`,
                            backgroundColor: `${getActionColor(incident.actionTaken.type)}10`,
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className="rounded px-2 py-1 text-sm font-medium uppercase"
                              style={{
                                backgroundColor: getActionColor(incident.actionTaken.type),
                                color: 'white',
                              }}
                            >
                              {incident.actionTaken.type}
                            </span>
                            {incident.actionTaken.duration && (
                              <span className="text-sm text-white/60">
                                {incident.actionTaken.duration} minutes
                              </span>
                            )}
                            {incident.actionTaken.automated && (
                              <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">
                                Automated
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/70">{incident.actionReason}</p>
                          {incident.actionTaken.reversible && (
                            <button className="mt-3 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10">
                              Reverse Action
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[calc(100%-72px)] items-center justify-center">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="mx-auto mb-4 text-4xl"
                  >
                    🔍
                  </motion.div>
                  <p className="text-white/50">Loading forensic data...</p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ForensicSideSheet;
