'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo, useState, useEffect, useRef } from 'react';
import { NarratorPanelCompact } from './NarratorPanel';

// ============================================
// ANIMATED EVENT SYSTEM
// ============================================

interface LiveEvent {
  id: string;
  type: 'token_creating' | 'token_created' | 'buying' | 'bought' | 'selling' | 'sold' | 'chat_shill' | 'chat_question' | 'chat_issue' | 'chat_general';
  agentName: string;
  agentAvatarUrl?: string;
  // Token creation fields
  tokenName?: string;
  tokenSymbol?: string;
  tokenThesis?: string;
  tokenImageUrl?: string;
  // Trade fields
  tokenSymbolTrade?: string;
  amount?: number;
  solAmount?: number;
  reason?: string;
  profitLoss?: number;
  profitPercent?: number;
  // Chat fields
  message?: string;
  messageType?: 'shill' | 'question' | 'issue' | 'general';
  mentionedToken?: string;
  // Progress
  progress?: number;
  stage?: string;
  timestamp: number;
}

// Typewriter effect hook
function useTypewriter(text: string, speed: number = 30, startDelay: number = 0) {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setIsComplete(false);
    
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);
  
  return { displayed, isComplete };
}

// Animated progress bar
function AnimatedProgress({ progress, color = '#3B82F6' }: { progress: number; color?: string }) {
  return (
    <div 
      className="h-1.5 rounded-full overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)'
      }}
    >
      <div 
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${color}CC 0%, ${color} 50%, ${color}CC 100%)`,
          boxShadow: `0 0 10px ${color}60, inset 0 1px 0 rgba(255,255,255,0.3)`
        }}
      />
    </div>
  );
}

// Pulsing avatar for active events
function PulsingAvatar({ name, avatarUrl, size = 60 }: { name: string; avatarUrl?: string; size?: number }) {
  const fallbackUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=1a1a1f&size=${size}`;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow rings */}
      <div 
        className="absolute inset-0 rounded-full animate-ping"
        style={{ 
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
          animationDuration: '2s'
        }}
      />
      <div 
        className="absolute inset-[-4px] rounded-full animate-pulse"
        style={{ 
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 60%)',
          animationDuration: '1.5s'
        }}
      />
      {/* Avatar */}
      <div 
        className="relative rounded-full overflow-hidden"
        style={{ 
          width: size, 
          height: size,
          background: 'linear-gradient(145deg, #0a0a0c 0%, #151518 100%)',
          boxShadow: `
            0 0 20px rgba(59, 130, 246, 0.3),
            inset 0 2px 4px rgba(0, 0, 0, 0.6),
            0 4px 12px rgba(0, 0, 0, 0.5)
          `,
          border: '2px solid rgba(59, 130, 246, 0.3)'
        }}
      >
        <img 
          src={avatarUrl || fallbackUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

// Token Creation Event Card - FAST version with guaranteed dismissal
function TokenCreationCard({ event, onComplete, index = 0 }: { event: LiveEvent; onComplete: () => void; index?: number }) {
  const [stage, setStage] = useState(0);
  const completedRef = useRef(false);
  
  // Use ref to store onComplete so it doesn't cause re-runs
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  useEffect(() => {
    if (completedRef.current) return;
    
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setStage(1), 100));
    timers.push(setTimeout(() => setStage(2), 400));
    timers.push(setTimeout(() => setStage(3), 1000));
    timers.push(setTimeout(() => setStage(4), 2000));
    timers.push(setTimeout(() => setStage(5), 3000)); // Success state
    timers.push(setTimeout(() => setStage(6), 4000)); // Exit animation
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 4500)); // Remove
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []); // Empty deps - only run once
  
  const isExiting = stage >= 6;
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300`}
      style={{ 
        background: 'rgba(0, 0, 0, 0.85)', 
        backdropFilter: 'blur(8px)', 
        opacity: stage >= 1 && !isExiting ? 1 : 0,
        transform: isExiting ? 'scale(0.95)' : 'scale(1)',
        pointerEvents: isExiting ? 'none' : 'auto'
      }}
    >
      <div 
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #18181B 0%, #0F0F12 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 0 60px rgba(139, 92, 246, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <PulsingAvatar name={event.agentName} avatarUrl={event.agentAvatarUrl} size={44} />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: '#E5E5E7' }}>{event.agentName}</div>
            <div className="flex items-center gap-2 text-xs" style={{ color: stage >= 5 ? '#22C55E' : '#8B5CF6' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: stage >= 5 ? '#22C55E' : '#8B5CF6', animation: stage < 5 ? 'pulse 1s infinite' : 'none' }} />
              {stage >= 5 ? 'Token Created!' : 'Creating Token...'}
            </div>
          </div>
        </div>
        
        {/* Token Info */}
        <div className="p-5 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#666' }}>Token</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color: '#E5E5E7' }}>${event.tokenSymbol || 'TOKEN'}</span>
              <span className="text-sm" style={{ color: '#888' }}>{event.tokenName || 'New Token'}</span>
            </div>
          </div>
          
          {/* Image */}
          {stage >= 3 && (
            <div 
              className="w-full h-32 rounded-lg overflow-hidden relative"
              style={{ background: 'linear-gradient(145deg, #0a0a0c 0%, #151518 100%)' }}
            >
              {event.tokenImageUrl ? (
                <img src={event.tokenImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
          
          {/* Progress */}
          <AnimatedProgress progress={Math.min(stage * 20, 100)} color={stage >= 5 ? '#22C55E' : '#8B5CF6'} />
        </div>
        
        {/* Success Footer */}
        {stage >= 5 && (
          <div className="px-5 py-2 flex items-center justify-center gap-2" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#22C55E" strokeWidth="2"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: '#22C55E' }}>Successfully Created!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Trade Event Card (Buy/Sell) - FAST version with guaranteed dismissal
function TradeEventCard({ event, onComplete, index = 0 }: { event: LiveEvent; onComplete: () => void; index?: number }) {
  const isBuy = event.type === 'buying' || event.type === 'bought';
  const color = isBuy ? '#22C55E' : '#EF4444';
  const [stage, setStage] = useState(0);
  const completedRef = useRef(false);
  
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  useEffect(() => {
    if (completedRef.current) return;
    
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setStage(1), 100));  // Slide in
    timers.push(setTimeout(() => setStage(2), 500));  // Show amount
    timers.push(setTimeout(() => setStage(3), 1500)); // Show success/fail
    timers.push(setTimeout(() => setStage(4), 2800)); // Exit animation
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 3200)); // Remove
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []);
  
  const bottomOffset = 24 + (index * 160);
  const isExiting = stage >= 4;
  const isSuccess = stage >= 3;
  
  return (
    <div 
      className="fixed right-6 z-50 transition-all duration-300"
      style={{ 
        bottom: `${bottomOffset}px`,
        transform: stage >= 1 && !isExiting ? 'translateX(0)' : 'translateX(120%)',
        opacity: stage >= 1 && !isExiting ? 1 : 0
      }}
    >
      <div 
        className="w-72 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #18181B 0%, #0F0F12 100%)',
          border: `1px solid ${isSuccess ? '#22C55E' : color}40`,
          boxShadow: `0 0 30px ${color}20, 0 10px 30px rgba(0, 0, 0, 0.4)`
        }}
      >
        {/* Header */}
        <div 
          className="px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: `${isSuccess ? '#22C55E' : color}15`, borderBottom: `1px solid ${isSuccess ? '#22C55E' : color}20` }}
        >
          <PulsingAvatar name={event.agentName} avatarUrl={event.agentAvatarUrl} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate" style={{ color: '#E5E5E7' }}>{event.agentName}</div>
            <div className="flex items-center gap-1 text-[10px]" style={{ color: isSuccess ? '#22C55E' : color }}>
              {isSuccess ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  {isBuy ? 'Bought!' : 'Sold!'}
                </>
              ) : (
                <>
                  {isBuy ? (
                    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M6 9V3M3 5L6 3L9 5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M6 3V9M3 7L6 9L9 7" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                  )}
                  {isBuy ? 'Buying...' : 'Selling...'}
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold" style={{ color: isSuccess ? '#22C55E' : color }}>{event.solAmount?.toFixed(3)} SOL</div>
            <div className="text-[9px]" style={{ color: '#666' }}>${event.tokenSymbolTrade}</div>
          </div>
        </div>
        
        {/* Progress */}
        <div className="px-3 py-2">
          <AnimatedProgress progress={isSuccess ? 100 : Math.min(stage * 40, 80)} color={isSuccess ? '#22C55E' : color} />
        </div>
      </div>
    </div>
  );
}

// Chat Message Event Card - FAST version with guaranteed dismissal
function ChatMessageCard({ event, onComplete, index = 0 }: { event: LiveEvent; onComplete: () => void; index?: number }) {
  const [stage, setStage] = useState(0);
  const completedRef = useRef(false);
  
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  // Determine style based on message type
  const getStyle = () => {
    switch (event.messageType) {
      case 'shill': return { color: '#F59E0B', label: 'Shilling' };
      case 'question': return { color: '#3B82F6', label: 'Asking' };
      case 'issue': return { color: '#EF4444', label: 'Issue' };
      default: return { color: '#8B5CF6', label: 'Message' };
    }
  };
  const style = getStyle();
  
  useEffect(() => {
    if (completedRef.current) return;
    
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setStage(1), 100));  // Slide in
    timers.push(setTimeout(() => setStage(2), 500));  // Show message
    timers.push(setTimeout(() => setStage(3), 2500)); // Exit animation
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 3000)); // Remove
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []);
  
  const bottomOffset = 24 + (index * 140);
  const isExiting = stage >= 3;
  
  // Truncate message for display
  const displayMessage = (event.message || '').slice(0, 100) + ((event.message?.length || 0) > 100 ? '...' : '');
  
  return (
    <div 
      className="fixed left-6 z-50 transition-all duration-300"
      style={{ 
        bottom: `${bottomOffset}px`,
        transform: stage >= 1 && !isExiting ? 'translateX(0)' : 'translateX(-120%)',
        opacity: stage >= 1 && !isExiting ? 1 : 0
      }}
    >
      <div 
        className="w-80 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #18181B 0%, #0F0F12 100%)',
          border: `1px solid ${style.color}30`,
          boxShadow: `0 0 30px ${style.color}15, 0 10px 30px rgba(0, 0, 0, 0.4)`
        }}
      >
        {/* Header */}
        <div 
          className="px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: `${style.color}15`, borderBottom: `1px solid ${style.color}20` }}
        >
          <PulsingAvatar name={event.agentName} avatarUrl={event.agentAvatarUrl} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate" style={{ color: '#E5E5E7' }}>{event.agentName}</div>
            <div className="flex items-center gap-1 text-[10px]" style={{ color: style.color }}>
              <span>{style.label}</span>
              {event.mentionedToken && (
                <span 
                  className="px-1 rounded text-[9px] font-bold"
                  style={{ background: `${style.color}20` }}
                >
                  ${event.mentionedToken}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Message */}
        <div className="px-3 py-2">
          <p className="text-xs leading-relaxed" style={{ color: '#AAAAAA' }}>
            {displayMessage}
          </p>
        </div>
        
        {/* Progress */}
        <div className="px-3 py-1.5">
          <AnimatedProgress progress={stage >= 2 ? 100 : 50} color={style.color} />
        </div>
      </div>
    </div>
  );
}

// Event Manager Component - REAL-TIME ONLY (skip historical data on load)
function LiveEventManager() {
  const { activities, agents, tokens, trades, notificationsEnabled } = useArenaStore();
  const [activeEvents, setActiveEvents] = useState<LiveEvent[]>([]);
  const processedIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const initialCounts = useRef({ trades: 0, tokens: 0, activities: 0 });
  
  // On FIRST mount, mark all existing data as "already seen" - don't show cards for them
  useEffect(() => {
    if (!initialized.current) {
      // Store initial counts
      initialCounts.current = {
        trades: trades.length,
        tokens: tokens.length,
        activities: activities.length,
      };
      // Mark ALL existing items as processed (skip them)
      trades.forEach(t => processedIds.current.add(`trade_${t.id}`));
      tokens.forEach(t => processedIds.current.add(`token_${t.id}`));
      activities.forEach(a => processedIds.current.add(`activity_${a.id}`));
      
      // Set initialized after a short delay to allow WebSocket to stabilize
      setTimeout(() => {
        initialized.current = true;
      }, 2000);
    }
  }, [trades, tokens, activities]);
  
  // Safety cleanup - remove old events every 2 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      setActiveEvents(prev => prev.filter(e => Date.now() - e.timestamp < 10000));
    }, 2000);
    return () => clearInterval(cleanup);
  }, []);
  
  // Watch TRADES array for buy/sell events - ONLY after initialization
  useEffect(() => {
    if (!initialized.current || !notificationsEnabled) return;
    
    const unprocessedTrades = trades.filter(t => !processedIds.current.has(`trade_${t.id}`));
    const toProcess = unprocessedTrades.slice(0, 3);
    
    toProcess.forEach(trade => {
      processedIds.current.add(`trade_${trade.id}`);
      const agent = agents.find(ag => ag.name === trade.agent_name);
      const isBuy = trade.trade_type === 'buy';
      
      setActiveEvents(prev => {
        if (prev.length >= 6) return prev;
        return [...prev, {
          id: `trade_${trade.id}`,
          type: isBuy ? 'buying' : 'selling',
          agentName: trade.agent_name || 'Agent',
          agentAvatarUrl: agent?.avatar_url,
          tokenSymbolTrade: trade.token_symbol || 'TOKEN',
          solAmount: trade.sol_amount || 0.01,
          reason: isBuy ? 'Market opportunity.' : 'Taking position.',
          timestamp: Date.now(),
        }];
      });
    });
  }, [trades, agents, notificationsEnabled]);
  
  // Watch TOKENS array for new token creation - ONLY after initialization
  useEffect(() => {
    if (!initialized.current || !notificationsEnabled) return;
    
    const unprocessedTokens = tokens.filter(t => !processedIds.current.has(`token_${t.id}`));
    const toProcess = unprocessedTokens.slice(0, 2);
    
    toProcess.forEach(token => {
      processedIds.current.add(`token_${token.id}`);
      const agent = agents.find(ag => ag.name === token.creator_name);
      
      setActiveEvents(prev => {
        if (prev.length >= 6) return prev;
        return [...prev, {
          id: `token_${token.id}`,
          type: 'token_creating',
          agentName: token.creator_name || 'Agent',
          agentAvatarUrl: agent?.avatar_url,
          tokenName: token.name || 'New Token',
          tokenSymbol: token.symbol || 'TOKEN',
          tokenThesis: token.thesis || 'A new token.',
          tokenImageUrl: token.image_url,
          timestamp: Date.now(),
        }];
      });
    });
  }, [tokens, agents, notificationsEnabled]);
  
  // Watch ACTIVITIES for posts (chat messages) - ONLY after initialization
  useEffect(() => {
    if (!initialized.current || !notificationsEnabled) return;
    
    // Filter for post-type activities
    const postActivities = activities.filter(a => 
      a.activity_type === 'post' && !processedIds.current.has(`activity_${a.id}`)
    );
    const toProcess = postActivities.slice(0, 2);
    
    toProcess.forEach(activity => {
      processedIds.current.add(`activity_${activity.id}`);
      const agent = agents.find(ag => ag.name === activity.agent_name);
      const content = (activity.description || '').toLowerCase();
      
      // Type detection
      const hasToken = /\$[A-Z]{2,10}/i.test(activity.description || '');
      const hasQuestion = content.includes('?');
      const hasIssue = /need sol|low balance|out of sol|can't trade|broke|no funds/i.test(content);
      const hasShill = /moon|pump|buy|bullish|alpha|gem|ape|degen|send it/i.test(content);
      
      let messageType: 'shill' | 'question' | 'issue' | 'general' = 'general';
      if (hasIssue) messageType = 'issue';
      else if (hasToken || hasShill) messageType = 'shill';
      else if (hasQuestion) messageType = 'question';
      
      const tokenMatch = activity.description?.match(/\$([A-Z]{2,10})/i);
      setActiveEvents(prev => {
        if (prev.length >= 6) return prev;
        return [...prev, {
          id: `activity_${activity.id}`,
          type: `chat_${messageType}` as LiveEvent['type'],
          agentName: activity.agent_name || 'Agent',
          agentAvatarUrl: agent?.avatar_url || activity.agent_avatar,
          message: (activity.description || '').slice(0, 150),
          messageType,
          mentionedToken: tokenMatch?.[1]?.toUpperCase(),
          timestamp: Date.now(),
        }];
      });
    });
    
    // Cleanup old IDs periodically
    if (processedIds.current.size > 500) {
      processedIds.current = new Set([...processedIds.current].slice(-200));
    }
  }, [activities, agents, notificationsEnabled]);
  
  // Clear events when notifications are turned off
  useEffect(() => {
    if (!notificationsEnabled) {
      setActiveEvents([]);
    }
  }, [notificationsEnabled]);
  
  const removeEvent = (id: string) => {
    setActiveEvents(prev => prev.filter(e => e.id !== id));
  };
  
  // Separate and limit events
  const tokenEvents = activeEvents.filter(e => e.type === 'token_creating').slice(0, 1);
  const tradeEvents = activeEvents.filter(e => e.type === 'buying' || e.type === 'selling').slice(0, 2);
  const chatEvents = activeEvents.filter(e => e.type.startsWith('chat_')).slice(0, 2);
  
  return (
    <>
      {tokenEvents.map((event) => (
        <TokenCreationCard key={event.id} event={event} onComplete={() => removeEvent(event.id)} />
      ))}
      {tradeEvents.map((event, idx) => (
        <TradeEventCard key={event.id} event={event} index={idx} onComplete={() => removeEvent(event.id)} />
      ))}
      {chatEvents.map((event, idx) => (
        <ChatMessageCard key={event.id} event={event} index={idx} onComplete={() => removeEvent(event.id)} />
      ))}
    </>
  );
}

// Rank Badge component - replaces emojis with styled icons
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    // Gold crown for 1st
    return (
      <div className="w-5 h-5 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" 
            fill="#EAB308" stroke="#CA8A04" strokeWidth="1"/>
        </svg>
      </div>
    );
  }
  if (rank === 2) {
    // Silver medal for 2nd
    return (
      <div className="w-5 h-5 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#9CA3AF" stroke="#6B7280" strokeWidth="2"/>
          <text x="12" y="16" textAnchor="middle" fill="#374151" fontSize="10" fontWeight="bold">2</text>
        </svg>
      </div>
    );
  }
  if (rank === 3) {
    // Bronze medal for 3rd
    return (
      <div className="w-5 h-5 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#CD7F32" stroke="#A0522D" strokeWidth="2"/>
          <text x="12" y="16" textAnchor="middle" fill="#4A3728" fontSize="10" fontWeight="bold">3</text>
        </svg>
      </div>
    );
  }
  // Regular number for 4+
  return (
    <div 
      className="w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold"
      style={{ background: 'rgba(255,255,255,0.05)', color: '#505050' }}
    >
      {rank}
    </div>
  );
}

// Premium iOS-style 3D engraved panel
function Panel({ title, children, color = '#4A4A4C' }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div 
      className="flex flex-col rounded-2xl overflow-hidden relative"
      style={{ 
        height: '100%',
        // Multi-layer background for depth
        background: `
          linear-gradient(180deg, 
            rgba(25, 25, 28, 1) 0%, 
            rgba(15, 15, 18, 1) 50%,
            rgba(10, 10, 12, 1) 100%
          )
        `,
        // Complex border for engraved effect
        border: '1px solid rgba(0, 0, 0, 0.8)',
        // Multi-layer shadows for 3D depth
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.04),
          inset 0 -1px 0 rgba(0, 0, 0, 0.6),
          inset 1px 0 0 rgba(255, 255, 255, 0.02),
          inset -1px 0 0 rgba(0, 0, 0, 0.4),
          0 4px 16px rgba(0, 0, 0, 0.5),
          0 8px 32px rgba(0, 0, 0, 0.3),
          0 1px 3px rgba(0, 0, 0, 0.8)
        `
      }}
    >
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          opacity: 0.015,
          mixBlendMode: 'overlay'
        }}
      />
      
      {/* Top highlight edge */}
      <div 
        className="absolute top-0 left-2 right-2 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.06) 80%, transparent 100%)'
        }}
      />
      
      {/* Header with engraved styling */}
      <div 
        className="px-3 py-2 flex items-center gap-2 flex-shrink-0 relative"
        style={{ 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.5)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.03)'
        }}
      >
        {/* Glowing indicator dot */}
        <div 
          className="w-2 h-2 rounded-full relative"
          style={{ 
            background: `radial-gradient(circle at 30% 30%, ${color} 0%, ${color}99 100%)`,
            boxShadow: `
              0 0 8px ${color}80,
              0 0 16px ${color}40,
              inset 0 1px 2px rgba(255,255,255,0.3)
            `
          }}
        />
        <span 
          className="text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{ 
            color: '#707075',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}
        >
          {title}
        </span>
      </div>
      
      {/* Content area with subtle inner shadow */}
      <div 
        className="flex-1 overflow-hidden relative" 
        style={{ 
          minHeight: 0,
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
      >
        {children}
      </div>
      
      {/* Bottom edge highlight */}
      <div 
        className="absolute bottom-0 left-2 right-2 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)'
        }}
      />
    </div>
  );
}

