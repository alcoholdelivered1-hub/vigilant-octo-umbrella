import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StoreOnboardingReadiness from '@/components/admin/StoreOnboardingReadiness';
export default function CustomerLaunchPanel({ stores, store, refreshVersion }) {
  const markedLive = stores.filter(s => s.is_active && s.onboarding_status === 'live' && s.compliance_status === 'compliant' && s.stripe_connection_status === 'connected');
  return <section className="space-y-5">
    <div className="rounded-2xl border bg-card p-6 space-y-4"><h2 className="font-display text-2xl font-semibold">Customer ordering</h2><p className="text-sm font-semibold">{markedLive.length ? `${markedLive.length} retailers have a saved live ordering status.` : 'No retailer is currently marked ready for customer ordering.'}</p><p className="text-sm text-muted-foreground">Your published app is available, but publishing alone does not enable sales. Start with one licensed retailer, real inventory, its own payment account, verified taxes, a legal delivery zone and a qualified driver. Complete the sandbox checkout and delivery-handoff evidence before final activation.</p><div className="flex flex-wrap gap-2"><Button asChild><Link to={store ? `/stores/${store.id}` : '/stores'}>Open customer storefront</Link></Button><Button asChild variant="outline"><Link to="/admin/orders">Manage incoming orders</Link></Button><Button asChild variant="outline"><Link to="/driver-onboarding">Review driver readiness</Link></Button></div><p className="text-sm text-muted-foreground">The checklist reads saved evidence only. Final retailer activation rechecks payment and operational requirements; no live payment is created from this screen.</p></div>
    {store && <StoreOnboardingReadiness key={store.id} storeId={store.id} name={store.name} refreshVersion={refreshVersion} focus />}
  </section>;
}