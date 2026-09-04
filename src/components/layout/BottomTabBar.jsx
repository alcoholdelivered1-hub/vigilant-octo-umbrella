import React, { useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Store, ShoppingBag, User, ShieldCheck, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

const customerTabs = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/stores', icon: Store, label: 'Stores' },
  { path: '/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/safety-training', icon: ShieldCheck, label: 'Safety' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const driverTab = { path: '/driver', icon: Truck, label: 'Driver' };

export default function BottomTabBar({ showDriverTab = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Remember the last visited path per tab so switching back restores it
  const tabHistory = useRef({});

  const tabs = useMemo(() => {
    if (!showDriverTab) return customerTabs;
    // Insert Driver tab after Orders, before Safety
    return [...customerTabs.slice(0, 3), driverTab, ...customerTabs.slice(3)];
  }, [showDriverTab]);

  const handleTabPress = (tab) => {
    const isActive = location.pathname === tab.path ||
      (tab.path === '/stores' && location.pathname.startsWith('/stores')) ||
      (tab.path === '/safety-training' && location.pathname.startsWith('/safety-training')) ||
      (tab.path === '/driver' && location.pathname.startsWith('/driver'));

    if (isActive) {
      // On a sub-path of the active tab → go back to the tab's root path
      if (location.pathname !== tab.path) {
        navigate(tab.path);
        return;
      }
      // Already at root → scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Save current path under its root tab
    const currentRoot = tabs.find(t =>
      location.pathname === t.path ||
      (t.path === '/stores' && location.pathname.startsWith('/stores')) ||
      (t.path === '/driver' && location.pathname.startsWith('/driver'))
    );
    if (currentRoot) tabHistory.current[currentRoot.path] = location.pathname;

    // Restore last visited path for this tab, or go to root
    const dest = tabHistory.current[tab.path] || tab.path;
    navigate(dest);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch h-14">
        {tabs.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path === '/stores' && location.pathname.startsWith('/stores')) ||
            (tab.path === '/safety-training' && location.pathname.startsWith('/safety-training')) ||
            (tab.path === '/driver' && location.pathname.startsWith('/driver'));
          return (
            <button
              key={tab.path}
              onClick={() => handleTabPress(tab)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('w-5 h-5', active && 'stroke-[2.5px]')} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}