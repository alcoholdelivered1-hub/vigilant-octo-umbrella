import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useAppShell } from '@/lib/deviceShell';
import { workspaceNavigation } from './workspaceNavigation';
import { adminTools } from './adminTools';
import AppShell from './AppShell';
import WebsiteShell from './WebsiteShell';

// Chooses the shell that matches the device and keeps shopper screens and staff
// tools apart: phones and tablets run the app shell, desktop browsers run the
// website, and the admin console always keeps its own tools navigation.
export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const appShell = useAppShell();
  const workspace = workspaceNavigation(location.pathname, user, location.search);
  const isAdminUser = user?.role === 'admin';
  const isAdmin = workspace.kind === 'admin';
  const isStoreOwner = user?.email?.trim().toLowerCase() === 'bevking71603@gmail.com';

  // Smoothly handle the hardware back button: scroll to top on popstate
  // so the previous route renders at a natural reading position in the WebView.
  useEffect(() => {
    const handlePopState = () => {
      const container = document.querySelector('.app-scroll-container');
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isAdmin && !user) return <Navigate replace to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)} />;
  if (isAdmin && !isAdminUser && !(isStoreOwner && location.pathname === '/admin/beverage-king-golive')) {
    return <Navigate to="/dashboard" replace />;
  }

  const moreTools = isAdminUser && isAdmin
    ? adminTools.filter(tool => !workspace.links.some(link => link.path === tool.path))
    : [];

  if (appShell && !isAdmin) return <AppShell workspace={workspace} user={user} />;

  return <WebsiteShell workspace={workspace} user={user} isAdmin={isAdmin} moreTools={moreTools} />;
}