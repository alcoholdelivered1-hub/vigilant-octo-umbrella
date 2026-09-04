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

export default function DriverRoute() {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const [isDriver, setIsDriver] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Admins always pass
    if (user.role === 'admin') {
      setIsDriver(true);
      return;
    }
    // Check if the user has a Driver record matching their email
    base44.entities.Driver.filter({ email: user.email })
      .then((drivers) => setIsDriver(drivers.length > 0))
      .catch(() => setIsDriver(false));
  }, [isAuthenticated, user]);

  // Prevent search engines from indexing driver pages
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

  // Auth check MUST come before the isDriver null check — otherwise an
  // unauthenticated user gets stuck on the spinner forever (useEffect bails
  // early when !isAuthenticated, so isDriver never gets set).
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    // Redirect to the platform-hosted login page; return to /driver after sign-in
    base44.auth.redirectToLogin('/driver');
    return <Spinner />;
  }

  // Authenticated — now wait for the Driver record lookup to finish
  if (isDriver === null) {
    return <Spinner />;
  }

  if (!isDriver) {
    return <Navigate to="/driver/signup" replace />;
  }

  return <Outlet />;
}