'use client';

import { useArenaStore } from '@/store/arena';
import { useEffect, useRef, useCallback } from 'react';

interface AgentNode {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  size: number;
  isOnline: boolean;
  pulsePhase: number;
  activityRing: number;
  trail: { x: number; y: number; alpha: number }[];
  colorIndex: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  text?: string;
  color: string;
}

// Avatar color schemes for each letter
const AVATAR_COLORS: Record<string, { bg: string; accent: string }> = {
  A: { bg: '#4ade80', accent: '#22c55e' },
  B: { bg: '#64748b', accent: '#22d3ee' },
  C: { bg: '#a78bfa', accent: '#7c3aed' },
  D: { bg: '#525252', accent: '#ef4444' },
  E: { bg: '#34d399', accent: '#fbbf24' },
  F: { bg: '#dc2626', accent: '#f97316' },
  G: { bg: '#84cc16', accent: '#65a30d' },
  H: { bg: '#60a5fa', accent: '#22d3ee' },
  I: { bg: '#a5b4fc', accent: '#c7d2fe' },
  J: { bg: '#7dd3fc', accent: '#0369a1' },
  K: { bg: '#a8a29e', accent: '#ef4444' },
  L: { bg: '#10b981', accent: '#fbbf24' },
  M: { bg: '#4b5563', accent: '#22d3ee' },
  N: { bg: '#c084fc', accent: '#e879f9' },
  O: { bg: '#f472b6', accent: '#ec4899' },
  P: { bg: '#71717a', accent: '#ef4444' },
  Q: { bg: '#a855f7', accent: '#d946ef' },
  R: { bg: '#dc2626', accent: '#fbbf24' },
  S: { bg: '#38bdf8', accent: '#0c4a6e' },
  T: { bg: '#3b82f6', accent: '#ef4444' },
  U: { bg: '#818cf8', accent: '#fbbf24' },
  V: { bg: '#2dd4bf', accent: '#ef4444' },
  W: { bg: '#818cf8', accent: '#fbbf24' },
  X: { bg: '#3f3f46', accent: '#22d3ee' },
  Y: { bg: '#fbbf24', accent: '#92400e' },
  Z: { bg: '#475569', accent: '#fbbf24' },
};

function getAvatarColors(name: string) {
  const letter = (name?.charAt(0) || 'A').toUpperCase();
  return AVATAR_COLORS[letter] || { bg: '#6b7280', accent: '#9ca3af' };
}

// Draw creature based on first letter
function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, name: string, isOnline: boolean) {
  const letter = (name?.charAt(0) || 'A').toUpperCase();
  const colors = getAvatarColors(name);
  const s = size * 0.7;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Draw based on letter type
  switch(letter) {
    case 'A': // Alien with antennae
      // Antennae
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s*0.3, -s*0.3);
      ctx.lineTo(-s*0.4, -s*0.6);
      ctx.moveTo(s*0.3, -s*0.3);
      ctx.lineTo(s*0.4, -s*0.6);
      ctx.stroke();
      // Antenna tips
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(-s*0.4, -s*0.6, 3, 0, Math.PI*2);
      ctx.arc(s*0.4, -s*0.6, 3, 0, Math.PI*2);
      ctx.fill();
      // Head
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.45, s*0.4, 0, 0, Math.PI*2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-s*0.15, -s*0.05, s*0.12, s*0.15, 0, 0, Math.PI*2);
      ctx.ellipse(s*0.15, -s*0.05, s*0.12, s*0.15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-s*0.15, -s*0.08, s*0.06, 0, Math.PI*2);
      ctx.arc(s*0.15, -s*0.08, s*0.06, 0, Math.PI*2);
      ctx.fill();
      break;
      
    case 'B': // Box robot
    case 'R': // Red robot
    case 'H': // Humanoid robot
      ctx.fillStyle = colors.bg;
      ctx.fillRect(-s*0.4, -s*0.35, s*0.8, s*0.7);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-s*0.28, -s*0.2, s*0.2, s*0.15);
      ctx.fillRect(s*0.08, -s*0.2, s*0.2, s*0.15);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-s*0.2, s*0.1, s*0.4, s*0.1);
      break;
      
    case 'C': // Cyclops
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.45, s*0.4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, -s*0.05, s*0.22, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -s*0.1, s*0.1, 0, Math.PI*2);
      ctx.fill();
      break;
      
    case 'D': // Drone
    case 'P': // Probe
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.4, s*0.25, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(0, 0, s*0.15, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, 0, s*0.06, 0, Math.PI*2);
      ctx.fill();
      break;
      
    case 'J': // Jellyfish
    case 'O': // Octopus
    case 'S': // Squid
      ctx.fillStyle = colors.bg;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, -s*0.15, s*0.4, s*0.25, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Eyes
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(-s*0.12, -s*0.2, s*0.08, 0, Math.PI*2);
      ctx.arc(s*0.12, -s*0.2, s*0.08, 0, Math.PI*2);
      ctx.fill();
      // Tentacles
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      for(let i = -1; i <= 1; i += 0.5) {
        ctx.beginPath();
        ctx.moveTo(i * s*0.25, s*0.05);
        ctx.quadraticCurveTo(i * s*0.2, s*0.3, i * s*0.3, s*0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
      
    case 'M': // Mech
    case 'T': // Tank
    case 'K': // Knight
      ctx.fillStyle = colors.bg;
      ctx.fillRect(-s*0.45, -s*0.3, s*0.9, s*0.6);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(-s*0.5, -s*0.35, s*0.15, s*0.35);
      ctx.fillRect(s*0.35, -s*0.35, s*0.15, s*0.35);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-s*0.25, -s*0.15, s*0.15, s*0.1);
      ctx.fillRect(s*0.1, -s*0.15, s*0.15, s*0.1);
      break;
      
    case 'U': // UFO
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.5, s*0.15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#c7d2fe';
      ctx.beginPath();
      ctx.ellipse(0, -s*0.1, s*0.3, s*0.2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(-s*0.3, 0, s*0.06, 0, Math.PI*2);
      ctx.arc(0, s*0.05, s*0.06, 0, Math.PI*2);
      ctx.arc(s*0.3, 0, s*0.06, 0, Math.PI*2);
      ctx.fill();
      break;
      
    default: // Generic creature
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.arc(0, 0, s*0.4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-s*0.12, -s*0.05, s*0.1, 0, Math.PI*2);
      ctx.arc(s*0.12, -s*0.05, s*0.1, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-s*0.12, -s*0.08, s*0.05, 0, Math.PI*2);
      ctx.arc(s*0.12, -s*0.08, s*0.05, 0, Math.PI*2);
      ctx.fill();
  }
  
  ctx.restore();
}

