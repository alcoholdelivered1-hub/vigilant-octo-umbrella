import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StripeExpressPortal from '@/components/stripe/StripeExpressPortal';
import PayoutSettings from '@/components/driver/PayoutSettings';
import StorePayoutSettings from '@/components/partner/StorePayoutSettings';
import { Landmark, ArrowLeft } from 'lucide-react';

export default function StripeExpressOnboarding() {
  const [storeId, setStoreId] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Check if user is a store owner
  const { data: stores = [] } = useQuery({
    queryKey: ['my-stores'],
    queryFn: () => base44.entities.Store.filter({ email: user?.email || '__none__' }, 'name', 10),
    enabled: !!user?.email,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('store');
    if (sId) setStoreId(sId);
    else if (stores.length > 0) setStoreId(stores[0].id);
  }, [stores]);

  const isDriver = !storeId && user?.stripe_connect_account_id;
  const isStoreOwner = stores.length > 0;
  const hasNoAccount = !isDriver && !isStoreOwner;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/home" className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Payouts &amp; Banking
          </h1>
          <p className="text-sm text-muted-foreground">Manage your payout account, balance, and bank details</p>
        </div>
      </div>

      {/* Store owner with multiple stores — let them pick */}
      {isStoreOwner && stores.length > 1 && (
        <div className="mb-4 bg-card rounded-2xl border p-4">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Store</label>
          <select
            value={storeId || ''}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Onboarding / connection status */}
      <div className="mb-4">
        {storeId ? <StorePayoutSettings storeId={storeId} /> : !hasNoAccount && <PayoutSettings />}
      </div>

      {/* Full portal — only if account exists */}
      <StripeExpressPortal storeId={storeId} />

      {hasNoAccount && (
        <div className="mt-4 bg-muted/50 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You don't have a Stripe Express account yet. Drivers can connect from the{' '}
            <Link to="/driver/earnings" className="text-primary hover:underline font-medium">Earnings page</Link>,
            and store owners from the{' '}
            <Link to="/store/dashboard" className="text-primary hover:underline font-medium">Store Dashboard</Link>.
          </p>
        </div>
      )}
    </div>
  );
}