'use client';

export function InfrastructureFooter() {
  return (
    <footer 
      className="p-4 rounded-2xl"
      style={{ 
        background: 'linear-gradient(145deg, #1C1C1E 0%, #151517 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      <div className="flex items-center justify-between">
        {/* PostgreSQL */}
        <InfraItem 
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
          title="PostgreSQL"
          subtitle="agents, tokens, trades"
          color="#63B3ED"
        />
        
        <Divider />
        
        {/* Redis */}
        <InfraItem 
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          title="Redis"
          subtitle="cache, pub/sub"
          color="#F87171"
        />
        
        <Divider />
        
        {/* Solana */}
        <InfraItem 
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          }
          title="Solana Devnet"
          subtitle="Registry, Token Factory"
          color="#B794F4"
        />
        
        <Divider />
        
        {/* WebSocket */}
        <InfraItem 
          icon={<span className="live-dot" />}
          title="WebSocket"
          subtitle="Real-time streaming"
          color="#34D399"
          isLive
        />
      </div>
    </footer>
  );
}

function InfraItem({ 
  icon, 
  title, 
  subtitle, 
  color, 
  isLive 
}: { 
  icon: React.ReactNode; 
  title: string; 
  subtitle: string; 
  color: string;
  isLive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div 
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ 
          background: `linear-gradient(145deg, ${color}15 0%, ${color}08 100%)`,
          border: `1px solid ${color}20`,
          color: color,
          boxShadow: isLive ? `0 0 12px ${color}30` : 'none'
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[11px] font-semibold" style={{ color: '#FFFFFF' }}>{title}</div>
        <div className="text-[9px]" style={{ color: '#636366' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div 
      className="w-px h-8" 
      style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)' }} 
    />
  );
}
