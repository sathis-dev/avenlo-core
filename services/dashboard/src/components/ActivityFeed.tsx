import { UserPlus, UserMinus, Ticket, Shield, MessageSquare } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'join' | 'leave' | 'ticket' | 'moderation' | 'message';
  user: {
    username: string;
    avatar?: string;
  };
  action: string;
  timestamp: string;
}

const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'join',
    user: { username: 'CoolUser123', avatar: '' },
    action: 'joined the server',
    timestamp: '2 minutes ago',
  },
  {
    id: '2',
    type: 'ticket',
    user: { username: 'ClientPro', avatar: '' },
    action: 'opened ticket #0042',
    timestamp: '5 minutes ago',
  },
  {
    id: '3',
    type: 'moderation',
    user: { username: 'Moderator', avatar: '' },
    action: 'warned ToxicUser for spam',
    timestamp: '12 minutes ago',
  },
  {
    id: '4',
    type: 'leave',
    user: { username: 'OldMember', avatar: '' },
    action: 'left the server',
    timestamp: '25 minutes ago',
  },
  {
    id: '5',
    type: 'ticket',
    user: { username: 'DevTeam', avatar: '' },
    action: 'resolved ticket #0041',
    timestamp: '1 hour ago',
  },
];

const iconMap = {
  join: { icon: UserPlus, color: 'text-success bg-success/20' },
  leave: { icon: UserMinus, color: 'text-danger bg-danger/20' },
  ticket: { icon: Ticket, color: 'text-avenlo-purple bg-avenlo-purple/20' },
  moderation: { icon: Shield, color: 'text-warning bg-warning/20' },
  message: { icon: MessageSquare, color: 'text-avenlo-cyan bg-avenlo-cyan/20' },
};

export default function ActivityFeed() {
  return (
    <div className="space-y-4">
      {mockActivity.map((item) => {
        const IconConfig = iconMap[item.type];
        return (
          <div
            key={item.id}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className={`p-2.5 rounded-xl ${IconConfig.color}`}>
              <IconConfig.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{item.user.username}</span>{' '}
                <span className="text-gray-400">{item.action}</span>
              </p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{item.timestamp}</span>
          </div>
        );
      })}
    </div>
  );
}
