'use client';

import { useArenaStore } from '@/store/arena';
import { useState, useMemo } from 'react';
import { SearchBar, searchMatch } from './SearchBar';

export function TopTokens() {
  const { tokens } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort by most recently created first
  const recentTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // Newest first
    });
  }, [tokens]);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    return recentTokens.filter(token => 
      searchMatch(token, searchQuery, ['symbol', 'name', 'mint_address', 'creator_name', 'thesis'])
    );
  }, [recentTokens, searchQuery]);
  
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
            {recentTokens.length > 4 && `+${recentTokens.length - 4} more`}
          </div>
        </div>

        <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3 flex-shrink-0" style={{ color: '#6A6A6C' }}>
          Tokens <span className="font-normal" style={{ color: '#444' }}>· Recent</span>
        </h3>
        
        {recentTokens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>No tokens yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {recentTokens.slice(0, 4).map((token, index) => (
              <TokenRow key={token.id || token.mint_address} token={token} rank={index + 1} 
                onClick={(e) => { e.stopPropagation(); setSelectedToken(token); }} />
            ))}
          </div>
        )}
      </section>
      
      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Recently Created Tokens"
          subtitle={`${recentTokens.length} tokens · Sorted by newest`}
          onClose={() => { setIsExpanded(false); setSearchQuery(''); }}
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by symbol, name, contract address, creator..."
            className="mb-4"
          />
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>
                {searchQuery ? `No tokens match "${searchQuery}"` : 'No tokens created yet'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: '#555' }}>
                {searchQuery ? `${filteredTokens.length} results` : `${recentTokens.length} tokens · Newest first`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTokens.map((token, index) => (
                  <TokenCardExpanded key={token.id || token.mint_address} token={token} rank={index + 1} 
                    onClick={() => setSelectedToken(token)} searchQuery={searchQuery} />
                ))}
              </div>
            </>
          )}
        </ExpandedModal>
      )}

      {selectedToken && (
        <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </>
  );
}

