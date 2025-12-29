import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  Shield,
  Crown,
  Ban,
  MessageSquareOff,
  ExternalLink,
} from 'lucide-react';

interface Member {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  roles: string[];
  joinedAt: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  isAdmin?: boolean;
  isModerator?: boolean;
}

const mockMembers: Member[] = [
  {
    id: '1',
    username: 'StudioLead',
    discriminator: '0001',
    avatar: '',
    roles: ['Studio Lead', 'Developer', 'Admin'],
    joinedAt: '2023-01-15',
    status: 'online',
    isAdmin: true,
  },
  {
    id: '2',
    username: 'SeniorDev',
    discriminator: '1234',
    avatar: '',
    roles: ['Active Dev', 'Developer'],
    joinedAt: '2023-03-22',
    status: 'online',
  },
  {
    id: '3',
    username: 'ModeratorPro',
    discriminator: '5678',
    avatar: '',
    roles: ['Moderator'],
    joinedAt: '2023-06-10',
    status: 'idle',
    isModerator: true,
  },
  {
    id: '4',
    username: 'NewContributor',
    discriminator: '9012',
    avatar: '',
    roles: ['Contributor'],
    joinedAt: '2024-01-05',
    status: 'offline',
  },
  {
    id: '5',
    username: 'ClientUser',
    discriminator: '3456',
    avatar: '',
    roles: ['Verified Client'],
    joinedAt: '2024-02-18',
    status: 'dnd',
  },
];

const statusColors = {
  online: 'bg-success',
  idle: 'bg-warning',
  dnd: 'bg-danger',
  offline: 'bg-gray-500',
};

export default function Members() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  const filteredMembers = mockMembers.filter((member) => {
    const matchesSearch = member.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || member.roles.some((r) => r.toLowerCase().includes(selectedRole.toLowerCase()));
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-gray-400 mt-1">Manage server members and roles</p>
        </div>
        <button className="btn-glow flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Invite Member
        </button>
      </div>

      {/* Filters */}
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
          <div className="flex gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="input w-40"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="developer">Developer</option>
              <option value="contributor">Contributor</option>
              <option value="client">Client</option>
            </select>
            <button className="btn-icon">
              <Filter className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead className="bg-avenlo-dark/50">
              <tr>
                <th>Member</th>
                <th>Roles</th>
                <th>Joined</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, index) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-avenlo-cyan to-avenlo-purple flex items-center justify-center text-sm font-bold">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-avenlo-card ${statusColors[member.status]}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.username}</span>
                          {member.isAdmin && <Crown className="w-4 h-4 text-warning" />}
                          {member.isModerator && <Shield className="w-4 h-4 text-avenlo-cyan" />}
                        </div>
                        <span className="text-sm text-gray-500">#{member.discriminator}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {member.roles.slice(0, 2).map((role) => (
                        <span key={role} className="badge-purple text-xs">
                          {role}
                        </span>
                      ))}
                      {member.roles.length > 2 && (
                        <span className="badge text-xs bg-white/5 text-gray-400">
                          +{member.roles.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="text-gray-400">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[member.status]}`} />
                      <span className="capitalize text-gray-400">{member.status}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn-icon" title="View Profile">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="btn-icon" title="Mute">
                        <MessageSquareOff className="w-4 h-4" />
                      </button>
                      <button className="btn-icon hover:!border-danger/50 hover:!bg-danger/10" title="Ban">
                        <Ban className="w-4 h-4 text-danger" />
                      </button>
                      <button className="btn-icon">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-avenlo-border">
          <p className="text-sm text-gray-500">
            Showing {filteredMembers.length} of {mockMembers.length} members
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm bg-avenlo-dark rounded-lg hover:bg-white/5 transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 text-sm bg-avenlo-cyan/20 text-avenlo-cyan rounded-lg">
              1
            </button>
            <button className="px-4 py-2 text-sm bg-avenlo-dark rounded-lg hover:bg-white/5 transition-colors">
              2
            </button>
            <button className="px-4 py-2 text-sm bg-avenlo-dark rounded-lg hover:bg-white/5 transition-colors">
              Next
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
