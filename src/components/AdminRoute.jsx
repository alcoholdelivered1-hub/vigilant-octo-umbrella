import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function AdminRoute() {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Prevent search engines from indexing any /admin/ page
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => {
      // Restore default indexing when leaving admin area
      meta.setAttribute('content', 'index, follow');
    };
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Not logged in or not an admin → redirect to home page
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}