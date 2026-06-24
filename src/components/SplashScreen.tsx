import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import xLogo from '../assets/x_new.png';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Preload logo image
  useEffect(() => {
    const img = new Image();
    img.src = xLogo;
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
  }, []);

  // Sequence timing
  useEffect(() => {
    if (!imageLoaded) return;

    // Hold the loading animation for a fixed duration, e.g., 2.5 seconds
    const exitStartTime = 2500;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, exitStartTime);

    // Exit animation duration is 0.6s. Unmount when finished.
    const unmountTimer = setTimeout(() => {
      onComplete();
    }, exitStartTime + 600);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, [imageLoaded, onComplete]);

  // Wait for preload
  if (!imageLoaded) return null;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'center center',
          }}
          initial={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.6, ease: 'easeInOut' }
          }}
        >
          <motion.div
            style={{
              width: '300px',
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'linear'
            }}
          >
            <img
              src={xLogo}
              alt="Loading"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
