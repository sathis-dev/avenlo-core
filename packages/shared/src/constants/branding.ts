// ====================================
// AVENLO CORE - BRANDING CONSTANTS
// ====================================

/**
 * Official Avenlo color palette for Discord embeds
 */
export const AvenloColors = {
  /** General / Active status - Avenlo Cyan */
  CYAN: 0x00FFAA,
  
  /** Milestone Reached - Gold */
  GOLD: 0xFFD700,
  
  /** System Error / Critical Bug - Crisis Red */
  RED: 0xFF4B4B,
  
  /** Information / Neutral */
  BLUE: 0x5865F2,
  
  /** Success / Completed */
  GREEN: 0x57F287,
  
  /** Warning / Pending */
  YELLOW: 0xFEE75C,
  
  /** Offline / Inactive */
  GRAY: 0x99AAB5,
  
  /** Dark embed background */
  DARK_EMBED: 0x2B2D31,
  
  /** Purple for special features */
  PURPLE: 0x9B59B6,
  
  /** White for neutral embeds */
  WHITE: 0xFFFFFF,
} as const;

/**
 * Get color based on project/system status
 */
export function getStatusColor(status: string): number {
  const statusMap: Record<string, number> = {
    // Project statuses
    'active': AvenloColors.CYAN,
    'in-progress': AvenloColors.CYAN,
    'completed': AvenloColors.GREEN,
    'milestone': AvenloColors.GOLD,
    'paused': AvenloColors.YELLOW,
    'cancelled': AvenloColors.RED,
    
    // System statuses
    'online': AvenloColors.GREEN,
    'degraded': AvenloColors.YELLOW,
    'offline': AvenloColors.RED,
    'maintenance': AvenloColors.BLUE,
    
    // Error statuses
    'error': AvenloColors.RED,
    'critical': AvenloColors.RED,
    'warning': AvenloColors.YELLOW,
    'info': AvenloColors.BLUE,
  };
  
  return statusMap[status.toLowerCase()] ?? AvenloColors.CYAN;
}

/**
 * Avenlo branding assets
 */
export const AvenloBranding = {
  name: 'Avenlo Studio',
  tagline: 'Building the Future, One Line at a Time',
  logo: 'https://i.imgur.com/your-logo.png', // Replace with actual logo
  footer: '© 2025 Avenlo Studio • Powered by Avenlo Core',
  website: 'https://avenlo.studio',
} as const;

/**
 * Emoji constants for consistent messaging
 */
export const AvenloEmojis = {
  // Status indicators
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  
  // Actions
  CHECK: '☑️',
  ROCKET: '🚀',
  STAR: '⭐',
  FIRE: '🔥',
  SPARKLES: '✨',
  
  // Categories
  CODE: '💻',
  MONEY: '💰',
  CHART: '📊',
  GEAR: '⚙️',
  SHIELD: '🛡️',
  LOCK: '🔐',
  
  // Project
  FOLDER: '📁',
  FILE: '📄',
  CALENDAR: '📅',
  CLOCK: '🕐',
  
  // Communication
  BELL: '🔔',
  SPEECH: '💬',
  MAIL: '📧',
  
  // Ticket System
  TICKET: '🎫',
  BOOK: '📚',
  TOOLS: '🔧',
  CREDIT_CARD: '💳',
  LIGHTBULB: '💡',
  BUG: '🐛',
  PENCIL: '📝',
} as const;

/**
 * Progress bar generator
 */
export function createProgressBar(
  percentage: number,
  length: number = 10,
  filled: string = '█',
  empty: string = '░'
): string {
  const filledCount = Math.round((percentage / 100) * length);
  const emptyCount = length - filledCount;
  return filled.repeat(filledCount) + empty.repeat(emptyCount);
}
