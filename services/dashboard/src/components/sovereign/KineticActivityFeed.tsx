// ====================================
// AVENLO CORE - KINETIC ACTIVITY FEED
// Real-time Shadow Score Stream
// ====================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ====================================
// TYPES & INTERFACES
// ====================================

export type KineticEventType = 
  | 'shadow_score_change'
  | 'thermal_spike'
  | 'raid_detected'
  | 'action_taken'
  | 'policy_change'
  | 'lockdown_event'
  | 'layer_detection';

export interface KineticEvent {
  id: string;
  type: KineticEventType;
  timestamp: Date;
  data: KineticEventData;
  severity: 'info' | 'warning' | 'critical';
}

export interface KineticEventData {
  userId?: string;
  username?: string;
  channelId?: string;
  channelName?: string;
  oldValue?: number;
  newValue?: number;
  delta?: number;
  reason?: string;
  action?: string;
  layer?: string;
  details?: string;
}

// ====================================
// EVENT CONFIG
// ====================================

const EventConfig: Record<KineticEventType, { icon: string; color: string; label: string }> = {
  shadow_score_change: { icon: '👤', color: '#3B82F6', label: 'Shadow Score' },
  thermal_spike: { icon: '🔥', color: '#F59E0B', label: 'Thermal Spike' },
  raid_detected: { icon: '🚨', color: '#EF4444', label: 'Raid Detected' },
  action_taken: { icon: '⚡', color: '#8B5CF6', label: 'Action Taken' },
  policy_change: { icon: '📜', color: '#10B981', label: 'Policy Change' },
  lockdown_event: { icon: '🔒', color: '#DC2626', label: 'Lockdown' },
  layer_detection: { icon: '🛡️', color: '#EC4899', label: 'Layer Detection' },
};

const SeverityConfig = {
  info: { glow: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.3)' },
  warning: { glow: 'rgba(245, 158, 11, 0.3)', border: 'rgba(245, 158, 11, 0.3)' },
  critical: { glow: 'rgba(239, 68, 68, 0.4)', border: 'rgba(239, 68, 68, 0.4)' },
};

// ====================================
// MOCK EVENT GENERATOR
// ====================================

const generateMockEvent = (): KineticEvent => {
  const types: KineticEventType[] = [
    'shadow_score_change',
    'shadow_score_change',
    'shadow_score_change',
    'thermal_spike',
    'action_taken',
    'layer_detection',
    'policy_change',
  ];

  const users = ['alice_dev', 'bob_builder', 'charlie_coder', 'diana_designer', 'eve_engineer'];
  const channels = ['#general', '#dev-chat', '#help', '#announcements', '#off-topic'];
  const actions = ['warn', 'mute', 'flag', 'monitor'];
  const layers = ['L1-ES', 'L2-CA', 'L3-OV'];

  const type = types[Math.floor(Math.random() * types.length)];
  const username = users[Math.floor(Math.random() * users.length)];
  const channel = channels[Math.floor(Math.random() * channels.length)];

  let data: KineticEventData = {};
  let severity: KineticEvent['severity'] = 'info';

  switch (type) {
    case 'shadow_score_change':
      const delta = Math.floor(Math.random() * 20) - 10;
      const oldValue = 50 + Math.floor(Math.random() * 30);
      data = {
        username,
        oldValue,
        newValue: oldValue + delta,
        delta,
        reason: delta > 0 ? 'Positive contribution' : 'Minor infraction',
      };
      severity = Math.abs(delta) > 15 ? 'warning' : 'info';
      break;

    case 'thermal_spike':
      const heat = 50 + Math.floor(Math.random() * 50);
      data = {
        channelName: channel,
        newValue: heat,
        reason: heat > 80 ? 'Heated discussion detected' : 'Activity surge',
      };
      severity = heat > 80 ? 'critical' : 'warning';
      break;

    case 'action_taken':
      data = {
        username,
        channelName: channel,
        action: actions[Math.floor(Math.random() * actions.length)],
        reason: 'Automated moderation response',
      };
      severity = 'warning';
      break;

    case 'layer_detection':
      data = {
        username,
        layer: layers[Math.floor(Math.random() * layers.length)],
        details: 'Pattern match triggered',
      };
      severity = 'info';
      break;

    case 'policy_change':
      data = {
        details: 'Sensitivity weights adjusted',
        reason: 'Admin policy injection',
      };
      severity = 'info';
      break;

    case 'raid_detected':
      data = {
        channelName: channel,
        details: '15 joins in 30 seconds',
        action: 'Soft lockdown activated',
      };
      severity = 'critical';
      break;

    case 'lockdown_event':
      data = {
        channelName: channel,
        action: 'Channel locked',
        reason: 'Automated protection',
      };
      severity = 'critical';
      break;
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    timestamp: new Date(),
    data,
    severity,
  };
};

// ====================================
// INDIVIDUAL EVENT COMPONENT
// ====================================

interface KineticEventCardProps {
  event: KineticEvent;
  isNew: boolean;
}

