import React, { useEffect, useState } from 'react';
import { Loader2, PlugZap, RefreshCw, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CloverCredentialPanel({ onComplete, isAdmin = false, showSync = true }) {
  const [merchantId, setMerchantId] = useState('YJSBZTD0WJ201');
  const [apiToken, setApiToken] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const reset = () => { if (document.visibilityState === 'visible') setBusy(value => value === 'oauth' ? '' : value); };
    window.addEventListener('focus', reset);
    document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('focus', reset); document.removeEventListener('visibilitychange', reset); };
  }, []);

  const act = async (action) => {
    setBusy(action); setMessage('');
    try {
      const response = await base44.functions.invoke('manageBeverageKingClover', { action, merchantId, apiToken });
      setMessage(response.data.message);
      if (action === 'connect') setApiToken('');
      await onComplete();
    } catch (error) { setMessage(error.response?.data?.error || error.message); }
    finally { setBusy(''); }
  };

  const startOAuth = async () => {
    setBusy('oauth');
    setMessage('');

    // Open the destination tab synchronously during the user's click so popup
    // blockers (and the cross-origin Base44 editor iframe) don't swallow the
    // redirect that happens after the async function call returns.
    const isFramed = window.self !== window.top;
    const cloverTab = isFramed ? window.open('', '_blank') : null;
    if (isFramed && !cloverTab) {
      setMessage('Allow popups to continue to Clover authorization.');
      setBusy('');
      return;
    }

    try {
      const response = await base44.functions.invoke('startBeverageKingCloverOAuth', {});
      const authorizeUrl = response?.data?.authorize_url;
      if (!authorizeUrl) throw new Error(response?.data?.error || 'Unable to start Clover authorization.');

      if (cloverTab) {
        cloverTab.opener = null;
        cloverTab.location.replace(authorizeUrl);
      } else {
        window.location.assign(authorizeUrl);
      }
    } catch (error) {
      cloverTab?.close();
      setMessage(error?.response?.data?.error || error?.message || 'Unable to start Clover authorization.');
      setBusy('');
    }
  };

  return <section className="rounded-xl border bg-card p-5 space-y-4">
    <div><h2 className="font-semibold">Beverage King Clover</h2><p className="text-sm text-muted-foreground">Authorize Beverage King through Clover, then import its catalog.</p></div>
    <Button className="w-full" onClick={startOAuth} disabled={!!busy}>
      {busy === 'oauth' ? <><Loader2 className="animate-spin" /> Opening Clover…</> : 'Authorize through Clover'}
    </Button>
    <p className="text-xs text-muted-foreground">Sign in to Clover and approve access to Beverage King. Then complete the inventory step.</p>
    {isAdmin && <div className="grid sm:grid-cols-2 gap-3"><Input value={merchantId} readOnly aria-label="Beverage King merchant ID" /><Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} aria-label="Clover API token (admin fallback)" placeholder="Clover API token (admin fallback)" /></div>}
    <div className="flex flex-wrap gap-2">
      {isAdmin && <Button onClick={() => act('connect')} disabled={!!busy || !apiToken}>{busy === 'connect' ? <Loader2 className="animate-spin" /> : <PlugZap />} Save and verify</Button>}
      {showSync && <Button variant="outline" onClick={() => act('sync')} disabled={!!busy}>{busy === 'sync' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync inventory</Button>}
      {isAdmin && <Button variant="destructive" onClick={() => act('clear')} disabled={!!busy}>{busy === 'clear' ? <Loader2 className="animate-spin" /> : <Trash2 />} Clear credential</Button>}
    </div>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
  </section>;
}