function TokenRow({ token, rank, onClick }: { token: any; rank: number; onClick: (e: React.MouseEvent) => void }) {
  const priceChange = token.price_change_24h ?? token.priceChange24h ?? 0;
  const isPositive = priceChange >= 0;
  // Market cap is now in SOL from bonding curve, default to ~30 SOL if not set
  const marketCap = token.market_cap || 30;
  const solscanUrl = token.mint_address ? `https://solscan.io/token/${token.mint_address}?cluster=devnet` : null;
  const createdAgo = token.created_at ? formatTimeAgo(token.created_at) : '';
  
  const handleAddressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (solscanUrl) {
      window.open(solscanUrl, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div 
      className="p-2.5 rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5">
        {token.image_url ? (
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(251, 191, 36, 0.15)' }}>
            <img 
              src={token.image_url} 
              alt={token.symbol}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold" style="background: linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05)); color: #D4A853;">${token.symbol?.slice(0, 2)}</div>`;
              }}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05))', border: '1px solid rgba(251, 191, 36, 0.15)', color: '#D4A853' }}>
            {token.symbol?.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[11px]" style={{ color: '#E5E5E7' }}>${token.symbol}</span>
            {createdAgo && <span className="text-[8px]" style={{ color: '#444' }}>{createdAgo}</span>}
          </div>
          {token.mint_address ? (
            <button
              onClick={handleAddressClick}
              className="flex items-center gap-1 text-[9px] font-mono hover:underline transition-all group"
              style={{ color: '#70B8E0' }}
              title="View on Solscan"
            >
              <span>{token.mint_address.slice(0, 4)}...{token.mint_address.slice(-4)}</span>
              <ExternalLinkIcon />
            </button>
          ) : (
            <div className="text-[9px] truncate" style={{ color: '#505050' }}>{token.creator_name || 'Unknown'}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold flex items-center justify-end gap-1" style={{ color: isPositive ? '#6FCF97' : '#E08080' }}>
            {isPositive 
              ? <svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 6V2M2 4L4 2L6 4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              : <svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 2V6M2 4L4 6L6 4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            }
            <span>{Math.abs(priceChange).toFixed(1)}%</span>
          </div>
          <div className="text-[9px]" style={{ color: '#505050' }}>{formatMarketCap(marketCap)}</div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ExternalLinkIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <path d="M8 5.5V8C8 8.5523 7.5523 9 7 9H2C1.4477 9 1 8.5523 1 8V3C1 2.4477 1.4477 2 2 2H4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M6 1H9V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 1L5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function TokenCardExpanded({ token, rank, onClick, searchQuery = '' }: { token: any; rank: number; onClick: () => void; searchQuery?: string }) {
  const priceChange = token.price_change_24h ?? 0;
  const isPositive = priceChange >= 0;
  const marketCap = token.market_cap || 30; // Default ~30 SOL
  const solscanUrl = token.mint_address ? `https://solscan.io/token/${token.mint_address}?cluster=devnet` : null;

  const handleAddressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (solscanUrl) {
      window.open(solscanUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Highlight helper
  const highlight = (text: string) => {
    if (!searchQuery.trim() || !text) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase().trim();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
      <>
        {text.slice(0, index)}
        <span style={{ background: 'rgba(251, 191, 36, 0.3)', borderRadius: '2px', padding: '0 1px' }}>
          {text.slice(index, index + lowerQuery.length)}
        </span>
        {text.slice(index + lowerQuery.length)}
      </>
    );
  };

  return (
    <div className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold"
          style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08))', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#D4A853' }}>
          {token.symbol?.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>${highlight(token.symbol)}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isPositive ? 'rgba(111, 207, 151, 0.15)' : 'rgba(224, 128, 128, 0.15)', color: isPositive ? '#6FCF97' : '#E08080' }}>
              {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
            </span>
          </div>
          {token.mint_address && (
            <button
              onClick={handleAddressClick}
              className="flex items-center gap-1.5 text-[10px] font-mono mb-2 hover:underline transition-all group"
              style={{ color: '#70B8E0' }}
              title="View on Solscan"
            >
              <ContractIcon />
              <span>{highlight(`${token.mint_address.slice(0, 6)}...${token.mint_address.slice(-6)}`)}</span>
              <ExternalLinkIcon />
            </button>
          )}
          <div className="flex items-center gap-3 text-[10px]">
            <span style={{ color: '#888' }}>MCap: <span style={{ color: '#D4A853' }}>{formatMarketCap(marketCap)}</span></span>
            <span style={{ color: '#888' }}>Trades: <span style={{ color: '#E5E5E7' }}>{token.trade_count || 0}</span></span>
            <span style={{ color: '#888' }}>By: <span style={{ color: '#888' }}>{highlight(token.creator_name || 'Unknown')}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContractIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/>
      <path d="M3 5H9M3 7H7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function TokenDetailModal({ token, onClose }: { token: any; onClose: () => void }) {
  const priceChange = token.price_change_24h ?? 0;
  const isPositive = priceChange >= 0;
  const marketCap = token.market_cap || 30;
  const solscanUrl = token.mint_address ? `https://solscan.io/token/${token.mint_address}?cluster=devnet` : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'linear-gradient(180deg, #141416 0%, #0A0A0C 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#E5E5E7' }}>${token.symbol}</h2>
            <p className="text-sm" style={{ color: '#606060' }}>{token.name}</p>
          </div>
          <button onClick={onClose} className="text-lg w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#666' }}>×</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <StatCard label="Market Cap" value={formatMarketCap(marketCap)} />
          <StatCard label="In SOL" value={`${marketCap.toFixed(2)} SOL`} valueColor="#A78BFA" />
          <StatCard label="Change 24h" value={`${isPositive ? '+' : ''}${priceChange.toFixed(2)}%`} valueColor={isPositive ? '#6FCF97' : '#E08080'} />
          <StatCard label="Trades" value={String(token.trade_count || 0)} />
          <StatCard label="Volume 24h" value={(token.volume_24h || 0).toFixed(4) + ' SOL'} />
        </div>

        {/* Creator's Thesis */}
        {token.thesis && (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)', border: '1px solid rgba(251, 191, 36, 0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <ThesisIcon />
              <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: '#D4A853' }}>Creator's Thesis</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#C0C0C0' }}>{token.thesis}</p>
          </div>
        )}

        {/* Token Image */}
        {token.image_url && (
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden" style={{ border: '2px solid rgba(251, 191, 36, 0.2)', boxShadow: '0 4px 16px rgba(251, 191, 36, 0.1)' }}>
              <img 
                src={token.image_url} 
                alt={token.symbol}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-[9px] mb-1 uppercase tracking-wider" style={{ color: '#555' }}>Created by</div>
          <div className="text-sm font-medium" style={{ color: '#E5E5E7' }}>{token.creator_name || 'Unknown'}</div>
        </div>

        {token.mint_address && (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-[9px] mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>Contract Address</div>
            <a 
              href={solscanUrl || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-mono text-xs break-all hover:underline transition-all group"
              style={{ color: '#70B8E0' }}
            >
              <span>{token.mint_address}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 opacity-60 group-hover:opacity-100">
                <path d="M9 6.5V9C9 9.5523 8.5523 10 8 10H3C2.4477 10 2 9.5523 2 9V4C2 3.4477 2.4477 3 3 3H5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <path d="M7 2H10V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 2L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        )}

        {solscanUrl && (
          <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(180deg, rgba(112, 184, 224, 0.15) 0%, rgba(112, 184, 224, 0.08) 100%)', color: '#70B8E0', border: '1px solid rgba(112, 184, 224, 0.2)' }}>
            <SolscanIcon />
            View on Solscan
          </a>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
      <div className="text-[8px] mb-1 uppercase tracking-wider" style={{ color: '#555' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: valueColor || '#E5E5E7', textShadow: valueColor ? `0 0 10px ${valueColor}50` : 'none' }}>{value}</div>
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

function SolscanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ThesisIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3 2H11C11.5523 2 12 2.44772 12 3V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V3C2 2.44772 2.44772 2 3 2Z" stroke="#D4A853" strokeWidth="1.2"/>
      <path d="M4 5H10M4 7H10M4 9H7" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// SOL price for USD conversion
const SOL_USD_PRICE = 150;

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(2);
}

function formatMarketCap(solAmount: number): string {
  // Market cap is in SOL, convert to USD for display
  const usdAmount = solAmount * SOL_USD_PRICE;
  if (usdAmount >= 1000000) return '$' + (usdAmount / 1000000).toFixed(2) + 'M';
  if (usdAmount >= 1000) return '$' + (usdAmount / 1000).toFixed(1) + 'K';
  return '$' + usdAmount.toFixed(0);
}