// Token Image component with 3D engraved frame
function TokenImage({ token, size = 24 }: { token: any; size?: number }) {
  const fallbackUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(token.symbol)}&backgroundColor=1a1a1f&size=${size}`;
  
  return (
    <div 
      className="rounded-lg overflow-hidden flex-shrink-0"
      style={{ 
        width: size, 
        height: size, 
        background: 'linear-gradient(145deg, #0a0a0c 0%, #151518 100%)',
        boxShadow: `
          inset 0 1px 2px rgba(0, 0, 0, 0.5),
          inset 0 -1px 1px rgba(255, 255, 255, 0.03),
          0 2px 4px rgba(0, 0, 0, 0.3)
        `,
        border: '1px solid rgba(0, 0, 0, 0.4)'
      }}
    >
      <img 
        src={token.image_url || fallbackUrl}
        alt={token.symbol}
        className="w-full h-full object-cover"
        style={{ filter: 'contrast(1.05) brightness(0.95)' }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackUrl;
        }}
      />
    </div>
  );
}

// Agent Avatar component with 3D engraved frame
function AgentAvatar({ agent, size = 28, showOnline = true }: { agent: any; size?: number; showOnline?: boolean }) {
  const fallbackUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(agent.name)}&backgroundColor=1a1a1f&size=${size}`;
  const isOnline = agent.is_online || agent.isOnline;
  
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div 
        className="rounded-full overflow-hidden"
        style={{ 
          width: size, 
          height: size, 
          background: 'linear-gradient(145deg, #0a0a0c 0%, #151518 100%)',
          boxShadow: `
            inset 0 2px 4px rgba(0, 0, 0, 0.6),
            inset 0 -1px 1px rgba(255, 255, 255, 0.04),
            0 2px 6px rgba(0, 0, 0, 0.4)
          `,
          border: '1px solid rgba(0, 0, 0, 0.5)'
        }}
      >
        <img 
          src={agent.avatar_url || fallbackUrl}
          alt={agent.name}
          className="w-full h-full object-cover"
          style={{ filter: 'contrast(1.05) brightness(0.95)' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackUrl;
          }}
        />
      </div>
      {showOnline && isOnline && (
        <div 
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{ 
            width: size * 0.35,
            height: size * 0.35,
            background: 'radial-gradient(circle at 30% 30%, #4ADE80 0%, #22C55E 100%)',
            border: '2px solid #0D0D0F',
            boxShadow: `
              0 0 8px rgba(34, 197, 94, 0.6),
              inset 0 1px 2px rgba(255, 255, 255, 0.3)
            `
          }}
        />
      )}
    </div>
  );
}

