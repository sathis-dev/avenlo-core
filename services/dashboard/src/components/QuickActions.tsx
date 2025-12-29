import { 
  Shield,
  Lock, 
  Unlock, 
  MessageSquareOff, 
  Send,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const actions = [
  {
    id: 'lockdown',
    label: 'Server Lockdown',
    icon: Lock,
    color: 'text-danger',
    bgColor: 'hover:bg-danger/10',
  },
  {
    id: 'unlock',
    label: 'Unlock Server',
    icon: Unlock,
    color: 'text-success',
    bgColor: 'hover:bg-success/10',
  },
  {
    id: 'clear-spam',
    label: 'Clear Spam',
    icon: MessageSquareOff,
    color: 'text-warning',
    bgColor: 'hover:bg-warning/10',
  },
  {
    id: 'announce',
    label: 'Send Announcement',
    icon: Send,
    color: 'text-avenlo-cyan',
    bgColor: 'hover:bg-avenlo-cyan/10',
  },
  {
    id: 'audit',
    label: 'Run Audit',
    icon: Shield,
    color: 'text-avenlo-purple',
    bgColor: 'hover:bg-avenlo-purple/10',
  },
  {
    id: 'refresh',
    label: 'Sync Roles',
    icon: RefreshCw,
    color: 'text-info',
    bgColor: 'hover:bg-info/10',
  },
];

export default function QuickActions() {
  const handleAction = (_actionId: string, label: string) => {
    toast.success(`${label} initiated`);
    // In real app, this would call the API
  };

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => handleAction(action.id, action.label)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${action.bgColor} group`}
        >
          <action.icon className={`w-5 h-5 ${action.color}`} />
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
