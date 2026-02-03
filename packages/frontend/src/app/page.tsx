'use client';

import { useEffect, useState } from 'react';
import { HumanObserverGuide } from '@/components/HumanObserverGuide';
import { ArenaOverview } from '@/components/ArenaOverview';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { NetworkActivity } from '@/components/NetworkActivity';
import { ActiveAgents } from '@/components/ActiveAgents';
import { TopTokens } from '@/components/TopTokens';
import { MoltbookFeed } from '@/components/MoltbookFeed';
import { AgentLogsPanel } from '@/components/AgentLogsPanel';
import { NewsFeed } from '@/components/NewsFeed';
import { SponsorBanner } from '@/components/SponsorBanner';
import { AgentStatusTracker } from '@/components/AgentStatusTracker';
import { TradingLeaderboard } from '@/components/TradingLeaderboard';
import { AgentChat } from '@/components/AgentChat';
import { MoltbookShillTracker } from '@/components/MoltbookShillTracker';
import { TokenPerformance } from '@/components/TokenPerformance';
import { AgentJourney } from '@/components/AgentJourney';
import { UnifiedActivityFeed } from '@/components/UnifiedActivityFeed';
import { ErrorBoundary, ConnectionStatus, ErrorAlert } from '@/components/ErrorBoundary';
import { MobileDashboard } from '@/components/MobileDashboard';
import { EasyModeDashboard, LiveEventManager } from '@/components/EasyModeDashboard';
import { NarratorPanel } from '@/components/NarratorPanel';
import { useArenaStore } from '@/store/arena';

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function LoadingOverlay() {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(10px)' }}
    >
      <div className="text-center">
        <div 
          className="w-10 h-10 rounded-full animate-spin mx-auto mb-4"
          style={{ 
            border: '2px solid #1A1A1A',
            borderTopColor: '#FFFFFF'
          }}
        />
        <p className="text-sm" style={{ color: '#606060' }}>Loading Arena...</p>
      </div>
    </div>
  );
}

function DesktopDashboard() {
  const { connect, disconnect, isLoading, error, retry, clearError, wsStatus, viewMode } = useArenaStore();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className={viewMode === 'easy' ? 'h-screen overflow-hidden' : 'min-h-screen'} style={{ background: '#000000' }}>
      
      {/* Loading State */}
      {isLoading && <LoadingOverlay />}
      
      {/* Error Banner */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-4 pt-4">
          <ErrorAlert 
            message={error} 
            onRetry={retry}
            onDismiss={clearError}
          />
        </div>
      )}
      
      {/* WebSocket Status */}
      {wsStatus === 'connecting' && (
        <div className="max-w-[1800px] mx-auto px-4 pt-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#606060' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FFFFFF' }} />
            Connecting to live feed...
          </div>
        </div>
      )}
      
      <main className="max-w-[1800px] mx-auto px-4 py-3 space-y-3">
        
        {/* Human Observer Guide */}
        <ErrorBoundary fallback={<CardError title="Guide" />}>
          <HumanObserverGuide />
        </ErrorBoundary>
        
        {/* Arena Overview */}
        <ErrorBoundary fallback={<CardError title="Overview" />}>
          <ArenaOverview />
        </ErrorBoundary>
        
        {/* EASY MODE - Stream-friendly single view */}
        {viewMode === 'easy' && (
          <ErrorBoundary fallback={<CardError title="Easy Mode" />}>
            <EasyModeDashboard />
          </ErrorBoundary>
        )}
        
        {/* PRO MODE - Full dashboard with all panels */}
        {viewMode === 'pro' && (
          <>
            {/* Live Event Overlays - Same as Easy Mode */}
            <LiveEventManager />
            
            {/* Arena Narrator - Top Panel */}
            <ErrorBoundary fallback={<CardError title="Narrator" />}>
              <NarratorPanel />
            </ErrorBoundary>
            
            {/* Unified Activity Feed */}
            <ErrorBoundary fallback={<CardError title="Activity Feed" />}>
              <UnifiedActivityFeed />
            </ErrorBoundary>
            
            {/* ROW 1: Agent Activity & Status */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Agent Status" />}>
                  <AgentStatusTracker />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Active Agents" />}>
                  <ActiveAgents />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Agent Chat" />}>
                  <AgentChat />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Agent Journey" />}>
                  <AgentJourney />
                </ErrorBoundary>
              </div>
            </div>
            
            {/* ROW 2: Trading & Tokens */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Live Activity" />}>
                  <LiveActivityFeed />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Leaderboard" />}>
                  <TradingLeaderboard />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Top Tokens" />}>
                  <TopTokens />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Token Performance" />}>
                  <TokenPerformance />
                </ErrorBoundary>
              </div>
            </div>
            
            {/* ROW 3: Logs, Social & News */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Agent Logs" />}>
                  <AgentLogsPanel />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Moltbook" />}>
                  <MoltbookFeed />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="News" />}>
                  <NewsFeed />
                </ErrorBoundary>
              </div>
              <div className="h-[280px]">
                <ErrorBoundary fallback={<CardError title="Network" />}>
                  <NetworkActivity />
                </ErrorBoundary>
              </div>
            </div>
            
            {/* Sponsor Banner */}
            <ErrorBoundary fallback={<div />}>
              <SponsorBanner />
            </ErrorBoundary>
          </>
        )}
      </main>
      
      {/* Connection Status Toast */}
      <ConnectionStatus />
    </div>
  );
}

function CardError({ title }: { title: string }) {
  return (
    <div 
      className="h-full p-6 text-center rounded-2xl flex flex-col items-center justify-center"
      style={{ 
        background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
        border: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-2 opacity-40">
        <path d="M12 9V13M12 17H12.01M12 3L2 21H22L12 3Z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="text-sm" style={{ color: '#505050' }}>Failed to load {title}</p>
      <button 
        onClick={() => window.location.reload()}
        className="text-xs underline hover:no-underline mt-2"
        style={{ color: '#444' }}
      >
        Reload
      </button>
    </div>
  );
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading until mounted to prevent flash
  if (!mounted) {
    return <LoadingOverlay />;
  }

  return (
    <ErrorBoundary>
      {isMobile ? <MobileDashboard /> : <DesktopDashboard />}
    </ErrorBoundary>
  );
}
