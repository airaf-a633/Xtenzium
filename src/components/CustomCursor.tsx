import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const CustomCursor = () => {
  const [isHovering, setIsHovering] = useState(false);
  
  // Use MotionValues for high-performance tracking (skips React re-renders)
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Apply springs for smooth movement
  const springConfigDot = { stiffness: 800, damping: 35, mass: 0.5 };
  const springConfigRing = { stiffness: 400, damping: 30, mass: 0.8 };
  
  const dotX = useSpring(cursorX, springConfigDot);
  const dotY = useSpring(cursorY, springConfigDot);
  const ringX = useSpring(cursorX, springConfigRing);
  const ringY = useSpring(cursorY, springConfigRing);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.closest('button') ||
        target.closest('a') ||
        target.style.cursor === 'pointer'
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updateMousePosition as EventListener, { passive: true });
    window.addEventListener('mouseover', handleMouseOver as EventListener, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateMousePosition as EventListener);
      window.removeEventListener('resize', updateMousePosition as EventListener);
      window.removeEventListener('mouseover', handleMouseOver as EventListener);
    };
  }, [cursorX, cursorY]);

  return (
    <>
      <motion.div
        className={`cursor-dot ${isHovering ? 'active' : ''}`}
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          scale: isHovering ? 2.5 : 1,
          left: 0,
          top: 0,
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 9999
        }}
      />
      <motion.div
        className={`cursor-ring ${isHovering ? 'active' : ''}`}
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          scale: isHovering ? 1.5 : 1,
          opacity: isHovering ? 0 : 1,
          left: 0,
          top: 0,
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 9998
        }}
      />
    </>
  );
};

export default CustomCursor;