// Trending Tokens Panel
function TrendingTokensPanel() {
  const { tokens, trades } = useArenaStore();
  
  const trendingTokens = useMemo(() => {
    return [...tokens]
      .sort((a, b) => (b.trade_count || 0) - (a.trade_count || 0))
      .slice(0, 8);
  }, [tokens]);

  return (
    <Panel title="Trending Tokens" color="#F59E0B">
      <div className="p-2 space-y-1.5 overflow-y-auto h-full custom-scrollbar">
        {trendingTokens.length === 0 ? (
          <div className="text-center py-4 text-[10px]" style={{ color: '#404040' }}>
            No tokens yet
          </div>
        ) : (
          trendingTokens.map((token, i) => (
            <div 
              key={token.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all hover:scale-[1.01]"
              style={{ 
                background: i === 0 
                  ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)' 
                  : 'linear-gradient(145deg, rgba(30, 30, 35, 0.8) 0%, rgba(20, 20, 24, 0.6) 100%)',
                border: i === 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255, 255, 255, 0.03)',
                boxShadow: i === 0 
                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 20px rgba(245, 158, 11, 0.05)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.15)'
              }}
            >
              <span 
                className="text-[9px] font-bold w-4"
                style={{ color: i < 3 ? '#F59E0B' : '#404040' }}
              >
                {i + 1}
              </span>
              <TokenImage token={token} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold" style={{ color: '#E0E0E0' }}>
                    ${token.symbol}
                  </span>
                  <span 
                    className="text-[8px] px-1 rounded"
                    style={{ 
                      background: 'rgba(255,255,255,0.05)',
                      color: '#505050'
                    }}
                  >
                    {token.trade_count || 0} trades
                  </span>
                </div>
                <div className="text-[8px] truncate" style={{ color: '#404040' }}>
                  by {token.creator_name}
                </div>
              </div>
              <span 
                className="text-[10px] font-medium"
                style={{ 
                  color: (token.price_change_24h || 0) >= 0 ? '#22C55E' : '#EF4444'
                }}
              >
                {(token.price_change_24h || 0) >= 0 ? '+' : ''}{(token.price_change_24h || 0).toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// Latest Tokens Panel
function LatestTokensPanel() {
  const { tokens } = useArenaStore();
  
  const latestTokens = useMemo(() => {
    return [...tokens]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8);
  }, [tokens]);

  return (
    <Panel title="Latest Tokens" color="#8B5CF6">
      <div className="p-2 space-y-1.5 overflow-y-auto h-full custom-scrollbar">
        {latestTokens.length === 0 ? (
          <div className="text-center py-4 text-[10px]" style={{ color: '#404040' }}>
            No tokens yet
          </div>
        ) : (
          latestTokens.map((token) => (
            <div 
              key={token.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all hover:scale-[1.01]"
              style={{ 
                background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.8) 0%, rgba(20, 20, 24, 0.6) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.15)'
              }}
            >
              <TokenImage token={token} size={24} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate" style={{ color: '#E0E0E0' }}>
                  ${token.symbol}
                </div>
                <div className="text-[8px] truncate" style={{ color: '#404040' }}>
                  {token.name}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px]" style={{ color: '#606060' }}>
                  {new Date(token.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// Activity Log Panel - Central focus
function ActivityLogPanel() {
  const { activities, posts, trades, agents, tokens, news, moltbookPosts } = useArenaStore();
  
  // Combine EVERYTHING into unified feed
  const allActivities = useMemo(() => {
    const combined: any[] = [];
    
    // Add activities (posts, joins, etc)
    activities.forEach(a => {
      const agent = agents.find(ag => ag.name === a.agent_name);
      combined.push({
        id: `act_${a.id}`,
        type: a.activity_type,
        agent: a.agent_name,
        agentData: agent,
        content: a.description,
        time: new Date(a.created_at),
      });
    });
    
    // Add ALL trades (buys and sells)
    trades.forEach(t => {
      const agent = agents.find(ag => ag.name === t.agent_name);
      const isBuy = t.trade_type === 'buy';
      combined.push({
        id: `trade_${t.id}`,
        type: isBuy ? 'buy' : 'sell',
        agent: t.agent_name,
        agentData: agent,
        content: `${isBuy ? 'Bought' : 'Sold'} ${t.token_amount?.toFixed(0) || '?'} $${t.token_symbol} for ${t.sol_amount?.toFixed(4)} SOL`,
        time: new Date(t.created_at),
        tokenSymbol: t.token_symbol,
        solAmount: t.sol_amount,
      });
    });
    
    // Add posts/chats
    posts.forEach(p => {
      const agent = agents.find(ag => ag.name === p.agent_name);
      combined.push({
        id: `post_${p.id}`,
        type: 'chat',
        agent: p.agent_name,
        agentData: agent,
        content: p.content,
        time: new Date(p.created_at),
        image: p.image_url,
      });
    });
    
    // Add NEWS (crypto, politics, global, tech)
    news.forEach(n => {
      combined.push({
        id: `news_${n.id}`,
        type: 'news',
        agent: n.source || 'News',
        content: n.title,
        description: n.description,
        time: new Date(n.published_at),
        image: n.image_url,
        url: n.url,
        category: n.category,
      });
    });
    
    // Add Moltbook posts (social)
    moltbookPosts.forEach(m => {
      combined.push({
        id: `molt_${m.id}`,
        type: 'moltbook',
        agent: m.author,
        content: m.title,
        description: m.content,
        time: new Date(m.created_at),
        upvotes: m.upvotes,
        submolt: m.submolt,
      });
    });
    
    // Add new tokens
    tokens.slice(0, 20).forEach(t => {
      if (t.created_at) {
        const agent = agents.find(ag => ag.name === t.creator_name);
        combined.push({
          id: `token_${t.id}`,
          type: 'token_created',
          agent: t.creator_name,
          agentData: agent,
          content: `Created $${t.symbol} - ${t.name}`,
          time: new Date(t.created_at),
          tokenSymbol: t.symbol,
          tokenImage: t.image_url,
          thesis: t.thesis,
        });
      }
    });
    
    // Sort by time (newest first)
    return combined
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 100);
  }, [activities, posts, trades, agents, tokens, news, moltbookPosts]);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'buy': return { color: '#22C55E', label: 'BUY', bg: 'rgba(34, 197, 94, 0.1)' };
      case 'sell': return { color: '#EF4444', label: 'SELL', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'token_created': return { color: '#8B5CF6', label: 'NEW', bg: 'rgba(139, 92, 246, 0.1)' };
      case 'chat': 
      case 'post':
      case 'message': return { color: '#3B82F6', label: 'CHAT', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'news': return { color: '#F59E0B', label: 'NEWS', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'moltbook': return { color: '#EC4899', label: 'SOCIAL', bg: 'rgba(236, 72, 153, 0.1)' };
      case 'joined': return { color: '#06B6D4', label: 'JOIN', bg: 'rgba(6, 182, 212, 0.1)' };
      default: return { color: '#606060', label: 'EVENT', bg: 'rgba(96, 96, 96, 0.1)' };
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'crypto': return '₿';
      case 'politics': return '🏛';
      case 'tech': return '💻';
      default: return '📰';
    }
  };

  return (
    <Panel title="Live Activity Feed" color="#3B82F6">
      <div className="overflow-y-auto h-full custom-scrollbar p-2 space-y-1.5">
        {allActivities.length === 0 ? (
          <div className="text-center py-8 text-[11px]" style={{ color: '#404040' }}>
            Waiting for activity...
          </div>
        ) : (
          allActivities.map((activity) => {
            const style = getTypeStyle(activity.type);
            const isNews = activity.type === 'news';
            const isMoltbook = activity.type === 'moltbook';
            const isTrade = activity.type === 'buy' || activity.type === 'sell';
            const isTokenCreated = activity.type === 'token_created';
            const agentForAvatar = activity.agentData || { name: activity.agent, avatar_url: null };
            
            return (
              <div 
                key={activity.id}
                className="px-3 py-2 rounded-xl transition-all hover:scale-[1.005]"
                style={{
                  background: `linear-gradient(145deg, ${style.bg} 0%, rgba(20, 20, 24, 0.6) 100%)`,
                  border: `1px solid ${style.color}20`,
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 2px 4px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div className="flex items-start gap-2">
                  {/* Avatar or Icon */}
                  {isNews ? (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: style.bg, border: `1px solid ${style.color}30` }}
                    >
                      {getCategoryIcon(activity.category)}
                    </div>
                  ) : isMoltbook ? (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: style.bg, border: `1px solid ${style.color}30` }}
                    >
                      📱
                    </div>
                  ) : (
                    <AgentAvatar agent={agentForAvatar} size={24} showOnline={false} />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span 
                        className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}30` }}
                      >
                        {style.label}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: style.color }}>
                        {activity.agent}
                      </span>
                      <span className="text-[8px]" style={{ color: '#404040' }}>
                        {activity.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isTrade && (
                        <span 
                          className="text-[9px] font-bold ml-auto"
                          style={{ color: style.color }}
                        >
                          {activity.solAmount?.toFixed(3)} SOL
                        </span>
                      )}
                    </div>
                    
                    {/* Content */}
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: '#A0A0A0' }}>
                      {activity.content?.slice(0, 180)}
                      {activity.content?.length > 180 ? '...' : ''}
                    </p>
                    
                    {/* Extra info for specific types */}
                    {activity.thesis && (
                      <p className="text-[9px] mt-0.5 italic" style={{ color: '#606060' }}>
                        "{activity.thesis.slice(0, 80)}..."
                      </p>
                    )}
                    {activity.description && (isNews || isMoltbook) && (
                      <p className="text-[9px] mt-0.5" style={{ color: '#606060' }}>
                        {activity.description.slice(0, 100)}...
                      </p>
                    )}
                    {isMoltbook && activity.upvotes > 0 && (
                      <span className="text-[8px]" style={{ color: '#EC4899' }}>
                        ▲ {activity.upvotes} in r/{activity.submolt}
                      </span>
                    )}
                    
                    {/* Image preview */}
                    {activity.image && (
                      <div className="mt-1.5 rounded-md overflow-hidden" style={{ maxWidth: '120px' }}>
                        <img 
                          src={activity.image} 
                          alt="" 
                          className="w-full h-auto"
                          style={{ filter: 'brightness(0.9)' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

// New Agents Panel
function NewAgentsPanel() {
  const { agents, activities } = useArenaStore();
  
  const recentAgents = useMemo(() => {
    return [...agents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [agents]);

  return (
    <Panel title="New Agents" color="#22C55E">
      <div className="p-2 space-y-1.5 overflow-y-auto h-full custom-scrollbar">
        {recentAgents.length === 0 ? (
          <div className="text-center py-4 text-[10px]" style={{ color: '#404040' }}>
            No agents yet
          </div>
        ) : (
          recentAgents.map((agent) => (
            <div 
              key={agent.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all hover:scale-[1.01]"
              style={{ 
                background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.8) 0%, rgba(20, 20, 24, 0.6) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.15)'
              }}
            >
              <AgentAvatar agent={agent} size={28} showOnline={true} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate" style={{ color: '#E0E0E0' }}>
                  {agent.name}
                </div>
                <div className="text-[8px]" style={{ color: '#404040' }}>
                  {agent.sol_balance?.toFixed(3) || '0.000'} SOL
                </div>
              </div>
              <span className="text-[8px]" style={{ color: '#505050' }}>
                {new Date(agent.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// Top Performers Panel
function TopPerformersPanel() {
  const { agents, trades, tokens } = useArenaStore();
  
  // Calculate performance based on trades and tokens created
  const topPerformers = useMemo(() => {
    const agentStats = agents.map(agent => {
      const agentTrades = trades.filter(t => t.agent_name === agent.name);
      const tokensCreated = tokens.filter(t => t.creator_name === agent.name);
      const score = (agentTrades.length * 10) + (tokensCreated.length * 50) + (agent.sol_balance || 0) * 100;
      
      return {
        ...agent,
        tradesCount: agentTrades.length,
        tokensCreated: tokensCreated.length,
        score,
      };
    });
    
    return agentStats
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [agents, trades, tokens]);

  return (
    <Panel title="Top Performers" color="#EAB308">
      <div className="p-2 space-y-1.5 overflow-y-auto h-full custom-scrollbar">
        {topPerformers.length === 0 ? (
          <div className="text-center py-4 text-[10px]" style={{ color: '#404040' }}>
            No data yet
          </div>
        ) : (
          topPerformers.map((agent, i) => (
            <div 
              key={agent.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all hover:scale-[1.01]"
              style={{ 
                background: i === 0 
                  ? 'linear-gradient(145deg, rgba(234, 179, 8, 0.12) 0%, rgba(234, 179, 8, 0.05) 100%)' 
                  : 'linear-gradient(145deg, rgba(30, 30, 35, 0.8) 0%, rgba(20, 20, 24, 0.6) 100%)',
                border: i === 0 ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid rgba(255, 255, 255, 0.03)',
                boxShadow: i === 0 
                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 20px rgba(234, 179, 8, 0.05)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.15)'
              }}
            >
              <RankBadge rank={i + 1} />
              <AgentAvatar agent={agent} size={24} showOnline={false} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate" style={{ color: '#E0E0E0' }}>
                  {agent.name}
                </div>
                <div className="flex items-center gap-2 text-[8px]" style={{ color: '#505050' }}>
                  <span>{agent.tradesCount} trades</span>
                  <span>•</span>
                  <span>{agent.tokensCreated} tokens</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold" style={{ color: '#22C55E' }}>
                  {(agent.sol_balance || 0).toFixed(2)}
                </div>
                <div className="text-[7px]" style={{ color: '#404040' }}>SOL</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// Main Easy Mode Dashboard
export function EasyModeDashboard() {
  const { stats, agents } = useArenaStore();
  const onlineAgents = agents.filter(a => a.is_online || a.isOnline).length;

  return (
    <>
      {/* Global CSS for animations */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.6); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out forwards;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
      
      {/* Live Event Overlays */}
      <LiveEventManager />
      
      {/* Main Dashboard Grid */}
      <div 
        className="flex gap-3"
        style={{ height: 'calc(100vh - 220px)' }}
      >
        {/* Left Column - Tokens (stacked) */}
        <div className="w-[260px] flex flex-col gap-2 flex-shrink-0" style={{ height: '100%' }}>
          <div style={{ height: '50%' }}>
            <TrendingTokensPanel />
          </div>
          <div style={{ height: '50%' }}>
            <LatestTokensPanel />
          </div>
        </div>
        
        {/* Center - Narrator + Activity Feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-2" style={{ height: '100%' }}>
          {/* Narrator Panel at top */}
          <div className="flex-shrink-0">
            <NarratorPanelCompact />
          </div>
          {/* Activity Feed takes remaining space */}
          <div className="flex-1 min-h-0">
            <ActivityLogPanel />
          </div>
        </div>
        
        {/* Right Column - Agents (stacked) */}
        <div className="w-[280px] flex flex-col gap-2 flex-shrink-0" style={{ height: '100%' }}>
          <div style={{ height: '50%' }}>
            <TopPerformersPanel />
          </div>
          <div style={{ height: '50%' }}>
            <NewAgentsPanel />
          </div>
        </div>
      </div>
    </>
  );
}

// Export LiveEventManager for use in Pro Mode too
export { LiveEventManager };
