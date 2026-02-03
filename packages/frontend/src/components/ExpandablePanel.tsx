'use client';

import { useState, ReactNode, useEffect } from 'react';

interface ExpandablePanelProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  expandedContent?: ReactNode;
  className?: string;
}

export function ExpandablePanel({ 
  title, 
  subtitle,
  badge,
  children, 
  expandedContent,
  className = ''
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isExpanded]);

  return (
    <>
      {/* Collapsed Panel */}
      <section 
        className={`flex flex-col h-full rounded-2xl cursor-pointer transition-all hover:scale-[1.005] group ${className}`}
        style={{ 
          background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.5)'
        }}
        onClick={() => setIsExpanded(true)}
      >
        {/* Expand hint */}
        <div 
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <div 
            className="flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#888' }}
          >
            <ExpandIcon />
            Click to expand
          </div>
        </div>
        
        <div className="relative p-4 h-full flex flex-col">
          {children}
        </div>
      </section>

      {/* Expanded Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ 
            background: 'rgba(0, 0, 0, 0.95)', 
            backdropFilter: 'blur(12px)' 
          }}
          onClick={() => setIsExpanded(false)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ 
              background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 48px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <h2 
                  className="text-lg font-semibold"
                  style={{ color: '#E5E5E7' }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {badge}
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {expandedContent || children}
            </div>

            {/* Footer hint */}
            <div 
              className="px-6 py-3 text-center flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <p className="text-[10px]" style={{ color: '#444' }}>
                Press ESC or click outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ExpandIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 4V1H4M6 1H9V4M9 6V9H6M4 9H1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Hook for panels to know if they should show full or limited content
export function usePanelExpanded() {
  // This can be enhanced with context if needed
  return { isExpanded: false };
}
