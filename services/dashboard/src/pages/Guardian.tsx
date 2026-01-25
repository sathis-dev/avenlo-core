// ====================================
// GUARDIAN PAGE
// AI Moderation Command Center
// ====================================

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  Eye,
  Brain,
  Zap,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  TrendingDown,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ForensicReportSheet,
  Infraction,
  DetectionLayer,
  InfractionSeverity,
  SEVERITY_COLORS,
  LAYER_COLORS,
} from '../components/forensic';

// ====================================
// MOCK DATA (Replace with API calls)
// ====================================

const MOCK_INFRACTIONS: Infraction[] = [
  {
    _id: '1',
    infractionId: 'INF-2026-001-ALPHA',
    guildId: '123456789',
    channelId: '987654321',
    channelName: 'general',
    userId: '111222333',
    username: 'SuspiciousUser',
    messageId: '999888777',
    messageContent: 'Hey everyone! Check out this amazing Discord Nitro giveaway at discordnitro-free.gift!!!',
    attachmentUrls: [],
    type: 'PHISHING',
    severity: 'CRITICAL',
    actionTaken: 'BAN',
    automated: true,
    aiReasoning: {
      detectionLayer: 'ANALYST',
      confidence: 94,
      intentClassification: 'DECEPTIVE',
      patternSignatures: ['phishing_domain', 'nitro_scam', 'urgency_language'],
      reasoning: 'Message contains a known phishing domain pattern (discordnitro-free.gift) attempting to impersonate Discord Nitro giveaways. The domain uses a deceptive TLD and follows common scam URL structures. User account is 2 days old with no previous activity.',
      mitigatingFactors: [],
      aggravatingFactors: ['New account', 'Known scam pattern', 'First message is scam', 'No avatar'],
      alternativeInterpretations: [],
      modelUsed: 'gpt-4o-2024-08-06',
      processingTimeMs: 847,
      tokenCount: 312,
    },
    socialContext: {
      channelHeat: 25,
      messageVelocity: 8,
      sentimentDelta: -0.15,
      activeUsers: 12,
      isHeatedDiscussion: false,
      technicalContext: false,
    },
    messageContext: [
      { messageId: 'm1', authorId: 'u1', authorUsername: 'Alice', content: 'Anyone playing the new game?', timestamp: new Date(Date.now() - 120000).toISOString(), sentiment: 0.3 },
      { messageId: 'm2', authorId: 'u2', authorUsername: 'Bob', content: 'Yeah its pretty fun', timestamp: new Date(Date.now() - 90000).toISOString(), sentiment: 0.5 },
      { messageId: 'm3', authorId: 'u3', authorUsername: 'Charlie', content: 'I need to download it still', timestamp: new Date(Date.now() - 60000).toISOString(), sentiment: 0.1 },
    ],
    userHistorySnapshot: {
      reputationScore: 15,
      accountAgeDays: 2,
      serverTenureDays: 0,
      previousInfractions: 0,
      wasElevatedObservation: true,
      positiveContributions: 0,
      roles: [],
    },
    appeal: { appealed: false },
    confirmedFalsePositive: false,
    tags: ['phishing', 'nitro-scam', 'auto-ban'],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: '2',
    infractionId: 'INF-2026-002-BETA',
    guildId: '123456789',
    channelId: '555666777',
    channelName: 'dev-talk',
    userId: '444555666',
    username: 'FrustratedDev',
    messageId: '888777666',
    messageContent: 'This code is absolute garbage, whoever wrote this should be fired',
    attachmentUrls: [],
    type: 'TOXICITY',
    severity: 'LOW',
    actionTaken: 'NONE',
    automated: true,
    aiReasoning: {
      detectionLayer: 'ANALYST',
      confidence: 72,
      intentClassification: 'EDUCATIONAL',
      patternSignatures: ['profanity_adjacent'],
      reasoning: 'While the language is strong, context indicates frustration about code quality in a technical discussion. "garbage" and "fired" are hyperbolic but directed at abstract code, not specific individuals. Channel is #dev-talk where such expressions are common during debugging sessions.',
      mitigatingFactors: ['Technical context', 'Directed at code not person', 'Active contributor', 'High reputation'],
      aggravatingFactors: ['Strong language'],
      alternativeInterpretations: ['Venting frustration', 'Code review feedback'],
      modelUsed: 'gpt-4o-2024-08-06',
      processingTimeMs: 623,
      tokenCount: 445,
    },
    socialContext: {
      channelHeat: 45,
      messageVelocity: 15,
      sentimentDelta: -0.3,
      activeUsers: 8,
      isHeatedDiscussion: true,
      conversationTopic: 'debugging session',
      technicalContext: true,
    },
    messageContext: [
      { messageId: 'm4', authorId: 'u4', authorUsername: 'Dave', content: 'This function is causing memory leaks', timestamp: new Date(Date.now() - 180000).toISOString(), sentiment: -0.2 },
      { messageId: 'm5', authorId: 'u5', authorUsername: 'Eve', content: 'Yeah the whole module needs refactoring', timestamp: new Date(Date.now() - 150000).toISOString(), sentiment: -0.1 },
    ],
    userHistorySnapshot: {
      reputationScore: 78,
      accountAgeDays: 450,
      serverTenureDays: 120,
      previousInfractions: 1,
      wasElevatedObservation: false,
      positiveContributions: 45,
      roles: ['Developer', 'Verified'],
    },
    appeal: { appealed: false },
    confirmedFalsePositive: false,
    tags: ['context-passed', 'technical-discussion'],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    _id: '3',
    infractionId: 'INF-2026-003-GAMMA',
    guildId: '123456789',
    channelId: '987654321',
    channelName: 'general',
    userId: '777888999',
    username: 'RaidBot001',
    messageId: '111222333',
    messageContent: '@everyone FREE CRYPTO AIRDROP! Join now: crypto-airdrop-legit.xyz',
    attachmentUrls: [],
    type: 'RAID',
    severity: 'CRITICAL',
    actionTaken: 'BAN',
    automated: true,
    aiReasoning: {
      detectionLayer: 'SIEVE',
      confidence: 100,
      intentClassification: 'DECEPTIVE',
      patternSignatures: ['everyone_ping', 'crypto_scam', 'suspicious_domain', 'raid_pattern'],
      reasoning: 'Instant SIEVE detection: @everyone ping combined with crypto scam keywords and suspicious domain. Account part of coordinated raid (5 similar accounts joined in 30 seconds).',
      mitigatingFactors: [],
      aggravatingFactors: ['@everyone abuse', 'Crypto scam', 'Raid coordination', 'Bot naming pattern'],
      alternativeInterpretations: [],
      modelUsed: 'regex_sieve',
      processingTimeMs: 2,
      tokenCount: 0,
    },
    socialContext: {
      channelHeat: 85,
      messageVelocity: 45,
      sentimentDelta: -0.8,
      activeUsers: 25,
      isHeatedDiscussion: false,
      technicalContext: false,
    },
    messageContext: [],
    userHistorySnapshot: {
      reputationScore: 0,
      accountAgeDays: 0,
      serverTenureDays: 0,
      previousInfractions: 0,
      wasElevatedObservation: true,
      positiveContributions: 0,
      roles: [],
    },
    appeal: { appealed: false },
    confirmedFalsePositive: false,
    tags: ['raid', 'crypto-scam', 'sieve-catch', 'instant-ban'],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

// ====================================
// STATS CARD COMPONENT
// ====================================

interface StatsCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  delta?: number;
  color: string;
  bgColor: string;
}

function StatsCard({ icon: Icon, label, value, delta, color, bgColor }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
      </div>
    </motion.div>
  );
}

