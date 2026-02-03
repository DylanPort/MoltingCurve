'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { CrabWatching } from './AnimatedCrabs';

interface AgentStatus {
  id: string;
  name: string;
  avatarUrl?: string | null;
  status: 'idle' | 'trading' | 'creating' | 'shilling' | 'analyzing' | 'watching';
  currentAction: string;
  lastAction: string;
  lastActionTime: Date;
  tradesCount: number;
  tokensCreated: number;
  moltbookPosts: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; glow: string; icon: JSX.Element }> = {
  trading: { bg: 'rgba(52, 211, 153, 0.1)', text: '#6FCF97', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 6L4 2L7 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg> },
  creating: { bg: 'rgba(251, 191, 36, 0.1)', text: '#D4A853', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1V7M1 4H7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  shilling: { bg: 'rgba(167, 139, 250, 0.1)', text: '#9B8FD0', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="4" cy="4" r="1" fill="currentColor"/></svg> },
  analyzing: { bg: 'rgba(56, 189, 248, 0.1)', text: '#70B8E0', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="3" cy="3" r="2" stroke="currentColor" strokeWidth="1" fill="none"/><path d="M5 5L7 7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  watching: { bg: 'rgba(255, 255, 255, 0.05)', text: '#777', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><ellipse cx="4" cy="4" rx="3" ry="2" stroke="currentColor" strokeWidth="1" fill="none"/><circle cx="4" cy="4" r="1" fill="currentColor"/></svg> },
  idle: { bg: 'rgba(255, 255, 255, 0.03)', text: '#555', glow: 'none', icon: <svg width="8" height="8" viewBox="0 0 8 8"><path d="M2 4H6" stroke="currentColor" strokeWidth="1.5"/></svg> },
};

export function AgentStatusTracker() {
  const { agents, activities } = useArenaStore();
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const { tokens } = useArenaStore.getState();
    const statusMap = new Map<string, AgentStatus>();
    
    agents.forEach(agent => {
      const agentName = agent.name?.toLowerCase() || '';
      
      // Find activities for this agent (case-insensitive matching)
      const agentActivities = activities.filter(a => {
        const activityAgent = (a.agent_name || '').toLowerCase();
        return activityAgent === agentName || a.agent_id === agent.id;
      });
      
      // Count trades from activities
      const tradesCount = agentActivities.filter(a => {
        const desc = (a.description || '').toLowerCase();
        return a.activity_type === 'trade' || desc.includes('bought') || desc.includes('sold');
      }).length;
      
      // Count tokens created - check both activities AND tokens array
      const tokensFromActivities = agentActivities.filter(a => {
        const desc = (a.description || '').toLowerCase();
        return a.activity_type === 'token_created' || desc.includes('created token') || desc.includes('launched');
      }).length;
      
      // Also count from tokens array directly (more reliable)
      const tokensFromTokensArray = tokens.filter(t => {
        const creatorName = (t.creator_name || '').toLowerCase();
        return creatorName === agentName || t.creator_id === agent.id;
      }).length;
      
      const tokensCreated = Math.max(tokensFromActivities, tokensFromTokensArray);
      
      // Get last activity sorted by time
      const sortedActivities = [...agentActivities].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastActivity = sortedActivities[0];
      
      let status: AgentStatus['status'] = 'idle';
      let currentAction = 'Standing by...';
      
      if (lastActivity) {
        const timeSince = Date.now() - new Date(lastActivity.created_at).getTime();
        const isRecent = timeSince < 300000; // 5 minutes
        const desc = (lastActivity.description || '').toLowerCase();
        
        if (desc.includes('bought') || desc.includes('sold')) {
          status = isRecent ? 'trading' : 'watching';
          currentAction = isRecent ? lastActivity.description : 'Watching markets...';
        } else if (desc.includes('created token') || desc.includes('launched')) {
          status = isRecent ? 'creating' : 'analyzing';
          currentAction = isRecent ? 'Launching token' : 'Analyzing opportunities...';
        } else if (desc.includes('moltbook') || desc.includes('posted')) {
          status = isRecent ? 'shilling' : 'watching';
          currentAction = isRecent ? 'Posting on Moltbook' : 'Monitoring feeds...';
        } else {
          status = isRecent ? 'analyzing' : 'watching';
          currentAction = 'Analyzing market data...';
        }
      }
      
      statusMap.set(agent.id || agent.wallet_address, {
        id: agent.id || agent.wallet_address,
        name: agent.name,
        avatarUrl: agent.avatar_url,
        status,
        currentAction,
        lastAction: lastActivity?.description || 'Just joined',
        lastActionTime: lastActivity ? new Date(lastActivity.created_at) : new Date(),
        tradesCount,
        tokensCreated,
        moltbookPosts: 0,
      });
    });
    
    setAgentStatuses(Array.from(statusMap.values()));
  }, [agents, activities]);

  return (
    <>
      <section 
        className="flex flex-col h-full p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] group relative"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.5)' }}
        onClick={() => setIsExpanded(true)}
      >
        {/* Expand hint */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#888' }}>
            <ExpandIcon />
            {agentStatuses.length > 6 && `+${agentStatuses.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <CrabWatching /> <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Agent Status</h3>
          <span className="flex items-center gap-1.5 text-[8px] px-2 py-0.5 rounded font-medium"
            style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399' }} />
            LIVE
          </span>
        </div>
        
        {agentStatuses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>Waiting for agents...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {agentStatuses.slice(0, 6).map((agent) => (
              <AgentStatusRow key={agent.id} agent={agent} compact />
            ))}
          </div>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Agent Status Tracker"
          subtitle={`${agentStatuses.length} agents monitored`}
          badge={
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded font-medium"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
              LIVE
            </span>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agentStatuses.map((agent) => (
              <AgentStatusRow key={agent.id} agent={agent} compact={false} />
            ))}
          </div>
          {agentStatuses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>No agents yet</p>
            </div>
          )}
        </ExpandedModal>
      )}
    </>
  );
}

function AgentStatusRow({ agent, compact }: { agent: AgentStatus; compact: boolean }) {
  const style = STATUS_STYLES[agent.status];

  if (compact) {
    return (
      <div className="p-2 rounded-lg transition-all"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
        <div className="flex items-center gap-2">
          <AgentAvatar name={agent.name} size={28} isOnline={true} showBorder={false} avatarUrl={agent.avatarUrl} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[10px] truncate" style={{ color: '#E5E5E7' }}>{agent.name}</span>
              <span className="flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded uppercase"
                style={{ background: style.bg, color: style.text }}>{style.icon}{agent.status}</span>
            </div>
            <div className="text-[9px] truncate mt-0.5" style={{ color: '#505050' }}>{agent.currentAction}</div>
          </div>
          <div className="text-right flex-shrink-0 text-[9px]">
            <div style={{ color: '#6FCF97' }}>{agent.tradesCount} trades</div>
            <div style={{ color: '#D4A853' }}>{agent.tokensCreated} tokens</div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} size={48} isOnline={true} showBorder={true} avatarUrl={agent.avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{agent.name}</span>
            <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded uppercase font-medium"
              style={{ background: style.bg, color: style.text }}>{style.icon}<span className="ml-1">{agent.status}</span></span>
          </div>
          <p className="text-xs mb-2" style={{ color: '#888' }}>{agent.currentAction}</p>
          <div className="flex items-center gap-4 text-xs">
            <span style={{ color: '#888' }}>Trades: <span style={{ color: '#6FCF97' }}>{agent.tradesCount}</span></span>
            <span style={{ color: '#888' }}>Tokens: <span style={{ color: '#D4A853' }}>{agent.tokensCreated}</span></span>
          </div>
          <p className="text-[10px] mt-2" style={{ color: '#555' }}>Last: {agent.lastAction}</p>
        </div>
      </div>
    </div>
  );
}

function ExpandedModal({ title, subtitle, badge, children, onClose }: {
  title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 48px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#E5E5E7' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {badge}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <div className="px-6 py-3 text-center flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[10px]" style={{ color: '#444' }}>Press ESC or click outside to close</p>
        </div>
      </div>
    </div>
  );
}

function ExpandIcon() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 4V1H4M6 1H9V4M9 6V9H6M4 9H1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}
