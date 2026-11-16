import { Home, Store, ShoppingBag, User, ShieldCheck, Truck, ClipboardList, CreditCard, FileCheck } from 'lucide-react';

export const customerNavigation = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/stores', icon: Store, label: 'Stores' },
  { path: '/orders', icon: ShoppingBag, label: 'My Orders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export function workspaceNavigation(pathname, user, search = '') {
  const adminPaths = ['/payouts', '/driver-onboarding', '/compliance-log', '/compliance-dashboard'];
  if (pathname.startsWith('/admin') || (user?.role === 'admin' && adminPaths.includes(pathname))) {
    return { kind: 'admin', home: '/admin', links: [
      { path: '/admin', icon: Home, label: 'Overview' },
      { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
      { path: '/admin/stores', icon: Store, label: 'Retailers' },
      { path: '/admin/drivers', icon: Truck, label: 'Drivers' },
      { path: '/admin/store-launch-progress', icon: ShieldCheck, label: 'Launch' },
      { path: '/admin/abc-permits', icon: ShieldCheck, label: 'ABC Permits' },
      { path: '/admin/checkr', icon: FileCheck, label: 'Checkr' },
    ] };
  }
  const retailerPaths = ['/onboarding', '/retailer-dashboard', '/retailer-portal', '/retailer-inventory', '/retailer-contract', '/bk-onboarding'];
  const isRetailer = pathname.startsWith('/store/') || pathname.startsWith('/partner/') || retailerPaths.includes(pathname)
    || (pathname === '/profile' && ['retailer_owner', 'retailer_staff'].includes(user?.role));
  if (isRetailer) {
    const storeId = new URLSearchParams(search).get('store_id');
    const suffix = storeId ? '?store_id=' + encodeURIComponent(storeId) : '';
    return { kind: 'retailer', home: '/store/dashboard' + suffix, links: [
      { path: '/store/dashboard', to: '/store/dashboard' + suffix, icon: ShoppingBag, label: 'Orders' },
      { path: '/retailer-inventory', to: '/retailer-inventory' + suffix, icon: Store, label: 'Inventory' },
      { path: '/onboarding', to: '/onboarding' + suffix, icon: ClipboardList, label: 'Setup' },
      { path: '/profile', icon: User, label: 'Profile' },
    ] };
  }
  if (pathname === '/driver' || pathname.startsWith('/driver/') || pathname === '/driver-agreement' || (pathname === '/safety-training' && user?.role === 'driver')
    || (pathname === '/profile' && user?.role === 'driver')) {
    return { kind: 'driver', home: '/driver', links: [
      { path: '/driver', icon: Truck, label: 'My Shift' },
      { path: '/driver/earnings', icon: CreditCard, label: 'Earnings' },
      { path: '/safety-training', icon: ShieldCheck, label: 'Training' },
      { path: '/profile', icon: User, label: 'Profile' },
    ] };
  }
  return { kind: 'customer', home: '/home', links: customerNavigation };
}

export function navigationActive(pathname, link) {
  return pathname === link.path || (link.path === '/stores' && pathname.startsWith('/stores/'))
    || (link.path === '/store/dashboard' && pathname === '/retailer-dashboard');
}

// --- Tab sub-path cache (restore last sub-path when switching back to a tab) ---
const TAB_CACHE_KEY = 'ad_tab_path_cache';

function readTabCache() {
  try { return JSON.parse(sessionStorage.getItem(TAB_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeTabCache(cache) {
  try { sessionStorage.setItem(TAB_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}

const allKnownTabPaths = [
  '/home', '/stores', '/orders', '/profile',
  '/admin', '/admin/orders', '/admin/stores', '/admin/drivers',
  '/admin/store-launch-progress', '/admin/abc-permits', '/admin/checkr',
  '/store/dashboard', '/retailer-inventory', '/onboarding',
  '/driver', '/driver/earnings', '/safety-training',
];

// The root tab a pathname belongs to (longest matching tab path), or null.
export function tabForPath(pathname) {
  let bestMatch = null;
  for (const tabPath of allKnownTabPaths) {
    if (pathname === tabPath || pathname.startsWith(tabPath + '/')) {
      if (!bestMatch || tabPath.length > bestMatch.length) bestMatch = tabPath;
    }
  }
  return bestMatch;
}

// Store the full pathname keyed by its parent tab so we can restore it later.
export function cacheCurrentTabPath(pathname) {
  const bestMatch = tabForPath(pathname);
  // Don't cache /profile — it is shared across workspaces.
  if (bestMatch && bestMatch !== '/profile') {
    const cache = readTabCache();
    cache[bestMatch] = pathname;
    writeTabCache(cache);
  }
  return bestMatch;
}

// --- Per-tab scroll offset (restored when switching back to a tab) ---
const TAB_SCROLL_KEY = 'ad_tab_scroll_cache';

function readScrollCache() {
  try { return JSON.parse(sessionStorage.getItem(TAB_SCROLL_KEY) || '{}'); }
  catch { return {}; }
}

export function cacheTabScroll(tabPath, scrollTop) {
  if (!tabPath) return;
  const cache = readScrollCache();
  cache[tabPath] = Math.max(0, Math.round(Number(scrollTop) || 0));
  try { sessionStorage.setItem(TAB_SCROLL_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}

export function getTabScroll(tabPath) {
  return Number(readScrollCache()[tabPath]) || 0;
}

// Return the cached sub-path for a tab, or null.
export function getCachedTabPath(tabPath) {
  const cache = readTabCache();
  return cache[tabPath] || null;
}