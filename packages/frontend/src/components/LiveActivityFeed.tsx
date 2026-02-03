'use client';

import { useState } from 'react';
import { useArenaStore } from '@/store/arena';
import { useMemo } from 'react';
import { AgentAvatar } from './AgentAvatar';

export function LiveActivityFeed() {
  const { trades, tokens } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Create a map of token_id to mint_address
  const tokenMintMap = useMemo(() => {
    const map = new Map<string, string>();
    tokens.forEach(t => {
      if (t.id && t.mint_address) map.set(t.id, t.mint_address);
    });
    return map;
  }, [tokens]);
  
  // Sort trades by created_at descending
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [trades]);
  
  return (
    <>
      <section 
        className="flex flex-col h-full p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] group relative"
        style={{ 
          background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.5)'
        }}
        onClick={() => setIsExpanded(true)}
      >
        {/* Expand hint */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#888' }}>
            <ExpandIcon />
            {sortedTrades.length > 6 && `+${sortedTrades.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>
            Live Trades
          </h3>
          <span className="flex items-center gap-1.5 text-[8px] px-2 py-0.5 rounded font-medium"
            style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52, 211, 153, 0.8)' }} />
            LIVE
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
          {sortedTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
              <p className="text-[10px]" style={{ color: '#444' }}>Waiting for trades...</p>
            </div>
          ) : (
            sortedTrades.slice(0, 6).map((trade, index) => (
              <TradeItem key={trade.id || index} trade={trade} mintAddress={tokenMintMap.get(trade.token_id)} compact />
            ))
          )}
        </div>
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Live Trades"
          subtitle={`${sortedTrades.length} total trades`}
          badge={
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded font-medium"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
              LIVE
            </span>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="space-y-2">
            {sortedTrades.map((trade, index) => (
              <TradeItem key={trade.id || index} trade={trade} mintAddress={tokenMintMap.get(trade.token_id)} compact={false} />
            ))}
            {sortedTrades.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#666' }}>No trades yet</p>
              </div>
            )}
          </div>
        </ExpandedModal>
      )}
    </>
  );
}

function TradeItem({ trade, mintAddress, compact = false }: { trade: any; mintAddress?: string; compact?: boolean }) {
  const timeAgo = getTimeAgo(new Date(trade.created_at));
  const isBuy = trade.trade_type === 'buy';
  const color = isBuy ? '#6FCF97' : '#E08080';
  const solAmount = typeof trade.sol_amount === 'number' ? trade.sol_amount.toFixed(4) : trade.sol_amount;
  
  const solscanTokenUrl = mintAddress 
    ? `https://solscan.io/token/${mintAddress}?cluster=devnet`
    : '#';
  const solscanTxUrl = trade.tx_signature 
    ? `https://solscan.io/tx/${trade.tx_signature}?cluster=devnet`
    : '#';
  
  const icon = isBuy 
    ? <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 11V3M4 6L7 3L10 6" stroke={color} strokeWidth="1.5" fill="none"/></svg>
    : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 3V11M4 8L7 11L10 8" stroke={color} strokeWidth="1.5" fill="none"/></svg>;

  if (compact) {
    return (
      <div className="p-2.5 rounded-lg transition-all hover:bg-white/[0.02]"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="font-medium truncate" style={{ color: '#E5E5E7' }}>{trade.agent_name}</span>
              <span style={{ color: '#606060' }}>
                {isBuy ? 'bought' : 'sold'}{' '}
                <a 
                  href={solscanTokenUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color, fontWeight: 600 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ${trade.token_symbol}
                </a>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold" style={{ color }}>
                {solAmount} SOL
              </span>
              <a 
                href={solscanTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] hover:underline"
                style={{ color: '#505050' }}
                onClick={(e) => e.stopPropagation()}
              >
                tx ↗
              </a>
            </div>
          </div>
          <span className="text-[9px] flex-shrink-0" style={{ color: '#505050' }}>{timeAgo}</span>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="p-4 rounded-xl transition-all hover:bg-white/[0.02]"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-start gap-3">
        <AgentAvatar name={trade.agent_name} size={36} isOnline={true} showBorder={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{trade.agent_name}</span>
            <span className="text-xs" style={{ color: '#505050' }}>{timeAgo}</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs px-2 py-1 rounded" style={{ background: `${color}15`, color }}>
              {isBuy ? 'BUY' : 'SELL'}
            </span>
            <a 
              href={solscanTokenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:underline"
              style={{ color }}
            >
              ${trade.token_symbol}
            </a>
            <span className="text-sm font-semibold" style={{ color }}>
              {solAmount} SOL
            </span>
          </div>
          <div className="flex items-center gap-3">
            {trade.tx_signature && (
              <a 
                href={solscanTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline flex items-center gap-1"
                style={{ color: '#666' }}
              >
                <SolscanIcon /> View on Solscan
              </a>
            )}
            {mintAddress && (
              <a 
                href={solscanTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: '#666' }}
              >
                Token: {mintAddress.slice(0, 8)}...
              </a>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SolscanIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M10 6.5V10C10 10.5523 9.55228 11 9 11H2C1.44772 11 1 10.5523 1 10V3C1 2.44772 1.44772 2 2 2H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7 1H11V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 1L6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function ExpandedModal({ title, subtitle, badge, children, onClose }: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
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
          <div className="flex items-center gap-3">
            {badge}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>×</button>
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

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  return `${diffDay}d`;
}
