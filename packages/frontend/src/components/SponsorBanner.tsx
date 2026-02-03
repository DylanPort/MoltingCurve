'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

export function SponsorBanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    hue: number;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 40; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.4 + 0.1,
          hue: Math.floor(Math.random() * 4),
        });
      }
    };

    const hueColors = [
      'rgba(56, 189, 248,',   // Bright cyan
      'rgba(52, 211, 153,',   // Emerald green
      'rgba(167, 139, 250,',  // Purple
      'rgba(251, 191, 36,',   // Amber
    ];

    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        initParticles();
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      time += 0.016;
      
      // Dark background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Colorful gradient wave
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      gradient.addColorStop(0.33, 'rgba(52, 211, 153, 0.08)');
      gradient.addColorStop(0.66, 'rgba(167, 139, 250, 0.08)');
      gradient.addColorStop(1, 'rgba(251, 191, 36, 0.08)');
      
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let x = 0; x <= canvas.width; x += 3) {
        const y = canvas.height / 2 + Math.sin(x * 0.01 + time * 1.5) * 8 + Math.sin(x * 0.02 + time * 2) * 5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Colorful particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = Math.sin(time * 2.5 + p.x * 0.01) * 0.4 + 0.6;
        const color = hueColors[p.hue];

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${(p.alpha * pulse * 0.4).toFixed(2)})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${(p.alpha * pulse).toFixed(2)})`;
        ctx.fill();
      });

      // Connecting lines with color
      ctx.lineWidth = 1;
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 60) {
            const alpha = (1 - dist / 60) * 0.15;
            const color = hueColors[p1.hue];
            ctx.strokeStyle = `${color}${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

      // Moving orbs with colors
      for (let i = 0; i < 3; i++) {
        const orbX = ((time * 30 + i * (canvas.width / 3)) % (canvas.width + 80)) - 40;
        const orbY = canvas.height / 2 + Math.sin(time * 1.5 + i * 2) * 10;
        const color = hueColors[i % 4];
        
        const orbGradient = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 25);
        orbGradient.addColorStop(0, `${color}0.2)`);
        orbGradient.addColorStop(0.5, `${color}0.08)`);
        orbGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(orbX, orbY, 25, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div 
      className="relative overflow-hidden rounded-2xl"
      style={{ 
        background: 'linear-gradient(145deg, #0A0A0F 0%, #050508 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* Animated Canvas Background */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: '50px' }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex items-center justify-center gap-8 py-2.5 px-6">
        {/* Left Decoration */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i}
                className="w-0.5 rounded-full animate-pulse"
                style={{ 
                  height: `${6 + i * 3}px`,
                  background: `linear-gradient(180deg, #38BDF8, #34D399)`,
                  animationDelay: `${i * 0.2}s`,
                  boxShadow: '0 0 6px rgba(56, 189, 248, 0.6)'
                }}
              />
            ))}
          </div>
          <span 
            className="text-[9px] font-semibold tracking-widest"
            style={{ color: '#38BDF8', textShadow: '0 0 10px rgba(56, 189, 248, 0.5)' }}
          >
            RPC INFRA
          </span>
        </div>

        {/* Main Sponsor Section */}
        <div className="flex items-center gap-3">
          <span 
            className="text-[9px] font-medium tracking-widest uppercase"
            style={{ color: '#6B7280' }}
          >
            Powered by
          </span>
          
          {/* Logo with Colorful Glow Effect */}
          <a 
            href="https://whistle.ninja" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative group cursor-pointer"
          >
            {/* Glow background */}
            <div 
              className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"
              style={{ 
                background: 'linear-gradient(135deg, #38BDF8, #34D399, #A78BFA)',
                transform: 'scale(1.8)' 
              }}
            />
            
            <div 
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group-hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(52, 211, 153, 0.1))',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                boxShadow: '0 0 20px rgba(52, 211, 153, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div className="relative w-6 h-6 animate-float">
                <Image
                  src="/whistle-logo.png"
                  alt="Whistle Protocol"
                  fill
                  className="object-contain"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.8))' }}
                />
              </div>
              
              <div className="flex flex-col">
                <span 
                  className="text-sm font-bold tracking-wide leading-tight"
                  style={{ 
                    background: 'linear-gradient(90deg, #38BDF8, #34D399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: 'none'
                  }}
                >
                  WHISTLE
                </span>
                <span 
                  className="text-[7px] tracking-widest leading-tight font-medium"
                  style={{ color: '#34D399' }}
                >
                  PROTOCOL
                </span>
              </div>

              {/* Animated border */}
              <div 
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ opacity: 0.3 }}
              >
                <div 
                  className="absolute inset-0 animate-border-spin"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent, #38BDF8, #34D399, #A78BFA, transparent)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'xor',
                    padding: '1px',
                    borderRadius: '12px'
                  }}
                />
              </div>
            </div>
          </a>
        </div>

        {/* Right Decoration */}
        <div className="hidden lg:flex items-center gap-2">
          <span 
            className="text-[9px] font-semibold tracking-widest"
            style={{ color: '#A78BFA', textShadow: '0 0 10px rgba(167, 139, 250, 0.5)' }}
          >
            NODE OPS
          </span>
          <div className="flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i}
                className="w-0.5 rounded-full animate-pulse"
                style={{ 
                  height: `${12 - i * 3}px`,
                  background: `linear-gradient(180deg, #A78BFA, #FBBF24)`,
                  animationDelay: `${i * 0.2}s`,
                  boxShadow: '0 0 6px rgba(167, 139, 250, 0.6)'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Colorful Scrolling Text Marquee */}
      <div 
        className="relative overflow-hidden py-1.5" 
        style={{ background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.03), rgba(52, 211, 153, 0.03), rgba(167, 139, 250, 0.03))' }}
      >
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 text-[8px] font-medium">
              <span style={{ color: '#38BDF8', textShadow: '0 0 8px rgba(56, 189, 248, 0.8)' }}>◆</span>
              <span style={{ color: '#6B7280' }}>ZK PRIVACY</span>
              <span style={{ color: '#34D399', textShadow: '0 0 8px rgba(52, 211, 153, 0.8)' }}>◇</span>
              <span style={{ color: '#6B7280' }}>SOLANA RPC</span>
              <span style={{ color: '#A78BFA', textShadow: '0 0 8px rgba(167, 139, 250, 0.8)' }}>◉</span>
              <span style={{ color: '#6B7280' }}>NODE OPERATORS</span>
              <span style={{ color: '#FBBF24', textShadow: '0 0 8px rgba(251, 191, 36, 0.8)' }}>○</span>
              <span style={{ color: '#6B7280' }}>DECENTRALIZED</span>
              <span style={{ color: '#38BDF8', textShadow: '0 0 8px rgba(56, 189, 248, 0.8)' }}>◆</span>
              <span style={{ color: '#6B7280' }}>HIGH PERFORMANCE</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
