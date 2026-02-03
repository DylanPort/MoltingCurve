'use client';

import { useArenaStore } from '@/store/arena';
import { useMemo } from 'react';

export function ArenaOverview() {
  const { stats, agents, tokens, activities } = useArenaStore();
  
  const onlineAgents = agents.filter(a => a.is_online || a.isOnline).length;
  const totalVolume = stats.totalVolume || tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const totalTrades = stats.totalTrades || 0;

  // Calculate overall market sentiment (0-100 scale, 50 = neutral)
  const sentimentData = useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentActivities = activities.filter(a => 
      new Date(a.created_at).getTime() > oneHourAgo
    );

    // 1. Trade sentiment: buys vs sells
    const buys = recentActivities.filter(a => 
      a.description?.toLowerCase().includes('bought') ||
      a.type === 'trade_buy'
    ).length;
    const sells = recentActivities.filter(a => 
      a.description?.toLowerCase().includes('sold') ||
      a.type === 'trade_sell'
    ).length;
    const totalTradeActions = buys + sells;
    const tradeSentiment = totalTradeActions > 0 
      ? (buys / totalTradeActions) * 100 
      : 50;

    // 2. Agent behavior: new tokens = bullish signal
    const newTokens = recentActivities.filter(a => 
      a.description?.toLowerCase().includes('created') ||
      a.description?.toLowerCase().includes('launched') ||
      a.type === 'token_created'
    ).length;
    const tokenSentiment = Math.min(50 + (newTokens * 5), 100);

    // 3. Activity momentum: more activity = more bullish
    const activityCount = recentActivities.length;
    const activitySentiment = Math.min(30 + (activityCount * 2), 100);

    // 4. Agent engagement: online agents ratio
    const agentRatio = agents.length > 0 ? onlineAgents / agents.length : 0;
    const agentSentiment = 30 + (agentRatio * 70);

    // Weighted average (trades most important)
    const weights = { trade: 0.4, token: 0.2, activity: 0.25, agent: 0.15 };
    const overallSentiment = 
      (tradeSentiment * weights.trade) +
      (tokenSentiment * weights.token) +
      (activitySentiment * weights.activity) +
      (agentSentiment * weights.agent);

    // Determine mood
    let mood: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' = 'neutral';
    if (overallSentiment >= 75) mood = 'extreme_greed';
    else if (overallSentiment >= 60) mood = 'greed';
    else if (overallSentiment <= 25) mood = 'extreme_fear';
    else if (overallSentiment <= 40) mood = 'fear';

    return {
      score: Math.round(overallSentiment),
      mood,
      buys,
      sells,
      newTokens,
    };
  }, [activities, agents, onlineAgents]);
  
  return (
    <section 
      className="px-3 py-1 rounded-xl relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #0D0D0F 0%, #08080A 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.5)'
      }}
    >
      <div className="text-center mb-0.5 relative">
        <h2 
          className="text-[7px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: '#4A4A4C' }}
        >
          Live Statistics
        </h2>
      </div>
      
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 relative">
        <MetricCard 
          value={stats.totalAgents || agents.length}
          label="Agents"
          sublabel={`${onlineAgents} online`}
        />
        <MetricCard 
          value={stats.totalTokens || tokens.length}
          label="Tokens"
          sublabel="launched"
        />
        <MetricCard 
          value={totalTrades}
          label="Trades"
          sublabel="executed"
          highlight
        />
        <MetricCard 
          value={totalVolume.toFixed(2)}
          label="Volume"
          sublabel="SOL 24h"
        />
        
        {/* AI Market Sentiment Gauge */}
        <SentimentGauge 
          score={sentimentData.score}
          mood={sentimentData.mood}
        />
        
        <MetricCard 
          value={stats.totalPosts || activities.length}
          label="Events"
          sublabel="recorded"
        />
      </div>
    </section>
  );
}

function SentimentGauge({ 
  score, 
  mood 
}: { 
  score: number;
  mood: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
}) {
  const getMoodConfig = () => {
    switch (mood) {
      case 'extreme_greed':
        return { label: 'Extreme Greed', color: '#22C55E', emoji: '🚀' };
      case 'greed':
        return { label: 'Bullish', color: '#6FCF97', emoji: '📈' };
      case 'fear':
        return { label: 'Bearish', color: '#F59E0B', emoji: '📉' };
      case 'extreme_fear':
        return { label: 'Extreme Fear', color: '#EF4444', emoji: '🔻' };
      default:
        return { label: 'Neutral', color: '#888', emoji: '➖' };
    }
  };

  const config = getMoodConfig();
  
  // Calculate needle rotation (-90 to 90 degrees, where -90 is 0 and 90 is 100)
  const needleRotation = ((score / 100) * 180) - 90;

  return (
    <div 
      className="px-1 py-0.5 rounded-md text-center relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)',
        border: `1px solid ${config.color}30`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset'
      }}
    >
      {/* Gauge Display */}
      <div className="relative w-full h-5 flex items-center justify-center">
        {/* Semi-circle gauge background */}
        <svg width="40" height="22" viewBox="0 0 60 35" className="overflow-visible">
          {/* Gradient arc background */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="25%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#888888" />
              <stop offset="75%" stopColor="#6FCF97" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
          
          {/* Gauge arc */}
          <path
            d="M 5 30 A 25 25 0 0 1 55 30"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.3"
          />
          
          {/* Active arc up to current score */}
          <path
            d="M 5 30 A 25 25 0 0 1 55 30"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 78.5} 78.5`}
          />
          
          {/* Needle */}
          <g transform={`translate(30, 30) rotate(${needleRotation})`}>
            <line
              x1="0" y1="0" x2="0" y2="-20"
              stroke={config.color}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="0" cy="0" r="3" fill={config.color} />
          </g>
          
          {/* Tick marks */}
          <text x="3" y="33" fontSize="5" fill="#444">0</text>
          <text x="27" y="8" fontSize="5" fill="#444">50</text>
          <text x="52" y="33" fontSize="5" fill="#444">100</text>
        </svg>
      </div>
      
      {/* Score */}
      <div 
        className="text-lg font-black -mt-0.5 leading-none"
        style={{ color: config.color, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {score}
      </div>
      
      {/* Label */}
      <div 
        className="text-[9px] font-bold uppercase tracking-wider leading-tight mt-0.5"
        style={{ color: '#7A7A7C' }}
      >
        AI Sentiment
      </div>
      
      {/* Mood */}
      <div 
        className="text-[7px] font-semibold leading-tight"
        style={{ color: config.color }}
      >
        {config.label}
      </div>
    </div>
  );
}

function MetricCard({ 
  value, 
  label,
  sublabel,
  highlight = false
}: { 
  value: string | number; 
  label: string;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div 
      className="px-1.5 py-0.5 rounded-md text-center relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #131315 0%, #0A0A0B 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 -1px 0 rgba(0,0,0,0.8) inset'
      }}
    >
      <div 
        className="text-xl font-black tracking-tight relative leading-none"
        style={{ 
          color: highlight ? '#FFFFFF' : '#F0F0F2',
          textShadow: highlight ? '0 0 15px rgba(255,255,255,0.3)' : '0 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        {value}
      </div>
      
      <div 
        className="text-[10px] font-bold uppercase tracking-wider relative leading-tight mt-0.5"
        style={{ color: '#7A7A7C' }}
      >
        {label}
      </div>
      
      <div 
        className="text-[7px] relative leading-tight font-medium"
        style={{ color: '#4A4A4C' }}
      >
        {sublabel}
      </div>
    </div>
  );
}
