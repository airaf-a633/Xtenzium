import type { Variants } from 'framer-motion';

export const easings = {
  global: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

export const durations = {
  short: 0.4,
  medium: 0.6,
  long: 0.8,
  pageTransition: 0.45,
};

// General fade in up
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.65, ease: easings.global } 
  }
};

// For staggered children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const revealText: Variants = {
  hidden: { y: "110%" },
  visible: { 
    y: 0, 
    transition: { duration: 0.75, ease: easings.global } 
  }
};

