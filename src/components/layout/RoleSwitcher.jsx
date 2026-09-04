import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ChevronDown, Truck, Store, Shield, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// One login → many roles. This switcher shows every "hat" the current user
// wears (customer, driver, store owner, admin) and jumps to that portal.
export default function RoleSwitcher({ className }) {
  const { user, isDriver, isRetailer } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  // Determine current role context from the active path
  const getCurrentRole = () => {
    const p = location.pathname;
    if (p.startsWith('/admin')) return { label: 'Admin', icon: Shield };
    if (p.startsWith('/driver')) return { label: 'Driver', icon: Truck };
    if (p.startsWith('/store') || p.startsWith('/Retailer')) return { label: 'Store', icon: Store };
    return { label: 'Customer', icon: ShoppingBag };
  };
  const current = getCurrentRole();
  const CurrentIcon = current.icon;

  // All portals the user can access, with their current one flagged
  const roles = [
    { label: 'Customer', icon: ShoppingBag, path: '/home', available: true },
    { label: 'Driver', icon: Truck, path: '/driver', available: isAdmin || isDriver },
    { label: 'Store Owner', icon: Store, path: '/store/dashboard', available: isAdmin || isRetailer },
    { label: 'Admin', icon: Shield, path: '/admin', available: isAdmin },
  ].filter(r => r.available);

  // Don't render the switcher if the user only has the customer role
  if (roles.length <= 1) return null;

  const handleSelect = (path) => {
    setOpen(false);
    if (location.pathname !== path) navigate(path);
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
      >
        <CurrentIcon className="w-4 h-4 text-primary" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Switch Role</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="py-1">
            {roles.map(role => {
              const isActive = current.label === role.label;
              return (
                <button
                  key={role.path}
                  onClick={() => handleSelect(role.path)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  )}
                >
                  <role.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{role.label}</span>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}