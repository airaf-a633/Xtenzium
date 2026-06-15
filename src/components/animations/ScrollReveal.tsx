import { type ReactNode, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface ScrollRevealProps {
  children: ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ScrollReveal = ({ children, id, className = '', style }: ScrollRevealProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.05 });

  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      style={style}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: { 
          opacity: 1, 
          y: 0, 
          transition: { duration: 0.4, ease: "easeOut" } 
        }
      }}
    >
      {children}
    </motion.section>
  );
};

export default ScrollReveal;
