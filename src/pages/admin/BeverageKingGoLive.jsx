import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  RefreshCw, CheckCircle2, XCircle, Loader2, ShieldCheck, CreditCard,
  Database, Trash2, Link2, Store, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

function Gate({ label, pass }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
      pass ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
    )}>
      {pass ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span className="font-medium">{label}</span>
    </div>
  );
}

export default function BeverageKingGoLive() {
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState('');
  const [apiToken, setApiToken] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['bk-golive-console'],
    queryFn: async () => {
      const res = await base44.functions.invoke('beverageKingGoLive', {});
      return res.data;
    },
  });

  const clearClover = useMutation({
    mutationFn: async () => (await base44.functions.invoke('beverageKingGoLive', { action: 'clear_clover' })).data,
    onSuccess: (d) => {
      toast.success('Clover credential cleared', { description: d?.cleared?.previous_merchant_id ? `Removed merchant ${d.cleared.previous_merchant_id}` : '' });
      refetch();
    },
    onError: (e) => toast.error('Clear failed', { description: e.message }),
  });

  const saveClover = useMutation({
    mutationFn: async () => (await base44.functions.invoke('saveCloverCredentialSecure', {
      store_id: BEVERAGE_KING_STORE_ID,
      merchant_id: merchantId.trim(),
      api_token: apiToken.trim(),
      environment: 'production',
    })).data,
    onSuccess: (d) => {
      if (d?.success && d?.verified) {
        toast.success(`Clover connected — merchant: ${d.merchant_name}`);
        setMerchantId(''); setApiToken('');
      } else {
        toast.error(d?.reason || d?.error || 'Verification failed — NOT saved', { duration: 9000 });
      }
      refetch();
    },
    onError: (e) => { toast.error('Save failed: ' + (e?.response?.data?.error || e.message), { duration: 9000 }); refetch(); },
  });

  const reconnectStripe = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('stripeConnectOnboardStore', { store_id: BEVERAGE_KING_STORE_ID });
      if (res?.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (d) => {
      if (d?.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      toast.success(d?.reconnected ? 'Revoked account replaced with a fresh one' : 'Stripe onboarding link ready',
        { description: 'Onboarding opened in a new tab — Beverage King completes bank/KYC there.', duration: 8000 });
      refetch();
    },
    onError: (e) => toast.error('Stripe reconnect failed', { description: e.message }),
  });

  const syncInventory = useMutation({
    mutationFn: async () => (await base44.functions.invoke('syncCloverInventory', { store_id: BEVERAGE_KING_STORE_ID })).data,
    onSuccess: (d) => {
      if (d?.success) toast.success(`Inventory synced — ${d.clover_items_fetched} items · ${d.created} created · ${d.updated} updated`);
      else toast.error(d?.error || 'Sync failed', { duration: 8000 });
      refetch();
    },
    onError: (e) => { toast.error('Sync failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 }); refetch(); },
  });

  const tagStripe = useMutation({
    mutationFn: async () => (await base44.functions.invoke('tagStripeProductsFromClover', {})).data,
    onSuccess: (d) => {
      const tagged = (d?.results || []).filter(r => r.status === 'tagged').length;
      toast.success(`Stripe products linked to Clover — ${tagged} newly tagged`);
      refetch();
    },
    onError: (e) => toast.error('Tag failed: ' + (e?.response?.data?.error || e.message)),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const clover = data?.clover || {};
  const stripe = data?.stripe || {};
  const gates = data?.gates || [];
  const ready = data?.go_live_ready;
  const cloverOk = gates.find(g => g.key === 'clover')?.pass;
  const stripeOk = gates.find(g => g.key === 'stripe')?.pass;
  const catalogOk = gates.find(g => g.key === 'catalog')?.pass;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Beverage King — Go-Live Console</h1>
            <p className="text-sm text-muted-foreground">One screen to drive every gate green.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {/* Status banner */}
      <Card className={cn('p-4 border-2', ready ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
        <div className="flex items-start gap-3">
          {ready ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />}
          <div className="flex-1">
            <p className={cn('font-bold', ready ? 'text-emerald-800' : 'text-amber-800')}>
              {ready ? 'GO-LIVE READY — push a paid test order to confirm, then flip live.' : 'NOT READY'}
            </p>
            {data?.next_action && (
              <p className="text-sm mt-1 flex items-start gap-1.5 text-amber-900">
                <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" /> {data.next_action}
              </p>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          {gates.map(g => <Gate key={g.key} label={g.label} pass={g.pass} />)}
        </div>
      </Card>

      {/* CLOVER */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Clover POS</h3>
          <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full', cloverOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
            {cloverOk ? `Connected: ${clover.merchant_name}` : clover.has_token ? `Wrong merchant: ${clover.merchant_name || 'unknown'}` : 'Not connected'}
          </span>
        </div>

        {clover.has_token && !cloverOk && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 space-y-2">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Stored credential is for the wrong merchant{clover.merchant_name ? ` (${clover.merchant_name})` : ''}.</p>
            <Button variant="destructive" size="sm" onClick={() => clearClover.mutate()} disabled={clearClover.isPending} className="gap-1.5">
              {clearClover.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Clear wrong credential
            </Button>
          </div>
        )}

        {!cloverOk && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Paste Beverage King's <b>Merchant ID</b> and a fresh <b>API Token</b> (Clover Dashboard → Settings → API Tokens, Orders + Inventory). It is verified against Clover and saved <b>only</b> if the merchant name is "Beverage King".
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Merchant ID</Label>
                <Input value={merchantId} onChange={e => setMerchantId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="e.g. 5428143500034529" />
              </div>
              <div>
                <Label className="text-xs">API Token</Label>
                <Input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Fresh Clover API token" />
              </div>
            </div>
            <Button onClick={() => saveClover.mutate()} disabled={saveClover.isPending || !merchantId.trim() || !apiToken.trim()} className="w-full gap-2">
              {saveClover.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {saveClover.isPending ? 'Verifying & saving…' : 'Verify & Save Beverage King Credential'}
            </Button>
            <p className="text-xs text-muted-foreground">Or use the self-serve OAuth page: <a href="/admin/beverage-king-clover" className="underline font-medium">Beverage King Clover Setup</a>.</p>
          </div>
        )}

        {cloverOk && !catalogOk && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Clover is connected. Pull the live catalog so products exist.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => syncInventory.mutate()} disabled={syncInventory.isPending} className="gap-1.5">
                {syncInventory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {syncInventory.isPending ? 'Syncing…' : 'Sync Inventory from Clover'}
              </Button>
              <Button variant="outline" onClick={() => tagStripe.mutate()} disabled={tagStripe.isPending} className="gap-1.5">
                {tagStripe.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Link Stripe Products to Clover
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* STRIPE */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Stripe Payouts</h3>
          <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full', stripeOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
            {stripeOk ? 'Payouts enabled' : stripe.revoked ? 'Account revoked' : 'Not connected'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">Account</p><p className="font-mono font-semibold truncate">{stripe.account_id || '—'}</p></div>
          <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">Charges</p><p className="font-semibold">{stripe.charges_enabled === null ? '—' : stripe.charges_enabled ? '✓' : '✗'}</p></div>
          <div className="rounded-lg bg-muted/40 p-2"><p className="text-muted-foreground">Payouts</p><p className="font-semibold">{stripe.payouts_enabled === null ? '—' : stripe.payouts_enabled ? '✓' : '✗'}</p></div>
        </div>
        {!stripeOk && (
          <Button onClick={() => reconnectStripe.mutate()} disabled={reconnectStripe.isPending} variant={stripe.revoked ? 'destructive' : 'default'} className="w-full gap-2">
            {reconnectStripe.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {stripe.revoked ? 'Reconnect Beverage King (fresh account)' : 'Open Stripe Onboarding Link'}
          </Button>
        )}
        {stripe.error && !stripeOk && <p className="text-xs text-red-600">{stripe.error}</p>}
      </Card>

      <p className="text-xs text-muted-foreground">
        When every gate above is green, push a controlled <b>paid test order</b> from Active Deliveries and confirm it
        appears on Beverage King's Clover register — then set onboarding status to <b>live</b>.
      </p>
    </div>
  );
}
