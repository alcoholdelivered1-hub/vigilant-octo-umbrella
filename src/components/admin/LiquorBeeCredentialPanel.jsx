import React, { useState } from 'react';
import { Loader2, RefreshCw, Upload, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function LiquorBeeCredentialPanel({ onComplete }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const sync = async () => {
    setBusy('sync');
    setMessage('');
    try {
      const response = await base44.functions.invoke('syncBeverageKingLiquorBee', { action: 'sync' });
      setMessage(response.data?.message || 'Inventory synced from Liquor Bee.');
      await onComplete();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Unable to sync from Liquor Bee.');
    } finally {
      setBusy('');
    }
  };

  const testConnection = async () => {
    setBusy('test');
    setMessage('');
    try {
      const response = await base44.functions.invoke('syncBeverageKingLiquorBee', { action: 'test' });
      const d = response.data;
      if (d?.ok) setMessage(`The legacy Liquor Bee endpoint responded (HTTP ${d.status}). This does not confirm live inventory synchronization, retailer order acceptance, or payment processing.`);
      else if (d?.status === 530) setMessage(`The configured endpoint returned HTTP 530 at ${d?.url || 'the API URL'}. Ask Liquor Bee to verify the official API URL, merchant access and authentication method.`);
      else setMessage(`Liquor Bee test returned HTTP ${d?.status || 'unknown'} at ${d?.url || 'the configured endpoint'}. Confirm the official API URL and credentials with Liquor Bee; the test alone cannot verify a payment integration.`);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Unable to reach Liquor Bee API.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm border rounded-lg p-3" role="note">POS integration is not the payment gateway. This screen only tests or syncs retailer inventory. Online checkout remains on the separately verified retailer payment setup; Liquor Bee payments, 25% platform fee splitting and driver payouts are not connected by this panel.</p>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-semibold">Liquor Bee POS connection</h3>
            <p className="text-sm text-muted-foreground">The existing connector tests a legacy retailer endpoint using LIQUOR_BEE_API_KEY in Settings → Secrets. We still need Liquor Bee to verify the official API URL, Merchant ID, Client ID, Client Secret and permitted API operations. Do not enter credentials in customer-facing forms.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={testConnection} disabled={!!busy}>
            {busy === 'test' ? <Loader2 className="animate-spin" /> : <KeyRound />} Test connection
          </Button>
          <Button onClick={sync} disabled={!!busy}>
            {busy === 'sync' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Download inventory
          </Button>
        </div>
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-semibold">Or upload a Liquor Bee inventory export</h3>
            <p className="text-sm text-muted-foreground">Export your products from Liquor Bee as a CSV or Excel file and upload it here.</p>
          </div>
        </div>
        <a href="/admin/inventory-upload" className="inline-block">
          <Button variant="outline">
            <Upload /> Go to inventory upload
          </Button>
        </a>
      </div>
    </div>
  );
}