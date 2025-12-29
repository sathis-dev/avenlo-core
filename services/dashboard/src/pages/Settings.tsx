import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Save,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: typeof SettingsIcon;
  settings: Setting[];
}

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'input' | 'channel';
  value: boolean | string;
  options?: { value: string; label: string }[];
}

const settingSections: SettingSection[] = [
  {
    id: 'moderation',
    title: 'AI Moderation',
    description: 'Configure AI-powered moderation settings',
    icon: Shield,
    settings: [
      {
        id: 'ai_moderation_enabled',
        label: 'Enable AI Moderation',
        description: 'Use GPT-4 to analyze and moderate messages',
        type: 'toggle',
        value: true,
      },
      {
        id: 'auto_mute',
        label: 'Auto-Mute on Spam',
        description: 'Automatically mute users detected spamming',
        type: 'toggle',
        value: true,
      },
      {
        id: 'warn_threshold',
        label: 'Warning Threshold',
        description: 'AI score threshold for warnings (0-100)',
        type: 'input',
        value: '40',
      },
      {
        id: 'ban_threshold',
        label: 'Ban Threshold',
        description: 'AI score threshold for auto-ban (0-100)',
        type: 'input',
        value: '95',
      },
    ],
  },
  {
    id: 'welcome',
    title: 'Welcome System',
    description: 'Configure welcome messages and auto-roles',
    icon: Sparkles,
    settings: [
      {
        id: 'welcome_enabled',
        label: 'Enable Welcome Messages',
        description: 'Send welcome messages when users join',
        type: 'toggle',
        value: true,
      },
      {
        id: 'welcome_dm',
        label: 'Send DM Welcome',
        description: 'Also send a private welcome message',
        type: 'toggle',
        value: true,
      },
      {
        id: 'auto_role',
        label: 'Auto-Assign Role',
        description: 'Automatically assign role on join',
        type: 'toggle',
        value: true,
      },
      {
        id: 'goodbye_enabled',
        label: 'Enable Goodbye Messages',
        description: 'Send messages when users leave',
        type: 'toggle',
        value: true,
      },
    ],
  },
  {
    id: 'protection',
    title: 'Server Protection',
    description: 'Anti-raid and anti-nuke settings',
    icon: Lock,
    settings: [
      {
        id: 'anti_raid',
        label: 'Anti-Raid Protection',
        description: 'Detect and prevent raid attacks',
        type: 'toggle',
        value: true,
      },
      {
        id: 'anti_nuke',
        label: 'Anti-Nuke Protection',
        description: 'Prevent mass deletions and bans',
        type: 'toggle',
        value: true,
      },
      {
        id: 'raid_threshold',
        label: 'Raid Detection Threshold',
        description: 'Joins per 30 seconds to trigger lockdown',
        type: 'input',
        value: '10',
      },
      {
        id: 'verification',
        label: 'New User Verification',
        description: 'Require captcha for new accounts',
        type: 'toggle',
        value: false,
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Configure alert and logging settings',
    icon: Bell,
    settings: [
      {
        id: 'mod_alerts',
        label: 'Moderation Alerts',
        description: 'Notify staff of moderation actions',
        type: 'toggle',
        value: true,
      },
      {
        id: 'join_alerts',
        label: 'Join/Leave Alerts',
        description: 'Log member joins and leaves',
        type: 'toggle',
        value: true,
      },
      {
        id: 'ticket_alerts',
        label: 'Ticket Alerts',
        description: 'Notify staff of new tickets',
        type: 'toggle',
        value: true,
      },
      {
        id: 'raid_alerts',
        label: 'Raid Alerts',
        description: 'Alert admins of potential raids',
        type: 'toggle',
        value: true,
      },
    ],
  },
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, boolean | string>>(() => {
    const initial: Record<string, boolean | string> = {};
    settingSections.forEach((section) => {
      section.settings.forEach((setting) => {
        initial[setting.id] = setting.value;
      });
    });
    return initial;
  });

  const [activeSection, setActiveSection] = useState('moderation');
  const [saving, setSaving] = useState(false);

  const handleToggle = (id: string) => {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInputChange = (id: string, value: string) => {
    setSettings((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    toast.success('Settings saved successfully!');
  };

  const currentSection = settingSections.find((s) => s.id === activeSection);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-400 mt-1">Configure your bot's behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-glow flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-4 lg:col-span-1"
        >
          <nav className="space-y-1">
            {settingSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-avenlo-cyan/10 text-avenlo-cyan border-l-2 border-avenlo-cyan'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <section.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{section.title}</span>
                {activeSection === section.id && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </button>
            ))}
          </nav>
        </motion.div>

        {/* Settings Panel */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 lg:col-span-3"
        >
          {currentSection && (
            <>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-avenlo-border">
                <div className="p-3 rounded-xl bg-avenlo-cyan/20">
                  <currentSection.icon className="w-6 h-6 text-avenlo-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{currentSection.title}</h2>
                  <p className="text-gray-400 text-sm">{currentSection.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                {currentSection.settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between py-4 border-b border-avenlo-border/50 last:border-0"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{setting.label}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{setting.description}</p>
                    </div>

                    {setting.type === 'toggle' && (
                      <button
                        onClick={() => handleToggle(setting.id)}
                        className="relative"
                      >
                        {settings[setting.id] ? (
                          <ToggleRight className="w-12 h-7 text-avenlo-cyan" />
                        ) : (
                          <ToggleLeft className="w-12 h-7 text-gray-600" />
                        )}
                      </button>
                    )}

                    {setting.type === 'input' && (
                      <input
                        type="text"
                        value={settings[setting.id] as string}
                        onChange={(e) => handleInputChange(setting.id, e.target.value)}
                        className="input w-24 text-center"
                      />
                    )}

                    {setting.type === 'select' && setting.options && (
                      <select
                        value={settings[setting.id] as string}
                        onChange={(e) => handleInputChange(setting.id, e.target.value)}
                        className="input w-48"
                      >
                        {setting.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6 border-danger/30"
      >
        <h2 className="text-lg font-semibold text-danger mb-4">Danger Zone</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-danger/10 rounded-xl border border-danger/20">
          <div>
            <h3 className="font-medium">Reset All Settings</h3>
            <p className="text-sm text-gray-400">Restore all settings to default values</p>
          </div>
          <button className="px-4 py-2 bg-danger/20 text-danger rounded-lg hover:bg-danger/30 transition-colors">
            Reset Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
}
