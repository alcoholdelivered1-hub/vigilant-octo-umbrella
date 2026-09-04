import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, CreditCard, ArrowRightLeft, DollarSign, Receipt, Clock, Tag, Store, ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import CloverCredentialForm from '@/components/admin/CloverCredentialForm';
import CloverRevenueChart from '@/components/admin/clover/CloverRevenueChart';
import CloverInvoiceList from '@/components/admin/clover/CloverInvoiceList';

export default function CloverStripeSync() {
  const queryClient = useQueryClient();
  const [fetching, setFetching] = useState(false);
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [tagging, setTagging] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const forceSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncCloverSalesToStripe', { action: 'sync' });
      const d = res.data;
      if (d?.success) {
        toast.success(`Synced ${d.created} new invoice(s). ${d.skipped_already_mirrored || 0} already mirrored. ${d.paid_orders_found} paid Clover orders found.`);
        refreshAll();
      } else {
        toast.error(d?.error || 'Sync failed', { duration: 8000 });
      }
    } catch (e) {
      toast.error('Sync failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setSyncing(false);
    }
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const runReadOnlyTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('testCloverInventoryReadOnly', {});
      setTestResult(res.data);
      const mn = res.data?.clover?.merchant_name;
      if (res.data?.success) {
        if (mn && /beverage\s*king/i.test(mn)) {
          toast.success(`Verified: ${mn} — ${res.data.inventory?.total_items ?? 0} items found`);
        } else {
          toast.error(`Wrong merchant: ${mn || 'unknown'} — do not import`, { duration: 10000 });
        }
      } else {
        toast.error(res.data?.reason || res.data?.error || 'Test failed', { duration: 8000 });
      }
    } catch (e) {
      toast.error('Test failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clover-stripe-sync-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('syncCloverSalesToStripe', { action: 'status' });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const tagMutation = useMutation({
    mutationFn: () => base44.functions.invoke('tagStripeProductsFromClover', {}),
    onMutate: () => setTagging(true),
    onSuccess: (res) => {
      const d = res.data;
      if (d?.success) {
        toast.success(`Tagged ${d.tagged} products, ${d.already_tagged} already tagged, ${d.no_match} unmatched`);
      } else {
        toast.error(d?.error || 'Tagging failed', { duration: 8000 });
      }
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e.message || 'unknown error';
      toast.error('Tagging failed: ' + msg, { duration: 8000 });
    },
    onSettled: () => setTagging(false),
  });

  const fetchTestOrder = async () => {
    setFetching(true);
    setFetchedOrder(null);
    try {
      const res = await base44.functions.invoke('fetchCloverOrderReadOnly', {});
      const d = res.data;
      if (d?.success) {
        setFetchedOrder(d.saved_record);
        toast.success(`Fetched Clover order: ${(d.saved_record.clover_order_id || '').slice(0, 12)}… (${d.paid_orders_found} paid orders available)`);
      } else {
        toast.error(d?.message || d?.error || 'Fetch failed', { duration: 8000 });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'unknown error';
      toast.error('Fetch failed: ' + msg, { duration: 8000 });
    } finally {
      setFetching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const syncState = data?.sync_state;
  const recentInvoices = data?.recent_invoices || [];
  const totalRevenue = data?.total_clover_revenue_cents || 0;
  const cloverConfigured = data?.clover_configured;
  const tokenValid = data?.token_valid;
  const tokenSource = data?.token_source;
  const validEnvironment = data?.valid_environment;
  const tokenPreview = data?.token_preview;
  const tokenIsUuid = data?.token_is_uuid;
  const tokenLength = data?.token_length;
  const diagnosticMerchantId = data?.merchant_id;

  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['clover-stripe-sync-status'] });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            Clover → Stripe Sync
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clover POS connection diagnostics, read-only order inspection, and on-demand POS sale mirroring to Stripe
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={forceSync}
            disabled={syncing || !cloverConfigured || !tokenValid}
            className="gap-2"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Force Sync'}
          </Button>
          <Button
            onClick={() => tagMutation.mutate()}
            disabled={tagging || !cloverConfigured}
            variant="outline"
            className="gap-2"
          >
            {tagging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            {tagging ? 'Tagging...' : 'Tag Products'}
          </Button>
          <Button
            onClick={fetchTestOrder}
            disabled={fetching || !cloverConfigured || !tokenValid}
            variant="outline"
            className="gap-2"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {fetching ? 'Fetching...' : 'Fetch Test Order'}
          </Button>
        </div>
      </div>

      {/* OAuth CTA — Beverage King */}
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-sm">Authorize Beverage King via Clover OAuth</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The merchant-scoped OAuth flow is the only way to get a valid Beverage King Clover token. Run it on the published live app (not the builder iframe).
            </p>
          </div>
          <Link to="/admin/beverage-king-clover">
            <Button className="gap-2">
              <KeyRound className="w-4 h-4" /> Authorize via OAuth
            </Button>
          </Link>
        </div>
      </Card>

      {/* Connection Status Banner */}
      {cloverConfigured && !tokenValid && (
        <Card className="p-4 border-red-200 bg-red-50/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-red-700">Clover token is invalid</p>
              <p className="text-sm text-muted-foreground mt-1">
                The Clover API rejected this token (tried both production and sandbox). It may be expired or for a different merchant.
                Use the OAuth flow below to reconnect, or generate a new REST API token from Settings → API Tokens in the Clover Dashboard.
              </p>
              {tokenPreview && (
                <div className="mt-2 text-xs text-muted-foreground bg-white/60 rounded-md p-2 font-mono">
                  Token: {tokenPreview} ({tokenLength} chars, {tokenIsUuid ? 'UUID format' : 'non-UUID'}) · Source: {tokenSource} · Merchant: {diagnosticMerchantId?.slice(0, 12)}…
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
      {cloverConfigured && tokenValid && (
        <Card className="p-4 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-emerald-700">Clover connection is valid</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Environment: <strong>{validEnvironment}</strong> · Token source: <strong>{tokenSource}</strong> · Ready to sync!
              </p>
            </div>
          </div>
        </Card>
      )}
      {!cloverConfigured && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-700">Clover not configured</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your Clover API credentials below to start syncing POS sales to Stripe.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Credential Form */}
      <CloverCredentialForm onSaved={() => refetch()} />

      {/* Verify Merchant — Read-Only Inventory Test */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Verify Beverage King Connection (Read-Only Test)</h3>
          </div>
          <Button onClick={runReadOnlyTest} disabled={testing || !cloverConfigured || !tokenValid} variant="outline" className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {testing ? 'Testing...' : 'Run Read-Only Test'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          After OAuth, run this to confirm the authorized merchant is <strong>Beverage King</strong> — not "Alcohol Delivered LLC".
          If the wrong merchant authorized, stop and re-run OAuth selecting the Beverage King merchant.
        </p>
        {testResult && (
          <div className="space-y-2">
            {testResult.success ? (
              <>
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${
                  /beverage\s*king/i.test(testResult.clover?.merchant_name || '')
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-red-300 bg-red-50'
                }`}>
                  {/beverage\s*king/i.test(testResult.clover?.merchant_name || '')
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                  <div className="text-sm">
                    {/beverage\s*king/i.test(testResult.clover?.merchant_name || '') ? (
                      <span className="font-semibold text-emerald-700">✓ Verified merchant: {testResult.clover.merchant_name}</span>
                    ) : (
                      <span className="font-semibold text-red-700">✗ WRONG MERCHANT: {testResult.clover?.merchant_name || 'unknown'} — the wrong Clover account authorized. Do NOT import. Re-run OAuth and select the Beverage King merchant.</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Metric label="Merchant ID" value={(testResult.clover?.merchant_id || '').slice(0, 14) + '…'} />
                  <Metric label="Environment" value={testResult.clover?.environment || '—'} />
                  <Metric label="Token Source" value={testResult.clover?.token_source || '—'} />
                  <Metric label="Total Items" value={testResult.inventory?.total_items ?? '—'} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Metric label="With SKU/UPC" value={testResult.inventory?.items_with_sku || 0} />
                  <Metric label="With Price" value={testResult.inventory?.items_with_price || 0} />
                  <Metric label="With Categories" value={testResult.inventory?.items_with_categories || 0} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-800">{testResult.reason || testResult.error || 'Not connected'}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          label="Synced Revenue"
          value={`$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<Receipt className="w-5 h-5 text-blue-500" />}
          label="Orders Synced"
          value={syncState?.total_synced?.toLocaleString() || '0'}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Last Sync"
          value={syncState?.last_synced_at
            ? formatDistanceToNow(new Date(syncState.last_synced_at), { addSuffix: true })
            : 'Never'}
          color="bg-amber-50"
        />
        <StatCard
          icon={syncState?.last_sync_status === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : syncState?.last_sync_status === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-500" />
            : <Clock className="w-5 h-5 text-muted-foreground" />}
          label="Sync Status"
          value={syncState?.last_sync_status || 'pending'}
          color={
            syncState?.last_sync_status === 'success' ? 'bg-emerald-50'
            : syncState?.last_sync_status === 'error' ? 'bg-red-50'
            : 'bg-slate-50'
          }
        />
      </div>

      {/* Last Sync Summary */}
      {syncState?.last_sync_summary && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Badge
              variant={syncState.last_sync_status === 'success' ? 'default' : syncState.last_sync_status === 'error' ? 'destructive' : 'secondary'}
              className="shrink-0"
            >
              {syncState.last_sync_status}
            </Badge>
            <p className="text-sm text-muted-foreground">{syncState.last_sync_summary}</p>
          </div>
        </Card>
      )}

      {/* Revenue Chart + Read-Only Order Test */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CloverRevenueChart invoices={recentInvoices} />
        </div>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Read-Only Clover Order Test</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Fetches a real paid Clover POS order and saves it to the database. No Stripe objects are created.
          </p>
          {fetchedOrder ? (
            <div className="space-y-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">Clover Order ID:</span><span className="font-mono truncate">{fetchedOrder.clover_order_id}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">Payment ID:</span><span className="font-mono truncate">{fetchedOrder.clover_payment_id || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="font-medium">{fetchedOrder.payment_status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-bold">${(fetchedOrder.total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>${(fetchedOrder.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>${(fetchedOrder.tax || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tip:</span><span>${(fetchedOrder.tip || 0).toFixed(2)}</span></div>
              </div>
              {fetchedOrder.items?.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium mb-1">Items ({fetchedOrder.items.length})</p>
                  {fetchedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{item.quantity}× {item.name}</span>
                      <span>${(item.price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-emerald-600 font-medium">✓ Saved to database (ID: {(fetchedOrder.id || '').slice(0, 12)}…)</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No order fetched yet. Click "Fetch Test Order" above.</p>
          )}
        </Card>
      </div>

      {/* How It Works */}
      <Card className="p-5 bg-muted/30">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          How the Sync Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {[
            'Clover-to-Stripe invoice mirroring has been DISABLED. No Stripe invoices are created from Clover POS sales.',
            'The scheduled sync workflow has been archived — no automatic mirroring runs.',
            'Manual mirror entries have been removed — no new Stripe objects can be created from this page.',
            'Diagnostic functions are read-only: they can view connection status and existing invoices but cannot create, void, or modify Stripe objects.',
            'Use "Fetch Test Order" to pull a real Clover POS order into the database for read-only inspection.',
            'Clover POS revenue remains independent of Alcohol Delivered Stripe revenue (delivery fees, driver payouts).',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Synced Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Recent Clover Sales in Stripe
          </h2>
          <span className="text-xs text-muted-foreground">{recentInvoices.length} invoice{recentInvoices.length !== 1 ? 's' : ''}</span>
        </div>
        <CloverInvoiceList invoices={recentInvoices} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold capitalize pl-12">{value}</p>
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{String(value)}</p>
    </div>
  );
}