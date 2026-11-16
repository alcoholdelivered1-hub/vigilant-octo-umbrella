import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { tabForPath } from './workspaceNavigation';

// iOS screen transitions: a pushed screen slides in from the right, a popped screen
// slides out to the right, and moving between tabs cross-fades instead of sliding.
const variants = {
  enter: ({ dir, fade }) => ({ x: fade ? 0 : dir > 0 ? '60%' : '-25%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: ({ dir, fade }) => ({ x: fade ? 0 : dir > 0 ? '-25%' : '60%', opacity: 0 }),
};

export default function AnimatedRoutes() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);

  // Back and replace navigations (including popping a tab to its root) are pops.
  const dir = navigationType === 'PUSH' ? 1 : -1;
  const fade = tabForPath(previousPath.current) !== tabForPath(location.pathname);
  const transition = { dir, fade };

  useEffect(() => {
    previousPath.current = location.pathname;
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false} custom={transition}>
      <motion.div
        key={location.pathname}
        custom={transition}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: 'tween', duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        style={{ willChange: 'transform, opacity' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}