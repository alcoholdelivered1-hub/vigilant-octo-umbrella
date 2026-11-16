import React, { useEffect, useState } from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

// Store-scoped Clover authorization. The card reads the store's own saved connection so
// the onboarding page never implies a register is connected when no record exists.
export default function CloverConnectionCard({ storeId, storeName = 'this store', startFunction = 'storeCloverOAuth' }) {
  const params = new URLSearchParams(window.location.search);
  const returned = params.get('clover');
  const returnedMessage = params.get('message');
  const readsStatus = startFunction === 'storeCloverOAuth';
  const [connection, setConnection] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!readsStatus) return undefined;
    let active = true;
    base44.functions.invoke(startFunction, { action: 'status', store_id: storeId })
      .then(({ data }) => { if (active) setConnection(data?.status || null); })
      .catch(() => { if (active) setError('Unable to read the saved register connection.'); });
    return () => { active = false; };
  }, [readsStatus, startFunction, storeId]);

  const startClover = async () => {
    try {
      setStarting(true);
      setError('');
      const payload = { store_id: storeId };
      if (readsStatus) payload.return_path = `${window.location.pathname}${window.location.search}`;
      const response = await base44.functions.invoke(startFunction, payload);
      const authorizeUrl = response?.data?.authorize_url;
      if (!authorizeUrl) throw new Error(response?.data?.error || 'Unable to start Clover authorization.');
      // Navigate the top-level browser window, not the embedded Base44 frame.
      // This avoids both Clover's iframe refusal and the about:blank popup race.
      window.top.location.href = authorizeUrl;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to start Clover authorization. Please sign in and try again.');
      setStarting(false);
    }
  };

  const connected = connection?.connected === true;

  return (
    <div className="bg-card border rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-2">Clover Point of Sale</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Sign in to Clover as {storeName}’s owner and approve access so Alcohol Delivered can use that merchant’s catalog, pricing, tax and inventory. Each retailer authorizes its own Clover merchant.
      </p>
      {returned === 'connected' && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 mb-4"><CheckCircle2 className="w-4 h-4" /> {returnedMessage || 'Clover was connected.'} Verify the connection below; this redirect is not proof of authorization.</p>
      )}
      {returned && returned !== 'connected' && (
        <p className="flex items-start gap-2 text-sm text-destructive mb-4"><AlertCircle className="w-4 h-4 mt-0.5" /> {returnedMessage || 'Clover was not connected. Please try again.'}</p>
      )}
      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive mb-4"><AlertCircle className="w-4 h-4 mt-0.5" /> {error}</p>
      )}
      {connection && (
        <p className={`flex items-start gap-2 text-sm mb-4 ${connected ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
          {connected ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
          <span>{connection.reason}</span>
        </p>
      )}
      <Button type="button" onClick={startClover} disabled={starting}>
        {starting
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening Clover…</>
          : <>{connected ? 'Reconnect Clover register' : 'Connect Clover register'} <ExternalLink className="w-4 h-4 ml-2" /></>}
      </Button>
    </div>
  );
}