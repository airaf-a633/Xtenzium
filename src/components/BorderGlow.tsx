import React, { useRef, useEffect } from 'react';
import './BorderGlow.css';

interface BorderGlowProps {
  children: React.ReactNode;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  className?: string;
}

// Performance Optimization: Global Mouse Tracking System
// This avoids multiple window listeners and layout thrashing
const activeCards = new Set<{
  ref: React.RefObject<HTMLDivElement | null>;
  update: (x: number, y: number) => void;
  updateRect: () => void;
}>();

let globalMouseX = -1000;
let globalMouseY = -1000;
let rafId: number | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const stopLoop = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // Reset all cards to zero proximity so glows fade out
  activeCards.forEach(card => {
    if (card.ref.current) {
      card.ref.current.style.setProperty('--edge-proximity', '0');
    }
  });
};

const runUpdateLoop = () => {
  activeCards.forEach((card) => {
    card.update(globalMouseX, globalMouseY);
  });
  rafId = requestAnimationFrame(runUpdateLoop);
};

const startLoop = () => {
  if (!rafId) rafId = requestAnimationFrame(runUpdateLoop);
  // Cancel any pending idle timer
  if (idleTimer !== null) clearTimeout(idleTimer);
  // Stop loop 2s after mouse goes idle
  idleTimer = setTimeout(stopLoop, 2000);
};

if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    globalMouseX = e.clientX;
    globalMouseY = e.clientY;
    startLoop();
  }, { passive: true });

  window.addEventListener('scroll', () => {
    activeCards.forEach(card => card.updateRect());
  }, { passive: true });

  window.addEventListener('resize', () => {
    activeCards.forEach(card => card.updateRect());
  }, { passive: true });
}

const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  edgeSensitivity = 30,
  glowColor = "40 80 80",
  backgroundColor = "var(--bg-card)",
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  className = ""
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      if (cardRef.current) {
        rectRef.current = cardRef.current.getBoundingClientRect();
      }
    };

    const updateGlow = (mouseX: number, mouseY: number) => {
      if (!cardRef.current || !rectRef.current) return;
      
      const rect = rectRef.current;
      
      // Calculate distance to the nearest edge
      const dx = Math.max(rect.left - mouseX, 0, mouseX - rect.right);
      const dy = Math.max(rect.top - mouseY, 0, mouseY - rect.bottom);
      
      // Optimization: use squared distance for preliminary check
      const distSq = dx * dx + dy * dy;
      
      // If further than ~200px, hide glow
      if (distSq > 40000) {
        cardRef.current.style.setProperty('--edge-proximity', '0');
        return;
      }

      const distance = Math.sqrt(distSq);
      const proximity = Math.max(0, 100 - (distance / 2)); 

      // Calculate angle from center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90;

      cardRef.current.style.setProperty('--cursor-angle', `${angle}deg`);
      cardRef.current.style.setProperty('--edge-proximity', `${proximity}`);
    };

    const cardEntry = {
      ref: cardRef,
      update: updateGlow,
      updateRect: updateRect
    };

    updateRect();
    activeCards.add(cardEntry);

    return () => {
      activeCards.delete(cardEntry);
      if (activeCards.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    
    card.style.setProperty('--edge-sensitivity', `${edgeSensitivity}`);
    card.style.setProperty('--border-radius', `${borderRadius}px`);
    card.style.setProperty('--glow-padding', `${glowRadius}px`);
    card.style.setProperty('--cone-spread', `${coneSpread}`);
    card.style.setProperty('--card-bg', backgroundColor);
    card.style.setProperty('--fill-opacity', `${glowIntensity}`);

    card.style.setProperty('--glow-color', `hsl(${glowColor} / 100%)`);
    card.style.setProperty('--glow-color-60', `hsl(${glowColor} / 60%)`);
    card.style.setProperty('--glow-color-40', `hsl(${glowColor} / 40%)`);
    card.style.setProperty('--glow-color-20', `hsl(${glowColor} / 20%)`);

    if (colors && colors.length > 0) {
      const colorNames = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
      colors.forEach((color, i) => {
        if (i < colorNames.length) {
          const positions = ['at 80% 55%', 'at 69% 34%', 'at 8% 6%', 'at 41% 38%', 'at 86% 85%', 'at 82% 18%', 'at 51% 4%'];
          card.style.setProperty(`--gradient-${colorNames[i]}`, `radial-gradient(${positions[i]}, ${color} 0px, transparent 50%)`);
        }
      });
      card.style.setProperty('--gradient-base', `linear-gradient(${colors[0]} 0 100%)`);
    }

    if (animated) card.classList.add('sweep-active');
    else card.classList.remove('sweep-active');
  }, [edgeSensitivity, borderRadius, glowRadius, coneSpread, backgroundColor, glowIntensity, glowColor, colors, animated]);

  return (
    <div ref={cardRef} className={`border-glow-card ${className}`}>
      <div className="edge-light" />
      <div className="border-glow-inner">
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
