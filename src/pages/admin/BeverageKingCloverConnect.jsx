import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, CheckCircle2, KeyRound, ShieldCheck, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
// The platform's own Clover app client_id connects ONLY to "Alcohol Delivered LLC".
// Beverage King must authorize its OWN Clover app — so we do NOT prefill the
// platform ID here (prefilling it is what caused the wrong-merchant connection).
const PLATFORM_APP_ID = '0669dc706397718d01b810c1eb52a7f4';

export default function BeverageKingCloverConnect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Credentials remain server-side. Connection state is verified through the
  // backend action rather than by exposing StorePosCredential to the browser.
  useEffect(() => {
    setLoading(false);
  }, []);

  // Auto-capture ?code= from the Clover redirect so the merchant never copy/pastes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) setAuthCode(code);
    const mid = params.get('merchant_id');
    if (mid) setMerchantId(mid);
    if (code || mid) {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('merchant_id');
      window.history.replaceState({}, '', url.toString());
      toast.success('Authorization captured! Click Connect to finish.');
    }
  }, []);

  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const redirectUri = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  // Target the authorize URL at Beverage King's merchant when the merchant_id is
  // known — Clover then pre-selects the correct merchant instead of defaulting to
  // whatever merchant the logged-in Clover account owns (often the platform one).
  const authUrl = appId
    ? `https://www.clover.com/oauth/v2/authorize?client_id=${encodeURIComponent(appId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}${merchantId.trim() ? `&merchant_id=${encodeURIComponent(merchantId.trim())}` : ''}`
    : '';
  const usingPlatformApp = appId.trim() === PLATFORM_APP_ID;

  const handleConnect = async () => {
    if (!appId.trim() || !authCode.trim()) {
      toast.error('Authorization Code is required (captured automatically after you authorize).');
      return;
    }
    setExchanging(true);
    setExchangeError(null);
    try {
      const res = await base44.functions.invoke('cloverOAuthExchange', {
        app_id: appId.trim(),
        app_secret: appSecret.trim() || undefined,
        code: authCode.trim(),
        store_id: BEVERAGE_KING_STORE_ID,
        merchant_id: merchantId.trim() || undefined,
      });
      const d = res.data;
      if (d?.success) {
        toast.success('Clover connected! Your merchant is now authorized.');
        setConnected(true);
        setAuthCode('');
        // Confirm merchant-scoped auth, then rerun the inventory sync.
        handleVerify();
      } else {
        setExchangeError(d);
        toast.error(d?.error || 'Connection failed', { duration: 8000 });
      }
    } catch (e) {
      const errData = e?.response?.data || { error: e.message };
      setExchangeError(errData);
      toast.error('Connection failed: ' + (errData.error || e.message), { duration: 8000 });
    } finally {
      setExchanging(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await base44.functions.invoke('verifyCloverOrderConnection', { store_id: BEVERAGE_KING_STORE_ID });
      setVerifyResult(res.data);
      if (res.data?.merchant_scoped_auth?.ok || res.data?.connected) {
        toast.success('Connection verified ✓ — merchant-scoped auth confirmed. Syncing inventory…');
        handleSyncInventory();
      } else {
        toast.error('Verification failed — see details below', { duration: 8000 });
      }
    } catch (e) {
      setVerifyResult({ error: e?.response?.data?.error || e.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncCloverInventory', { store_id: BEVERAGE_KING_STORE_ID });
      setSyncResult(res.data);
      if (res.data?.success) {
        toast.success(`Inventory synced — ${res.data.clover_items_fetched} items · ${res.data.created} created · ${res.data.updated} updated`);
      } else if (res.data?.action === 'authorize') {
        toast.error('Authorization required — re-authorize Beverage King with Clover (Step 1).', { duration: 8000 });
      } else {
        toast.error(res.data?.error || 'Inventory sync failed', { duration: 8000 });
      }
    } catch (e) {
      setSyncResult({ error: e?.response?.data?.error || e.message });
      toast.error('Inventory sync failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setSyncing(false);
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
        <h1 className="font-display text-2xl font-bold">Beverage King — Clover Setup</h1>
        <p className="text-muted-foreground mt-1 text-sm">Three quick steps to connect your Clover merchant.</p>
      </div>

      {connected && (
        <Card className="p-4 border-emerald-200 bg-emerald-50/60 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium text-sm text-emerald-800">Already connected</p>
            <p className="text-xs text-emerald-700">Your merchant-scoped token is saved. Re-authorize below if it expired.</p>
          </div>
        </Card>
      )}

      {/* Step 1 — Authorize */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="font-semibold">Authorize your merchant</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Click the button, log in as Beverage King on Clover, and click <b>Allow</b>. You'll come right back here automatically.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Use Beverage King's OWN Clover app</p>
          <p>Enter the <b>Client ID of Beverage King's own Clover app</b> (created in the Clover Developer Dashboard under the Beverage King merchant, with INVENTORY + ORDERS permissions). Do <b>not</b> use the platform app — that connects to "Alcohol Delivered LLC" and orders would route to the wrong POS.</p>
        </div>
        <div>
          <Label className="text-xs">Clover App ID (Client ID) — <span className="text-amber-700 font-semibold">Beverage King's app</span></Label>
          <Input value={appId} onChange={e => setAppId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Beverage King's app Client ID" />
          {usingPlatformApp && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> That's the <b>platform</b> app ID — it connects to "Alcohol Delivered LLC", not Beverage King. Use Beverage King's own app Client ID.
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs">Beverage King Merchant ID <span className="text-muted-foreground">— optional, targets the correct merchant</span></Label>
          <Input value={merchantId} onChange={e => setMerchantId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Auto-filled after authorize — or paste Beverage King's Clover merchant ID" />
        </div>
        {inIframe && authUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Open the published app to authorize</p>
            <p className="text-xs">Clover's authorization page can't open inside the builder preview iframe. Use the button below to open it in a real browser tab, or open the live app directly.</p>
            <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Open Clover Authorize in new tab
              </Button>
            </a>
          </div>
        )}
        {authUrl && !inIframe && (
          <a href={authUrl} target="_blank" rel="noopener noreferrer">
            <Button className="w-full gap-2" size="lg">
              <ExternalLink className="w-4 h-4" /> Authorize Merchant
            </Button>
          </a>
        )}
        {!authUrl && (
          <p className="text-xs text-muted-foreground">Enter your App ID above to enable the button.</p>
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
          <h3 className="font-semibold">Enter your App Secret & connect</h3>
        </div>
        <div>
          <Label className="text-xs">Clover App Secret (Client Secret) <span className="text-muted-foreground">— optional</span></Label>
          <Input type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Leave blank to use the platform default" />
        </div>
        <div>
          <Label className="text-xs">Authorization Code</Label>
          <Input value={authCode} onChange={e => setAuthCode(e.target.value)} className="mt-1 font-mono text-xs" placeholder="Auto-filled after you authorize, or paste manually" />
        </div>
        <Button onClick={handleConnect} disabled={exchanging || !authCode.trim() || usingPlatformApp} className="w-full gap-2" size="lg">
          {exchanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {exchanging ? 'Connecting…' : 'Connect'}
        </Button>
        <p className="text-xs text-muted-foreground">If left blank, the platform's stored Clover App Secret is used automatically. Either way, the secret is never stored or shared.</p>
        {exchangeError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {exchangeError.error}</p>
            {exchangeError.authorized_merchant_name && (
              <p>Authorized merchant: <b>{exchangeError.authorized_merchant_name}</b> (ID {exchangeError.authorized_merchant_id || '—'})</p>
            )}
            {exchangeError.fix && <p className="text-red-700">{exchangeError.fix}</p>}
          </div>
        )}
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
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">{JSON.stringify(verifyResult, null, 2)}</pre>
        )}
      </Card>

      {/* Step 4 — Sync inventory */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="font-semibold">Sync inventory from Clover</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Pulls Beverage King's live Clover items into the catalog. Runs automatically after a verified connection — you can also re-run it any time.
        </p>
        <Button onClick={handleSyncInventory} disabled={syncing || !connected} variant="outline" className="w-full gap-2">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing…' : 'Sync Inventory Now'}
        </Button>
        {syncResult && (
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-56">{JSON.stringify(syncResult, null, 2)}</pre>
        )}
        {syncResult?.action === 'authorize' && (
          <a href="/admin/beverage-king-clover">
            <Button variant="link" className="w-full h-auto py-1 text-sm">Authorize Beverage King with Clover →</Button>
          </a>
        )}
      </Card>
    </div>
  );
}