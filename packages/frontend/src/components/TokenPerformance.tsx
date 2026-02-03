'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo, useState } from 'react';

interface TokenMetrics {
  id: string;
  symbol: string;
  name: string;
  creator: string;
  creator_id?: string;
  price: number;
  priceChange: number;
  holders: number;
  trades: number;
  volume: number;
  marketCap: number;
  liquidity?: number;
  mintAddress?: string;
  createdAt?: string;
  thesis?: string;
  imageUrl?: string;
  momentum: 'high' | 'medium' | 'low' | 'none';
  recentTrades: any[];
  tradeHistory?: { time: number; price: number; type: string }[];
}

export function TokenPerformance() {
  const { tokens, activities } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenMetrics | null>(null);
  const [sortBy, setSortBy] = useState<'trades' | 'volume' | 'change'>('trades');

  const tokenMetrics = useMemo(() => {
    return tokens.map(token => {
      const tokenActivities = activities.filter(a => 
        a.description?.toLowerCase().includes(token.symbol?.toLowerCase()) || 
        a.metadata?.token_symbol === token.symbol ||
        a.metadata?.token_id === token.id
      );
      const recentTrades = tokenActivities.filter(t => 
        Date.now() - new Date(t.created_at).getTime() < 3600000
      );
      
      // Calculate REAL holders from buy activities - unique buyers
      const uniqueBuyers = new Set<string>();
      tokenActivities.forEach(a => {
        // Check for buy activities
        if (a.description?.toLowerCase().includes('bought') || 
            a.metadata?.trade_type === 'buy' ||
            a.activity_type === 'trade_buy') {
          // Add the agent/wallet that bought
          if (a.agent_name) uniqueBuyers.add(a.agent_name);
          if (a.agent_id) uniqueBuyers.add(a.agent_id);
          if (a.metadata?.buyer) uniqueBuyers.add(a.metadata.buyer);
        }
      });
      // Always include creator as holder
      if (token.creator_name) uniqueBuyers.add(token.creator_name);
      if (token.creator_id) uniqueBuyers.add(token.creator_id);
      
      // Real holders count: unique buyers + 1 (creator) minimum
      const realHolders = Math.max(uniqueBuyers.size, token.holder_count || 1);
      
      let momentum: TokenMetrics['momentum'] = 'none';
      if (recentTrades.length > 10) momentum = 'high';
      else if (recentTrades.length > 5) momentum = 'medium';
      else if (recentTrades.length > 0) momentum = 'low';
      
      // Build price history from actual trades
      const tradeHistory = tokenActivities
        .filter(a => a.metadata?.price || a.metadata?.sol_amount)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(a => ({
          time: new Date(a.created_at).getTime(),
          price: a.metadata?.price || (a.metadata?.sol_amount / (a.metadata?.token_amount || 1)) || 0,
          type: a.description?.includes('bought') ? 'buy' : 'sell'
        }));
      
      return {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        creator: token.creator_name || 'Unknown',
        creator_id: token.creator_id,
        price: token.current_price || 0.0001,
        priceChange: token.price_change_24h || 0,
        holders: realHolders, // Use calculated real holders
        trades: token.trade_count || tokenActivities.filter(a => 
          a.description?.includes('bought') || a.description?.includes('sold')
        ).length,
        volume: token.volume_24h || 0,
        marketCap: token.market_cap || 0,
        totalSupply: token.total_supply || 1000000000,
        mintAddress: token.mint_address,
        createdAt: token.created_at,
        thesis: token.thesis || '',
        imageUrl: token.image_url || null,
        momentum,
        recentTrades: tokenActivities.slice(0, 20),
        tradeHistory, // Add real trade history for chart
      };
    }).sort((a, b) => {
      if (sortBy === 'trades') return b.trades - a.trades;
      if (sortBy === 'volume') return b.volume - a.volume;
      return b.priceChange - a.priceChange;
    });
  }, [tokens, activities, sortBy]);

  const getMomentumStyle = (m: TokenMetrics['momentum']) => {
    switch (m) {
      case 'high': return { label: 'Hot', bg: 'rgba(248, 113, 113, 0.1)', color: '#E08080' };
      case 'medium': return { label: 'Active', bg: 'rgba(251, 191, 36, 0.1)', color: '#D4A853' };
      case 'low': return { label: 'Warming', bg: 'rgba(52, 211, 153, 0.1)', color: '#6FCF97' };
      default: return { label: 'Idle', bg: 'rgba(255,255,255,0.05)', color: '#555' };
    }
  };

  const handleTokenClick = (token: TokenMetrics, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedToken(token);
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
            {tokenMetrics.length > 6 && `+${tokenMetrics.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Token Performance</h3>
          <span className="text-[8px]" style={{ color: '#555' }}>{tokenMetrics.length} tokens</span>
        </div>
        
        {tokenMetrics.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>No tokens yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {tokenMetrics.slice(0, 6).map((token) => (
              <TokenMetricRow 
                key={token.symbol} 
                token={token} 
                getMomentumStyle={getMomentumStyle} 
                compact 
                onClick={(e) => handleTokenClick(token, e)}
              />
            ))}
          </div>
        )}
      </section>

      {/* All Tokens Modal */}
      {isExpanded && !selectedToken && (
        <AllTokensModal
          tokens={tokenMetrics}
          getMomentumStyle={getMomentumStyle}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onClose={() => setIsExpanded(false)}
          onTokenClick={(token) => setSelectedToken(token)}
        />
      )}

      {/* Token Detail Modal */}
      {selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          getMomentumStyle={getMomentumStyle}
          onClose={() => setSelectedToken(null)}
          onBack={() => setSelectedToken(null)}
        />
      )}
    </>
  );
}

function TokenMetricRow({ 
  token, 
  getMomentumStyle, 
  compact, 
  onClick 
}: { 
  token: TokenMetrics; 
  getMomentumStyle: (m: TokenMetrics['momentum']) => any; 
  compact: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const momentumStyle = getMomentumStyle(token.momentum);
  const isPositive = token.priceChange >= 0;

  if (compact) {
    return (
      <div 
        className="p-2.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:bg-white/[0.02]" 
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          {/* Token Image or Fallback */}
          {token.imageUrl ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(251, 191, 36, 0.15)' }}>
              <img 
                src={token.imageUrl} 
                alt={token.symbol}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold" style="background: linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05)); color: #D4A853;">${token.symbol.slice(0, 2)}</div>`;
                }}
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05))', border: '1px solid rgba(251, 191, 36, 0.15)', color: '#D4A853' }}>
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[11px]" style={{ color: '#E5E5E7' }}>${token.symbol}</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded font-medium" style={{ background: momentumStyle.bg, color: momentumStyle.color }}>{momentumStyle.label}</span>
            </div>
            <div className="text-[8px]" style={{ color: '#505050' }}>by {token.creator}</div>
            <div className="text-[8px] mt-0.5" style={{ color: '#404040' }}>{token.trades} trades</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[11px] font-semibold" style={{ color: '#D4A853' }}>{formatMarketCap(token.marketCap)}</div>
            <div className="text-[8px]" style={{ color: '#555' }}>mcap</div>
            <div className="text-[9px] font-semibold" style={{ color: isPositive ? '#6FCF97' : '#E08080' }}>{isPositive ? '+' : ''}{token.priceChange.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view in list
  return (
    <div 
      className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] hover:bg-white/[0.02]" 
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08))', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#D4A853' }}>
          {token.symbol.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base" style={{ color: '#E5E5E7' }}>${token.symbol}</span>
            <span className="text-[9px] px-2 py-0.5 rounded font-medium" style={{ background: momentumStyle.bg, color: momentumStyle.color }}>{momentumStyle.label}</span>
          </div>
          <p className="text-xs mb-2" style={{ color: '#888' }}>{token.name || token.symbol}</p>
          <div className="flex items-center gap-4 text-xs">
            <span style={{ color: '#888' }}>Trades: <span style={{ color: '#E5E5E7' }}>{token.trades}</span></span>
            <span style={{ color: '#888' }}>By: <span style={{ color: '#888' }}>{token.creator}</span></span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold" style={{ color: '#D4A853' }}>{formatMarketCap(token.marketCap)}</div>
          <div className="text-xs" style={{ color: '#666' }}>Market Cap</div>
          <div className="text-sm font-bold mt-1 flex items-center justify-end gap-1" style={{ color: isPositive ? '#6FCF97' : '#E08080' }}>
            {isPositive 
              ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 9V3M3 6L6 3L9 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              : <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 3V9M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            }
            {isPositive ? '+' : ''}{token.priceChange.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function AllTokensModal({ 
  tokens, 
  getMomentumStyle, 
  sortBy, 
  setSortBy, 
  onClose, 
  onTokenClick 
}: {
  tokens: TokenMetrics[];
  getMomentumStyle: (m: TokenMetrics['momentum']) => any;
  sortBy: string;
  setSortBy: (s: 'trades' | 'volume' | 'change') => void;
  onClose: () => void;
  onTokenClick: (token: TokenMetrics) => void;
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
            <h2 className="text-lg font-semibold" style={{ color: '#E5E5E7' }}>All Tokens</h2>
            <p className="text-xs mt-0.5" style={{ color: '#666' }}>{tokens.length} tokens tracked</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {(['trades', 'volume', 'change'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className="px-3 py-1.5 text-[10px] font-medium rounded transition-all"
                  style={{ 
                    background: sortBy === s ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: sortBy === s ? '#E5E5E7' : '#666'
                  }}
                >
                  By {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>×</button>
          </div>
        </div>

        {/* Table Header */}
        <div className="px-6 py-3 grid grid-cols-12 gap-4 text-[10px] font-medium uppercase tracking-wider" 
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#555' }}>
          <div className="col-span-3">Token</div>
          <div className="col-span-2">Contract</div>
          <div className="col-span-2 text-right">Market Cap</div>
          <div className="col-span-1 text-right">Trades</div>
          <div className="col-span-1 text-right">Age</div>
          <div className="col-span-1 text-right">Change</div>
          <div className="col-span-2 text-right">Creator</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tokens.map((token) => {
            const isPositive = token.priceChange >= 0;
            const age = token.createdAt ? getAge(token.createdAt) : '—';
            
            return (
              <div 
                key={token.id}
                className="px-6 py-3 cursor-pointer transition-all hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                onClick={() => onTokenClick(token)}
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    {token.imageUrl ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(251, 191, 36, 0.15)' }}>
                        <img src={token.imageUrl} alt={token.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05))', border: '1px solid rgba(251, 191, 36, 0.15)', color: '#D4A853' }}>
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#E5E5E7' }}>${token.symbol}</div>
                      <div className="text-[10px]" style={{ color: '#555' }}>{token.name}</div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    {token.mintAddress ? (
                      <a 
                        href={`https://solscan.io/token/${token.mintAddress}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono hover:opacity-80 flex items-center gap-1"
                        style={{ color: '#70B8E0' }}
                      >
                        {token.mintAddress.slice(0, 6)}...{token.mintAddress.slice(-4)}
                        <ExternalIcon />
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: '#444' }}>—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-sm" style={{ color: '#D4A853' }}>
                    {formatMarketCap(token.marketCap)}
                  </div>
                  <div className="col-span-1 text-right text-sm" style={{ color: '#888' }}>
                    {token.trades}
                  </div>
                  <div className="col-span-1 text-right text-xs" style={{ color: '#555' }}>
                    {age}
                  </div>
                  <div className="col-span-1 text-right font-semibold text-sm" style={{ color: isPositive ? '#6FCF97' : '#E08080' }}>
                    {isPositive ? '+' : ''}{token.priceChange.toFixed(1)}%
                  </div>
                  <div className="col-span-2 text-right text-xs truncate" style={{ color: '#888' }}>
                    {token.creator}
                  </div>
                </div>
                {/* Thesis preview */}
                {token.thesis && (
                  <div className="mt-2 text-[10px] truncate pl-11" style={{ color: '#555' }}>
                    <span style={{ color: '#D4A853' }}>Thesis:</span> {token.thesis}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 text-center flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[10px]" style={{ color: '#444' }}>Click any token for detailed view with chart</p>
        </div>
      </div>
    </div>
  );
}

function TokenDetailModal({ 
  token, 
  getMomentumStyle,
  onClose, 
  onBack 
}: { 
  token: TokenMetrics;
  getMomentumStyle: (m: TokenMetrics['momentum']) => any;
  onClose: () => void;
  onBack: () => void;
}) {
  const momentumStyle = getMomentumStyle(token.momentum);
  const isPositive = token.priceChange >= 0;
  
  // Use real trade data for price history when available
  const priceHistory = useMemo(() => {
    const points = 24;
    const basePrice = token.price;
    const history = [];
    
    // If we have real trade history with prices, use it
    if (token.tradeHistory && token.tradeHistory.length > 0) {
      const realPrices = token.tradeHistory.filter(t => t.price > 0);
      if (realPrices.length >= 2) {
        // Resample to 24 points for smooth display
        const timeRange = realPrices[realPrices.length - 1].time - realPrices[0].time;
        const timeStep = timeRange / (points - 1);
        
        for (let i = 0; i < points; i++) {
          const targetTime = realPrices[0].time + (i * timeStep);
          // Find closest price point
          let closestPrice = realPrices[0].price;
          for (const p of realPrices) {
            if (p.time <= targetTime) closestPrice = p.price;
          }
          history.push({
            time: i,
            price: Math.max(0.000001, closestPrice),
            high: Math.max(0.000001, closestPrice),
            low: Math.max(0.000001, closestPrice),
          });
        }
        return history;
      }
    }
    
    // Fallback: If no real price change data, show flat line at current price
    if (token.priceChange === 0 && token.trades === 0) {
      for (let i = 0; i < points; i++) {
        history.push({
          time: i,
          price: basePrice,
          high: basePrice,
          low: basePrice,
        });
      }
      return history;
    }
    
    // Fallback: Generate curve from start price to current based on price change
    const startPrice = basePrice / (1 + token.priceChange / 100);
    const priceStep = (basePrice - startPrice) / (points - 1);
    
    for (let i = 0; i < points; i++) {
      const price = startPrice + (priceStep * i);
      history.push({
        time: i,
        price: Math.max(0.000001, price),
        high: Math.max(0.000001, price),
        low: Math.max(0.000001, price),
      });
    }
    
    return history;
  }, [token.price, token.priceChange, token.trades, token.tradeHistory]);

  const maxPrice = Math.max(...priceHistory.map(p => p.high));
  const minPrice = Math.min(...priceHistory.map(p => p.low));
  const priceRange = maxPrice - minPrice || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 48px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            {/* Token Image or Fallback */}
            {token.imageUrl ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                <img 
                  src={token.imageUrl} 
                  alt={token.symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to text if image fails
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-lg font-bold" style="background: linear-gradient(145deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08)); color: #D4A853;">${token.symbol.slice(0, 2)}</div>`;
                  }}
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08))', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#D4A853' }}>
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: '#E5E5E7' }}>${token.symbol}</h2>
                <span className="text-[9px] px-2 py-0.5 rounded font-medium" style={{ background: momentumStyle.bg, color: momentumStyle.color }}>{momentumStyle.label}</span>
              </div>
              <p className="text-sm" style={{ color: '#666' }}>{token.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: '#D4A853' }}>{formatMarketCap(token.marketCap)}</div>
            <div className="text-xs mb-1" style={{ color: '#666' }}>{token.marketCap.toFixed(2)} SOL</div>
            <div className="text-sm flex items-center justify-end gap-1" style={{ color: isPositive ? '#6FCF97' : '#E08080' }}>
              {isPositive 
                ? <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 10V4M4 7L7 4L10 7" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 4V10M4 7L7 10L10 7" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              }
              {isPositive ? '+' : ''}{token.priceChange.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Creator's Thesis */}
          {token.thesis && (
            <div className="mb-6 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%)', border: '1px solid rgba(251, 191, 36, 0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <ThesisIcon />
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4A853' }}>Creator's Thesis</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#C0C0C0' }}>{token.thesis}</p>
              <div className="mt-2 text-[10px]" style={{ color: '#666' }}>— {token.creator}</div>
            </div>
          )}

          {/* Token Image (Large) */}
          {token.imageUrl && (
            <div className="mb-6 flex justify-center">
              <div className="w-32 h-32 rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(251, 191, 36, 0.2)', boxShadow: '0 8px 32px rgba(251, 191, 36, 0.1)' }}>
                <img 
                  src={token.imageUrl} 
                  alt={token.symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          {/* Professional Linear Price Chart */}
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium" style={{ color: '#888' }}>Price (24h)</span>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ background: '#D4A853' }}></span><span style={{ color: '#666' }}>Price</span></span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ background: 'rgba(167, 139, 250, 0.6)' }}></span><span style={{ color: '#666' }}>MA7</span></span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ background: 'rgba(96, 165, 250, 0.5)' }}></span><span style={{ color: '#666' }}>MA14</span></span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px]" style={{ color: '#555' }}>
                <span>H: <span style={{ color: '#6FCF97' }}>{maxPrice.toFixed(6)}</span></span>
                <span>L: <span style={{ color: '#E08080' }}>{minPrice.toFixed(6)}</span></span>
              </div>
            </div>
            
            {/* SVG Linear Chart with Indicators */}
            <div className="relative h-52">
              <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="none">
                <defs>
                  {/* Gradient fill under price line */}
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? 'rgba(111, 207, 151, 0.3)' : 'rgba(224, 128, 128, 0.3)'}/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
                  </linearGradient>
                  {/* Glow effect */}
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                
                {/* Grid lines */}
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <g key={i}>
                    <line x1="40" y1={10 + i * 28} x2="395" y2={10 + i * 28} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                    <text x="35" y={14 + i * 28} textAnchor="end" fontSize="8" fill="#444">
                      {(maxPrice - (i / 5) * priceRange).toFixed(4)}
                    </text>
                  </g>
                ))}
                
                {/* Vertical time grid */}
                {[0, 6, 12, 18, 23].map(i => {
                  const x = 40 + (i / 23) * 355;
                  return (
                    <g key={i}>
                      <line x1={x} y1="10" x2={x} y2="150" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
                      <text x={x} y="165" textAnchor="middle" fontSize="8" fill="#444">{24 - i}h</text>
                    </g>
                  );
                })}
                
                {/* Area fill under price line */}
                <path 
                  d={`${priceHistory.map((p, i) => {
                    const x = 40 + (i / (priceHistory.length - 1)) * 355;
                    const y = 10 + ((maxPrice - p.price) / priceRange) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')} L 395 150 L 40 150 Z`}
                  fill="url(#priceGradient)"
                />
                
                {/* MA14 (Moving Average 14 periods) */}
                <path 
                  d={priceHistory.map((p, i) => {
                    const ma14 = priceHistory.slice(Math.max(0, i - 13), i + 1).reduce((sum, pt) => sum + pt.price, 0) / Math.min(i + 1, 14);
                    const x = 40 + (i / (priceHistory.length - 1)) * 355;
                    const y = 10 + ((maxPrice - ma14) / priceRange) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  stroke="rgba(96, 165, 250, 0.5)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeDasharray="4,2"
                />
                
                {/* MA7 (Moving Average 7 periods) */}
                <path 
                  d={priceHistory.map((p, i) => {
                    const ma7 = priceHistory.slice(Math.max(0, i - 6), i + 1).reduce((sum, pt) => sum + pt.price, 0) / Math.min(i + 1, 7);
                    const x = 40 + (i / (priceHistory.length - 1)) * 355;
                    const y = 10 + ((maxPrice - ma7) / priceRange) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  stroke="rgba(167, 139, 250, 0.6)"
                  strokeWidth="1.5"
                  fill="none"
                />
                
                {/* Main price line */}
                <path 
                  d={priceHistory.map((p, i) => {
                    const x = 40 + (i / (priceHistory.length - 1)) * 355;
                    const y = 10 + ((maxPrice - p.price) / priceRange) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  stroke={isPositive ? '#6FCF97' : '#E08080'}
                  strokeWidth="2"
                  fill="none"
                  filter="url(#glow)"
                />
                
                {/* Data points */}
                {priceHistory.filter((_, i) => i % 4 === 0 || i === priceHistory.length - 1).map((p, idx, arr) => {
                  const i = priceHistory.indexOf(p);
                  const x = 40 + (i / (priceHistory.length - 1)) * 355;
                  const y = 10 + ((maxPrice - p.price) / priceRange) * 140;
                  const isLast = idx === arr.length - 1;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={isLast ? 4 : 2.5} fill={isLast ? '#D4A853' : (isPositive ? '#6FCF97' : '#E08080')} opacity={isLast ? 1 : 0.7}/>
                      {isLast && <circle cx={x} cy={y} r="6" fill="none" stroke="#D4A853" strokeWidth="1" opacity="0.5"/>}
                    </g>
                  );
                })}
              </svg>
              
              {/* Current price badge */}
              <div 
                className="absolute text-xs font-mono px-2 py-1 rounded-lg flex items-center gap-1.5"
                style={{ 
                  right: '8px',
                  top: `${((maxPrice - token.price) / priceRange) * 78 + 5}%`,
                  background: 'rgba(212, 168, 83, 0.15)',
                  border: '1px solid rgba(212, 168, 83, 0.3)',
                  color: '#D4A853',
                  transform: 'translateY(-50%)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#D4A853' }}></span>
                {token.price.toFixed(6)}
              </div>
            </div>
            
            {/* Volume indicator bar at bottom */}
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span style={{ color: '#555' }}>Volume</span>
                <span style={{ color: '#666' }}>{token.volume.toFixed(2)} SOL</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${Math.min((token.volume / 100) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, rgba(167, 139, 250, 0.4), rgba(167, 139, 250, 0.8))'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Market Cap (USD)', value: formatMarketCap(token.marketCap), color: '#D4A853', icon: '◎' },
              { label: 'Market Cap (SOL)', value: token.marketCap.toFixed(2) + ' SOL', color: '#A78BFA', icon: '◎' },
              { label: 'Total Trades', value: token.trades.toString(), color: '#70B8E0', icon: '⬡' },
              { label: 'Volume 24h', value: token.volume > 0 ? token.volume.toFixed(4) + ' SOL' : '—', color: '#D4A853', icon: '◈' },
              { label: 'Price', value: formatPrice(token.price) + ' SOL', color: '#D4A853', icon: '◇' },
              { label: 'Age', value: token.createdAt ? getAge(token.createdAt) : '—', color: '#888', icon: '○' },
              { label: 'Change 24h', value: token.priceChange !== 0 ? (isPositive ? '+' : '') + token.priceChange.toFixed(2) + '%' : '—', color: token.priceChange !== 0 ? (isPositive ? '#6FCF97' : '#E08080') : '#555', icon: isPositive ? '↗' : '↘' },
            ].map((stat, i) => (
              <div key={i} className="p-3 rounded-xl relative overflow-hidden group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="absolute top-2 right-2 text-lg opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: stat.color }}>{stat.icon}</div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#555' }}>{stat.label}</div>
                <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Contract Info */}
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 className="text-xs font-medium mb-3" style={{ color: '#666' }}>Contract Details</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#555' }}>Mint Address</span>
                {token.mintAddress ? (
                  <a 
                    href={`https://solscan.io/token/${token.mintAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono hover:opacity-80 flex items-center gap-1"
                    style={{ color: '#70B8E0' }}
                  >
                    {token.mintAddress}
                    <ExternalIcon />
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: '#444' }}>Not available</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#555' }}>Creator</span>
                <span className="text-xs" style={{ color: '#888' }}>{token.creator}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#555' }}>Network</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA' }}>Solana Devnet</span>
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 className="text-xs font-medium mb-3" style={{ color: '#666' }}>Recent Activity</h3>
            {token.recentTrades.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#444' }}>No recent activity</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {token.recentTrades.slice(0, 10).map((trade, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        trade.activity_type === 'trade' 
                          ? (trade.metadata?.trade_type === 'buy' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10')
                          : 'text-blue-400 bg-blue-400/10'
                      }`}>
                        {trade.activity_type === 'trade' ? trade.metadata?.trade_type?.toUpperCase() : trade.activity_type.toUpperCase()}
                      </span>
                      <span className="text-xs" style={{ color: '#888' }}>{trade.agent_name}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: '#555' }}>{formatTimeAgo(trade.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {token.mintAddress && (
            <a 
              href={`https://solscan.io/token/${token.mintAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 hover:opacity-80"
              style={{ color: '#70B8E0' }}
            >
              View on Solscan <ExternalIcon />
            </a>
          )}
          <p className="text-[10px]" style={{ color: '#444' }}>Press ESC or click outside to close</p>
        </div>
      </div>
    </div>
  );
}

// SOL price for USD conversion (can be updated dynamically)
const SOL_USD_PRICE = 150;

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.01) return num.toFixed(2);
  return num.toFixed(6);
}

function formatMarketCap(solAmount: number): string {
  // Market cap is in SOL, convert to USD for display
  const usdAmount = solAmount * SOL_USD_PRICE;
  if (usdAmount >= 1000000) return '$' + (usdAmount / 1000000).toFixed(2) + 'M';
  if (usdAmount >= 1000) return '$' + (usdAmount / 1000).toFixed(1) + 'K';
  return '$' + usdAmount.toFixed(0);
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toExponential(2);
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

function getAge(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const hours = Math.floor((now.getTime() - date.getTime()) / 3600000);
  
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ExpandIcon() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 4V1H4M6 1H9V4M9 6V9H6M4 9H1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-70">
      <path d="M8 5.5V8C8 8.5523 7.5523 9 7 9H2C1.4477 9 1 8.5523 1 8V3C1 2.4477 1.4477 2 2 2H4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M6 1H9V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 1L5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function ThesisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 2H11C11.5523 2 12 2.44772 12 3V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V3C2 2.44772 2.44772 2 3 2Z" stroke="#D4A853" strokeWidth="1.2"/>
      <path d="M4 5H10M4 7H10M4 9H7" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