const KineticEventCard: React.FC<KineticEventCardProps> = ({ event, isNew }) => {
  const config = EventConfig[event.type];
  const severityStyle = SeverityConfig[event.severity];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const renderContent = () => {
    switch (event.type) {
      case 'shadow_score_change':
        const delta = event.data.delta || 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{event.data.username}</span>
            <span className="text-white/50">→</span>
            <span
              className={`font-mono font-medium ${
                delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/50'
              }`}
            >
              {delta > 0 ? '+' : ''}{delta}
            </span>
            <span className="text-white/40">
              ({event.data.oldValue} → {event.data.newValue})
            </span>
          </div>
        );

      case 'thermal_spike':
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{event.data.channelName}</span>
            <span className="text-white/50">heat:</span>
            <span
              className="font-mono font-medium"
              style={{
                color: (event.data.newValue || 0) > 80 ? '#EF4444' : '#F59E0B',
              }}
            >
              {event.data.newValue}°
            </span>
          </div>
        );

      case 'action_taken':
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{event.data.username}</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium uppercase text-amber-400">
              {event.data.action}
            </span>
            <span className="text-white/40">in {event.data.channelName}</span>
          </div>
        );

      case 'layer_detection':
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{event.data.username}</span>
            <span className="rounded bg-pink-500/20 px-2 py-0.5 text-xs font-medium text-pink-400">
              {event.data.layer}
            </span>
            <span className="text-white/40">{event.data.details}</span>
          </div>
        );

      case 'raid_detected':
      case 'lockdown_event':
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-red-400">{event.data.details}</span>
            {event.data.channelName && (
              <span className="text-white/40">in {event.data.channelName}</span>
            )}
          </div>
        );

      case 'policy_change':
        return (
          <div className="flex items-center gap-2">
            <span className="text-white/70">{event.data.details}</span>
          </div>
        );

      default:
        return <span className="text-white/50">Unknown event</span>;
    }
  };

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="group relative overflow-hidden rounded-lg border p-3 transition-colors hover:bg-white/5"
      style={{
        borderColor: severityStyle.border,
        backgroundColor: isNew ? `${severityStyle.glow}` : 'rgba(255, 255, 255, 0.02)',
      }}
    >
      {/* Pulse animation for new events */}
      {isNew && event.severity === 'critical' && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: severityStyle.glow }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="text-xs font-medium uppercase"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs text-white/40">{formatTime(event.timestamp)}</span>
          </div>
          
          <div className="text-sm">{renderContent()}</div>
          
          {event.data.reason && (
            <div className="mt-1 text-xs text-white/40">{event.data.reason}</div>
          )}
        </div>

        {/* Severity indicator */}
        {event.severity !== 'info' && (
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: event.severity === 'critical' ? '#EF4444' : '#F59E0B',
              boxShadow: `0 0 8px ${event.severity === 'critical' ? '#EF4444' : '#F59E0B'}`,
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

// ====================================
// MAIN FEED COMPONENT
// ====================================

interface KineticActivityFeedProps {
  maxEvents?: number;
  autoScroll?: boolean;
  simulateEvents?: boolean;
}

export const KineticActivityFeed: React.FC<KineticActivityFeedProps> = ({
  maxEvents = 50,
  autoScroll = true,
  simulateEvents = true,
}) => {
  const [events, setEvents] = useState<KineticEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<KineticEventType | 'all'>('all');
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate incoming events
  useEffect(() => {
    if (!simulateEvents || isPaused) return;

    const interval = setInterval(() => {
      const newEvent = generateMockEvent();
      
      setEvents((prev) => {
        const updated = [newEvent, ...prev].slice(0, maxEvents);
        return updated;
      });

      setNewEventIds((prev) => new Set([...prev, newEvent.id]));

      // Clear "new" status after animation
      setTimeout(() => {
        setNewEventIds((prev) => {
          const next = new Set(prev);
          next.delete(newEvent.id);
          return next;
        });
      }, 2000);
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [simulateEvents, isPaused, maxEvents]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  // Filter events
  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter((e) => e.type === filter);

  // Stats
  const stats = {
    total: events.length,
    critical: events.filter((e) => e.severity === 'critical').length,
    warning: events.filter((e) => e.severity === 'warning').length,
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">📡</span>
          <div>
            <h3 className="font-semibold text-white">Kinetic Feed</h3>
            <p className="text-xs text-white/50">Real-time system activity</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          {stats.critical > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400">
              {stats.critical} critical
            </span>
          )}
          {stats.warning > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400">
              {stats.warning} warning
            </span>
          )}

          {/* Pause button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`rounded-lg p-2 transition-colors ${
              isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/50 hover:text-white'
            }`}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2">
        <button
          onClick={() => setFilter('all')}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:bg-white/5 hover:text-white'
          }`}
        >
          All Events
        </button>
        {Object.entries(EventConfig).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setFilter(type as KineticEventType)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === type
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </button>
        ))}
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredEvents.map((event) => (
            <KineticEventCard
              key={event.id}
              event={event}
              isNew={newEventIds.has(event.id)}
            />
          ))}
        </AnimatePresence>

        {filteredEvents.length === 0 && (
          <div className="flex h-32 items-center justify-center text-white/40">
            {isPaused ? 'Feed paused' : 'Waiting for events...'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <span className="text-xs text-white/40">
          {filteredEvents.length} events
          {filter !== 'all' && ` (filtered)`}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${isPaused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`}
          />
          <span className="text-xs text-white/40">
            {isPaused ? 'Paused' : 'Live'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KineticActivityFeed;