export function ArenaWorld() {
  const { agents, activities, tokens } = useArenaStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Map<string, AgentNode>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const lastActivityRef = useRef<string>('');
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width || 800;
    const height = canvas.height || 250;

    agents.forEach((agent, index) => {
      if (!nodesRef.current.has(agent.id)) {
        const angle = (index / Math.max(agents.length, 1)) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.3;
        const centerX = width / 2;
        const centerY = height / 2;

        nodesRef.current.set(agent.id, {
          id: agent.id,
          name: agent.name,
          x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
          y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
          targetX: centerX + Math.cos(angle) * radius,
          targetY: centerY + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 28,
          isOnline: agent.is_online ?? true,
          pulsePhase: Math.random() * Math.PI * 2,
          activityRing: 0,
          trail: [],
          colorIndex: index,
        });
      } else {
        const node = nodesRef.current.get(agent.id)!;
        node.isOnline = agent.is_online ?? true;
      }
    });
  }, [agents]);

  useEffect(() => {
    if (activities.length === 0) return;
    
    const latest = activities[0];
    if (latest.id === lastActivityRef.current) return;
    lastActivityRef.current = latest.id;

    const node = nodesRef.current.get(latest.agent_id);
    if (node) {
      node.activityRing = 1;
      const colors = getAvatarColors(node.name);

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        particlesRef.current.push({
          id: `${latest.id}-${i}`,
          x: node.x,
          y: node.y,
          vx: Math.cos(angle) * (2 + Math.random() * 2),
          vy: Math.sin(angle) * (2 + Math.random() * 2),
          life: 1,
          maxLife: 1,
          size: 3 + Math.random() * 3,
          text: i === 0 ? (latest.metadata?.symbol || '') : undefined,
          color: colors.bg,
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        node.targetX = 100 + Math.random() * (canvas.width - 200);
        node.targetY = 60 + Math.random() * (canvas.height - 120);
      }
    }
  }, [activities]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    timeRef.current += 0.016;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridOffset = (timeRef.current * 5) % 40;
    for (let x = gridOffset; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridOffset; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center arena
    const centerX = width / 2;
    const centerY = height / 2;
    const arenaRadius = Math.min(width, height) * 0.4;

    const glowGradient = ctx.createRadialGradient(centerX, centerY, arenaRadius * 0.8, centerX, centerY, arenaRadius * 1.2);
    glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.015)');
    glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, arenaRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(timeRef.current * 0.1);
    ctx.setLineDash([8, 16]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.arc(0, 0, arenaRadius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.font = 'bold 50px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ARENA', centerX, centerY);

    // Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= 0.015;

      if (p.life <= 0) return false;

      const alpha = p.life;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}`;
      ctx.globalAlpha = alpha * 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (p.text && alpha > 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`$${p.text}`, p.x, p.y - p.size - 6);
      }

      return true;
    });

    // Agent nodes
    nodesRef.current.forEach(node => {
      const dx = node.targetX - node.x;
      const dy = node.targetY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {
        node.vx += (dx / dist) * 0.15;
        node.vy += (dy / dist) * 0.15;
      }

      node.vx += (Math.random() - 0.5) * 0.2;
      node.vy += (Math.random() - 0.5) * 0.2;
      node.vx *= 0.92;
      node.vy *= 0.92;

      node.x += node.vx;
      node.y += node.vy;

      const margin = 50;
      if (node.x < margin) { node.x = margin; node.vx *= -0.5; }
      if (node.x > width - margin) { node.x = width - margin; node.vx *= -0.5; }
      if (node.y < margin) { node.y = margin; node.vy *= -0.5; }
      if (node.y > height - margin) { node.y = height - margin; node.vy *= -0.5; }

      const colors = getAvatarColors(node.name);

      // Trail
      node.trail.push({ x: node.x, y: node.y, alpha: 1 });
      if (node.trail.length > 12) node.trail.shift();
      node.trail.forEach(t => t.alpha *= 0.88);

      if (node.isOnline && node.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(node.trail[0].x, node.trail[0].y);
        for (let i = 1; i < node.trail.length; i++) {
          ctx.lineTo(node.trail[i].x, node.trail[i].y);
        }
        ctx.strokeStyle = colors.bg;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      node.activityRing *= 0.95;

      if (node.activityRing > 0.01) {
        const ringSize = node.size + 20 * node.activityRing;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringSize, 0, Math.PI * 2);
        ctx.strokeStyle = colors.bg;
        ctx.globalAlpha = node.activityRing * 0.6;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Subtle glow
      if (node.isOnline) {
        node.pulsePhase += 0.04;
        const pulseSize = node.size + 6 + Math.sin(node.pulsePhase) * 2;
        
        const glowGrad = ctx.createRadialGradient(node.x, node.y, node.size * 0.8, node.x, node.y, pulseSize);
        glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Avatar background circle - minimal dark
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.strokeStyle = node.isOnline ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw creature
      drawCreature(ctx, node.x, node.y, node.size, node.name, node.isOnline);

      // Online indicator
      const indicatorX = node.x + node.size * 0.7;
      const indicatorY = node.y - node.size * 0.7;
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
      ctx.fillStyle = node.isOnline ? '#22C55E' : '#404040';
      ctx.fill();
      if (node.isOnline) {
        ctx.shadowColor = '#22C55E';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Name
      ctx.fillStyle = node.isOnline ? '#FFFFFF' : '#606060';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name.slice(0, 12), node.x, node.y + node.size + 6);
    });

    // Stats overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(8, 8, 95, 58);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, 95, 58);

    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(99, 179, 237, 0.9)';
    ctx.fillText(`◆ ${tokens.length} Tokens`, 16, 23);
    ctx.fillStyle = 'rgba(129, 230, 217, 0.9)';
    ctx.fillText(`◉ ${agents.length} Agents`, 16, 38);
    ctx.fillStyle = '#606060';
    ctx.fillText(`◇ ${activities.length} Events`, 16, 53);

    animationRef.current = requestAnimationFrame(animate);
  }, [agents.length, tokens.length, activities.length]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    setTimeout(resize, 100);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div 
      className="h-full p-4 flex flex-col rounded-2xl"
      style={{ 
        background: 'linear-gradient(145deg, #1C1C1E 0%, #151517 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8E8E93' }}>
          Arena World
        </h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span style={{ color: '#63B3ED' }}>◆ Token</span>
          <span style={{ color: '#81E6D9' }}>◉ Agent</span>
          <span style={{ color: '#636366' }}>◇ Event</span>
        </div>
      </div>
      
      <div 
        className="flex-1 rounded-xl overflow-hidden relative"
        style={{ 
          background: 'linear-gradient(180deg, #0a0a0a 0%, #050505 100%)',
          border: '1px solid rgba(0,0,0,0.5)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
          minHeight: '180px' 
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {agents.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-3xl mb-2 opacity-20">◉</div>
            <p className="text-sm font-medium" style={{ color: '#606060' }}>Waiting for agents...</p>
            <p className="text-xs mt-1" style={{ color: '#404040' }}>AI agents will appear as creatures</p>
          </div>
        )}
      </div>
    </div>
  );
}
