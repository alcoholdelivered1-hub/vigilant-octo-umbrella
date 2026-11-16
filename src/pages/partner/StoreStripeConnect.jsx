import React, { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, LogIn, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const BEVERAGE_KING_EMAIL = 'bevking71603@gmail.com';

export default function StoreStripeConnect() {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [store, setStore] = useState(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const isAuthorized = user?.role === 'admin' || user?.email?.toLowerCase() === BEVERAGE_KING_EMAIL;

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) return;
    setLoadingStore(true);
    base44.entities.Store.filter({ email: BEVERAGE_KING_EMAIL }, 'name', 1)
      .then((stores) => setStore(stores?.[0] || null))
      .catch((issue) => setError(issue.message || 'Unable to load Beverage King.'))
      .finally(() => setLoadingStore(false));
  }, [isAuthenticated, isAuthorized]);

  const signIn = () => base44.auth.redirectToLogin('/store/clover-connect');

  const connectStripe = async () => {
    setConnecting(true);
    setError('');
    try {
      const response = await base44.functions.invoke('reconnectBeverageKingStripe', { store_id: store.id, action: 'onboard' });
      const url = response?.data?.url;
      if (!url) throw new Error('Stripe did not return an onboarding link.');
      window.top.location.href = url;
    } catch (issue) {
      setError(issue?.response?.data?.error || issue.message || 'Unable to open Stripe onboarding.');
      setConnecting(false);
    }
  };

  if (isLoadingAuth) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <section className="rounded-2xl border bg-card p-7 text-center space-y-5">
          <Store className="w-12 h-12 mx-auto text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Beverage King Store Sign In</h1>
            <p className="text-sm text-muted-foreground mt-2">Sign in with the existing Beverage King account to continue Stripe setup.</p>
          </div>
          <Button onClick={signIn} className="w-full gap-2"><LogIn className="w-4 h-4" /> Sign in as Beverage King</Button>
          <p className="text-xs text-muted-foreground">Use {BEVERAGE_KING_EMAIL}. Do not create a new retailer or Stripe account.</p>
        </section>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <section className="rounded-2xl border bg-card p-7 text-center space-y-4">
          <h1 className="text-xl font-bold">Wrong account</h1>
          <p className="text-sm text-muted-foreground">You are signed in as {user?.email}. Beverage King must use {BEVERAGE_KING_EMAIL}.</p>
          <Button onClick={() => logout(true)} variant="outline">Sign out and switch account</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <section className="rounded-2xl border bg-card p-7 space-y-5">
        <div className="flex items-center gap-3">
          <CreditCard className="w-9 h-9 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Beverage King Stripe Connect</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {loadingStore ? (
          <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading store…</div>
        ) : store ? (
          <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-1">
            <p className="font-semibold">{store.name}</p>
            <p>{store.address}, {store.city}, {store.state} {store.zip_code}</p>
            <p>Stripe status: <span className="font-medium">{store.stripe_connection_status || 'pending'}</span></p>
          </div>
        ) : (
          <p className="text-sm text-destructive">The existing Beverage King store record could not be found. No new record was created.</p>
        )}

        <Button onClick={connectStripe} disabled={!store || loadingStore || connecting} className="w-full gap-2">
          {connecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing secure Stripe link…</> : <>Continue to Stripe <ExternalLink className="w-4 h-4" /></>}
        </Button>

        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">This continues the Stripe account already mapped to Beverage King. It will not create a replacement account.</p>
      </section>
    </div>
  );
}
