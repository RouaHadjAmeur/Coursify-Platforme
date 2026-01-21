import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right';
}

export default function PageTransition({ children, direction = 'left' }: PageTransitionProps) {
  const variants = {
    initial: {
      x: direction === 'left' ? '-100%' : '100%',
      opacity: 0,
    },
    animate: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: direction === 'left' ? '100%' : '-100%',
      opacity: 0,
    },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
