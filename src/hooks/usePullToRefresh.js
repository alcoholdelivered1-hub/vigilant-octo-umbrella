import { useState, useEffect, useRef } from 'react';

export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const threshold = 70;
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;

    const onTouchStart = (e) => {
      if (scrollContainer.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > threshold && scrollContainer.scrollTop <= 0) {
        pulling.current = false;
        setRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
      }
    };

    const onTouchEnd = () => { pulling.current = false; };

    scrollContainer.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', onTouchMove, { passive: true });
    scrollContainer.addEventListener('touchend', onTouchEnd);

    return () => {
      scrollContainer.removeEventListener('touchstart', onTouchStart);
      scrollContainer.removeEventListener('touchmove', onTouchMove);
      scrollContainer.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);

  return refreshing;
}