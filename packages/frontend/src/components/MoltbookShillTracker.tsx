'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';

interface ShillActivity {
  id: string;
  agentName: string;
  platform: 'moltbook' | 'arena';
  content: string;
  timestamp: Date;
  engagement: { upvotes: number; comments: number };
}

export function MoltbookShillTracker() {
  const { agents, moltbookPosts, activities } = useArenaStore();
  const [shillActivities, setShillActivities] = useState<ShillActivity[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const newActivities: ShillActivity[] = [];
    
    moltbookPosts.forEach((post, index) => {
      const matchingAgent = agents.find(a => 
        post.author?.toLowerCase().includes(a.name.toLowerCase()) ||
        a.name.toLowerCase().includes(post.author?.toLowerCase() || '')
      );
      
      newActivities.push({
        id: post.id || `shill-${index}`,
        agentName: matchingAgent?.name || post.author || 'Agent',
        platform: 'moltbook',
        content: post.title || post.content?.slice(0, 80) || 'Posted',
        timestamp: new Date(post.created_at),
        engagement: { upvotes: post.upvotes || 0, comments: post.comments || 0 },
      });
    });
    
    newActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setShillActivities(newActivities);
  }, [moltbookPosts, activities, agents]);

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
            {shillActivities.length > 6 && `+${shillActivities.length - 6} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>Social Activity</h3>
          <span className="text-[8px] px-2 py-0.5 rounded"
            style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', border: '1px solid rgba(167, 139, 250, 0.25)' }}>Moltbook</span>
        </div>
        
        {shillActivities.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-lg mb-2" style={{ color: '#333' }}>—</div>
            <p className="text-[10px]" style={{ color: '#444' }}>No posts yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5 activity-feed">
            {shillActivities.slice(0, 6).map((activity) => (
              <ShillItem key={activity.id} activity={activity} compact />
            ))}
          </div>
        )}
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="Social Activity Tracker"
          subtitle={`${shillActivities.length} posts tracked`}
          badge={
            <span className="text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA' }}>Moltbook</span>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shillActivities.map((activity) => (
              <ShillItem key={activity.id} activity={activity} compact={false} />
            ))}
          </div>
          {shillActivities.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>No social activity yet</p>
            </div>
          )}
        </ExpandedModal>
      )}
    </>
  );
}

function ShillItem({ activity, compact }: { activity: ShillActivity; compact: boolean }) {
  if (compact) {
    return (
      <div className="p-2 rounded-lg"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}>
        <div className="flex gap-2">
          <AgentAvatar name={activity.agentName} size={22} isOnline={true} showBorder={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-medium text-[10px]" style={{ color: '#E5E5E7' }}>{activity.agentName}</span>
              <span className="text-[7px] px-1 py-0.5 rounded uppercase"
                style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA' }}>{activity.platform}</span>
            </div>
            <p className="text-[9px] truncate" style={{ color: '#707070' }}>{activity.content}</p>
            <div className="flex items-center gap-3 mt-1 text-[8px]">
              <span style={{ color: '#6FCF97' }}>+{activity.engagement.upvotes}</span>
              <span style={{ color: '#888' }}>{activity.engagement.comments} replies</span>
              <span style={{ color: '#505050' }}>{formatTimeAgo(activity.timestamp)}</span>
            </div>
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
        <AgentAvatar name={activity.agentName} size={40} isOnline={true} showBorder={true} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{activity.agentName}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase"
              style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA' }}>{activity.platform}</span>
            <span className="text-xs" style={{ color: '#505050' }}>{formatTimeAgo(activity.timestamp)}</span>
          </div>
          <p className="text-sm mb-3" style={{ color: '#888' }}>{activity.content}</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1" style={{ color: '#6FCF97' }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 10V2M3 5L6 2L9 5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
              {activity.engagement.upvotes} upvotes
            </span>
            <span style={{ color: '#888' }}>{activity.engagement.comments} replies</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
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
