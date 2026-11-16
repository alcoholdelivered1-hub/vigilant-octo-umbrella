import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Menu, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedRoutes from './AnimatedRoutes';
import WorkspaceLink from './WorkspaceLink';
import CartDrawer from '@/components/cart/CartDrawer';
import FinalApprovalAlertsButton from '@/components/approvals/FinalApprovalAlertsButton';
import { useCart } from '@/hooks/useCart';

const logo = 'https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c';

// Desktop website shell and staff console: primary navigation lives in the site header.
export default function WebsiteShell({ workspace, user, isAdmin, moreTools = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const isAdminUser = user?.role === 'admin';
  const isCustomer = workspace.kind === 'customer';
  const closeMenu = () => setMobileOpen(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to={workspace.home} className="flex shrink-0 items-center gap-2" aria-label="Alcohol Delivered workspace home">
            <img src={logo} alt="Alcohol Delivered" className="h-8 w-auto object-contain" />
            {!isCustomer && <span className="text-xs font-semibold capitalize">{workspace.kind === 'retailer' ? 'My Store' : workspace.kind === 'driver' ? 'Driver' : 'Admin'}</span>}
          </Link>
          <nav aria-label="Main navigation" className="hidden flex-wrap items-center gap-1 lg:flex">
            {workspace.links.map(link => <WorkspaceLink key={link.path} link={link} pathname={location.pathname} />)}
            {moreTools.length > 0 && (
              <details className="relative">
                <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted">More tools</summary>
                <nav aria-label="Additional admin tools" className="absolute right-0 z-50 max-h-[70vh] w-72 overflow-y-auto rounded-xl border bg-card p-2 shadow-lg">
                  {moreTools.map(link => <WorkspaceLink key={link.path || link.href} link={link} pathname={location.pathname} />)}
                </nav>
              </details>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {isAdminUser && <FinalApprovalAlertsButton />}
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
            {isAdminUser && (
              <Link className="hidden sm:block" to={isAdmin ? '/home' : '/admin'}>
                <Button variant="outline" size="sm">{isAdmin ? 'Customer View' : 'Admin'}</Button>
              </Link>
            )}
            <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <nav aria-label="Mobile navigation" className="max-h-[70vh] overflow-y-auto border-t bg-card p-3 lg:hidden">
            {workspace.links.map(link => <WorkspaceLink key={link.path} link={link} pathname={location.pathname} onNavigate={closeMenu} compact />)}
            {moreTools.length > 0 && (
              <details className="mt-2 border-t pt-2">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">More tools</summary>
                {moreTools.map(link => <WorkspaceLink key={link.path || link.href} link={link} pathname={location.pathname} onNavigate={closeMenu} compact />)}
              </details>
            )}
            {isAdminUser && (
              <div className="mt-2 border-t pt-2">
                <Link to={isAdmin ? '/home' : '/admin'} onClick={closeMenu} className="block min-h-11 px-3 py-3 text-sm">{isAdmin ? 'Customer View' : 'Admin'}</Link>
                <Link to="/store/dashboard" onClick={closeMenu} className="block min-h-11 px-3 py-3 text-sm">Store workspace</Link>
                <Link to="/driver" onClick={closeMenu} className="block min-h-11 px-3 py-3 text-sm">Driver workspace</Link>
              </div>
            )}
          </nav>
        )}
      </header>
      <main className="app-scroll-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><AnimatedRoutes /></main>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}