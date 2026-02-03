'use client';

import { useEffect, useState, useRef } from 'react';

interface Narration {
  id: string;
  narrator_name: string;
  content: string;
  type: string;
  created_at: string;
}

// Custom SVG Icons - Red/Black/White theme
const Icons = {
  Microphone: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#DC2626"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#DC2626"/>
    </svg>
  ),
  Live: () => (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="4" fill="#DC2626">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  ),
  Trophy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" fill="#FFF"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#DC2626"/>
    </svg>
  ),
  Chart: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 18.5l6-6 4 4L22 6.92 20.59 5.5l-7.09 8-4-4L2 17l1.5 1.5z" fill="#FFF"/>
    </svg>
  ),
  TrendDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6h-6z" fill="#DC2626"/>
    </svg>
  ),
  Strategy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="#FFF"/>
    </svg>
  ),
  Lightbulb: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" fill="#FBBF24"/>
    </svg>
  ),
  Skull: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="10" r="2" fill="#DC2626"/>
      <circle cx="15" cy="10" r="2" fill="#DC2626"/>
      <path d="M12 2C6.48 2 2 6.48 2 12v8h4v-2h4v2h4v-2h4v2h4v-8c0-5.52-4.48-10-10-10zm0 18H6v-2h12v2h-6zm6-4H6v-4c0-3.31 2.69-6 6-6s6 2.69 6 6v4z" fill="#DC2626"/>
    </svg>
  ),
  Expand: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z" fill="#666"/>
    </svg>
  ),
  Collapse: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" fill="#666"/>
    </svg>
  ),
  Clock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="#666"/>
    </svg>
  ),
};

