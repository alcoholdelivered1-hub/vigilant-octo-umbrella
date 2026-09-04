import { useState, useEffect, useRef, useCallback } from 'react';

export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  const handlePull = useCallback(() => {
    setRefreshing(true);
    Promise.resolve(onRefreshRef.current()).finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    const threshold = 70;

    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > threshold && window.scrollY === 0) {
        pulling.current = false;
        handlePull();
      }
    };

    const onTouchEnd = () => { pulling.current = false; };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [handlePull]);

  return refreshing;
}