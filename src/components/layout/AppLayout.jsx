import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import AnimatedRoutes from './AnimatedRoutes';
import RoleSwitcher from './RoleSwitcher';
import { Home, Store, ShoppingCart, Truck, MapPin, Shield, ShieldAlert, Users, BarChart3, TrendingUp, Menu, X, ChevronLeft, Zap, LogIn, UserPlus, Rocket, Megaphone, Phone, CreditCard, Car, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import CartDrawer from '@/components/cart/CartDrawer';
import BottomTabBar from './BottomTabBar';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useFCMPush } from '@/hooks/useFCMPush';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';

// Ordered by workflow: overview → daily ops → people & inventory →
// geography & compliance → customers & growth → reports → marketing → finance
const adminLinks = [
  { path: '/admin', icon: BarChart3, label: 'Dashboard' },
  { path: '/admin/operations', icon: Rocket, label: 'Operations' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/deliveries', icon: Truck, label: 'Live Deliveries' },
  { path: '/admin/dispatch', icon: Zap, label: 'Auto Dispatch' },
  { path: '/admin/drivers', icon: Users, label: 'Drivers' },
  { path: '/admin/driver-vetting', icon: ShieldAlert, label: 'Vetting Watchlist' },
  { path: '/admin/stores', icon: Store, label: 'Stores' },
  { path: '/admin/product-sync', icon: Store, label: 'Product Sync' },
  { path: '/admin/zones', icon: MapPin, label: 'Zones' },
  { path: '/admin/zones/editor', icon: MapPin, label: 'Zone Editor' },
  { path: '/admin/compliance', icon: Shield, label: 'Compliance' },
  { path: '/admin/comments', icon: Users, label: 'Customer Feedback' },
  { path: '/admin/early-signups', icon: Users, label: 'Early Signups' },
  { path: '/admin/launch-readiness', icon: Rocket, label: 'Launch Readiness' },
  { path: '/admin/performance', icon: TrendingUp, label: 'Performance' },
  { path: '/admin/sales-reports', icon: BarChart3, label: 'Sales Reports' },
  { path: '/admin/ad-creatives', icon: Megaphone, label: 'Ad Creatives' },
  { path: '/admin/driver-ads', icon: Car, label: 'Driver Ad Campaign' },
  { path: '/admin/call-sheet', icon: Phone, label: 'Call Sheet' },
  { path: '/admin/clover-stripe-sync', icon: CreditCard, label: 'Clover→Stripe' },
  { path: '/admin/clover-sales', icon: Receipt, label: 'Clover Sales' },
  { path: '/admin/connect-status', icon: CreditCard, label: 'Connect Status' },
];

const customerLinks = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/stores', icon: Store, label: 'Stores' },
  { path: '/orders', icon: ShoppingCart, label: 'My Orders' },
  { path: '/track', icon: MapPin, label: 'Track Order' },
];

// Routes that show a back button on mobile instead of the logo
const childRoutes = ['/stores/', '/checkout', '/track', '/driver', '/orders', '/order-status', '/rate-delivery', '/retailer-contract', '/retailer-onboarding', '/Retailer', '/store/dashboard', '/driver-agreement', '/safety-training', '/early-signup', '/qr', '/abc-compliance', '/driver-training-overview'];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin');
  const links = isAdmin ? adminLinks : customerLinks;
  const { itemCount } = useCart();
  const { user, isDriver, isRetailer } = useAuth();
  const isAdminUser = user?.role === 'admin';
  const isRetailerRoute = ['/retailer-contract', '/retailer-onboarding'].includes(location.pathname) || location.pathname.startsWith('/Retailer') || location.pathname.startsWith('/store/dashboard');

  const isChildRoute = childRoutes.some(r => location.pathname.startsWith(r)) ||
    /^\/stores\/.+/.test(location.pathname);

  // Auto-register ops users (admin, retailer, driver) for FCM push so they get
  // instant order alerts. No-op until Firebase config + VAPID key are filled in
  // src/lib/firebaseConfig.js. Customers are intentionally not registered.
  const shouldRegisterPush = !!user && (isAdminUser || isRetailer || isDriver);
  useFCMPush(shouldRegisterPush ? { firebaseConfig: FIREBASE_CONFIG, vapidKey: FIREBASE_VAPID_KEY } : {});

  // Redirect non-admins away from admin routes (Navigate component, not navigate()
  // during render — calling navigate() during render is a React anti-pattern)
  if (isAdmin && user && !isAdminUser) {
    return <Navigate to="/home" replace />;
  }

  if (isRetailer && !isAdminUser && !isDriver && !isRetailerRoute && (location.pathname === '/' || location.pathname === '/home')) {
    return <Navigate to="/retailer-onboarding" replace />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Mobile: back button on child routes */}
          <div className="md:hidden">
            {isChildRoute ? (
              <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/home')} className="flex items-center gap-1 text-sm font-medium text-primary -ml-1 p-1">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
            ) : (
              <Link to="/home">
                <img
                  src="https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c"
                  alt="Alcohol Delivered"
                  className="h-8 w-auto object-contain"
                />
              </Link>
            )}
          </div>

          {/* Desktop Logo */}
          <Link to="/home" className="hidden md:flex items-center gap-2.5">
            <img
              src="https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c"
              alt="Alcohol Delivered"
              className="h-9 w-auto object-contain"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
                  location.pathname === link.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            {!user && !isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => base44.auth.redirectToLogin('/stores')} className="gap-1.5">
                  <LogIn className="w-4 h-4" /> Login
                </Button>
                <Link to="/"><Button size="sm" className="gap-1.5">
                  <UserPlus className="w-4 h-4" /> Register
                </Button></Link>
              </>
            )}
            {!isAdmin && (
              <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            )}
            {/* Unified role switcher — one login, jump between Customer / Driver / Store / Admin */}
            <RoleSwitcher />
          </div>

          {/* Mobile Right: cart + role switcher + admin hamburger */}
          <div className="md:hidden flex items-center gap-1">
            {!isAdmin && (
              <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            )}
            {/* Role switcher (hidden if user only has customer role) */}
            <RoleSwitcher />
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Admin Mobile Nav Dropdown */}
        {isAdmin && mobileOpen && (
          <div className="md:hidden border-t bg-card p-4 space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  location.pathname === link.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t mt-2">
              <Link to="/home" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Customer View</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto md:pb-0 pb-16">
        <AnimatedRoutes />
      </main>

      {/* Bottom Tab Bar (customer, non-admin only) */}
      {!isAdmin && <BottomTabBar showDriverTab={isDriver} />}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}