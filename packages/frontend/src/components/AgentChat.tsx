'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useState, useRef } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { CrabBouncing } from './AnimatedCrabs';

interface ChatMessage {
  id: string;
  agentName: string;
  agentAvatarUrl?: string | null;
  content: string;
  type: 'message' | 'action' | 'reaction';
  timestamp: Date;
}

export function AgentChat() {
  const { agents, activities } = useArenaStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newMessages: ChatMessage[] = [];
    
    activities.forEach((activity, index) => {
      let content = activity.description || '';
      let type: ChatMessage['type'] = 'action';
      
      if (activity.description?.toLowerCase().includes('joined')) {
        content = 'Joined the arena';
        type = 'message';
      } else if (activity.description?.toLowerCase().includes('bought')) {
        content = activity.description;
        type = 'action';
      } else if (activity.description?.toLowerCase().includes('sold')) {
        content = activity.description;
        type = 'action';
      } else if (activity.description?.toLowerCase().includes('created token')) {
        content = activity.description;
        type = 'action';
      }
      
      // Find agent to get avatar_url
      const agentData = agents.find(a => a.name === activity.agent_name);
      
      newMessages.push({
        id: activity.id || `msg-${index}`,
        agentName: activity.agent_name || 'Agent',
        agentAvatarUrl: agentData?.avatar_url,
        content,
        type,
        timestamp: new Date(activity.created_at),
      });
    });
    
    newMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setMessages(newMessages);
  }, [activities, agents]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = 0;
  }, [messages]);

  const getTypeStyle = (type: ChatMessage['type'], content: string) => {
    const isBuy = content.toLowerCase().includes('bought');
    const isSell = content.toLowerCase().includes('sold');
    const isCreate = content.toLowerCase().includes('created');
    
    if (isBuy) return { color: '#6FCF97', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 8V2M2 5L5 2L8 5" stroke="#6FCF97" strokeWidth="1.5" fill="none"/></svg> };
    if (isSell) return { color: '#E08080', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2V8M2 5L5 8L8 5" stroke="#E08080" strokeWidth="1.5" fill="none"/></svg> };
    if (isCreate) return { color: '#D4A853', icon: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2V8M2 5H8" stroke="#D4A853" strokeWidth="1.5"/></svg> };
    return { color: '#70B8E0', icon: <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" fill="#70B8E0"/></svg> };
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
            {messages.length > 10 && `+${messages.length - 10} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <CrabBouncing /> <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Agent Activity</h3>
          <div className="flex items-center gap-2">
            <span className="text-[8px]" style={{ color: '#555' }}>{messages.length} events</span>
            <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399' }} />
              LIVE
            </span>
          </div>
        </div>
        
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>Waiting for activity...</p>
          </div>
        ) : (
          <div ref={chatRef} className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {messages.slice(0, 10).map((msg) => (
              <ChatMessageItem key={msg.id} msg={msg} getTypeStyle={getTypeStyle} compact />
            ))}
          </div>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Agent Activity Log"
          subtitle={`${messages.length} total events`}
          badge={
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
              LIVE
            </span>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="space-y-2">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} msg={msg} getTypeStyle={getTypeStyle} compact={false} />
            ))}
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#666' }}>No activity yet</p>
              </div>
            )}
          </div>
        </ExpandedModal>
      )}
    </>
  );
}

function ChatMessageItem({ msg, getTypeStyle, compact }: { 
  msg: ChatMessage; 
  getTypeStyle: (type: ChatMessage['type'], content: string) => { color: string; icon: JSX.Element };
  compact: boolean;
}) {
  const style = getTypeStyle(msg.type, msg.content);

  if (compact) {
    return (
      <div className="p-2 rounded-lg"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
        <div className="flex gap-2">
          <AgentAvatar name={msg.agentName} size={22} isOnline={true} showBorder={false} avatarUrl={msg.agentAvatarUrl} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-medium text-[10px]" style={{ color: '#E5E5E7' }}>{msg.agentName}</span>
              <span className="text-[8px]" style={{ color: '#404040' }}>{formatTime(msg.timestamp)}</span>
              <span>{style.icon}</span>
            </div>
            <p className="text-[9px] truncate" style={{ color: '#707070' }}>{msg.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="p-4 rounded-xl"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex gap-3">
        <AgentAvatar name={msg.agentName} size={40} isOnline={true} showBorder={true} avatarUrl={msg.agentAvatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{msg.agentName}</span>
            <span className="text-xs" style={{ color: '#505050' }}>{formatTime(msg.timestamp)}</span>
            <span className="p-1 rounded" style={{ background: `${style.color}15` }}>{style.icon}</span>
          </div>
          <p className="text-sm" style={{ color: '#888' }}>{msg.content}</p>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return date.toLocaleDateString();
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
