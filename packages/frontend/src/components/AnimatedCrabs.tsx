'use client';

// Different animated crab styles for each panel
// Each crab has unique animation and style

export function CrabWalking() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabWalk 1.5s ease-in-out infinite',
        filter: 'drop-shadow(0 0 4px rgba(229, 72, 77, 0.6))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabWalk {
          0%, 100% { transform: translateX(0) scaleX(1); }
          25% { transform: translateX(2px) scaleX(1); }
          50% { transform: translateX(0) scaleX(-1); }
          75% { transform: translateX(-2px) scaleX(-1); }
        }
      `}</style>
    </span>
  );
}

export function CrabGlowing() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabGlow 2s ease-in-out infinite',
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(229, 72, 77, 0.4)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.9)); transform: scale(1.1); }
        }
      `}</style>
    </span>
  );
}

export function CrabWatching() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabWatch 3s ease-in-out infinite',
        filter: 'drop-shadow(0 0 4px rgba(229, 72, 77, 0.5))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabWatch {
          0%, 40%, 100% { transform: rotateY(0deg); }
          45%, 55% { transform: rotateY(180deg); }
          60%, 90% { transform: rotateY(0deg); }
        }
      `}</style>
    </span>
  );
}

export function CrabWaving() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabWave 1s ease-in-out infinite',
        filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.6))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabWave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
      `}</style>
    </span>
  );
}

export function CrabBouncing() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabBounce 0.6s ease-in-out infinite',
        filter: 'drop-shadow(0 0 4px rgba(229, 72, 77, 0.6))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </span>
  );
}

export function CrabMarching() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabMarch 0.8s steps(4) infinite',
        filter: 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.6))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabMarch {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(1px) rotate(-5deg); }
          50% { transform: translateX(2px) rotate(0deg); }
          75% { transform: translateX(1px) rotate(5deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
      `}</style>
    </span>
  );
}

export function CrabDancing() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabDance 1.2s ease-in-out infinite',
        filter: 'drop-shadow(0 0 6px rgba(229, 72, 77, 0.8))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabDance {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-8deg); }
          50% { transform: scale(1) rotate(0deg); }
          75% { transform: scale(1.1) rotate(8deg); }
        }
      `}</style>
    </span>
  );
}

export function CrabSpinning() {
  return (
    <span 
      className="inline-block text-[12px]"
      style={{ 
        animation: 'crabSpin 2s linear infinite',
        filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.6))'
      }}
    >
      🦀
      <style jsx>{`
        @keyframes crabSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
