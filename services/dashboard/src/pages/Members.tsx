import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  Ban,
  MessageSquareOff,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
  joinedAt: string;
  isBot: boolean;
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMembers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch('/api/members', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // LIVE SYNC - refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchMembers(false), 30000);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  const handleAction = async (action: string, memberId: string, memberName: string) => {
    try {
      const response = await fetch(`/api/moderation/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: memberId, reason: `Dashboard action` }),
      });
      
      if (response.ok) {
        toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} action on ${memberName}`);
        fetchMembers(true);
      } else {
        toast.error(`Failed to ${action} member`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} member`);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = 
      member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = 
      filterType === 'all' || 
      (filterType === 'bots' && member.isBot) || 
      (filterType === 'humans' && !member.isBot);
    return matchesSearch && matchesType;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-gray-400 mt-1">
            {members.length} members • Updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchMembers(true)} disabled={refreshing} className="btn-icon">
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-glow flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        Live sync enabled - updates every 30s
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input w-40">
            <option value="all">All ({members.length})</option>
            <option value="humans">Humans ({members.filter(m => !m.isBot).length})</option>
            <option value="bots">Bots ({members.filter(m => m.isBot).length})</option>
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead className="bg-avenlo-dark/50">
              <tr>
                <th>Member</th>
                <th>Roles</th>
                <th>Joined</th>
                <th>Type</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No members found</td></tr>
              ) : (
                filteredMembers.map((member, index) => (
                  <motion.tr key={member.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
                    <td>
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.username} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-avenlo-cyan to-avenlo-purple flex items-center justify-center text-sm font-bold">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.displayName}</span>
                            {member.isBot && <span className="badge-purple text-xs">BOT</span>}
                          </div>
                          <span className="text-sm text-gray-500">@{member.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-gray-400">{member.roles.length} roles</span>
                    </td>
                    <td>
                      <span className="text-gray-400">{new Date(member.joinedAt).toLocaleDateString()}</span>
                    </td>
                    <td>
                      <span className={member.isBot ? 'text-avenlo-cyan' : 'text-success'}>
                        {member.isBot ? 'Bot' : 'Human'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn-icon" onClick={() => window.open(`https://discord.com/users/${member.id}`, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        {!member.isBot && (
                          <>
                            <button className="btn-icon" onClick={() => handleAction('mute', member.id, member.username)}>
                              <MessageSquareOff className="w-4 h-4" />
                            </button>
                            <button className="btn-icon hover:!border-danger/50 hover:!bg-danger/10" onClick={() => handleAction('ban', member.id, member.username)}>
                              <Ban className="w-4 h-4 text-danger" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-avenlo-border">
          <p className="text-sm text-gray-500">Showing {filteredMembers.length} of {members.length} members (from Discord API)</p>
        </div>
      </motion.div>
    </div>
  );
}
