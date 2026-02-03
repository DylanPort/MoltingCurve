'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useState } from 'react';
import { CrabDancing } from './AnimatedCrabs';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

type Category = 'all' | 'crypto' | 'politics' | 'general' | 'tech';

const categoryColors: Record<Category, string> = {
  all: '#888',
  crypto: '#6FCF97',
  politics: '#E08080',
  general: '#70B8E0',
  tech: '#9B8FD0',
};

export function NewsFeed() {
  const { news, fetchNews } = useArenaStore();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => { fetchNews(); }, 120000);
    return () => clearInterval(interval);
  }, [fetchNews]);
  
  const categories: Category[] = ['all', 'crypto', 'politics', 'general', 'tech'];
  const filteredNews = activeCategory === 'all' ? news : news.filter(item => item.category === activeCategory);

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
            {filteredNews.length > 5 && `+${filteredNews.length - 5} more`}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <CrabDancing /> <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#6A6A6C' }}>News</h2>
          <span className="flex items-center gap-1.5 text-[8px] px-2 py-0.5 rounded font-medium"
            style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#6FCF97', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#6FCF97' }} />
            LIVE
          </span>
        </div>

        {/* Categories */}
        <div className="flex gap-1 mb-3 flex-wrap flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {categories.map(cat => {
            const isActive = activeCategory === cat;
            const color = categoryColors[cat];
            return (
              <button key={cat} onClick={(e) => { e.stopPropagation(); setActiveCategory(cat); }}
                className="text-[8px] px-2 py-1 rounded transition-all capitalize"
                style={{ background: isActive ? `${color}20` : 'rgba(255,255,255,0.03)', color: isActive ? color : '#555', border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.04)'}` }}>
                {cat}
              </button>
            );
          })}
        </div>
        
        {filteredNews.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px]" style={{ color: '#444' }}>No news</p>
          </div>
        ) : (
          <div className="space-y-1.5 flex-1 overflow-y-auto activity-feed">
            {filteredNews.slice(0, 5).map((item, index) => (
              <NewsItem key={item.id || index} item={item} compact />
            ))}
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <ExpandedModal
          title="News Feed"
          subtitle={`${filteredNews.length} articles`}
          badge={
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded font-medium"
              style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#6FCF97' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#6FCF97' }} />
              LIVE
            </span>
          }
          onClose={() => setIsExpanded(false)}
        >
          {/* Categories in expanded view */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              const color = categoryColors[cat];
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="text-xs px-3 py-1.5 rounded transition-all capitalize"
                  style={{ background: isActive ? `${color}25` : 'rgba(255,255,255,0.05)', color: isActive ? color : '#888', border: `1px solid ${isActive ? `${color}50` : 'rgba(255,255,255,0.06)'}` }}>
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNews.map((item, index) => (
              <NewsItem key={item.id || index} item={item} compact={false} />
            ))}
          </div>
          {filteredNews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#666' }}>No news articles in this category</p>
            </div>
          )}
        </ExpandedModal>
      )}
    </>
  );
}

function NewsItem({ item, compact }: { item: any; compact: boolean }) {
  const catColor = categoryColors[item.category as Category] || '#FBBF24';

  if (compact) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        className="block p-2 rounded-lg transition-all hover:scale-[1.01]"
        style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex gap-2">
          {item.image_url && (
            <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <img src={item.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[10px] font-medium line-clamp-2 mb-1" style={{ color: '#E5E5E7' }}>{item.title}</h3>
            <div className="flex items-center gap-2 text-[8px]" style={{ color: '#505050' }}>
              <span className="truncate">{item.source}</span>
              <span>·</span>
              <span>{formatTimeAgo(item.published_at || item.created_at)}</span>
              <span className="px-1 py-0.5 rounded capitalize" style={{ background: `${catColor}15`, color: catColor }}>{item.category}</span>
            </div>
          </div>
        </div>
      </a>
    );
  }

  // Expanded view
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block p-4 rounded-xl transition-all hover:scale-[1.01] hover:bg-white/[0.02]"
      style={{ background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex gap-4">
        {item.image_url && (
          <div className="w-24 h-24 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <img src={item.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-2 line-clamp-2" style={{ color: '#E5E5E7' }}>{item.title}</h3>
          {item.description && (
            <p className="text-xs mb-3 line-clamp-2" style={{ color: '#888' }}>{item.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs" style={{ color: '#606060' }}>
            <span className="font-medium">{item.source}</span>
            <span>·</span>
            <span>{formatTimeAgo(item.published_at || item.created_at)}</span>
            <span className="px-2 py-0.5 rounded capitalize text-[10px]" style={{ background: `${catColor}20`, color: catColor }}>{item.category}</span>
          </div>
        </div>
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
