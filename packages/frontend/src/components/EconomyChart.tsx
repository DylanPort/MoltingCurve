'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface EconomicSnapshot {
  timestamp: string;
  totalMarketCap: number;
  totalVolume24h: number;
  totalTrades: number;
  totalAgents: number;
  onlineAgents: number;
  totalTokens: number;
  avgTokenPrice: number;
  tradeVelocity: number;
  buyPressure: number;
}

export function EconomyChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [current, setCurrent] = useState<EconomicSnapshot | null>(null);
  const [prevValues, setPrevValues] = useState<Partial<EconomicSnapshot>>({});
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3002/api/economy/history?limit=1');
      if (res.ok) {
        const data = await res.json();
        if (data.current) {
          setPrevValues(current || {});
          setCurrent(data.current);
        }
      }
    } catch (e) {
      console.error('Failed to fetch economy data:', e);
    }
  }, [current]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const connect = () => {
      ws = new WebSocket('ws://localhost:3002/ws');
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'economic_update') {
            setPrevValues(current || {});
            setCurrent(msg.data);
          }
        } catch (e) {}
      };
      
      ws.onclose = () => setTimeout(connect, 3000);
    };
    
    connect();
    return () => ws?.close();
  }, [current]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Particle system for ambient effect
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      maxLife: number;
      color: string;
    }

    const particles: Particle[] = [];
    const maxParticles = 50;

    const colors = ['#38BDF8', '#34D399', '#A78BFA', '#FBBF24', '#F87171'];

    const spawnParticle = (x: number, y: number, color: string) => {
      if (particles.length < maxParticles) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 2 - 1,
          size: Math.random() * 3 + 1,
          life: 1,
          maxLife: 60 + Math.random() * 60,
          color
        });
      }
    };

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Dark background with subtle gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a0a0f');
      bgGradient.addColorStop(1, '#050508');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        const alpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${alpha * 0.6})`).replace('rgb', 'rgba');
        ctx.fill();

        if (p.life <= 0) particles.splice(i, 1);
      }

      if (!current) {
        // Loading state
        ctx.fillStyle = '#404040';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting economic data...', width / 2, height / 2);
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const centerX = width / 2;
      const centerY = height / 2;

      // === CENTRAL PULSE - Market Health ===
      const healthScore = Math.min(100, (current.buyPressure + (current.tradeVelocity * 10)) / 2);
      const pulseSize = 60 + Math.sin(t * 3) * 8;
      const healthColor = healthScore > 60 ? '#34D399' : healthScore > 40 ? '#FBBF24' : '#F87171';

      // Outer glow rings
      for (let i = 3; i >= 0; i--) {
        const ringSize = pulseSize + i * 25 + Math.sin(t * 2 + i) * 5;
        const ringAlpha = 0.05 - i * 0.01;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringSize, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${ringAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Central pulse orb
      const pulseGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize);
      pulseGradient.addColorStop(0, healthColor);
      pulseGradient.addColorStop(0.4, healthColor.replace(')', ', 0.4)').replace('rgb', 'rgba').replace('#', 'rgba(').replace(/([A-Fa-f0-9]{2})([A-Fa-f0-9]{2})([A-Fa-f0-9]{2})/, (_, r, g, b) => `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`));
      pulseGradient.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = pulseGradient;
      ctx.fill();

      // Spawn particles from center occasionally
      if (Math.random() < 0.1) {
        spawnParticle(centerX + (Math.random() - 0.5) * 30, centerY + (Math.random() - 0.5) * 30, healthColor);
      }

      // === ORBITAL METRICS ===
      const metrics = [
        { label: 'MARKET CAP', value: current.totalMarketCap, max: 5000, unit: 'SOL', color: '#38BDF8', angle: 0 },
        { label: 'VOLUME', value: current.totalVolume24h, max: 100, unit: 'SOL', color: '#34D399', angle: Math.PI * 0.5 },
        { label: 'TRADES', value: current.totalTrades, max: 1000, unit: '', color: '#A78BFA', angle: Math.PI },
        { label: 'VELOCITY', value: current.tradeVelocity, max: 10, unit: '/m', color: '#FBBF24', angle: Math.PI * 1.5 },
      ];

      const orbitRadius = Math.min(width, height) * 0.32;

      metrics.forEach((metric, i) => {
        const angle = metric.angle + t * 0.1;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius * 0.6; // Elliptical orbit

        // Connection line to center
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `${metric.color}20`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Metric node
        const nodeSize = 35;
        const fillPercent = Math.min(1, metric.value / metric.max);

        // Background circle
        ctx.beginPath();
        ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
        ctx.strokeStyle = `${metric.color}40`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Progress arc
        ctx.beginPath();
        ctx.arc(x, y, nodeSize - 4, -Math.PI / 2, -Math.PI / 2 + fillPercent * Math.PI * 2);
        ctx.strokeStyle = metric.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Glow effect on progress
        ctx.shadowColor = metric.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize - 4, -Math.PI / 2, -Math.PI / 2 + fillPercent * Math.PI * 2);
        ctx.strokeStyle = metric.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Value text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayValue = metric.value >= 1000 ? `${(metric.value / 1000).toFixed(1)}k` : metric.value.toFixed(metric.value < 10 ? 1 : 0);
        ctx.fillText(displayValue, x, y - 4);

        // Unit text
        ctx.fillStyle = '#606060';
        ctx.font = '8px system-ui';
        ctx.fillText(metric.unit, x, y + 8);

        // Label
        ctx.fillStyle = '#808080';
        ctx.font = '8px system-ui';
        ctx.fillText(metric.label, x, y + nodeSize + 12);

        // Spawn particles on high activity
        if (Math.random() < fillPercent * 0.05) {
          spawnParticle(x, y, metric.color);
        }
      });

      // === SIDE INDICATORS ===
      const indicatorY = height - 60;
      const indicatorSpacing = width / 5;

      const indicators = [
        { label: 'AGENTS', value: current.totalAgents, icon: '◉', color: '#38BDF8' },
        { label: 'TOKENS', value: current.totalTokens, icon: '◆', color: '#A78BFA' },
        { label: 'BUY PRESSURE', value: `${current.buyPressure.toFixed(0)}%`, icon: current.buyPressure > 50 ? '↑' : '↓', color: current.buyPressure > 50 ? '#34D399' : '#F87171' },
        { label: 'ONLINE', value: current.onlineAgents, icon: '●', color: '#34D399' },
      ];

      indicators.forEach((ind, i) => {
        const x = indicatorSpacing * (i + 0.8);

        // Icon
        ctx.fillStyle = ind.color;
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(ind.icon, x, indicatorY - 15);

        // Value
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px system-ui';
        ctx.fillText(String(ind.value), x, indicatorY + 8);

        // Label
        ctx.fillStyle = '#505050';
        ctx.font = '9px system-ui';
        ctx.fillText(ind.label, x, indicatorY + 24);
      });

      // === TOP HEADER ===
      ctx.fillStyle = '#606060';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('ECONOMIC PULSE', 20, 25);

      // Live indicator
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'right';
      const livePulse = Math.sin(t * 4) * 0.3 + 0.7;
      ctx.globalAlpha = livePulse;
      ctx.fillText('● LIVE', width - 20, 25);
      ctx.globalAlpha = 1;

      // Market status text
      const statusText = healthScore > 60 ? 'BULLISH' : healthScore > 40 ? 'NEUTRAL' : 'BEARISH';
      ctx.fillStyle = healthColor;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(statusText, centerX, centerY + pulseSize + 25);

      ctx.fillStyle = '#404040';
      ctx.font = '9px system-ui';
      ctx.fillText(`Health Score: ${healthScore.toFixed(0)}%`, centerX, centerY + pulseSize + 40);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [current]);

  return (
    <div 
      className="h-full rounded-2xl overflow-hidden"
      style={{ 
        background: 'linear-gradient(145deg, #1C1C1E 0%, #151517 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
