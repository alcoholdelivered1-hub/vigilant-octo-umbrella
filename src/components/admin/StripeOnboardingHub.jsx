import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';

export default function StripeOnboardingHub() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const response = await base44.functions.invoke('beverageKingReadinessCheck', {});
    setStatus(response.data);
    setChecking(false);
  };

  return (
    <section className="mb-6 rounded-2xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="font-semibold">Stripe Onboarding Hub</h2><p className="text-sm text-muted-foreground">Retailer payment readiness</p></div>
        <Button variant="outline" size="sm" onClick={checkStatus} disabled={checking}><RefreshCw className="h-4 w-4" />{checking ? 'Checking…' : 'Integrations Status'}</Button>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><CreditCard className="h-5 w-5" /></div><div><p className="font-medium">Beverage King</p><p className="text-xs text-muted-foreground">{status ? (status.ready ? 'Ready for live payments' : `${status.blockers.length} Stripe blocker(s)`) : 'Reconnect, then complete KYC and bank setup'}</p></div></div>
        <Button asChild size="sm"><a href="/admin/beverage-king-golive">Open Go-Live <ExternalLink className="h-4 w-4" /></a></Button>
      </div>
      {status && <p className="mt-3 text-xs text-muted-foreground">{status.integrations_status.active_endpoints} endpoint(s) active · Secret {status.integrations_status.secret_configured ? 'configured' : 'not configured'}</p>}
    </section>
  );
}