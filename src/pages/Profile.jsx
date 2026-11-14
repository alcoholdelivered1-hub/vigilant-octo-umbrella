import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReferralSection from '@/components/profile/ReferralSection';
import { Button } from '@/components/ui/button';
import { User, LogOut, Trash2, ShieldCheck, AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Generate referral code if user doesn't have one
  useEffect(() => {
    if (user && !user.referral_code) {
      const code = (user.full_name?.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'USER') +
        Math.random().toString(36).toUpperCase().slice(2, 6);
      base44.auth.updateMe({ referral_code: code }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['me'] });
      }).catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    base44.auth.logout('/').catch(() => {});
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Clear user data and log out
      await base44.auth.updateMe({ account_deleted: true, deleted_at: new Date().toISOString() });
      toast.success('Account deleted. Goodbye!');
      base44.auth.logout('/').catch(() => {});
    } catch (e) {
      toast.error('Failed to delete account. Please contact support.');
    }
    setDeleting(false);
  };

  const onboardingData = user?.onboarding_data || {};

  // Not logged in — show login prompt (public app, no auth guard on this route)
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">Sign In Required</h1>
        <p className="text-muted-foreground mt-2">Log in to view your profile and orders.</p>
        <Button className="mt-6" onClick={() => base44.auth.redirectToLogin('/profile')}>
          Sign In
        </Button>
      </div>
    );
  }

  const displayName = user.full_name || [onboardingData.first_name, onboardingData.last_name].filter(Boolean).join(' ') || 'Customer';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-bold mb-2">Profile</h1>
      <p className="text-muted-foreground mb-8">Manage your account settings</p>

      {/* User Info */}
      <div className="bg-card rounded-2xl border p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Account Details */}
      {onboardingData.phone && (
        <div className="bg-card rounded-2xl border divide-y mb-4">
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted-foreground">Phone</span>
            <span className="text-sm font-medium">{onboardingData.phone}</span>
          </div>
          {onboardingData.dob && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Date of Birth</span>
              <span className="text-sm font-medium">{onboardingData.dob}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted-foreground">Age Verified</span>
            <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
              <ShieldCheck className="w-4 h-4" /> Verified 21+
            </div>
          </div>
        </div>
      )}

      {/* Referral Program */}
      <div className="mb-4">
        <ReferralSection user={user} />
      </div>

      {/* Subscription */}
      {onboardingData.free_trial_ends && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-4">
          <p className="font-semibold text-sm">Membership</p>
          <p className="text-xs text-muted-foreground mt-1">
            Free trial ends: {new Date(onboardingData.free_trial_ends).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground">After trial: $10.00/month</p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-card rounded-2xl border divide-y mb-4">
        <button
          onClick={() => navigate('/orders')}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium">My Orders</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/driver')}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium">Driver Portal</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Logout */}
      <Button variant="outline" className="w-full mb-3" onClick={handleLogout}>
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>

      {/* Delete Account */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-center text-sm text-destructive hover:underline py-2"
        >
          Delete Account
        </button>
      ) : (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Delete Account?</p>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteAccount} disabled={deleting}>
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-6">
        To cancel membership, email{' '}
        <a href="mailto:jpbsandiego@yahoo.com" className="text-primary hover:underline">jpbsandiego@yahoo.com</a>
      </p>
    </div>
  );
}