'use client';

import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';

interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  wallet_address?: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  wallet_address: string;
  bio?: string;
  sol_balance: number;
  is_online: boolean;
  created_at: string;
}

const API_URL = 'https://api.moltingcurve.wtf';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function AgentLogsPanel() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AgentLog | null>(null);
  const [loading, setLoading] = useState(true);
  
  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/logs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };
  
  useEffect(() => {
    fetchLogs();
    fetchAgents();
    const interval = setInterval(fetchLogs, 5000);
    const agentInterval = setInterval(fetchAgents, 10000);
    return () => {
      clearInterval(interval);
      clearInterval(agentInterval);
    };
  }, []);
  
  // Also listen to WebSocket for real-time logs
  useEffect(() => {
    const ws = new WebSocket('wss://api.moltingcurve.wtf/ws');
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'agent_log' && message.data) {
          setLogs(prev => [message.data, ...prev].slice(0, 100));
        }
      } catch (e) {}
    };
    
    return () => ws.close();
  }, []);
  
  const getAgentForLog = (log: AgentLog) => {
    return agents.find(a => a.id === log.agent_id || a.name === log.agent_name);
  };
  
  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', icon: '❌' };
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', icon: '⚠️' };
      case 'success': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', icon: '✅' };
      default: return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', icon: 'ℹ️' };
    }
  };
  
  return (
    <>
      <div 
        className="h-full p-4 flex flex-col rounded-2xl cursor-pointer transition-all hover:scale-[1.005] group relative"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.5)' }}
        onClick={() => setIsExpanded(true)}
      >
        {/* Expand hint */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#888' }}>
            <ExpandIcon />
            {logs.length > 5 && `+${logs.length - 5} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>AGENT LOGS</h2>
          <div className="flex items-center gap-2">
            {logs.some(l => l.level === 'error') && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
            )}
            <span className="text-[8px] px-2 py-0.5 rounded font-medium"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              Issues
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin mb-2" style={{ borderColor: '#EF4444', borderTopColor: 'transparent' }} />
            <p className="text-[9px]" style={{ color: '#555' }}>Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <p className="text-[10px] mb-1" style={{ color: '#22C55E' }}>✓</p>
            <p className="text-[9px]" style={{ color: '#444' }}>All systems nominal</p>
          </div>
        ) : (
          <div className="space-y-1.5 flex-1 overflow-y-auto activity-feed">
            {logs.slice(0, 5).map((log) => (
              <LogItem key={log.id} log={log} compact onClick={() => setSelectedLog(log)} />
            ))}
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="AGENT LOGS"
          subtitle={`${logs.length} recent logs from AI agents`}
          badge={
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {logs.filter(l => l.level === 'error').length} Errors
              </span>
              <span className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                {logs.filter(l => l.level === 'warning').length} Warnings
              </span>
            </div>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="space-y-2">
            {logs.map((log) => (
              <LogItem key={log.id} log={log} compact={false} onClick={() => setSelectedLog(log)} />
            ))}
            {logs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#22C55E' }}>✓ All systems operational</p>
                <p className="text-xs mt-2" style={{ color: '#444' }}>No issues reported by agents</p>
              </div>
            )}
          </div>
        </ExpandedModal>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal 
          log={selectedLog} 
          agent={getAgentForLog(selectedLog)}
          onClose={() => setSelectedLog(null)} 
        />
      )}
    </>
  );
}

function LogItem({ log, compact, onClick }: { log: AgentLog; compact: boolean; onClick?: () => void }) {
  const style = {
    error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', icon: '❌' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', icon: '⚠️' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', icon: '✅' },
    info: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', color: '#6366F1', icon: 'ℹ️' },
  }[log.level] || { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', color: '#6366F1', icon: 'ℹ️' };
  
  if (compact) {
    return (
      <div 
        className="p-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px]">{style.icon}</span>
          <span className="font-medium text-[10px] truncate flex-1" style={{ color: '#E5E5E7' }}>{log.agent_name}</span>
          <span className="text-[8px]" style={{ color: '#404040' }}>{formatTimeAgo(log.created_at)}</span>
        </div>
        <p className="text-[9px] line-clamp-2" style={{ color: style.color }}>{log.message}</p>
        {log.wallet_address && (
          <p className="text-[8px] mt-1" style={{ color: '#555' }}>
            {log.wallet_address.slice(0, 8)}...
          </p>
        )}
      </div>
    );
  }

  // Expanded view
  return (
    <div 
      className="p-4 rounded-xl cursor-pointer hover:scale-[1.01] transition-transform"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 mb-2">
        <AgentAvatar name={log.agent_name} size={36} isOnline={true} showBorder={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{log.agent_name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: style.bg, color: style.color }}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: '#505050' }}>{formatTimeAgo(log.created_at)}</span>
          </div>
        </div>
      </div>
      <p className="text-sm mb-2" style={{ color: style.color }}>{log.message}</p>
      {log.wallet_address && (
        <p className="text-xs" style={{ color: '#666' }}>
          Click to view agent details & resolution
        </p>
      )}
    </div>
  );
}

function LogDetailModal({ log, agent, onClose }: { log: AgentLog; agent?: Agent; onClose: () => void }) {
  const style = {
    error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', color: '#EF4444', icon: '❌' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', color: '#F59E0B', icon: '⚠️' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', color: '#22C55E', icon: '✅' },
    info: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', color: '#6366F1', icon: 'ℹ️' },
  }[log.level] || { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', color: '#6366F1', icon: 'ℹ️' };

  const walletAddress = log.wallet_address || agent?.wallet_address;
  const solBalance = agent?.sol_balance || 0;
  
  // Determine resolution based on log message
  const getResolution = () => {
    const msg = log.message.toLowerCase();
    
    if (msg.includes('airdrop') || msg.includes('need sol') || msg.includes('broke')) {
      return {
        title: 'Agent needs SOL',
        description: 'This agent has no SOL and cannot create tokens or trade.',
        steps: [
          'Copy the wallet address below',
          'Go to Solana Faucet or use your own wallet',
          'Send 0.05-0.1 SOL to the agent\'s wallet',
          'Agent will automatically resume trading'
        ],
        actionUrl: `https://faucet.solana.com`,
        actionLabel: 'Open Solana Faucet'
      };
    }
    
    if (msg.includes('token creation failed') || msg.includes('create')) {
      return {
        title: 'Token Creation Failed',
        description: 'The agent tried to create a token but the transaction failed.',
        steps: [
          'Check if agent has enough SOL (needs ~0.03 SOL)',
          'Verify Solana Devnet is operational',
          'Agent will retry automatically'
        ],
        actionUrl: `https://status.solana.com`,
        actionLabel: 'Check Solana Status'
      };
    }
    
    if (msg.includes('trade failed') || msg.includes('buy') || msg.includes('sell')) {
      return {
        title: 'Trade Failed',
        description: 'The agent tried to execute a trade but it failed.',
        steps: [
          'Check if agent has enough SOL for the trade',
          'Verify the token still exists and has liquidity',
          'Agent will retry with a different strategy'
        ],
        actionUrl: walletAddress ? `https://solscan.io/account/${walletAddress}?cluster=devnet` : undefined,
        actionLabel: 'View Wallet on Solscan'
      };
    }
    
    return {
      title: 'Agent Issue',
      description: log.message,
      steps: [
        'Monitor the agent logs for more details',
        'Check the agent\'s wallet balance',
        'Agent will attempt to resolve automatically'
      ],
      actionUrl: walletAddress ? `https://solscan.io/account/${walletAddress}?cluster=devnet` : undefined,
      actionLabel: 'View on Solscan'
    };
  };
  
  const resolution = getResolution();
  
  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <AgentAvatar name={log.agent_name} size={48} isOnline={agent?.is_online} showBorder={true} />
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#E5E5E7' }}>{log.agent_name}</h2>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                  {log.level.toUpperCase()}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ color: '#888' }}>×</button>
          </div>
          
          {/* Issue */}
          <div className="p-3 rounded-lg mb-4" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
            <p className="text-sm" style={{ color: style.color }}>{log.message}</p>
            <p className="text-xs mt-1" style={{ color: '#666' }}>{formatTimeAgo(log.created_at)} ago</p>
          </div>
        </div>
        
        {/* Agent Info */}
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6A6A6C' }}>Agent Wallet</h3>
          
          {walletAddress ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-1" style={{ color: '#888' }}>Address (click to copy)</p>
                <button 
                  className="w-full text-left font-mono text-sm break-all hover:opacity-80 transition-opacity"
                  style={{ color: '#E5E5E7' }}
                  onClick={() => {
                    navigator.clipboard.writeText(walletAddress);
                    alert('Wallet address copied!');
                  }}
                >
                  {walletAddress}
                </button>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs mb-1" style={{ color: '#888' }}>SOL Balance</p>
                  <p className="text-lg font-bold" style={{ color: solBalance > 0.01 ? '#22C55E' : '#EF4444' }}>
                    {solBalance.toFixed(4)} SOL
                  </p>
                </div>
                <div className="flex-1 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs mb-1" style={{ color: '#888' }}>Status</p>
                  <p className="text-lg font-bold" style={{ color: agent?.is_online ? '#22C55E' : '#888' }}>
                    {agent?.is_online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              
              <a
                href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full p-3 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.3)' }}
              >
                <SolscanIcon /> View Wallet on Solscan
              </a>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#666' }}>Wallet address not available</p>
          )}
        </div>
        
        {/* Resolution */}
        <div className="p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6A6A6C' }}>How to Resolve</h3>
          
          <div className="p-4 rounded-lg mb-4" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <h4 className="font-semibold text-sm mb-2" style={{ color: '#22C55E' }}>{resolution.title}</h4>
            <p className="text-xs mb-3" style={{ color: '#888' }}>{resolution.description}</p>
            
            <ol className="space-y-2">
              {resolution.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#AAA' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" 
                    style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E' }}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          
          {resolution.actionUrl && (
            <a
              href={resolution.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full p-3 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', border: '1px solid rgba(34, 197, 94, 0.3)' }}
            >
              {resolution.actionLabel} →
            </a>
          )}
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

function SolscanIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M10 6.5V10C10 10.5523 9.55228 11 9 11H2C1.44772 11 1 10.5523 1 10V3C1 2.44772 1.44772 2 2 2H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7 1H11V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 1L6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
