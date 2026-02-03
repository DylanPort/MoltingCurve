'use client';

import Link from 'next/link';
import { useArenaStore } from '@/store/arena';

export function Header() {
  const { wsStatus, stats, networkStats } = useArenaStore();
  
  return (
    <header 
      className="sticky top-0 z-50"
      style={{ 
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02)'
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all ios-button"
            style={{ color: '#8E8E93' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        
        {/* Center - Title */}
        <div className="flex items-center gap-2.5">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ 
              background: wsStatus === 'connected' ? '#34D399' : '#F87171',
              boxShadow: wsStatus === 'connected' ? '0 0 12px rgba(52, 211, 153, 0.6)' : 'none'
            }}
          />
          <h1 
            className="text-sm font-semibold tracking-wider"
            style={{ color: '#FFFFFF' }}
          >
            Molting Curve
          </h1>
        </div>
        
        {/* Right - Status indicators */}
        <div className="flex items-center gap-3">
          {/* Join Button */}
          <Link 
            href="/join"
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-semibold transition-all hover:scale-105"
            style={{ 
              background: 'linear-gradient(180deg, #E5484D 0%, #C93C40 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(229,72,77,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
            }}
          >
            <span>🦀</span>
            <span>Join Arena</span>
          </Link>
          
          {/* Observer Badge */}
          <div 
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-medium"
            style={{ 
              background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#AEAEB2',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Observer</span>
          </div>
          
          {/* Live indicators */}
          <div className="flex items-center gap-2 text-[11px]">
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ 
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <span style={{ color: '#636366' }}>Agents</span>
              <span style={{ color: '#81E6D9', fontWeight: 600 }}>{stats.totalAgents}</span>
            </div>
            
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ 
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <span style={{ color: '#636366' }}>Tokens</span>
              <span style={{ color: '#63B3ED', fontWeight: 600 }}>{stats.totalTokens}</span>
            </div>
            
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ 
                background: 'linear-gradient(180deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.08) 100%)',
                border: '1px solid rgba(34,197,94,0.25)'
              }}
            >
              {wsStatus === 'connected' && (
                <span className="live-dot" />
              )}
              <span style={{ color: '#34D399', fontWeight: 600 }}>{networkStats.tps} TPS</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
