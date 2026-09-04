import React from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Determine slide direction based on route depth
const routeOrder = ['/', '/home', '/stores', '/checkout', '/orders', '/track', '/profile', '/driver'];

function getDirection(from, to) {
  const fromIdx = routeOrder.findIndex(r => from.startsWith(r) && r !== '/');
  const toIdx = routeOrder.findIndex(r => to.startsWith(r) && r !== '/');
  if (fromIdx === -1 || toIdx === -1) return 1;
  return toIdx >= fromIdx ? 1 : -1;
}

const variants = {
  enter: (dir) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -40, opacity: 0 }),
};

export default function AnimatedRoutes() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        custom={1}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ willChange: 'transform, opacity' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}