// Parse content and identify sections
function parseNarrationContent(content: string) {
  const sections: { type: string; content: string; items?: string[] }[] = [];
  
  // Split by line and categorize
  const lines = content.split('\n').filter(l => l.trim());
  let currentSection: { type: string; content: string; items: string[] } | null = null;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Detect section headers by keywords
    if (trimmed.includes('Catastrophic') || trimmed.includes('CRITICAL') || trimmed.includes('Failure')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'critical', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else if (trimmed.includes('Winner') || trimmed.includes('LEADER') || trimmed.includes('Top') || trimmed.includes('Success')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'success', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else if (trimmed.includes('Failing') || trimmed.includes('NEEDS HELP') || trimmed.includes('down') || trimmed.includes('losing')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'warning', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else if (trimmed.includes('STRATEGIC') || trimmed.includes('INSIGHT') || trimmed.includes('Strategy')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'insight', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else if (trimmed.includes('STATUS') || trimmed.includes('ECOSYSTEM') || trimmed.includes('Overview')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'status', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else if (currentSection) {
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    } else {
      // Default to info
      if (!currentSection) currentSection = { type: 'info', content: '', items: [] };
      currentSection.items.push(trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, ''));
    }
  });
  
  if (currentSection) sections.push(currentSection);
  
  return sections;
}

// Section component with iOS styling
function NarrationSection({ type, items }: { type: string; items: string[] }) {
  const configs: Record<string, { icon: React.ReactNode; bg: string; border: string; label: string; labelBg: string }> = {
    critical: {
      icon: <Icons.Skull />,
      bg: 'rgba(220, 38, 38, 0.08)',
      border: 'rgba(220, 38, 38, 0.2)',
      label: 'CRITICAL',
      labelBg: 'rgba(220, 38, 38, 0.9)',
    },
    warning: {
      icon: <Icons.Warning />,
      bg: 'rgba(220, 38, 38, 0.05)',
      border: 'rgba(220, 38, 38, 0.15)',
      label: 'WARNING',
      labelBg: 'rgba(220, 38, 38, 0.7)',
    },
    success: {
      icon: <Icons.Trophy />,
      bg: 'rgba(255, 255, 255, 0.03)',
      border: 'rgba(255, 255, 255, 0.1)',
      label: 'LEADERS',
      labelBg: 'rgba(255, 255, 255, 0.15)',
    },
    insight: {
      icon: <Icons.Lightbulb />,
      bg: 'rgba(251, 191, 36, 0.08)',
      border: 'rgba(251, 191, 36, 0.2)',
      label: 'STRATEGY',
      labelBg: 'rgba(251, 191, 36, 0.9)',
    },
    status: {
      icon: <Icons.Chart />,
      bg: 'rgba(255, 255, 255, 0.02)',
      border: 'rgba(255, 255, 255, 0.08)',
      label: 'STATUS',
      labelBg: 'rgba(255, 255, 255, 0.1)',
    },
    info: {
      icon: <Icons.Strategy />,
      bg: 'rgba(255, 255, 255, 0.02)',
      border: 'rgba(255, 255, 255, 0.08)',
      label: 'ANALYSIS',
      labelBg: 'rgba(255, 255, 255, 0.1)',
    },
  };
  
  const config = configs[type] || configs.info;
  
  return (
    <div 
      className="rounded-xl mb-2 overflow-hidden"
      style={{ 
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${config.border}` }}>
        <span className="flex-shrink-0">{config.icon}</span>
        <span 
          className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
          style={{ 
            background: config.labelBg,
            color: type === 'insight' ? '#000' : '#FFF',
          }}
        >
          {config.label}
        </span>
      </div>
      
      {/* Section Content */}
      <div className="px-3 py-2 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span 
              className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: type === 'critical' || type === 'warning' ? '#DC2626' : '#666' }}
            />
            <span 
              className="text-[11px] leading-relaxed"
              style={{ color: type === 'critical' ? '#FCA5A5' : type === 'insight' ? '#FDE68A' : '#A0A0A0' }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NarratorPanel() {
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const lastNarrationId = useRef<string | null>(null);

  // Fetch narrations
  useEffect(() => {
    const fetchNarrations = async () => {
      try {
        const res = await fetch('https://api.moltingcurve.wtf/api/narrator?limit=10');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setNarrations(data);
          
          // Check if this is a new narration
          if (lastNarrationId.current && data[0]?.id !== lastNarrationId.current) {
            setIsNew(true);
            setTimeout(() => setIsNew(false), 5000);
          }
          lastNarrationId.current = data[0]?.id;
        }
      } catch (e) {
        console.error('Failed to fetch narrations:', e);
      }
    };

    fetchNarrations();
    const interval = setInterval(fetchNarrations, 15000);
    return () => clearInterval(interval);
  }, []);

  const latestNarration = narrations[0];
  const sections = latestNarration ? parseNarrationContent(latestNarration.content) : [];

  if (!latestNarration) {
    return (
      <div 
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(145deg, #1A1A1F 0%, #0D0D10 100%)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <Icons.Microphone />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Arena Observer</div>
            <div className="text-[10px] text-gray-500">Initializing analysis...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-2xl overflow-hidden transition-all duration-500 ${isNew ? 'ring-1 ring-red-500/30' : ''}`}
      style={{
        background: 'linear-gradient(180deg, #0F0F12 0%, #08080A 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: isNew 
          ? '0 0 30px rgba(220, 38, 38, 0.15)' 
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Header - iOS style */}
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center relative"
            style={{ 
              background: 'linear-gradient(145deg, #1A1A1F 0%, #0D0D10 100%)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <Icons.Microphone />
            {/* Live indicator */}
            <div className="absolute -top-1 -right-1">
              <Icons.Live />
            </div>
          </div>
          
          {/* Title & Time */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-tight">Arena Observer</span>
              <span 
                className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                style={{ 
                  background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                  color: '#FFF',
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
                }}
              >
                LIVE
              </span>
              {isNew && (
                <span 
                  className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded animate-pulse"
                  style={{ background: '#FFF', color: '#000' }}
                >
                  NEW
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Icons.Clock />
              <span className="text-[10px] text-gray-500">
                {new Date(latestNarration.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-[10px] text-gray-600 mx-1">•</span>
              <span className="text-[10px] text-gray-500">Updates every hour</span>
            </div>
          </div>
        </div>
        
        {/* Expand/Collapse */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-medium">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          {isExpanded ? <Icons.Collapse /> : <Icons.Expand />}
        </div>
      </div>
      
      {/* Content - Parsed Sections */}
      <div className="px-4 py-3">
        {isExpanded ? (
          <div className="space-y-0">
            {sections.map((section, i) => (
              <NarrationSection key={i} type={section.type} items={section.items || []} />
            ))}
          </div>
        ) : (
          /* Collapsed Preview */
          <div 
            className="rounded-xl px-3 py-2.5"
            style={{ 
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div className="flex items-start gap-2">
              <Icons.TrendDown />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-gray-400 line-clamp-2">
                  {latestNarration.content.replace(/\*\*/g, '').replace(/[•\-]/g, '').slice(0, 200)}...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Expanded: History */}
      {isExpanded && narrations.length > 1 && (
        <div 
          className="px-4 py-3 max-h-32 overflow-y-auto custom-scrollbar"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
        >
          <div className="text-[9px] font-bold tracking-widest text-gray-600 mb-2">
            PREVIOUS ANALYSES
          </div>
          <div className="space-y-1.5">
            {narrations.slice(1, 4).map((narration) => (
              <div 
                key={narration.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(255, 255, 255, 0.02)' }}
              >
                <Icons.Clock />
                <span className="text-[9px] text-gray-500">
                  {new Date(narration.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] text-gray-500 truncate flex-1">
                  {narration.content.replace(/\*\*/g, '').slice(0, 80)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Ultra-Compact version for Easy Mode - Limited height, scrollable
export function NarratorPanelCompact() {
  const [latestNarration, setLatestNarration] = useState<Narration | null>(null);
  const [isNew, setIsNew] = useState(false);
  const lastNarrationId = useRef<string | null>(null);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch('https://api.moltingcurve.wtf/api/narrator/latest');
        const data = await res.json();
        if (data?.id) {
          if (lastNarrationId.current && data.id !== lastNarrationId.current) {
            setIsNew(true);
            setTimeout(() => setIsNew(false), 5000);
          }
          lastNarrationId.current = data.id;
          setLatestNarration(data);
        }
      } catch (e) {
        console.error('Failed to fetch latest narration:', e);
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!latestNarration) return null;

  const content = latestNarration.content.replace(/\*\*/g, '').replace(/[•\-]/g, '').trim();

  return (
    <div 
      className={`rounded-lg overflow-hidden transition-all duration-300 ${isNew ? 'ring-1 ring-emerald-500/20' : ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 25, 0.95) 0%, rgba(10, 18, 22, 0.98) 50%, rgba(12, 20, 28, 0.95) 100%)',
        border: '1px solid rgba(80, 120, 100, 0.15)',
        maxHeight: '120px',
      }}
    >
      {/* Single compact bar with content */}
      <div className="px-2.5 py-1.5 flex items-start gap-2">
        {/* Observer icon */}
        <div 
          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ 
            background: 'rgba(45, 90, 80, 0.3)',
            border: '1px solid rgba(80, 140, 120, 0.25)',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#5EAAA8"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#5EAAA8"/>
          </svg>
        </div>
        
        {/* Content area - scrollable */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: '100px' }}>
          <p 
            className="text-[10px] leading-snug"
            style={{ color: '#B8C8C4' }}
          >
            {content}
          </p>
        </div>
        
        {/* Live + Time column */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div 
              className="w-1 h-1 rounded-full"
              style={{ 
                background: '#5EAAA8',
                boxShadow: '0 0 4px rgba(94, 170, 168, 0.5)',
              }}
            />
            <span className="text-[7px] font-medium" style={{ color: '#5EAAA8' }}>LIVE</span>
          </div>
          <span className="text-[8px]" style={{ color: '#506868' }}>
            {new Date(latestNarration.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
