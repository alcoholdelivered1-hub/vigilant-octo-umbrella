import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function StripeConnectStep({ store, onReady }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { data: payment, isLoading, error: statusError, refetch } = useQuery({
    queryKey: ['retailer-payment-status', store?.id], enabled: !!store?.id,
    queryFn: async () => {
      const response = await base44.functions.invoke('reconnectBeverageKingStripe', { store_id: store.id, action: 'status' });
      queryClient.invalidateQueries({ queryKey: ['onboarding-hub-stores'] });
      if (!response.data || response.data.error) throw new Error(response.data?.error || 'Could not check payment status.');
      return response.data;
    }, retry: false,
  });
  const connected = payment?.ready === true;
  useEffect(() => { onReady?.(connected); }, [connected, onReady]);
  const requirements = payment?.requirements || [];
  const needed = [
    requirements.some(key => key.startsWith('business_') || key.startsWith('company.') || key.startsWith('settings.')) && 'Business details',
    requirements.some(key => key.startsWith('representative.') || key.startsWith('owners.') || key.startsWith('individual.')) && 'Owner identity and verification',
    requirements.some(key => key.startsWith('external_account')) && 'Bank account for payouts',
    requirements.some(key => key.startsWith('tos_acceptance')) && 'Review and accept Stripe’s terms',
    requirements.some(key => key.includes('supportability_rejection_appeal')) && 'Complete Stripe’s requested appeal',
  ].filter(Boolean);

  const connect = async () => {
    const framed = window.self !== window.top;
    const tab = framed ? window.open('', '_blank') : null;
    if (framed && !tab) { setError('Allow popups to open secure Stripe onboarding.'); return; }
    if (tab) tab.opener = null;
    setConnecting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('reconnectBeverageKingStripe', { store_id: store.id, action: 'onboard' });
      const url = res?.data?.url;
      if (!url) throw new Error(res?.data?.error || 'Stripe did not return an onboarding link.');
      if (tab) tab.location.replace(url); else window.location.assign(url);
      setConnecting(false);
    } catch (e) {
      tab?.close();
      setError(e?.message || 'Unable to open Stripe onboarding.');
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <CreditCard className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Status:</span>
        <span className="font-medium capitalize">{isLoading ? 'Checking…' : payment?.status || 'Not verified'}</span>

      </div>
      {connected ? (
        <div className="space-y-3"><p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Stripe confirms payments and payouts are enabled.</p>{payment?.dashboard_url && <Button size="sm" variant="outline" asChild><a href={payment.dashboard_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Manage payouts in Stripe</a></Button>}</div>
      ) : payment?.review_required ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-2"><p className="font-semibold">Stripe review required</p><p>Payments and payouts are blocked. The account owner must open the existing Stripe account and follow its review or appeal instructions. Reconnecting does not remove this restriction.</p>{payment.dashboard_url && <Button size="sm" variant="outline" asChild><a href={payment.dashboard_url} target="_blank" rel="noopener noreferrer">Open Stripe to review requirements <ExternalLink className="w-3.5 h-3.5" /></a></Button>}</div>
      ) : !isLoading && !statusError && payment && !payment.account_id ? (
        <div className="rounded-lg border p-3 text-sm space-y-2"><p className="font-semibold">John needs to link your payment account</p><p>Your store details remain saved. Call John so he can connect the correct retailer account, then refresh this status.</p><a href="tel:+18707181521" className="inline-flex min-h-11 items-center text-primary underline">Call John: 870-718-1521</a></div>
      ) : (
        <Button size="sm" onClick={connect} disabled={connecting || isLoading || !!statusError}>
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} {store?.stripe_connect_account_id ? 'Finish payment setup in Stripe' : 'Connect Stripe'}
        </Button>
      )}
      {!connected && requirements.length > 0 && <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground"><p className="font-medium">Have these ready:</p><ul className="list-disc pl-5">{(needed.length ? needed : ['Additional information requested by Stripe']).map(item => <li key={item}>{item}</li>)}</ul><p className="mt-2">Stripe’s secure form shows exactly what is missing. Enter bank and identity details there.</p></div>}
      <p className="text-sm text-muted-foreground">Stripe guides you through any remaining payment setup. Have your business and bank details ready, then return here to check your status.</p>
      <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>Refresh payment status</Button>
      {(error || statusError) && <p className="text-sm text-destructive">{error || statusError?.response?.data?.error || statusError?.message}</p>}
    </div>
  );
}