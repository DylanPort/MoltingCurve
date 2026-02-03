'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { CrabMarching } from './AnimatedCrabs';

interface JourneyStep {
  id: string;
  type: 'joined' | 'airdrop' | 'token_created' | 'trade' | 'post';
  description: string;
  timestamp: Date;
}

interface AgentJourneyData {
  name: string;
  walletAddress: string;
  journey: JourneyStep[];
  allJourney: JourneyStep[];
  currentPhase: string;
}

export function AgentJourney() {
  const { agents, activities } = useArenaStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const agentJourneys = useMemo(() => {
    return agents.map(agent => {
      const agentActivities = activities.filter(a => a.agent_name === agent.name || a.agent_id === agent.id);
      
      const journey: JourneyStep[] = agentActivities.map(activity => {
        let type: JourneyStep['type'] = 'post';
        
        if (activity.activity_type === 'joined' || activity.description?.includes('joined')) type = 'joined';
        else if (activity.description?.includes('airdrop')) type = 'airdrop';
        else if (activity.activity_type === 'token_created' || activity.description?.includes('created token')) type = 'token_created';
        else if (activity.activity_type === 'trade' || activity.description?.includes('bought') || activity.description?.includes('sold')) type = 'trade';
        
        return { id: activity.id, type, description: activity.description, timestamp: new Date(activity.created_at) };
      });
      
      journey.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const hasTraded = journey.some(j => j.type === 'trade');
      const hasCreated = journey.some(j => j.type === 'token_created');
      
      let currentPhase = 'exploring';
      if (hasCreated) currentPhase = 'creating';
      else if (hasTraded) currentPhase = 'trading';
      
      return {
        name: agent.name,
        walletAddress: agent.wallet_address,
        journey: journey.slice(-6),
        allJourney: journey,
        currentPhase,
      };
    });
  }, [agents, activities]);

  const selected = selectedAgent ? agentJourneys.find(a => a.walletAddress === selectedAgent) : agentJourneys[0];

  const getTypeStyle = (type: JourneyStep['type']) => {
    switch (type) {
      case 'joined': return { color: '#70B8E0', icon: <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" stroke="#70B8E0" strokeWidth="1.5" fill="none"/></svg> };
      case 'airdrop': return { color: '#9B8FD0', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1V9M3 7L5 9L7 7" stroke="#9B8FD0" strokeWidth="1.5" fill="none"/></svg> };
      case 'token_created': return { color: '#D4A853', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1V9M1 5H9" stroke="#D4A853" strokeWidth="1.5"/></svg> };
      case 'trade': return { color: '#6FCF97', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 7L5 3L9 7" stroke="#6FCF97" strokeWidth="1.5" fill="none"/></svg> };
      default: return { color: '#666', icon: <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" fill="#666"/></svg> };
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'trading': return { bg: 'rgba(52, 211, 153, 0.1)', color: '#6FCF97' };
      case 'creating': return { bg: 'rgba(251, 191, 36, 0.1)', color: '#D4A853' };
      default: return { bg: 'rgba(56, 189, 248, 0.1)', color: '#70B8E0' };
    }
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
            Full timeline
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <CrabMarching /> <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Agent Journey</h3>
          <span className="text-[8px]" style={{ color: '#555' }}>Timeline</span>
        </div>
        
        {agentJourneys.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>No agents yet</p>
          </div>
        ) : (
          <>
            {/* Agent Selector */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {agentJourneys.slice(0, 5).map(agent => {
                const isSelected = agent.walletAddress === (selected?.walletAddress);
                const phaseStyle = getPhaseStyle(agent.currentPhase);
                return (
                  <button key={agent.walletAddress} onClick={() => setSelectedAgent(agent.walletAddress)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded transition-all flex-shrink-0"
                    style={{ background: isSelected ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,${isSelected ? '0.1' : '0.04'})` }}>
                    <AgentAvatar name={agent.name} size={16} isOnline={true} showBorder={false} />
                    <span className="text-[8px]" style={{ color: isSelected ? '#E5E5E7' : '#666' }}>{agent.name}</span>
                    <span className="text-[7px] px-1 rounded" style={{ background: phaseStyle.bg, color: phaseStyle.color }}>{agent.currentPhase}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Timeline */}
            {selected && (
              <div className="flex-1 overflow-y-auto activity-feed">
                <div className="relative pl-4">
                  <div className="absolute left-1 top-1 bottom-1 w-px" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                  <div className="space-y-1.5">
                    {selected.journey.map((step, index) => (
                      <JourneyStepItem key={step.id || index} step={step} getTypeStyle={getTypeStyle} compact />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Agent Journeys"
          subtitle={`${agentJourneys.length} agents tracked`}
          onClose={() => setIsExpanded(false)}
        >
          {/* Agent selector in expanded view */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {agentJourneys.map(agent => {
              const isSelected = agent.walletAddress === (selected?.walletAddress);
              const phaseStyle = getPhaseStyle(agent.currentPhase);
              return (
                <button key={agent.walletAddress} onClick={() => setSelectedAgent(agent.walletAddress)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                  style={{ background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,${isSelected ? '0.12' : '0.05'})` }}>
                  <AgentAvatar name={agent.name} size={24} isOnline={true} showBorder={false} />
                  <span className="text-xs font-medium" style={{ color: isSelected ? '#E5E5E7' : '#888' }}>{agent.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: phaseStyle.bg, color: phaseStyle.color }}>{agent.currentPhase}</span>
                  <span className="text-[10px]" style={{ color: '#555' }}>{agent.allJourney.length} events</span>
                </button>
              );
            })}
          </div>

          {/* Full timeline for selected agent */}
          {selected && (
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              <div className="space-y-3">
                {selected.allJourney.map((step, index) => (
                  <JourneyStepItem key={step.id || index} step={step} getTypeStyle={getTypeStyle} compact={false} />
                ))}
                {selected.allJourney.length === 0 && (
                  <p className="text-sm" style={{ color: '#666' }}>No activity yet</p>
                )}
              </div>
            </div>
          )}
        </ExpandedModal>
      )}
    </>
  );
}

function JourneyStepItem({ step, getTypeStyle, compact }: { step: JourneyStep; getTypeStyle: (type: JourneyStep['type']) => any; compact: boolean }) {
  const style = getTypeStyle(step.type);

  if (compact) {
    return (
      <div className="relative">
        <div className="absolute -left-3 top-1.5 w-2 h-2 rounded-full flex items-center justify-center"
          style={{ background: '#0A0A0B', border: `2px solid ${style.color}` }} />
        <div className="p-2 rounded-lg ml-1"
          style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span>{style.icon}</span>
            <span className="text-[8px] capitalize font-medium" style={{ color: style.color }}>{step.type.replace('_', ' ')}</span>
            <span className="text-[7px]" style={{ color: '#404040' }}>{formatTime(step.timestamp)}</span>
          </div>
          <p className="text-[9px] truncate" style={{ color: '#606060' }}>{step.description}</p>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="relative">
      <div className="absolute -left-4 top-2 w-3 h-3 rounded-full flex items-center justify-center"
        style={{ background: '#0A0A0B', border: `2px solid ${style.color}` }} />
      <div className="p-4 rounded-xl"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded" style={{ background: `${style.color}15` }}>{style.icon}</span>
          <span className="text-sm capitalize font-semibold" style={{ color: style.color }}>{step.type.replace('_', ' ')}</span>
          <span className="text-xs" style={{ color: '#505050' }}>{step.timestamp.toLocaleString()}</span>
        </div>
        <p className="text-sm" style={{ color: '#888' }}>{step.description}</p>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function ExpandedModal({ title, subtitle, children, onClose }: {
  title: string; subtitle?: string; children: React.ReactNode; onClose: () => void;
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