// ====================================
// INFRACTION ROW COMPONENT
// ====================================

interface InfractionRowProps {
  infraction: Infraction;
  onClick: () => void;
}

function InfractionRow({ infraction, onClick }: InfractionRowProps) {
  const severityColors = SEVERITY_COLORS[infraction.severity];
  const layerColors = LAYER_COLORS[infraction.aiReasoning.detectionLayer];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
      onClick={onClick}
      className="p-4 border-b border-avenlo-border/30 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4">
        {/* Severity Indicator */}
        <div className={`w-1 h-12 rounded-full ${severityColors.bg.replace('/20', '')}`} />

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{infraction.username}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${severityColors.bg} ${severityColors.text}`}>
              {infraction.severity}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${layerColors.bg} ${layerColors.text}`}>
              {infraction.aiReasoning.detectionLayer}
            </span>
          </div>
          <p className="text-sm text-gray-400 truncate mt-1">{infraction.messageContent}</p>
        </div>

        {/* Type & Action */}
        <div className="text-right">
          <div className="text-sm font-medium text-gray-300">{infraction.type}</div>
          <div className={`text-xs ${infraction.actionTaken === 'BAN' ? 'text-danger' : 'text-gray-500'}`}>
            {infraction.actionTaken}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-gray-500 w-24 text-right">
          {new Date(infraction.createdAt).toLocaleTimeString()}
        </div>

        {/* Confidence */}
        <div className="w-16 text-right">
          <div className={`text-sm font-mono ${infraction.aiReasoning.confidence > 80 ? 'text-success' : 'text-warning'}`}>
            {infraction.aiReasoning.confidence}%
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ====================================
// PIPELINE HEALTH INDICATOR
// ====================================

function PipelineHealth() {
  const layers = [
    { name: 'SIEVE', icon: Zap, status: 'operational', latency: '2ms' },
    { name: 'ANALYST', icon: Brain, status: 'operational', latency: '650ms' },
    { name: 'VISIONARY', icon: Eye, status: 'operational', latency: '1.2s' },
  ];

  return (
    <div className="flex items-center gap-2">
      {layers.map((layer) => (
        <div
          key={layer.name}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-avenlo-card/50 border border-avenlo-border/30"
        >
          <layer.icon className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-300">{layer.name}</span>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-gray-500">{layer.latency}</span>
        </div>
      ))}
    </div>
  );
}

