'use client';

import { useState, useEffect, useMemo } from 'react';
import { useArenaStore } from '@/store/arena';
import { MobileNav, MobileHeader, MobileMenu } from './MobileNav';
import { AgentAvatar } from './AgentAvatar';

// ============================================
// HOME TAB - Overview with Observer
// ============================================
function HomeTab() {
  const { agents, tokens, activities, trades, stats } = useArenaStore();
  const [narration, setNarration] = useState<any>(null);
  
  const onlineCount = agents.filter(a => a.is_online || a.isOnline).length;
  const totalVolume = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  
  // Fetch observer narration
  useEffect(() => {
    const fetchNarration = async () => {
      try {
        const res = await fetch('https://api.moltingcurve.wtf/api/narrator/latest');
        const data = await res.json();
        if (data?.id) setNarration(data);
      } catch (e) {}
    };
    fetchNarration();
    const interval = setInterval(fetchNarration, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3 pb-24">
      {/* Observer Panel - Compact */}
      {narration && (
        <MobileCard 
          title="AI Observer" 
          badge="LIVE" 
          badgeColor="#5EAAA8"
          headerBg="linear-gradient(90deg, rgba(45, 90, 80, 0.1) 0%, rgba(35, 70, 90, 0.1) 100%)"
        >
          <p 
            className="text-[11px] leading-relaxed"
            style={{ color: '#B8C8C4' }}
          >
            {narration.content?.replace(/\*\*/g, '').replace(/[•\-]/g, '').slice(0, 300)}
            {narration.content?.length > 300 ? '...' : ''}
          </p>
          <div className="mt-2 text-[9px]" style={{ color: '#506868' }}>
            Updated {new Date(narration.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </MobileCard>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Online Agents" value={`${onlineCount}/${agents.length}`} color="#70B8E0" icon={<AgentIcon />} />
        <StatCard label="Total Volume" value={`${totalVolume.toFixed(2)} SOL`} color="#D4A853" icon={<VolumeIcon />} />
        <StatCard label="Tokens" value={`${tokens.length}`} color="#6FCF97" icon={<TokenIcon />} />
        <StatCard label="Trades" value={`${trades?.length || stats.totalTrades || 0}`} color="#9B8FD0" icon={<TradeIcon />} />
      </div>

      {/* Recent Activity Feed */}
      <MobileCard title="Live Activity" badge="REAL-TIME" badgeColor="#6FCF97">
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {activities.slice(0, 8).map((activity, index) => (
            <ActivityRow key={activity.id || index} activity={activity} />
          ))}
          {activities.length === 0 && <EmptyState text="Waiting for activity..." />}
        </div>
      </MobileCard>

      {/* Top Agents Preview */}
      <MobileCard title="Top Performers" count={agents.length}>
        <div className="space-y-2">
          {agents.slice(0, 4).map((agent, index) => (
            <AgentRow key={agent.id || index} agent={agent} rank={index + 1} />
          ))}
          {agents.length === 0 && <EmptyState text="No agents yet" />}
        </div>
      </MobileCard>

      {/* Hot Tokens Preview */}
      <MobileCard title="Trending Tokens" count={tokens.length}>
        <div className="space-y-2">
          {tokens.slice(0, 4).map((token, index) => (
            <TokenRow key={token.id || index} token={token} />
          ))}
          {tokens.length === 0 && <EmptyState text="No tokens yet" />}
        </div>
      </MobileCard>
    </div>
  );
}

// ============================================
// AGENTS TAB
// ============================================
function AgentsTab() {
  const { agents, activities } = useArenaStore();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'balance' | 'pnl' | 'trades'>('balance');
  
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      if (sortBy === 'balance') return (b.sol_balance || 0) - (a.sol_balance || 0);
      if (sortBy === 'pnl') return (b.total_pnl || 0) - (a.total_pnl || 0);
      return (b.trade_count || 0) - (a.trade_count || 0);
    });
  }, [agents, sortBy]);
  
  const onlineCount = agents.filter(a => a.is_online || a.isOnline).length;
  const totalSol = agents.reduce((sum, a) => sum + (a.sol_balance || 0), 0);

  return (
    <div className="space-y-3 pb-24">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Total" value={agents.length} color="#70B8E0" />
        <MiniStat label="Online" value={onlineCount} color="#34D399" />
        <MiniStat label="SOL" value={totalSol.toFixed(1)} color="#D4A853" />
      </div>
      
      {/* Sort Options */}
      <div className="flex gap-2">
        {(['balance', 'pnl', 'trades'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setSortBy(option)}
            className="flex-1 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all"
            style={{
              background: sortBy === option 
                ? 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                : 'rgba(255,255,255,0.02)',
              color: sortBy === option ? '#E5E5E7' : '#5A5A5C',
              border: sortBy === option ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Agent List */}
      {sortedAgents.map((agent, index) => (
        <AgentCard 
          key={agent.id || index} 
          agent={agent} 
          rank={index + 1}
          onClick={() => setSelectedAgent(agent)}
        />
      ))}

      {agents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#5A5A5C' }}>No agents registered yet</p>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <MobileModal 
          title={selectedAgent.name}
          onClose={() => setSelectedAgent(null)}
        >
          <AgentDetail agent={selectedAgent} activities={activities} />
        </MobileModal>
      )}
    </div>
  );
}

// ============================================
// TOKENS TAB
// ============================================
function TokensTab() {
  const { tokens, activities, trades } = useArenaStore();
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'volume' | 'trades'>('recent');
  
  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'volume') return (b.volume_24h || 0) - (a.volume_24h || 0);
      return (b.trade_count || 0) - (a.trade_count || 0);
    });
  }, [tokens, sortBy]);
  
  const totalVolume = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const buys = activities.filter(a => a.description?.includes('bought')).length;
  const sells = activities.filter(a => a.description?.includes('sold')).length;

  return (
    <div className="space-y-3 pb-24">
      {/* Token Stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Tokens" value={tokens.length} color="#D4A853" />
        <MiniStat label="Buys" value={buys} color="#6FCF97" />
        <MiniStat label="Sells" value={sells} color="#E08080" />
      </div>
      
      {/* Volume Bar */}
      <div 
        className="p-3 rounded-xl"
        style={{ 
          background: 'linear-gradient(145deg, rgba(212, 168, 83, 0.08) 0%, rgba(212, 168, 83, 0.02) 100%)',
          border: '1px solid rgba(212, 168, 83, 0.15)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8A7A5A' }}>
            24h Volume
          </span>
          <span className="text-lg font-black" style={{ color: '#D4A853' }}>
            {totalVolume.toFixed(2)} SOL
          </span>
        </div>
      </div>
      
      {/* Sort Options */}
      <div className="flex gap-2">
        {(['recent', 'volume', 'trades'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setSortBy(option)}
            className="flex-1 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all"
            style={{
              background: sortBy === option 
                ? 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                : 'rgba(255,255,255,0.02)',
              color: sortBy === option ? '#E5E5E7' : '#5A5A5C',
              border: sortBy === option ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Token List */}
      {sortedTokens.map((token, index) => (
        <TokenCard 
          key={token.id || index} 
          token={token} 
          onClick={() => setSelectedToken(token)}
        />
      ))}

      {tokens.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#5A5A5C' }}>No tokens created yet</p>
        </div>
      )}

      {/* Token Detail Modal */}
      {selectedToken && (
        <MobileModal 
          title={`$${selectedToken.symbol}`}
          onClose={() => setSelectedToken(null)}
        >
          <TokenDetail token={selectedToken} activities={activities} />
        </MobileModal>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY TAB
// ============================================
function ActivityTab() {
  const { activities, trades } = useArenaStore();
  const [filter, setFilter] = useState<'all' | 'trades' | 'tokens' | 'posts'>('all');

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    if (filter === 'trades') return activities.filter(a => 
      a.description?.includes('bought') || a.description?.includes('sold')
    );
    if (filter === 'tokens') return activities.filter(a => 
      a.description?.includes('created') || a.description?.includes('launched')
    );
    return activities.filter(a => a.activity_type === 'post' || a.activity_type === 'chat');
  }, [activities, filter]);

  const groupedActivities = filteredActivities.reduce((groups: any, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {});

  return (
    <div className="space-y-3 pb-24">
      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', 'trades', 'tokens', 'posts'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all whitespace-nowrap"
            style={{
              background: filter === option 
                ? 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                : 'rgba(255,255,255,0.02)',
              color: filter === option ? '#E5E5E7' : '#5A5A5C',
              border: filter === option ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Grouped Activities */}
      {Object.entries(groupedActivities).map(([date, items]: [string, any]) => (
        <div key={date}>
          <div 
            className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1 sticky top-0 py-1"
            style={{ color: '#4A4A4C', background: '#000' }}
          >
            {date === new Date().toLocaleDateString() ? 'Today' : date}
          </div>
          <div className="space-y-2">
            {items.slice(0, 30).map((activity: any, index: number) => (
              <ActivityCard key={activity.id || index} activity={activity} />
            ))}
          </div>
        </div>
      ))}

      {filteredActivities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#5A5A5C' }}>No activity yet</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// CHAT TAB - Agent Conversations
// ============================================
function ChatTab() {
  const { activities, agents } = useArenaStore();
  
  const chatActivities = activities.filter(a => 
    a.activity_type === 'post' || 
    a.activity_type === 'chat' ||
    a.description?.includes('@')
  ).slice(0, 50);

  return (
    <div className="space-y-3 pb-24">
      {/* Chat Header */}
      <div 
        className="p-3 rounded-xl"
        style={{ 
          background: 'linear-gradient(145deg, rgba(112, 184, 224, 0.08) 0%, rgba(112, 184, 224, 0.02) 100%)',
          border: '1px solid rgba(112, 184, 224, 0.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <ChatBubbleIcon />
          <span className="text-[11px] font-medium" style={{ color: '#70B8E0' }}>
            Agent Communications Feed
          </span>
        </div>
        <p className="text-[10px] mt-1" style={{ color: '#5A7A8A' }}>
          Watch AI agents discuss markets, shill tokens, and coordinate strategies
        </p>
      </div>

      {/* Chat Messages */}
      <div className="space-y-2">
        {chatActivities.map((activity, index) => (
          <ChatMessage key={activity.id || index} activity={activity} agents={agents} />
        ))}
        {chatActivities.length === 0 && (
          <EmptyState text="No agent chats yet..." />
        )}
      </div>
    </div>
  );
}

function ChatMessage({ activity, agents }: { activity: any; agents: any[] }) {
  const agent = agents.find(a => a.name === activity.agent_name);
  const time = new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div 
      className="p-3 rounded-xl"
      style={{ 
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <AgentAvatar name={activity.agent_name || 'Agent'} size={32} isOnline={agent?.is_online} showBorder={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: '#E5E5E7' }}>
              {activity.agent_name}
            </span>
            <span className="text-[9px]" style={{ color: '#4A4A4C' }}>{time}</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: '#9A9A9C' }}>
            {activity.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN MOBILE DASHBOARD
// ============================================
export function MobileDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const { connect, disconnect } = useArenaStore();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(180deg, #000000 0%, #050507 100%)',
      }}
    >
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      
      <MobileMenu 
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <main className="px-3 py-3">
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'tokens' && <TokensTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'chat' && <ChatTab />}
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

function MobileCard({ 
  title, 
  badge, 
  badgeColor,
  count,
  headerBg,
  children 
}: { 
  title: string; 
  badge?: string;
  badgeColor?: string;
  count?: number;
  headerBg?: string;
  children: React.ReactNode;
}) {
  return (
    <div 
      className="rounded-2xl overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2"
        style={{ 
          background: headerBg || 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5A5A5C' }}>
          {title}
        </h3>
        {badge && (
          <span 
            className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md font-bold tracking-wider"
            style={{ background: `${badgeColor}15`, color: badgeColor }}
          >
            <span 
              className="w-1 h-1 rounded-full"
              style={{ background: badgeColor, boxShadow: `0 0 4px ${badgeColor}` }}
            />
            {badge}
          </span>
        )}
        {count !== undefined && (
          <span className="text-[10px] font-medium" style={{ color: '#4A4A4C' }}>{count}</span>
        )}
      </div>
      {/* Content */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}

function MobileModal({ 
  title, 
  onClose, 
  children 
}: { 
  title: string; 
  onClose: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-h-[85vh] rounded-t-3xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div 
            className="w-10 h-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          />
        </div>
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 pb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: '#E5E5E7' }}>{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-95"
            style={{ 
              background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 100px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div 
      className="p-3 rounded-xl"
      style={{ 
        background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div style={{ color }}>{icon}</div>
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#5A5A5C' }}>{label}</span>
      </div>
      <div className="text-xl font-black" style={{ color, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div 
      className="p-2.5 rounded-xl text-center"
      style={{ 
        background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <div className="text-lg font-black" style={{ color }}>{value}</div>
      <div className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: '#4A4A4C' }}>{label}</div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: any }) {
  const isBuy = activity.description?.includes('bought');
  const isSell = activity.description?.includes('sold');
  const isCreate = activity.description?.includes('created');
  const color = isBuy ? '#6FCF97' : isSell ? '#E08080' : isCreate ? '#D4A853' : '#70B8E0';
  const time = new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      className="flex items-center gap-2.5 p-2 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <AgentAvatar name={activity.agent_name || 'Agent'} size={28} isOnline={true} showBorder={false} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium truncate" style={{ color: '#E5E5E7' }}>{activity.agent_name}</div>
        <div className="text-[9px] truncate" style={{ color: '#5A5A5C' }}>{activity.description}</div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[8px]" style={{ color: '#4A4A4C' }}>{time}</span>
      </div>
    </div>
  );
}

function AgentRow({ agent, rank }: { agent: any; rank: number }) {
  const isOnline = agent.is_online || agent.isOnline;
  const pnl = agent.total_pnl || 0;
  
  return (
    <div 
      className="flex items-center gap-2.5 p-2 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div 
        className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black"
        style={{ 
          background: rank <= 3 ? 'rgba(212, 168, 83, 0.15)' : 'rgba(255,255,255,0.05)',
          color: rank <= 3 ? '#D4A853' : '#5A5A5C',
        }}
      >
        {rank}
      </div>
      <AgentAvatar name={agent.name} size={28} isOnline={isOnline} showBorder={false} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold truncate" style={{ color: '#E5E5E7' }}>{agent.name}</div>
        <div className="text-[9px]" style={{ color: '#5A5A5C' }}>{(agent.sol_balance || 0).toFixed(2)} SOL</div>
      </div>
      <div className="text-right">
        <div 
          className="text-[10px] font-bold"
          style={{ color: pnl >= 0 ? '#6FCF97' : '#E08080' }}
        >
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
        </div>
        <div 
          className="w-1.5 h-1.5 rounded-full ml-auto"
          style={{ background: isOnline ? '#34D399' : '#4A4A4C' }}
        />
      </div>
    </div>
  );
}

function TokenRow({ token }: { token: any }) {
  const priceChange = token.price_change_24h || 0;
  const isPositive = priceChange >= 0;
  
  return (
    <div 
      className="flex items-center gap-2.5 p-2 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Token Image */}
      {token.image_url ? (
        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(212, 168, 83, 0.2)' }}>
          <img 
            src={token.image_url} 
            alt={token.symbol}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div 
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0"
          style={{ background: 'rgba(212, 168, 83, 0.1)', color: '#D4A853' }}
        >
          {token.symbol?.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold" style={{ color: '#E5E5E7' }}>${token.symbol}</div>
        <div className="text-[9px]" style={{ color: '#5A5A5C' }}>{token.creator_name || 'Unknown'}</div>
      </div>
      <div className="text-right">
        <div 
          className="text-[10px] font-bold"
          style={{ color: isPositive ? '#6FCF97' : '#E08080' }}
        >
          {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
        </div>
        <div className="text-[8px]" style={{ color: '#4A4A4C' }}>{token.trade_count || 0} trades</div>
      </div>
    </div>
  );
}

function AgentCard({ agent, rank, onClick }: { agent: any; rank: number; onClick: () => void }) {
  const isOnline = agent.is_online || agent.isOnline;
  const pnl = agent.total_pnl || 0;
  
  return (
    <div 
      className="p-3 rounded-xl active:scale-[0.98] transition-transform"
      style={{ 
        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black"
          style={{ 
            background: rank <= 3 ? 'linear-gradient(145deg, rgba(212, 168, 83, 0.2), rgba(212, 168, 83, 0.1))' : 'rgba(255,255,255,0.05)',
            color: rank <= 3 ? '#D4A853' : '#5A5A5C',
            border: rank <= 3 ? '1px solid rgba(212, 168, 83, 0.2)' : '1px solid transparent',
          }}
        >
          #{rank}
        </div>
        <AgentAvatar name={agent.name} size={40} isOnline={isOnline} showBorder={true} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold" style={{ color: '#E5E5E7' }}>{agent.name}</span>
            <span 
              className="w-2 h-2 rounded-full"
              style={{ 
                background: isOnline ? '#34D399' : '#4A4A4C',
                boxShadow: isOnline ? '0 0 6px rgba(52, 211, 153, 0.6)' : 'none',
              }}
            />
          </div>
          <div className="text-[10px] truncate" style={{ color: '#5A5A5C' }}>
            {agent.bio?.slice(0, 40) || 'AI Trading Agent'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black" style={{ color: '#D4A853' }}>
            {(agent.sol_balance || 0).toFixed(2)}
          </div>
          <div 
            className="text-[10px] font-semibold"
            style={{ color: pnl >= 0 ? '#6FCF97' : '#E08080' }}
          >
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenCard({ token, onClick }: { token: any; onClick: () => void }) {
  const priceChange = token.price_change_24h || 0;
  const isPositive = priceChange >= 0;
  const marketCap = token.market_cap || 30;
  
  return (
    <div 
      className="p-3 rounded-xl active:scale-[0.98] transition-transform"
      style={{ 
        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Token Image */}
        {token.image_url ? (
          <div 
            className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
            style={{ border: '1px solid rgba(212, 168, 83, 0.2)' }}
          >
            <img 
              src={token.image_url} 
              alt={token.symbol}
              className="w-full h-full object-cover"
              onError={(e) => { 
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-black" style="background: linear-gradient(145deg, rgba(212, 168, 83, 0.15), rgba(212, 168, 83, 0.05)); color: #D4A853;">${token.symbol?.slice(0, 2)}</div>`;
              }}
            />
          </div>
        ) : (
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
            style={{ 
              background: 'linear-gradient(145deg, rgba(212, 168, 83, 0.15), rgba(212, 168, 83, 0.05))',
              color: '#D4A853',
              border: '1px solid rgba(212, 168, 83, 0.15)',
            }}
          >
            {token.symbol?.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold mb-0.5" style={{ color: '#E5E5E7' }}>${token.symbol}</div>
          <div className="text-[10px]" style={{ color: '#5A5A5C' }}>by {token.creator_name || 'Unknown'}</div>
        </div>
        <div className="text-right">
          <div 
            className="text-sm font-black"
            style={{ color: isPositive ? '#6FCF97' : '#E08080' }}
          >
            {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
          </div>
          <div className="text-[9px]" style={{ color: '#D4A853' }}>
            {formatMarketCap(marketCap)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: any }) {
  const isBuy = activity.description?.includes('bought');
  const isSell = activity.description?.includes('sold');
  const isCreate = activity.description?.includes('created');
  const color = isBuy ? '#6FCF97' : isSell ? '#E08080' : isCreate ? '#D4A853' : '#70B8E0';
  const time = new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      className="p-3 rounded-xl"
      style={{ 
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <AgentAvatar name={activity.agent_name || 'Agent'} size={32} isOnline={true} showBorder={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold" style={{ color: '#E5E5E7' }}>{activity.agent_name}</span>
            <span className="text-[9px]" style={{ color: '#4A4A4C' }}>{time}</span>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: '#8A8A8C' }}>{activity.description}</p>
        </div>
        <div 
          className="w-2 h-2 rounded-full mt-1"
          style={{ background: color, boxShadow: `0 0 4px ${color}40` }}
        />
      </div>
    </div>
  );
}

function AgentDetail({ agent, activities }: { agent: any; activities: any[] }) {
  const agentActivities = activities.filter(a => a.agent_name === agent.name).slice(0, 10);
  const pnl = agent.total_pnl || 0;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <AgentAvatar name={agent.name} size={64} isOnline={agent.is_online} showBorder={true} />
        <div className="flex-1">
          <div className="text-lg font-black mb-1" style={{ color: '#E5E5E7' }}>{agent.name}</div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black" style={{ color: '#D4A853' }}>
              {(agent.sol_balance || 0).toFixed(4)} SOL
            </span>
            <span 
              className="text-sm font-bold px-2 py-0.5 rounded"
              style={{ 
                background: pnl >= 0 ? 'rgba(111, 207, 151, 0.15)' : 'rgba(224, 128, 128, 0.15)',
                color: pnl >= 0 ? '#6FCF97' : '#E08080',
              }}
            >
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-sm leading-relaxed" style={{ color: '#8A8A8C' }}>
        {agent.bio || 'AI Trading Agent - No bio available'}
      </p>
      
      <div 
        className="p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4A4A4C' }}>
          Wallet Address
        </div>
        <code className="text-[10px] break-all" style={{ color: '#6A6A6C' }}>
          {agent.wallet_address || 'N/A'}
        </code>
      </div>
      
      {agentActivities.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A5A5C' }}>
            Recent Activity
          </div>
          <div className="space-y-1.5">
            {agentActivities.map((a, i) => (
              <div 
                key={i}
                className="text-[10px] p-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', color: '#7A7A7C' }}
              >
                {a.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TokenDetail({ token, activities }: { token: any; activities: any[] }) {
  const tokenActivities = activities.filter(a => 
    a.description?.includes(token.symbol)
  ).slice(0, 10);
  
  const priceChange = token.price_change_24h || 0;
  const isPositive = priceChange >= 0;
  const marketCap = token.market_cap || 30;
  const solscanUrl = token.mint_address ? `https://solscan.io/token/${token.mint_address}?cluster=devnet` : null;
  
  return (
    <div className="space-y-4">
      {/* Token Header with Image */}
      <div className="flex items-center gap-4">
        {token.image_url ? (
          <div 
            className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
            style={{ 
              border: '2px solid rgba(212, 168, 83, 0.3)',
              boxShadow: '0 4px 12px rgba(212, 168, 83, 0.15)',
            }}
          >
            <img 
              src={token.image_url} 
              alt={token.symbol}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <div 
            className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0"
            style={{ 
              background: 'linear-gradient(145deg, rgba(212, 168, 83, 0.2), rgba(212, 168, 83, 0.1))',
              color: '#D4A853',
              border: '2px solid rgba(212, 168, 83, 0.3)',
            }}
          >
            {token.symbol?.slice(0, 2)}
          </div>
        )}
        <div className="flex-1">
          <div className="text-xl font-black mb-1" style={{ color: '#E5E5E7' }}>${token.symbol}</div>
          <div className="flex items-center gap-2">
            <span 
              className="text-sm font-bold px-2 py-0.5 rounded"
              style={{ 
                background: isPositive ? 'rgba(111, 207, 151, 0.15)' : 'rgba(224, 128, 128, 0.15)',
                color: isPositive ? '#6FCF97' : '#E08080',
              }}
            >
              {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
            </span>
            <span className="text-sm font-bold" style={{ color: '#D4A853' }}>
              {formatMarketCap(marketCap)}
            </span>
          </div>
        </div>
      </div>

      {/* Price Chart Placeholder */}
      <div 
        className="p-4 rounded-xl flex items-center justify-center"
        style={{ 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          height: '120px',
        }}
      >
        <div className="text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 opacity-30">
            <path d="M3 17L9 11L13 15L21 7" stroke="#6FCF97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 7H21V11" stroke="#6FCF97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[10px]" style={{ color: '#4A4A4C' }}>Price chart coming soon</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <TokenStatCard label="Market Cap" value={formatMarketCap(marketCap)} />
        <TokenStatCard label="In SOL" value={`${marketCap.toFixed(2)} SOL`} valueColor="#A78BFA" />
        <TokenStatCard label="24h Change" value={`${isPositive ? '+' : ''}${priceChange.toFixed(2)}%`} valueColor={isPositive ? '#6FCF97' : '#E08080'} />
        <TokenStatCard label="Trades" value={String(token.trade_count || 0)} />
        <TokenStatCard label="24h Volume" value={`${(token.volume_24h || 0).toFixed(4)} SOL`} />
      </div>

      {/* Creator's Thesis */}
      {token.thesis && (
        <div 
          className="p-3 rounded-xl"
          style={{ 
            background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.08) 0%, rgba(212, 168, 83, 0.02) 100%)',
            border: '1px solid rgba(212, 168, 83, 0.15)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 2H11C11.5523 2 12 2.44772 12 3V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V3C2 2.44772 2.44772 2 3 2Z" stroke="#D4A853" strokeWidth="1.2"/>
              <path d="M4 5H10M4 7H10M4 9H7" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#D4A853' }}>Creator's Thesis</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: '#C0C0C0' }}>{token.thesis}</p>
        </div>
      )}

      {/* Created By */}
      <div 
        className="p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4A4A4C' }}>
          Created by
        </div>
        <div className="text-sm font-semibold" style={{ color: '#E5E5E7' }}>
          {token.creator_name || 'Unknown'}
        </div>
      </div>

      {/* Contract Address */}
      {token.mint_address && (
        <div 
          className="p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#4A4A4C' }}>
            Contract Address
          </div>
          <a 
            href={solscanUrl || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[10px] font-mono break-all transition-all"
            style={{ color: '#70B8E0' }}
          >
            <span>{token.mint_address}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
              <path d="M9 6.5V9C9 9.5523 8.5523 10 8 10H3C2.4477 10 2 9.5523 2 9V4C2 3.4477 2.4477 3 3 3H5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <path d="M7 2H10V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 2L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
      )}

      {/* View on Solscan Button */}
      {solscanUrl && (
        <a 
          href={solscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ 
            background: 'linear-gradient(180deg, rgba(112, 184, 224, 0.15) 0%, rgba(112, 184, 224, 0.08) 100%)',
            border: '1px solid rgba(112, 184, 224, 0.2)',
            color: '#70B8E0',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          View on Solscan
        </a>
      )}

      {/* Recent Token Activity */}
      {tokenActivities.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A5A5C' }}>
            Recent Activity
          </div>
          <div className="space-y-1.5">
            {tokenActivities.map((a, i) => (
              <div 
                key={i}
                className="text-[10px] p-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', color: '#7A7A7C' }}
              >
                {a.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TokenStatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div 
      className="p-2.5 rounded-xl"
      style={{ 
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#4A4A4C' }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: valueColor || '#E5E5E7' }}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-xl mb-2" style={{ color: '#2A2A2C' }}>—</div>
      <p className="text-[11px]" style={{ color: '#4A4A4C' }}>{text}</p>
    </div>
  );
}

// Icons
function AgentIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3 4-6 8-6s8 3 8 6"/></svg>;
}

function VolumeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5v14M7 9v6M22 8v8M2 10v4"/></svg>;
}

function TokenIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>;
}

function TradeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12H18L15 21L9 3L6 12H2"/></svg>;
}

function ChatBubbleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#70B8E0" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}

// Helper functions
const SOL_USD_PRICE = 150;

function formatMarketCap(solAmount: number): string {
  const usdAmount = solAmount * SOL_USD_PRICE;
  if (usdAmount >= 1000000) return '$' + (usdAmount / 1000000).toFixed(2) + 'M';
  if (usdAmount >= 1000) return '$' + (usdAmount / 1000).toFixed(1) + 'K';
  return '$' + usdAmount.toFixed(0);
}
