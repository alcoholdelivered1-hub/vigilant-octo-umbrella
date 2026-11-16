import React, { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import LiquorBeeCredentialPanel from '@/components/admin/LiquorBeeCredentialPanel';
import StripeReconnectPanel from '@/components/admin/StripeReconnectPanel';
import useBeverageKingLaunchCheck from '@/components/admin/useBeverageKingLaunchCheck';

export default function BeverageKingGoLive() {
  const { result, loading, error, lastChecked, run } = useBeverageKingLaunchCheck();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const downloadInventory = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await base44.functions.invoke('syncBeverageKingLiquorBee', { action: 'sync' });
      setSyncMessage(response.data?.message || 'Inventory and prices downloaded.');
      await run();
    } catch (issue) {
      setSyncMessage(issue?.response?.data?.error || issue?.message || 'Unable to download inventory.');
    } finally {
      setSyncing(false);
    }
  };

  const stepDone = (key) => result?.checks?.[key];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Beverage King Go-Live</h1>
          <p className="text-muted-foreground">Bobby, finish only the steps shown below. Completed steps are saved. John helps with setup and handles the final launch review.</p>
        </div>
        <Button variant="outline" onClick={run} disabled={loading} className="w-full sm:w-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Checking…' : 'Check status'}
        </Button>
      </div>
      {lastChecked && <p className="text-xs text-muted-foreground" role="status">{lastChecked}</p>}

      <Button variant="ghost" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? 'Hide completed steps' : 'View completed steps'}</Button>
      {/* Step 1: Stripe */}
      {(!stepDone('stripe_connected') || showCompleted) && (
      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">1</span>
          <h2 className="font-semibold flex-1">Set up payments — get paid into your bank</h2>
          {stepDone('stripe_connected') && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        </div>
        <p className="text-sm text-muted-foreground">Open Stripe’s secure form and complete the business, owner and bank details it requests. If Stripe reports an account restriction, call John for help.</p>
        <StripeReconnectPanel onboardingUrl={result?.stripe_reconnect_url} loading={loading} />
      </section>

      )}
      {/* Step 2: Liquor Bee POS connection */}
      {(!stepDone('inventory_synced') || showCompleted) && (
      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">2</span>
          <h2 className="font-semibold flex-1">Connect your Liquor Bee POS</h2>
          {stepDone('inventory_synced') && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        </div>
        <p className="text-sm text-muted-foreground">Connect Beverage King's Liquor Bee POS only after obtaining provider-confirmed credentials and authorizing the retailer. The existing API-key connector is unverified; a CSV upload is only a temporary inventory fallback, not a live POS or payment connection.</p>
        <LiquorBeeCredentialPanel onComplete={run} />
      </section>

      )}
      {/* Step 3: Download inventory and prices */}
      {(!stepDone('inventory_synced') || showCompleted) && (
      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">3</span>
          <h2 className="font-semibold flex-1">Download inventory and prices</h2>
          {stepDone('inventory_synced') && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        </div>
        <p className="text-sm text-muted-foreground">Import verified Liquor Bee product IDs, inventory and retailer-approved prices into the storefront. Test the connection first.</p>
        <Button onClick={downloadInventory} disabled={syncing || loading} className="w-full sm:w-auto">
          {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading…</> : 'Download inventory and prices'}
        </Button>
        {syncMessage && <p className="text-sm text-muted-foreground" role="status">{syncMessage}</p>}
      </section>

      )}
      {loading && <div className="flex items-center gap-3 rounded-xl border bg-card p-6"><Loader2 className="w-5 h-5 animate-spin" /> Running checks…</div>}
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {result && (
        <div className={`rounded-xl border p-5 ${result.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          <p className="font-semibold flex items-center gap-2">
            {result.ready ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {result.activated ? 'Beverage King is live' : 'Setup and final launch verification are still in progress'}
          </p>
          {!result.ready && result.blockers?.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">{result.blockers.map(b => <li key={b}>• {b}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}