import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { easings } from '../theme';

const PageTransition = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.45, ease: easings.global } }}
        exit={{ opacity: 0, transition: { duration: 0.45, ease: easings.global } }}
        style={{ width: '100%', minHeight: '100vh' }}
      >
        {children}
      </motion.div>

      {/* Sweep UP from bottom (Exit Animation) */}
      <motion.div
        className="page-transition-overlay slide-in"
        initial={{ y: "100%" }}
        animate={{ y: "100%", transition: { duration: 0 } }}
        exit={{ y: "0%", transition: { duration: 0.45, ease: "easeIn" } }}
      />
      
      {/* Sweep OUT upward (Enter Animation) */}
      <motion.div
        className="page-transition-overlay slide-out"
        initial={{ y: "0%" }}
        animate={{ y: "-100%", transition: { duration: 0.45, ease: "easeOut", delay: 0.1 } }}
        exit={{ y: "-100%", transition: { duration: 0 } }}
      />
    </>
  );
};

export default PageTransition;
