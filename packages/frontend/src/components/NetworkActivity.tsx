'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo, useState } from 'react';

export function NetworkActivity() {
  const { networkStats, activities, tokens, agents } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const chartBars = useMemo(() => 
    Array.from({ length: 24 }).map((_, i) => ({
      height: 15 + Math.sin(i * 0.3) * 20 + Math.random() * 40,
      active: i > 18,
    })), 
  []);

  const detailedStats = useMemo(() => ({
    totalAgents: agents.length,
    onlineAgents: agents.filter(a => a.is_online || a.isOnline).length,
    totalTokens: tokens.length,
    totalTrades: activities.filter(a => a.activity_type === 'trade' || a.description?.includes('bought') || a.description?.includes('sold')).length,
    totalPosts: activities.filter(a => a.activity_type === 'post').length,
    totalVolume: activities.reduce((sum, a) => {
      const match = a.description?.match(/(\d+\.?\d*)\s*SOL/i);
      return sum + (match ? parseFloat(match[1]) : 0);
    }, 0),
    recentActivity: activities.slice(0, 10),
  }), [agents, tokens, activities]);
  
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
            Details
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Network</h3>
          <div className="flex items-center gap-1.5 text-[8px] px-2 py-0.5 rounded font-semibold"
            style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399' }} />
            {networkStats.tps} TPS
          </div>
        </div>
        
        {/* Chart Area */}
        <div className="flex-1 min-h-[80px] mb-3 rounded-xl flex items-end justify-between px-3 py-3"
          style={{ background: 'linear-gradient(180deg, #0A0A0B 0%, #111113 100%)', border: '1px solid rgba(255,255,255,0.03)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
          {chartBars.map((bar, i) => (
            <div key={i} className="w-1.5 rounded-full transition-all duration-300"
              style={{ height: `${bar.height}%`, background: bar.active ? 'linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.3))' : 'rgba(255,255,255,0.08)', boxShadow: bar.active ? '0 0 6px rgba(255, 255, 255, 0.2)' : 'none' }} />
          ))}
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
          <MetricBox value={networkStats.tokensPerMinute} label="Tokens" color="#D4A853" />
          <MetricBox value={networkStats.tradesExecuted} label="Trades" color="#6FCF97" />
        </div>
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Network Activity"
          subtitle="Real-time network statistics"
          badge={
            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded font-semibold"
              style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34D399' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
              {networkStats.tps} TPS
            </div>
          }
          onClose={() => setIsExpanded(false)}
        >
          {/* Large Chart */}
          <div className="h-48 mb-6 rounded-2xl flex items-end justify-between px-6 py-4"
            style={{ background: 'linear-gradient(180deg, #0A0A0B 0%, #111113 100%)', border: '1px solid rgba(255,255,255,0.04)' }}>
            {chartBars.concat(chartBars).map((bar, i) => (
              <div key={i} className="w-2 rounded-full transition-all duration-300"
                style={{ height: `${bar.height}%`, background: bar.active ? 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.35))' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Agents" value={detailedStats.totalAgents.toString()} color="#70B8E0" />
            <StatCard label="Online Agents" value={detailedStats.onlineAgents.toString()} color="#34D399" />
            <StatCard label="Total Tokens" value={detailedStats.totalTokens.toString()} color="#D4A853" />
            <StatCard label="Total Trades" value={detailedStats.totalTrades.toString()} color="#6FCF97" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Tokens/Min" value={networkStats.tokensPerMinute.toString()} color="#D4A853" />
            <StatCard label="Trades Executed" value={networkStats.tradesExecuted.toLocaleString()} color="#6FCF97" />
            <StatCard label="Total Volume" value={`${detailedStats.totalVolume.toFixed(2)} SOL`} color="#9B8FD0" />
          </div>
        </ExpandedModal>
      )}
    </>
  );
}

function MetricBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="p-2.5 rounded-xl text-center"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
      <div className="text-base font-bold" style={{ color, textShadow: `0 0 12px ${color}50` }}>{value.toLocaleString()}</div>
      <div className="text-[8px] uppercase tracking-wider" style={{ color: '#505050' }}>{label}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] mb-2 uppercase tracking-wider" style={{ color: '#555' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color, textShadow: `0 0 20px ${color}40` }}>{value}</div>
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
