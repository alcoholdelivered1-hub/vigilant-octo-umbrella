import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Menu, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedRoutes from './AnimatedRoutes';
import BottomTabBar from './BottomTabBar';
import WorkspaceLink from './WorkspaceLink';
import CartDrawer from '@/components/cart/CartDrawer';
import { useCart } from '@/hooks/useCart';

const logo = 'https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c';

// Phone and tablet app shell: tab bar navigation, compact app header, no website chrome.
export default function AppShell({ workspace, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const isCustomer = workspace.kind === 'customer';
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-xl">
        <div className="flex min-h-14 items-center justify-between gap-2 px-4 py-1">
          <Link to={workspace.home} className="flex shrink-0 items-center gap-2" aria-label="Alcohol Delivered home" onClick={closeMenu}>
            <img src={logo} alt="Alcohol Delivered" className="h-8 w-auto object-contain" />
            {!isCustomer && <span className="text-xs font-semibold capitalize">{workspace.kind === 'retailer' ? 'My Store' : 'Driver'}</span>}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {!user && (
              <Link to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)}>
                <Button variant="outline" size="sm"><LogIn className="mr-1 h-4 w-4" />Sign in</Button>
              </Link>
            )}
            {isCustomer && (
              <button type="button" aria-label={'Open cart, ' + itemCount + ' items'} onClick={() => setCartOpen(true)} className="relative min-h-11 min-w-11 rounded-lg p-2 hover:bg-muted">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && <span className="absolute right-0 top-0 rounded-full bg-secondary px-1.5 text-xs font-bold">{itemCount > 9 ? '9+' : itemCount}</span>}
              </button>
            )}
            {!isCustomer && (
              <>
                <Button type="button" variant="ghost" size="icon" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
                  {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                {menuOpen && (
                  <nav aria-label="Workspace navigation" className="absolute left-0 right-0 top-full max-h-[70vh] overflow-y-auto border-b bg-card p-3 shadow-lg">
                    {workspace.links.map(link => <WorkspaceLink key={link.path} link={link} pathname={location.pathname} onNavigate={closeMenu} compact />)}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className="app-scroll-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-20"><AnimatedRoutes /></main>
      <BottomTabBar tabs={workspace.links} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}