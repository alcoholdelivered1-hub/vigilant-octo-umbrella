import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  customerNavigation,
  navigationActive,
  cacheCurrentTabPath,
  getCachedTabPath,
  cacheTabScroll,
  getTabScroll,
} from './workspaceNavigation';

const scrollContainer = () => document.querySelector('.app-scroll-container');

// iOS tab bar: each tab keeps its own navigation stack (last visited screen) and
// scroll offset. Switching tabs restores both, and tapping the active tab pops
// that tab's stack back to its root screen.
export default function BottomTabBar({ tabs = customerNavigation }) {
  const location = useLocation();
  const navigate = useNavigate();
  const restoreTimers = useRef([]);

  // Remember the current screen and persist its scroll offset when leaving it.
  useEffect(() => {
    const tab = cacheCurrentTabPath(location.pathname);
    if (!tab) return;
    const container = scrollContainer();
    let top = container?.scrollTop || 0;
    const record = () => { top = container?.scrollTop || 0; };
    cacheTabScroll(tab, top);
    container?.addEventListener('scroll', record, { passive: true });
    return () => {
      container?.removeEventListener('scroll', record);
      cacheTabScroll(tab, top);
    };
  }, [location.pathname]);

  const clearRestores = () => {
    restoreTimers.current.forEach(clearTimeout);
    restoreTimers.current = [];
  };

  useEffect(() => clearRestores, []);

  const selectTab = tab => {
    const container = scrollContainer();
    const currentTab = cacheCurrentTabPath(location.pathname);
    if (currentTab) cacheTabScroll(currentTab, container?.scrollTop || 0);

    if (navigationActive(location.pathname, tab)) {
      // Re-selecting the active tab pops back to the tab's root screen.
      if (location.pathname === tab.path) {
        container?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(tab.path, { replace: true });
        requestAnimationFrame(() => scrollContainer()?.scrollTo({ top: 0 }));
      }
      return;
    }

    // Restore the tab's own stack: its deepest screen plus its scroll position.
    const saved = getTabScroll(tab.path);
    navigate(getCachedTabPath(tab.path) || tab.to || tab.path);

    clearRestores();
    const restore = () => scrollContainer()?.scrollTo({ top: saved });
    requestAnimationFrame(restore);
    restoreTimers.current = [
      // The outgoing screen finishes its transition first, then the restored one mounts.
      setTimeout(restore, 320),
      // Retry once if the first attempt landed before the screen had its full height.
      setTimeout(() => {
        const el = scrollContainer();
        if (el && saved > 0 && el.scrollTop === 0) el.scrollTo({ top: saved });
      }, 640),
    ];
  };

  return (
    <nav
      aria-label="Workspace navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-card/85 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex h-[49px] max-w-lg items-stretch">
        {tabs.map(tab => {
          const active = navigationActive(location.pathname, tab);
          return (
            <button
              type="button"
              key={tab.path}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              onClick={() => selectTab(tab)}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] transition-colors active:opacity-60',
                active ? 'text-primary' : 'text-muted-foreground'
              )}>
              <tab.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
              <span className={cn('truncate text-[0.65rem] leading-none tracking-tight', active ? 'font-semibold' : 'font-medium')}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}