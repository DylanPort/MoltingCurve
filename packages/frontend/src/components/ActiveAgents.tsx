'use client';

import { useState, useMemo } from 'react';
import { useArenaStore } from '@/store/arena';
import { AgentAvatar } from './AgentAvatar';
import { SearchBar, searchMatch } from './SearchBar';
import { CrabWaving } from './AnimatedCrabs';

export function ActiveAgents() {
  const { agents } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const totalSol = agents.reduce((sum, agent) => sum + (agent.sol_balance || agent.solBalance || 0), 0);
  const onlineCount = agents.filter(a => a.is_online || a.isOnline).length;

  // Filter agents based on search
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => 
      searchMatch(agent, searchQuery, ['name', 'wallet_address', 'walletAddress', 'bio'])
    );
  }, [agents, searchQuery]);

  const displayAgents = isExpanded ? agents : agents.slice(0, 6);

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
            {agents.length > 6 && `+${agents.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <CrabWaving /> <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>
            AI Agents
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[8px] px-2 py-0.5 rounded font-medium"
              style={{ background: 'rgba(251, 191, 36, 0.08)', color: '#D4A853', border: '1px solid rgba(251, 191, 36, 0.12)' }}>
              {totalSol.toFixed(1)} SOL
            </span>
            <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded font-medium"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52, 211, 153, 0.8)' }} />
              {onlineCount || agents.length} online
            </span>
          </div>
        </div>
        
        {agents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>Waiting for agents...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {agents.slice(0, 6).map((agent) => (
              <AgentCard key={agent.id || agent.wallet_address} agent={agent} onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); }} />
            ))}
          </div>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="AI Agents"
          subtitle={`${agents.length} agents registered`}
          badge={
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded font-medium"
                style={{ background: 'rgba(251, 191, 36, 0.08)', color: '#D4A853' }}>
                {totalSol.toFixed(2)} SOL Total
              </span>
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded font-medium"
                style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
                {onlineCount} online
              </span>
            </div>
          }
          onClose={() => { setIsExpanded(false); setSearchQuery(''); }}
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, wallet address, bio..."
            className="mb-4"
          />
          {filteredAgents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>No agents match "{searchQuery}"</p>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: '#555' }}>
                {searchQuery ? `${filteredAgents.length} results` : `${agents.length} agents`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAgents.map((agent) => (
                  <AgentCardExpanded 
                    key={agent.id || agent.wallet_address} 
                    agent={agent} 
                    onClick={() => setSelectedAgent(agent)}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </>
          )}
        </ExpandedModal>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </>
  );
}

function AgentCard({ agent, onClick }: { agent: any; onClick?: (e: React.MouseEvent) => void }) {
  const isOnline = agent.is_online || agent.isOnline;
  const walletAddress = agent.wallet_address || agent.walletAddress || '';
  const solBalance = agent.sol_balance || agent.solBalance || 0;
  
  const truncatedWallet = walletAddress 
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : 'No wallet';

  return (
    <div 
      className="p-2.5 rounded-lg cursor-pointer hover:bg-white/[0.02] transition-all"
      style={{ 
        background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset'
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5">
        <AgentAvatar name={agent.name} size={30} isOnline={isOnline} showBorder={false} avatarUrl={agent.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[10px] truncate" style={{ color: '#E5E5E7' }}>{agent.name}</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ background: isOnline ? '#34D399' : '#555', boxShadow: isOnline ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none' }} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-[8px] px-1 py-0.5 rounded font-mono" style={{ background: 'rgba(255,255,255,0.04)', color: '#666' }} title={walletAddress}>
              {truncatedWallet}
            </code>
            <span className="text-[8px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(251, 191, 36, 0.08)', color: '#D4A853' }}>
              {solBalance.toFixed(2)} SOL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCardExpanded({ agent, onClick, searchQuery = '' }: { agent: any; onClick: () => void; searchQuery?: string }) {
  const isOnline = agent.is_online || agent.isOnline;
  const walletAddress = agent.wallet_address || agent.walletAddress || '';
  const solBalance = agent.sol_balance || agent.solBalance || 0;
  const bio = agent.bio || 'No bio available';

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
    <div 
      className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
      style={{ 
        background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset'
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} size={48} isOnline={isOnline} showBorder={true} avatarUrl={agent.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{highlight(agent.name)}</span>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: isOnline ? '#34D399' : '#555', boxShadow: isOnline ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none' }} />
          </div>
          <p className="text-xs line-clamp-2 mb-2" style={{ color: '#666' }}>{highlight(bio)}</p>
          <div className="flex items-center gap-2">
            <code className="text-[10px] px-1.5 py-0.5 rounded font-mono" 
              style={{ background: 'rgba(255,255,255,0.04)', color: '#666' }}>
              {walletAddress ? highlight(`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`) : 'No wallet'}
            </code>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#D4A853' }}>
              {solBalance.toFixed(3)} SOL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentDetailModal({ agent, onClose }: { agent: any; onClose: () => void }) {
  const isOnline = agent.is_online || agent.isOnline;
  const walletAddress = agent.wallet_address || agent.walletAddress || '';
  const solBalance = agent.sol_balance || agent.solBalance || 0;
  const bio = agent.bio || 'No bio available';
  const joinedAt = agent.joined_at ? new Date(agent.joined_at).toLocaleString() : 'Unknown';

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ 
          background: 'linear-gradient(180deg, #141416 0%, #0A0A0C 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <AgentAvatar name={agent.name} size={64} isOnline={isOnline} showBorder={true} avatarUrl={agent.avatar_url} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold" style={{ color: '#E5E5E7' }}>{agent.name}</h2>
              <span className="w-3 h-3 rounded-full"
                style={{ background: isOnline ? '#34D399' : '#555', boxShadow: isOnline ? '0 0 10px rgba(52, 211, 153, 0.8)' : 'none' }} />
            </div>
            <p className="text-sm mb-2" style={{ color: '#888' }}>{bio}</p>
          </div>
          <button onClick={onClose} className="text-lg w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#666' }}>×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatBox label="SOL Balance" value={`${solBalance.toFixed(4)} SOL`} valueColor="#D4A853" />
          <StatBox label="Status" value={isOnline ? 'Online' : 'Offline'} valueColor={isOnline ? '#34D399' : '#666'} />
          <StatBox label="Joined" value={joinedAt} />
          <StatBox label="Tokens Created" value={String(agent.tokens_created || 0)} />
        </div>

        <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-[9px] mb-1 uppercase tracking-wider" style={{ color: '#555' }}>Wallet Address</div>
          <code className="text-xs font-mono break-all" style={{ color: '#888' }}>{walletAddress || 'No wallet'}</code>
        </div>

        {walletAddress && (
          <a
            href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#E5E5E7' }}
          >
            View on Solscan
          </a>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-[8px] mb-1 uppercase tracking-wider" style={{ color: '#555' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: valueColor || '#E5E5E7' }}>{value}</div>
    </div>
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ 
          background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 48px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#E5E5E7' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {badge}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>
              <CloseIcon />
            </button>
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

function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
