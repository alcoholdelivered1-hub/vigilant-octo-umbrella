import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function StoreRoute() {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const [isStoreOwner, setIsStoreOwner] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Admins always pass
    if (user.role === 'admin') {
      setIsStoreOwner(true);
      return;
    }
    // Check if the user's email matches a Store record
    base44.entities.Store.filter({ email: user.email })
      .then((stores) => setIsStoreOwner(stores.length > 0))
      .catch(() => setIsStoreOwner(false));
  }, [isAuthenticated, user]);

  // Prevent search engines from indexing partner/retailer pages
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => { meta.setAttribute('content', 'index, follow'); };
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    base44.auth.redirectToLogin('/store/dashboard');
    return <Spinner />;
  }

  if (isStoreOwner === null) {
    return <Spinner />;
  }

  if (!isStoreOwner) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}