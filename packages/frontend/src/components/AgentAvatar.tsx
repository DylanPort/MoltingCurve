'use client';

// Agent Avatar with API avatar_url support and DiceBear fallback

interface AgentAvatarProps {
  name: string;
  size?: number;
  isOnline?: boolean;
  showBorder?: boolean;
  avatarUrl?: string | null;  // API avatar URL
}

export function AgentAvatar({ name, size = 40, isOnline = true, showBorder = true, avatarUrl }: AgentAvatarProps) {
  const fallbackUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=0a0a0a&size=${size}`;
  
  return (
    <div 
      className="relative flex-shrink-0 rounded-full overflow-hidden"
      style={{ 
        width: size, 
        height: size,
        background: '#0A0A0A',
        border: showBorder ? `1px solid rgba(255,255,255,0.15)` : 'none',
        boxShadow: isOnline 
          ? '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' 
          : '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      <img 
        src={avatarUrl || fallbackUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackUrl;
        }}
      />
      
      {/* Online indicator */}
      {showBorder && (
        <div 
          className="absolute bottom-0 right-0 rounded-full border-2"
          style={{ 
            width: size * 0.25,
            height: size * 0.25,
            background: isOnline ? '#22C55E' : '#404040',
            borderColor: '#0A0A0A',
            boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none'
          }}
        />
      )}
    </div>
  );
}

// Legacy SVG creature avatars for each letter A-Z (kept for backward compatibility)

interface AvatarConfig {
  creature: (size: number) => JSX.Element;
}

const AVATAR_CONFIGS: Record<string, AvatarConfig> = {
  A: {
    creature: (s) => (
      // Alien with antennae
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <circle cx="20" cy="22" r="12" fill="#FFFFFF"/>
        <ellipse cx="14" cy="20" rx="4" ry="5" fill="#000"/>
        <ellipse cx="26" cy="20" rx="4" ry="5" fill="#000"/>
        <ellipse cx="14" cy="19" rx="2" ry="2.5" fill="#FFF"/>
        <ellipse cx="26" cy="19" rx="2" ry="2.5" fill="#FFF"/>
        <line x1="12" y1="10" x2="10" y2="4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
        <line x1="28" y1="10" x2="30" y2="4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="4" r="2" fill="#CCC"/>
        <circle cx="30" cy="4" r="2" fill="#CCC"/>
      </svg>
    ),
  },
  B: {
    creature: (s) => (
      // Box Robot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="10" y="12" width="20" height="18" rx="2" fill="#888"/>
        <rect x="12" y="14" width="6" height="6" rx="1" fill="#FFF"/>
        <rect x="22" y="14" width="6" height="6" rx="1" fill="#FFF"/>
        <circle cx="15" cy="17" r="2" fill="#000"/>
        <circle cx="25" cy="17" r="2" fill="#000"/>
        <rect x="15" y="24" width="10" height="3" rx="1" fill="#444"/>
        <rect x="8" y="8" width="24" height="4" rx="1" fill="#666"/>
        <line x1="14" y1="8" x2="14" y2="4" stroke="#888" strokeWidth="2"/>
        <line x1="26" y1="8" x2="26" y2="4" stroke="#888" strokeWidth="2"/>
      </svg>
    ),
  },
  C: {
    creature: (s) => (
      // Cyclops alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="22" rx="14" ry="12" fill="#CCC"/>
        <circle cx="20" cy="20" r="8" fill="#000"/>
        <circle cx="20" cy="18" r="4" fill="#FFF"/>
        <circle cx="22" cy="17" r="1.5" fill="#888"/>
        <path d="M8 28 Q20 38 32 28" fill="none" stroke="#666" strokeWidth="2"/>
      </svg>
    ),
  },
  D: {
    creature: (s) => (
      // Drone bot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="22" rx="12" ry="8" fill="#777"/>
        <circle cx="20" cy="22" r="5" fill="#FFF"/>
        <circle cx="20" cy="22" r="2" fill="#000"/>
        <line x1="8" y1="18" x2="4" y2="12" stroke="#777" strokeWidth="2"/>
        <line x1="32" y1="18" x2="36" y2="12" stroke="#777" strokeWidth="2"/>
        <circle cx="4" cy="12" r="3" fill="#AAA"/>
        <circle cx="36" cy="12" r="3" fill="#AAA"/>
        <ellipse cx="20" cy="32" rx="6" ry="2" fill="#444"/>
      </svg>
    ),
  },
  E: {
    creature: (s) => (
      // Electric eel alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M8 20 Q14 12, 20 20 T32 20" fill="none" stroke="#FFF" strokeWidth="6" strokeLinecap="round"/>
        <circle cx="10" cy="18" r="3" fill="#000"/>
        <circle cx="10" cy="17" r="1.5" fill="#FFF"/>
        <path d="M30 16 L34 10 L32 16 L36 12" stroke="#CCC" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
  },
  F: {
    creature: (s) => (
      // Fierce face
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="24" rx="12" ry="10" fill="#AAA"/>
        <path d="M10 18 L8 10 L14 16" fill="#CCC"/>
        <path d="M30 18 L32 10 L26 16" fill="#CCC"/>
        <ellipse cx="15" cy="22" rx="3" ry="4" fill="#FFF"/>
        <ellipse cx="25" cy="22" rx="3" ry="4" fill="#FFF"/>
        <circle cx="15" cy="23" r="1.5" fill="#000"/>
        <circle cx="25" cy="23" r="1.5" fill="#000"/>
        <path d="M16 30 Q20 33 24 30" fill="none" stroke="#333" strokeWidth="1.5"/>
      </svg>
    ),
  },
  G: {
    creature: (s) => (
      // Ghost
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M10 36 L10 18 Q10 8 20 8 Q30 8 30 18 L30 36 L26 32 L22 36 L18 32 L14 36 L10 32" fill="#E0E0E0"/>
        <ellipse cx="15" cy="18" rx="3" ry="4" fill="#000"/>
        <ellipse cx="25" cy="18" rx="3" ry="4" fill="#000"/>
        <circle cx="15" cy="17" r="1" fill="#FFF"/>
        <circle cx="25" cy="17" r="1" fill="#FFF"/>
      </svg>
    ),
  },
  H: {
    creature: (s) => (
      // Humanoid robot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="12" y="10" width="16" height="20" rx="3" fill="#999"/>
        <rect x="14" y="14" width="5" height="4" rx="1" fill="#333"/>
        <rect x="21" y="14" width="5" height="4" rx="1" fill="#333"/>
        <circle cx="16.5" cy="16" r="1" fill="#FFF"/>
        <circle cx="23.5" cy="16" r="1" fill="#FFF"/>
        <rect x="16" y="22" width="8" height="2" rx="1" fill="#333"/>
        <line x1="20" y1="6" x2="20" y2="10" stroke="#999" strokeWidth="2"/>
        <circle cx="20" cy="5" r="2" fill="#CCC"/>
      </svg>
    ),
  },
  I: {
    creature: (s) => (
      // Ice crystal being
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <polygon points="20,4 26,16 34,20 26,24 20,36 14,24 6,20 14,16" fill="#CCC" opacity="0.8"/>
        <polygon points="20,8 24,16 30,20 24,24 20,32 16,24 10,20 16,16" fill="#FFF" opacity="0.9"/>
        <circle cx="17" cy="18" r="2" fill="#333"/>
        <circle cx="23" cy="18" r="2" fill="#333"/>
      </svg>
    ),
  },
  J: {
    creature: (s) => (
      // Jellyfish alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="14" rx="12" ry="8" fill="#DDD" opacity="0.9"/>
        <circle cx="16" cy="12" r="2" fill="#333"/>
        <circle cx="24" cy="12" r="2" fill="#333"/>
        <path d="M10 18 Q12 28 10 34" stroke="#BBB" strokeWidth="2" fill="none"/>
        <path d="M16 20 Q18 30 16 36" stroke="#CCC" strokeWidth="2" fill="none"/>
        <path d="M24 20 Q22 30 24 36" stroke="#CCC" strokeWidth="2" fill="none"/>
        <path d="M30 18 Q28 28 30 34" stroke="#BBB" strokeWidth="2" fill="none"/>
      </svg>
    ),
  },
  K: {
    creature: (s) => (
      // Knight robot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M12 8 L20 4 L28 8 L28 14 L20 18 L12 14 Z" fill="#BBB"/>
        <rect x="12" y="18" width="16" height="14" rx="2" fill="#888"/>
        <rect x="16" y="10" width="3" height="4" fill="#222"/>
        <rect x="21" y="10" width="3" height="4" fill="#222"/>
        <circle cx="17.5" cy="12" r="1" fill="#FFF"/>
        <circle cx="22.5" cy="12" r="1" fill="#FFF"/>
        <rect x="18" y="22" width="4" height="6" rx="1" fill="#666"/>
      </svg>
    ),
  },
  L: {
    creature: (s) => (
      // Lizard alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="22" rx="12" ry="10" fill="#B0B0B0"/>
        <ellipse cx="14" cy="18" rx="4" ry="5" fill="#FFF"/>
        <ellipse cx="26" cy="18" rx="4" ry="5" fill="#FFF"/>
        <ellipse cx="14" cy="19" rx="2" ry="3" fill="#000"/>
        <ellipse cx="26" cy="19" rx="2" ry="3" fill="#000"/>
        <path d="M8 14 L4 10" stroke="#B0B0B0" strokeWidth="3" strokeLinecap="round"/>
        <path d="M32 14 L36 10" stroke="#B0B0B0" strokeWidth="3" strokeLinecap="round"/>
        <ellipse cx="20" cy="28" rx="3" ry="1.5" fill="#888"/>
      </svg>
    ),
  },
  M: {
    creature: (s) => (
      // Mech warrior
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="8" y="12" width="24" height="18" rx="2" fill="#777"/>
        <rect x="4" y="14" width="4" height="10" rx="1" fill="#999"/>
        <rect x="32" y="14" width="4" height="10" rx="1" fill="#999"/>
        <rect x="14" y="16" width="4" height="3" fill="#FFF"/>
        <rect x="22" y="16" width="4" height="3" fill="#FFF"/>
        <rect x="12" y="22" width="16" height="4" rx="1" fill="#333"/>
        <circle cx="16" cy="24" r="1" fill="#FFF"/>
        <circle cx="20" cy="24" r="1" fill="#FFF"/>
        <circle cx="24" cy="24" r="1" fill="#FFF"/>
      </svg>
    ),
  },
  N: {
    creature: (s) => (
      // Nebula being
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <circle cx="20" cy="20" r="14" fill="#D0D0D0"/>
        <circle cx="16" cy="18" r="3" fill="#000" opacity="0.8"/>
        <circle cx="24" cy="18" r="3" fill="#000" opacity="0.8"/>
        <circle cx="16" cy="17" r="1.5" fill="#FFF"/>
        <circle cx="24" cy="17" r="1.5" fill="#FFF"/>
        <circle cx="12" cy="24" r="2" fill="#AAA"/>
        <circle cx="28" cy="24" r="2" fill="#AAA"/>
      </svg>
    ),
  },
  O: {
    creature: (s) => (
      // Octopus alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="16" rx="12" ry="10" fill="#CCC"/>
        <circle cx="15" cy="14" r="3" fill="#FFF"/>
        <circle cx="25" cy="14" r="3" fill="#FFF"/>
        <circle cx="15" cy="14" r="1.5" fill="#000"/>
        <circle cx="25" cy="14" r="1.5" fill="#000"/>
        <path d="M8 22 Q6 30 10 34" stroke="#AAA" strokeWidth="3" fill="none"/>
        <path d="M14 24 Q12 32 16 36" stroke="#BBB" strokeWidth="3" fill="none"/>
        <path d="M26 24 Q28 32 24 36" stroke="#BBB" strokeWidth="3" fill="none"/>
        <path d="M32 22 Q34 30 30 34" stroke="#AAA" strokeWidth="3" fill="none"/>
      </svg>
    ),
  },
  P: {
    creature: (s) => (
      // Probe droid
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <circle cx="20" cy="18" r="12" fill="#999"/>
        <circle cx="20" cy="18" r="8" fill="#333"/>
        <circle cx="20" cy="18" r="4" fill="#FFF"/>
        <circle cx="20" cy="17" r="1.5" fill="#000"/>
        <line x1="10" y1="28" x2="8" y2="34" stroke="#999" strokeWidth="2"/>
        <line x1="20" y1="30" x2="20" y2="36" stroke="#999" strokeWidth="2"/>
        <line x1="30" y1="28" x2="32" y2="34" stroke="#999" strokeWidth="2"/>
      </svg>
    ),
  },
  Q: {
    creature: (s) => (
      // Queen alien with crown
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M10 12 L14 6 L20 10 L26 6 L30 12" fill="#DDD"/>
        <ellipse cx="20" cy="22" rx="12" ry="12" fill="#BBB"/>
        <ellipse cx="15" cy="20" rx="3" ry="4" fill="#000"/>
        <ellipse cx="25" cy="20" rx="3" ry="4" fill="#000"/>
        <ellipse cx="15" cy="19" rx="1.5" ry="2" fill="#FFF"/>
        <ellipse cx="25" cy="19" rx="1.5" ry="2" fill="#FFF"/>
        <path d="M16 28 Q20 32 24 28" fill="none" stroke="#666" strokeWidth="2"/>
      </svg>
    ),
  },
  R: {
    creature: (s) => (
      // Round robot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="10" y="8" width="20" height="6" rx="2" fill="#AAA"/>
        <rect x="8" y="14" width="24" height="18" rx="3" fill="#888"/>
        <circle cx="15" cy="20" r="4" fill="#333"/>
        <circle cx="25" cy="20" r="4" fill="#333"/>
        <circle cx="15" cy="20" r="2" fill="#FFF"/>
        <circle cx="25" cy="20" r="2" fill="#FFF"/>
        <rect x="14" y="27" width="12" height="2" rx="1" fill="#555"/>
      </svg>
    ),
  },
  S: {
    creature: (s) => (
      // Squid alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="14" rx="10" ry="8" fill="#DDD"/>
        <circle cx="16" cy="12" r="3" fill="#333"/>
        <circle cx="24" cy="12" r="3" fill="#333"/>
        <circle cx="16" cy="11" r="1.5" fill="#FFF"/>
        <circle cx="24" cy="11" r="1.5" fill="#FFF"/>
        <path d="M12 20 L8 32" stroke="#CCC" strokeWidth="3" strokeLinecap="round"/>
        <path d="M17 22 L15 34" stroke="#DDD" strokeWidth="3" strokeLinecap="round"/>
        <path d="M23 22 L25 34" stroke="#DDD" strokeWidth="3" strokeLinecap="round"/>
        <path d="M28 20 L32 32" stroke="#CCC" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
  T: {
    creature: (s) => (
      // Tank bot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="6" y="20" width="28" height="12" rx="2" fill="#999"/>
        <rect x="10" y="12" width="20" height="10" rx="2" fill="#AAA"/>
        <circle cx="20" cy="16" r="4" fill="#333"/>
        <circle cx="20" cy="16" r="2" fill="#FFF"/>
        <circle cx="10" cy="28" r="4" fill="#666"/>
        <circle cx="20" cy="28" r="4" fill="#666"/>
        <circle cx="30" cy="28" r="4" fill="#666"/>
      </svg>
    ),
  },
  U: {
    creature: (s) => (
      // UFO
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="20" rx="16" ry="6" fill="#AAA"/>
        <ellipse cx="20" cy="16" rx="10" ry="8" fill="#CCC"/>
        <ellipse cx="20" cy="14" rx="6" ry="4" fill="#EEE"/>
        <circle cx="10" cy="20" r="2" fill="#FFF"/>
        <circle cx="20" cy="22" r="2" fill="#FFF"/>
        <circle cx="30" cy="20" r="2" fill="#FFF"/>
        <path d="M16 26 L14 32" stroke="#AAA" strokeWidth="2" opacity="0.6"/>
        <path d="M24 26 L26 32" stroke="#AAA" strokeWidth="2" opacity="0.6"/>
      </svg>
    ),
  },
  V: {
    creature: (s) => (
      // Viper snake
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M10 30 Q6 20, 14 14 Q20 10, 26 14 Q34 20, 30 30" fill="#CCC"/>
        <ellipse cx="16" cy="18" rx="3" ry="4" fill="#FFF"/>
        <ellipse cx="24" cy="18" rx="3" ry="4" fill="#FFF"/>
        <ellipse cx="16" cy="19" rx="1.5" ry="2" fill="#000"/>
        <ellipse cx="24" cy="19" rx="1.5" ry="2" fill="#000"/>
        <path d="M18 26 L20 30 L22 26" fill="#666"/>
      </svg>
    ),
  },
  W: {
    creature: (s) => (
      // Wizard alien
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <path d="M20 2 L26 18 L14 18 Z" fill="#AAA"/>
        <ellipse cx="20" cy="26" rx="10" ry="10" fill="#CCC"/>
        <circle cx="16" cy="24" r="3" fill="#000"/>
        <circle cx="24" cy="24" r="3" fill="#000"/>
        <circle cx="16" cy="23" r="1.5" fill="#FFF"/>
        <circle cx="24" cy="23" r="1.5" fill="#FFF"/>
        <path d="M14 32 Q20 36 26 32" fill="#999"/>
        <circle cx="20" cy="6" r="2" fill="#FFF"/>
      </svg>
    ),
  },
  X: {
    creature: (s) => (
      // X-ray skeleton bot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <circle cx="20" cy="14" r="10" fill="#555" stroke="#888" strokeWidth="2"/>
        <circle cx="16" cy="12" r="3" fill="#000"/>
        <circle cx="24" cy="12" r="3" fill="#000"/>
        <circle cx="16" cy="12" r="1" fill="#FFF"/>
        <circle cx="24" cy="12" r="1" fill="#FFF"/>
        <rect x="18" y="24" width="4" height="8" fill="#555"/>
        <line x1="14" y1="26" x2="10" y2="32" stroke="#888" strokeWidth="2"/>
        <line x1="26" y1="26" x2="30" y2="32" stroke="#888" strokeWidth="2"/>
        <path d="M16 18 L20 20 L24 18" fill="none" stroke="#888" strokeWidth="1.5"/>
      </svg>
    ),
  },
  Y: {
    creature: (s) => (
      // Yeti
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <ellipse cx="20" cy="22" rx="14" ry="14" fill="#E0E0E0"/>
        <circle cx="14" cy="18" r="4" fill="#FFF"/>
        <circle cx="26" cy="18" r="4" fill="#FFF"/>
        <circle cx="14" cy="18" r="2" fill="#000"/>
        <circle cx="26" cy="18" r="2" fill="#000"/>
        <ellipse cx="20" cy="26" rx="4" ry="3" fill="#888"/>
        <path d="M6 16 Q4 12, 8 10" stroke="#E0E0E0" strokeWidth="3" fill="none"/>
        <path d="M34 16 Q36 12, 32 10" stroke="#E0E0E0" strokeWidth="3" fill="none"/>
      </svg>
    ),
  },
  Z: {
    creature: (s) => (
      // Zapper robot
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect x="12" y="10" width="16" height="20" rx="3" fill="#777"/>
        <polygon points="20,4 24,10 16,10" fill="#CCC"/>
        <rect x="15" y="14" width="4" height="4" fill="#FFF"/>
        <rect x="21" y="14" width="4" height="4" fill="#FFF"/>
        <circle cx="17" cy="16" r="1" fill="#000"/>
        <circle cx="23" cy="16" r="1" fill="#000"/>
        <rect x="16" y="22" width="8" height="4" rx="1" fill="#333"/>
        <path d="M8 18 L4 14 L6 18 L2 16" stroke="#CCC" strokeWidth="1.5" fill="none"/>
        <path d="M32 18 L36 14 L34 18 L38 16" stroke="#CCC" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
  },
};

// Default creature for unknown letters
const DEFAULT_CREATURE = {
  creature: (s: number) => (
    <svg viewBox="0 0 40 40" width={s} height={s}>
      <circle cx="20" cy="20" r="14" fill="#999"/>
      <circle cx="15" cy="18" r="3" fill="#000"/>
      <circle cx="25" cy="18" r="3" fill="#000"/>
      <circle cx="15" cy="17" r="1.5" fill="#FFF"/>
      <circle cx="25" cy="17" r="1.5" fill="#FFF"/>
      <path d="M14 26 Q20 30 26 26" fill="none" stroke="#555" strokeWidth="2"/>
    </svg>
  ),
};

// Export for canvas rendering (legacy)
export function getAvatarConfig(letter: string): AvatarConfig {
  return AVATAR_CONFIGS[letter.toUpperCase()] || DEFAULT_CREATURE;
}

export { AVATAR_CONFIGS };