// ====================================
// MAIN GUARDIAN PAGE
// ====================================

export default function Guardian() {
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<InfractionSeverity | 'all'>('all');
  const [layerFilter, setLayerFilter] = useState<DetectionLayer | 'all'>('all');

  const fetchInfractions = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/guardian/infractions', { credentials: 'include' });
      // const data = await response.json();
      // setInfractions(data.infractions);
      
      // Using mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setInfractions(MOCK_INFRACTIONS);
    } catch (error) {
      console.error('Failed to fetch infractions:', error);
      toast.error('Failed to load Guardian infractions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInfractions();
  }, [fetchInfractions]);

  // Live sync
  useEffect(() => {
    const interval = setInterval(() => fetchInfractions(false), 15000);
    return () => clearInterval(interval);
  }, [fetchInfractions]);

  const handleInfractionClick = (infraction: Infraction) => {
    setSelectedInfraction(infraction);
    setIsSheetOpen(true);
  };

  const handleMarkFalsePositive = async (_infractionId: string, _reason: string) => {
    try {
      // TODO: Implement API call to mark false positive
      // await fetch(`/api/guardian/infractions/${_infractionId}/false-positive`, {
      //   method: 'POST',
      //   body: JSON.stringify({ reason: _reason }),
      // });
      toast.success('Marked as false positive');
      setIsSheetOpen(false);
    } catch (error) {
      toast.error('Failed to update infraction');
    }
  };

  // Calculate stats
  const stats = {
    total: infractions.length,
    critical: infractions.filter(i => i.severity === 'CRITICAL').length,
    automated: infractions.filter(i => i.automated).length,
    falsePositives: infractions.filter(i => i.confirmedFalsePositive).length,
    avgConfidence: infractions.length > 0
      ? Math.round(infractions.reduce((acc, i) => acc + i.aiReasoning.confidence, 0) / infractions.length)
      : 0,
  };

  // Filter infractions
  const filteredInfractions = infractions.filter(i => {
    const matchesSearch = 
      i.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.messageContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || i.severity === severityFilter;
    const matchesLayer = layerFilter === 'all' || i.aiReasoning.detectionLayer === layerFilter;
    return matchesSearch && matchesSeverity && matchesLayer;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-avenlo-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-avenlo-cyan/10">
              <Shield className="w-6 h-6 text-avenlo-cyan" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Guardian</h1>
              <p className="text-gray-400 text-sm">AI-Powered Behavioral Moderation Pipeline</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PipelineHealth />
          <button
            onClick={() => fetchInfractions(true)}
            disabled={refreshing}
            className="btn-icon"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live Indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        Guardian active — Real-time protection enabled
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatsCard
          icon={ShieldAlert}
          label="Total Infractions"
          value={stats.total}
          color="text-avenlo-cyan"
          bgColor="bg-avenlo-cyan/20"
        />
        <StatsCard
          icon={AlertTriangle}
          label="Critical"
          value={stats.critical}
          delta={-15}
          color="text-danger"
          bgColor="bg-danger/20"
        />
        <StatsCard
          icon={Brain}
          label="AI Automated"
          value={stats.automated}
          color="text-avenlo-purple"
          bgColor="bg-avenlo-purple/20"
        />
        <StatsCard
          icon={Activity}
          label="Avg Confidence"
          value={`${stats.avgConfidence}%`}
          delta={3}
          color="text-success"
          bgColor="bg-success/20"
        />
        <StatsCard
          icon={BarChart3}
          label="False Positives"
          value={stats.falsePositives}
          color="text-warning"
          bgColor="bg-warning/20"
        />
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search infractions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as InfractionSeverity | 'all')}
            className="input w-40"
          >
            <option value="all">All Severity</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value as DetectionLayer | 'all')}
            className="input w-40"
          >
            <option value="all">All Layers</option>
            <option value="SIEVE">Sieve</option>
            <option value="ANALYST">Analyst</option>
            <option value="VISIONARY">Visionary</option>
            <option value="RAID_DETECTOR">Raid Detector</option>
          </select>
        </div>
      </div>

      {/* Infractions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* Table Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-avenlo-border/50 bg-black/20">
          <div className="w-1" />
          <div className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">User & Content</div>
          <div className="w-24 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Type</div>
          <div className="w-24 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Time</div>
          <div className="w-16 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Conf.</div>
        </div>

        {filteredInfractions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No infractions match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-avenlo-border/30">
            {filteredInfractions.map((infraction) => (
              <InfractionRow
                key={infraction._id}
                infraction={infraction}
                onClick={() => handleInfractionClick(infraction)}
              />
            ))}
          </div>
        )}

        <div className="px-6 py-4 border-t border-avenlo-border bg-black/20">
          <p className="text-sm text-gray-500">
            Showing {filteredInfractions.length} of {infractions.length} infractions
          </p>
        </div>
      </motion.div>

      {/* Forensic Report Sheet */}
      <ForensicReportSheet
        infraction={selectedInfraction}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onOverride={handleMarkFalsePositive}
      />
    </div>
  );
}
