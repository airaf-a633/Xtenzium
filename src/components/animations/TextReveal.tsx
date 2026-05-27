import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { easings } from '../../theme';

interface Props {
  text: string;
  className?: string;
}

export const WordSplitter = ({ text, className = "" }: Props) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  const words = text.split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const child = {
    hidden: { y: "110%" },
    visible: {
      y: "0%",
      transition: { duration: 0.75, ease: easings.global }
    }
  };

  return (
    <motion.span
      ref={ref}
      variants={container}
      initial="hidden"
      animate={controls}
      className={className}
      style={{ display: 'inline-block', overflow: 'hidden' }}
    >
      {words.map((word, index) => (
        <span key={index} style={{ display: 'inline-block', overflow: 'hidden', marginRight: '0.25em' }}>
          <motion.span variants={child} style={{ display: 'inline-block' }}>
            {word}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
};

export const ClipReveal = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ y: "100%" }}
        animate={controls}
        variants={{
          visible: { y: 0, transition: { duration: 0.8, ease: easings.global, delay } }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export const NumberCounter = ({ to, prefix = '', suffix = '', duration = 1.4, delay = 0, className = '' }: { to: number, prefix?: string, suffix?: string, duration?: number, delay?: number, className?: string }) => {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  useEffect(() => {
    if (inView) {
      let startTimestamp: number;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        
        // easeOutQuart
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeProgress * to));

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(to);
        }
      };
      
      const timeout = setTimeout(() => {
        window.requestAnimationFrame(step);
      }, delay * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [inView, to, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {prefix}{count}{suffix}
    </span>
  );
};
