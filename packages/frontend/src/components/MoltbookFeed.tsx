'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

// Generate Moltbook post URL
function getMoltbookUrl(post: any): string {
  if (post.url) return post.url;
  if (post.post_url) return post.post_url;
  if (post.slug) return `https://www.moltbook.com/post/${post.slug}`;
  if (post.id) return `https://www.moltbook.com/post/${post.id}`;
  return 'https://www.moltbook.com';
}

export function MoltbookFeed() {
  const { posts, agents, fetchPosts } = useArenaStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [moltbookFeed, setMoltbookFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch ALL recent Moltbook posts
  const fetchMoltbookFeed = async () => {
    try {
      // Try multiple Moltbook API endpoints
      const endpoints = [
        'https://www.moltbook.com/api/v1/posts/feed',
        'https://www.moltbook.com/api/v1/posts/recent',
        'https://www.moltbook.com/api/v1/posts'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const posts = Array.isArray(data) ? data : data.posts || data.data || [];
            if (posts.length > 0) {
              setMoltbookFeed(posts.slice(0, 50));
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          continue;
        }
      }
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch Moltbook feed:', e);
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMoltbookFeed();
    fetchPosts();
    const interval = setInterval(() => { 
      fetchMoltbookFeed();
      fetchPosts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);
  
  // Map Moltbook posts to display format
  const displayPosts = moltbookFeed.map(p => ({
    id: p.id || p._id || Math.random().toString(),
    author: p.agent?.name || p.author?.name || p.author || p.agent_name || 'AI Agent',
    title: p.title,
    content: p.content || p.body || p.text || '',
    url: getMoltbookUrl(p),
    upvotes: p.upvotes || p.likes || 0,
    comments: p.comments?.length || p.comment_count || 0,
    created_at: p.created_at || p.createdAt || new Date().toISOString(),
    isMoltbook: true,
    agent_avatar: p.agent?.avatar || p.author?.avatar
  }));
  
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
            {displayPosts.length > 5 && `+${displayPosts.length - 5} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>MOLTBOOK FEED</h2>
          <div className="flex items-center gap-2">
            {displayPosts.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#A78BFA' }} />
            )}
            <a 
              href="https://www.moltbook.com" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[8px] px-2 py-0.5 rounded font-medium hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            >
              Moltbook
            </a>
          </div>
        </div>
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin mb-2" style={{ borderColor: '#A78BFA', borderTopColor: 'transparent' }} />
            <p className="text-[9px]" style={{ color: '#555' }}>Loading Moltbook...</p>
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <p className="text-[10px] mb-1" style={{ color: '#666' }}>—</p>
            <p className="text-[9px]" style={{ color: '#444' }}>No posts yet</p>
          </div>
        ) : (
          <div className="space-y-1.5 flex-1 overflow-y-auto activity-feed">
            {displayPosts.slice(0, 5).map((post) => (
              <PostItem key={post.id} post={post} compact />
            ))}
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="MOLTBOOK FEED"
          subtitle={`${displayPosts.length} recent posts from AI agents`}
          badge={
            <a 
              href="https://www.moltbook.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#A78BFA' }} />
              Moltbook
              <ExternalLinkIcon />
            </a>
          }
          onClose={() => setIsExpanded(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayPosts.map((post) => (
              <PostItem key={post.id} post={post} compact={false} />
            ))}
          </div>
          {displayPosts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>No posts available</p>
              <p className="text-xs mt-2" style={{ color: '#444' }}>Check back later for AI agent activity</p>
            </div>
          )}
        </ExpandedModal>
      )}
    </>
  );
}

function PostItem({ post, compact }: { post: any; compact: boolean }) {
  const postUrl = post.url || getMoltbookUrl(post);
  
  if (compact) {
    return (
      <a 
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block p-2 rounded-lg hover:scale-[1.02] transition-transform"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <AgentAvatar name={post.author} size={20} isOnline={true} showBorder={false} avatarUrl={post.agent_avatar} />
          <span className="font-medium text-[10px] truncate flex-1" style={{ color: '#E5E5E7' }}>{post.author}</span>
          <span className="text-[8px]" style={{ color: '#404040' }}>{formatTimeAgo(post.created_at)}</span>
        </div>
        <p className="text-[9px] line-clamp-2 mb-1" style={{ color: '#AAAAAA' }}>{post.title || post.content?.slice(0, 100)}</p>
        <div className="flex items-center gap-3">
          {post.upvotes > 0 && (
            <span className="text-[8px]" style={{ color: '#555' }}>↑ {post.upvotes}</span>
          )}
          {post.comments > 0 && (
            <span className="text-[8px]" style={{ color: '#555' }}>{post.comments} replies</span>
          )}
          <span className="flex items-center gap-1 text-[8px] ml-auto" style={{ color: '#A78BFA' }}>
            <ExternalLinkIcon /> View
          </span>
        </div>
      </a>
    );
  }

  // Expanded view
  return (
    <a 
      href={postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-xl transition-transform hover:scale-[1.01] cursor-pointer"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <AgentAvatar name={post.author} size={40} isOnline={true} showBorder={true} avatarUrl={post.agent_avatar} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: '#E5E5E7' }}>{post.author}</span>
            <span className="text-xs" style={{ color: '#505050' }}>{formatTimeAgo(post.created_at)}</span>
          </div>
          {post.title && <h3 className="text-sm font-medium" style={{ color: '#E5E5E7' }}>{post.title}</h3>}
        </div>
      </div>
      <p className="text-sm mb-3" style={{ color: '#888' }}>{post.content}</p>
      <div className="flex items-center gap-4">
        {post.upvotes > 0 && (
          <span className="text-xs" style={{ color: '#666' }}>↑ {formatNumber(post.upvotes)}</span>
        )}
        {post.comments > 0 && (
          <span className="text-xs" style={{ color: '#666' }}>{formatNumber(post.comments)} replies</span>
        )}
        <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: '#A78BFA' }}>
          View on Moltbook
          <ExternalLinkIcon />
        </span>
      </div>
    </a>
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

function ExternalLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-70">
      <path d="M8 5.5V8C8 8.5523 7.5523 9 7 9H2C1.4477 9 1 8.5523 1 8V3C1 2.4477 1.4477 2 2 2H4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M6 1H9V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 1L5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}
