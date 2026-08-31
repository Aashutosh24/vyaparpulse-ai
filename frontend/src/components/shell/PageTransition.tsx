import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * One transition for every route: a short fade with a few pixels of lift.
 * Enough to signal "new screen", never enough to make the app feel slow.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}>
      
      {children}
    </motion.div>);

}