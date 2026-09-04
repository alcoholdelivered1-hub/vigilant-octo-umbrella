import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, CheckCircle2, KeyRound, ShieldCheck, ArrowLeft, Store as StoreIcon } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_APP_ID = '0669dc706397718d01b810c1eb52a7f4';
const SELECTED_STORE_KEY = 'clover_connect_store_id';

export default function CloverRetailerConnect() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [cred, setCred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const [appSecret, setAppSecret] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [connected, setConnected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // Load stores list once
  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Store.list('-name', 200);
        // Show ALL stores (including inactive) so admins can onboard any retailer
        // whose Clover setup is still pending — e.g. Beverage King.
        setStores(list || []);
        const saved = localStorage.getItem(SELECTED_STORE_KEY);
        if (saved && (list || []).some(s => s.id === saved)) {
          setStoreId(saved);
        }
      } catch (_) { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load the selected store's existing credential
  useEffect(() => {
    if (!storeId) { setCred(null); setConnected(false); setStoreName(''); return; }
    localStorage.setItem(SELECTED_STORE_KEY, storeId);
    const s = stores.find(x => x.id === storeId);
    setStoreName(s?.name || '');
    (async () => {
      try {
        const creds = await base44.entities.StorePosCredential.filter({ store_id: storeId });
        if (creds[0]) {
          setCred(creds[0]);
          setAppId(creds[0].app_id || DEFAULT_APP_ID);
          if (creds[0].app_id && creds[0].api_token) setConnected(true);
        } else {
          setCred(null);
          setConnected(false);
          setAppId(DEFAULT_APP_ID);
        }
      } catch (_) { /* ignore */ }
    })();
  }, [storeId, stores]);

  // Auto-capture ?code= from the Clover redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAuthCode(code);
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
      toast.success('Authorization code captured! Enter your App Secret and click Connect.');
    }
  }, []);

  const authUrl = appId
    ? `https://www.clover.com/oauth/authorize?client_id=${encodeURIComponent(appId)}&response_type=code`
    : '';

  const handleConnect = async () => {
    if (!storeId) { toast.error('Select a retailer first.'); return; }
    if (!appId.trim() || !appSecret.trim() || !authCode.trim()) {
      toast.error('App Secret and Authorization Code are both required.');
      return;
    }
    setExchanging(true);
    try {
      const res = await base44.functions.invoke('cloverOAuthExchange', {
        app_id: appId.trim(),
        app_secret: appSecret.trim(),
        code: authCode.trim(),
        store_id: storeId,
      });
      const d = res.data;
      if (d?.success) {
        toast.success(`${storeName} is now connected to Clover.`);
        setConnected(true);
        setAuthCode('');
      } else {
        toast.error(d?.error || 'Connection failed', { duration: 8000 });
      }
    } catch (e) {
      toast.error('Connection failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setExchanging(false);
    }
  };

  const handleVerify = async () => {
    if (!storeId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await base44.functions.invoke('verifyCloverOrderConnection', { store_id: storeId });
      setVerifyResult(res.data);
      if (res.data?.merchant_scoped_auth?.ok || res.data?.connected) {
        toast.success('Connection verified ✓');
      } else {
        toast.error('Verification failed — see details below', { duration: 8000 });
      }
    } catch (e) {
      setVerifyResult({ error: e?.response?.data?.error || e.message });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <h1 className="font-display text-2xl font-bold">Clover POS — Retailer Onboarding</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connect any retailer's Clover merchant with a merchant-scoped OAuth token.</p>
      </div>

      {/* Store selector */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StoreIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">Select a retailer</h3>
        </div>
        <select
          value={storeId}
          onChange={e => setStoreId(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Choose a store…</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
          ))}
        </select>
        {storeName && (
          <p className="text-xs text-muted-foreground">Onboarding <b>{storeName}</b>. The merchant-scoped token is saved only to this store's credential record — no shared token is used.</p>
        )}
      </Card>

      {storeId && (
        <>
          {connected && (
            <Card className="p-4 border-emerald-200 bg-emerald-50/60 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-sm text-emerald-800">Already connected</p>
                <p className="text-xs text-emerald-700">A merchant-scoped token is on file. Re-authorize below if it expired.</p>
              </div>
            </Card>
          )}

          {/* Step 1 — Authorize */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-semibold">Authorize the merchant</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              The retailer clicks the button, logs in to Clover, and clicks <b>Allow</b>. They'll be redirected back here automatically.
            </p>
            <div>
              <Label className="text-xs">Clover App ID (Client ID)</Label>
              <Input value={appId} onChange={e => setAppId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="App ID / Client ID" />
            </div>
            {authUrl ? (
              <a href={authUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2" size="lg">
                  <ExternalLink className="w-4 h-4" /> Authorize Merchant
                </Button>
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Enter the App ID above to enable the button.</p>
            )}
            {authCode && (
              <p className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Authorization code captured — ready for step 2.
              </p>
            )}
          </Card>

          {/* Step 2 — Connect */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-semibold">Enter the App Secret & connect</h3>
            </div>
            <div>
              <Label className="text-xs">Clover App Secret (Client Secret)</Label>
              <Input type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Your Clover app's client secret" />
            </div>
            <div>
              <Label className="text-xs">Authorization Code</Label>
              <Input value={authCode} onChange={e => setAuthCode(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Auto-filled after authorization, or paste manually" />
            </div>
            <Button onClick={handleConnect} disabled={exchanging || !appSecret.trim() || !authCode.trim()} className="w-full gap-2" size="lg">
              {exchanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {exchanging ? 'Connecting…' : 'Connect'}
            </Button>
            <p className="text-xs text-muted-foreground">The App Secret is used once to exchange the authorization code for the merchant token. It is saved to the retailer's credential record only.</p>
          </Card>

          {/* Step 3 — Verify */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-semibold">Verify the connection</h3>
            </div>
            <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {verifying ? 'Verifying…' : 'Verify Connection'}
            </Button>
            {verifyResult && (
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64">{JSON.stringify(verifyResult, null, 2)}</pre>
            )}
          </Card>
        </>
      )}
    </div>
  );
}