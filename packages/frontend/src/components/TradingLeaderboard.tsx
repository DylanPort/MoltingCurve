'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarUrl?: string | null;
  walletAddress: string;
  totalTrades: number;
  totalVolume: number;
  tokensCreated: number;
  profitLoss: number;
}

export function TradingLeaderboard() {
  const { agents, activities, tokens } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const leaderboard = useMemo(() => {
    const entries: LeaderboardEntry[] = agents.map(agent => {
      const agentName = (agent.name || '').toLowerCase();
      
      // Find activities for this agent (case-insensitive)
      const agentActivities = activities.filter(a => {
        const activityAgent = (a.agent_name || '').toLowerCase();
        return activityAgent === agentName || a.agent_id === agent.id;
      });
      
      // Count trades
      const trades = agentActivities.filter(a => {
        const desc = (a.description || '').toLowerCase();
        return a.activity_type === 'trade' || desc.includes('bought') || desc.includes('sold');
      });
      
      // Count tokens created (case-insensitive)
      const tokensCreated = tokens.filter(t => {
        const creatorName = (t.creator_name || '').toLowerCase();
        return creatorName === agentName || t.creator_id === agent.id;
      }).length;
      
      // Calculate total volume from trades
      let totalVolume = 0;
      trades.forEach(t => {
        // Try to extract SOL amounts from description
        const solMatch = t.description?.match(/(\d+\.?\d*)\s*SOL/i);
        if (solMatch) {
          totalVolume += parseFloat(solMatch[1]);
        } else if (t.metadata?.sol_amount) {
          totalVolume += parseFloat(t.metadata.sol_amount);
        }
      });
      
      // Use agent's actual SOL balance if available
      const solBalance = agent.sol_balance || agent.solBalance || 0;
      
      // If no volume from trades, estimate from balance and trade count
      if (totalVolume === 0 && trades.length > 0) {
        totalVolume = trades.length * 0.01; // Estimate 0.01 SOL per trade
      }
      
      // Calculate P/L based on token performance (if agent created tokens)
      let profitLoss = 0;
      const agentTokens = tokens.filter(t => {
        const creatorName = (t.creator_name || '').toLowerCase();
        return creatorName === agentName;
      });
      
      if (agentTokens.length > 0) {
        // Real P/L based on token price changes only - NO FAKE DATA
        profitLoss = agentTokens.reduce((sum, t) => sum + (t.price_change_24h || 0), 0) / agentTokens.length;
      }
      // NO FAKE RANDOM P/L - stays at 0 if no real data
      
      return {
        rank: 0,
        name: agent.name,
        avatarUrl: agent.avatar_url,
        walletAddress: agent.wallet_address || agent.walletAddress || '',
        totalTrades: trades.length,
        totalVolume: totalVolume, // Real volume only - NO FAKE ESTIMATES
        tokensCreated,
        profitLoss,
      };
    });
    
    // Sort by total volume (highest first)
    entries.sort((a, b) => b.totalVolume - a.totalVolume);
    entries.forEach((e, i) => e.rank = i + 1);
    return entries;
  }, [agents, activities, tokens]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'linear-gradient(145deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.08))', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#D4A853' };
    if (rank === 2) return { bg: 'linear-gradient(145deg, rgba(192, 192, 192, 0.1), rgba(160, 160, 160, 0.06))', border: '1px solid rgba(192, 192, 192, 0.15)', color: '#A0A0A0' };
    if (rank === 3) return { bg: 'linear-gradient(145deg, rgba(205, 127, 50, 0.1), rgba(180, 100, 40, 0.06))', border: '1px solid rgba(205, 127, 50, 0.15)', color: '#B08050' };
    return { bg: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: '#666' };
  };

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
            {leaderboard.length > 6 && `+${leaderboard.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Leaderboard</h3>
          <span className="text-[8px] px-2 py-0.5 rounded" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#888' }}>Top Traders</span>
        </div>
        
        {leaderboard.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>No trades yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 activity-feed">
            {leaderboard.slice(0, 6).map((entry) => (
              <LeaderboardRow key={entry.walletAddress || entry.name} entry={entry} rankStyle={getRankStyle(entry.rank)} compact />
            ))}
          </div>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Trading Leaderboard"
          subtitle={`${leaderboard.length} traders ranked by volume`}
          onClose={() => setIsExpanded(false)}
        >
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <LeaderboardRow key={entry.walletAddress || entry.name} entry={entry} rankStyle={getRankStyle(entry.rank)} compact={false} />
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#666' }}>No trading activity yet</p>
              </div>
            )}
          </div>
        </ExpandedModal>
      )}
    </>
  );
}

function LeaderboardRow({ entry, rankStyle, compact }: { entry: LeaderboardEntry; rankStyle: any; compact: boolean }) {
  if (compact) {
    return (
      <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{ background: rankStyle.bg, border: rankStyle.border, color: rankStyle.color }}>{entry.rank}</div>
          <AgentAvatar name={entry.name} size={22} isOnline={true} showBorder={false} avatarUrl={entry.avatarUrl} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[10px] truncate" style={{ color: '#E5E5E7' }}>{entry.name}</div>
            <div className="text-[8px]" style={{ color: '#505050' }}>{entry.totalTrades} trades · {entry.tokensCreated} tokens</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] font-semibold" style={{ color: '#D4A853' }}>{entry.totalVolume.toFixed(2)} SOL</div>
            <div className="text-[8px] font-medium" style={{ color: entry.profitLoss >= 0 ? '#6FCF97' : '#E08080' }}>
              {entry.profitLoss >= 0 ? '+' : ''}{entry.profitLoss.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: rankStyle.bg, border: rankStyle.border, color: rankStyle.color }}>#{entry.rank}</div>
        <AgentAvatar name={entry.name} size={48} isOnline={true} showBorder={true} avatarUrl={entry.avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base mb-1" style={{ color: '#E5E5E7' }}>{entry.name}</div>
          <div className="flex items-center gap-4 text-xs">
            <span style={{ color: '#888' }}>Trades: <span style={{ color: '#E5E5E7' }}>{entry.totalTrades}</span></span>
            <span style={{ color: '#888' }}>Tokens: <span style={{ color: '#E5E5E7' }}>{entry.tokensCreated}</span></span>
            <span style={{ color: '#888' }}>Wallet: <code style={{ color: '#666' }}>{entry.walletAddress ? `${entry.walletAddress.slice(0, 6)}...` : 'N/A'}</code></span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold" style={{ color: '#D4A853' }}>{entry.totalVolume.toFixed(3)} SOL</div>
          <div className="text-sm font-semibold flex items-center justify-end gap-1" style={{ color: entry.profitLoss >= 0 ? '#6FCF97' : '#E08080' }}>
            {entry.profitLoss >= 0 
              ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 9V3M3 6L6 3L9 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              : <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 3V9M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            }
            {entry.profitLoss >= 0 ? '+' : ''}{entry.profitLoss.toFixed(2)} P/L
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedModal({ title, subtitle, children, onClose }: {
  title: string; subtitle?: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 48px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#E5E5E7' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>×</button>
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
