import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

const ROLE_ROUTES = {
  admin: '/admin',
  driver: '/driver',
  retailer_owner: '/store/dashboard',
  retailer_staff: '/store/dashboard',
  user: '/stores',
  customer: '/stores',
};

export default function RoleDashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !user) return;
    const route = ROLE_ROUTES[user.role] || '/home';
    navigate(route, { replace: true });
  }, [user, isLoadingAuth, navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}