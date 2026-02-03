'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div 
          className="flex flex-col items-center justify-center p-8 rounded-xl"
          style={{ 
            background: '#0A0A0A', 
            border: '1px solid #1A1A1A' 
          }}
        >
          <div className="text-3xl mb-4 opacity-50">⚠</div>
          <h3 className="text-base font-semibold mb-2" style={{ color: '#FFFFFF' }}>
            Something went wrong
          </h3>
          <p className="text-sm mb-4 text-center" style={{ color: '#606060' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ 
              background: '#FFFFFF', 
              color: '#000000',
              boxShadow: '0 0 20px rgba(255,255,255,0.2)'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Connection status component
export function ConnectionStatus() {
  const [status, setStatus] = React.useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/health`);
        setStatus(res.ok ? 'connected' : 'disconnected');
      } catch {
        setStatus('disconnected');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (status === 'checking') return null;
  
  if (status === 'disconnected') {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl flex items-center gap-3"
        style={{ 
          background: 'rgba(255,255,255,0.05)', 
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 0 30px rgba(255,255,255,0.05)'
        }}
      >
        <div 
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#FFFFFF', boxShadow: '0 0 8px #FFFFFF' }}
        />
        <span className="text-sm" style={{ color: '#FFFFFF' }}>Server disconnected</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs underline hover:no-underline"
          style={{ color: '#808080' }}
        >
          Retry
        </button>
      </div>
    );
  }
  
  return null;
}

// Error alert component
export function ErrorAlert({ 
  message, 
  onRetry, 
  onDismiss 
}: { 
  message: string; 
  onRetry?: () => void; 
  onDismiss?: () => void;
}) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ 
        background: 'rgba(255,255,255,0.03)', 
        border: '1px solid rgba(255,255,255,0.1)' 
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-lg opacity-50">⚠</div>
        <div className="flex-1">
          <p className="text-sm" style={{ color: '#FFFFFF' }}>{message}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1 rounded-lg transition-colors"
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1 transition-colors"
              style={{ color: '#606060' }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading skeleton component
export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'rgba(255,255,255,0.05)' }}
    />
  );
}

// Empty state component
export function EmptyState({ 
  icon = '◇', 
  title, 
  description 
}: { 
  icon?: string; 
  title: string; 
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-3xl mb-3 opacity-30">{icon}</div>
      <h4 className="text-sm font-medium mb-1" style={{ color: '#808080' }}>{title}</h4>
      {description && (
        <p className="text-xs" style={{ color: '#505050' }}>{description}</p>
      )}
    </div>
  );
}
