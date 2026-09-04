import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, CheckCircle2, KeyRound, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import DownloadContractButton from '@/components/partner/DownloadContractButton';

const DEFAULT_APP_ID = '0669dc706397718d01b810c1eb52a7f4';

export default function CloverConnect({ storeId: propStoreId }) {
  const navigate = useNavigate();
  const embedded = !!propStoreId;
  const [storeId, setStoreId] = useState(propStoreId || '');
  const [storeName, setStoreName] = useState('');
  const [cred, setCred] = useState(null);
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const [authCode, setAuthCode] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [connected, setConnected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  // Resolve the retailer's store by matching their login email to Store.email
  useEffect(() => {
    if (propStoreId) { setStoreId(propStoreId); return; }
    (async () => {
      if (!user?.email) return;
      try {
        const stores = await base44.entities.Store.filter({ email: user.email });
        if (stores[0]) { setStoreId(stores[0].id); setStoreName(stores[0].name); }
      } catch (_) { /* ignore */ }
    })();
  }, [user?.email, propStoreId]);

  // Load any existing Clover credential for this store
  useEffect(() => {
    if (!storeId) { setCred(null); setConnected(false); return; }
    (async () => {
      try {
        const creds = await base44.entities.StorePosCredential.filter({ store_id: storeId });
        if (creds[0]) {
          setCred(creds[0]);
          setAppId(creds[0].app_id || DEFAULT_APP_ID);
          if (creds[0].app_id && creds[0].api_token) setConnected(true);
          if (!storeName) setStoreName(creds[0].store_name || '');
        }
      } catch (_) { /* ignore */ }
    })();
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-capture ?code= from the Clover redirect
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
  // Canonical redirect URI — must match the value registered in the Clover
  // Developer Dashboard. Using the live /store/clover-connect route (not the
  // current pathname) ensures OAuth works even when this component is embedded
  // on another page (e.g. the partner dashboard or builder preview).
  const redirectUri = typeof window !== 'undefined' ? window.location.origin + '/store/clover-connect' : '';
  const authUrl = appId
    ? `https://www.clover.com/oauth/v2/authorize?client_id=${encodeURIComponent(appId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`
    : '';

  const handleConnect = async () => {
    if (!storeId) { toast.error('No store linked to your account.'); return; }
    if (!authCode.trim()) {
      toast.error('Click "Authorize Merchant" first to get an authorization code.');
      return;
    }
    setExchanging(true);
    try {
      const res = await base44.functions.invoke('cloverOAuthExchange', {
        app_id: appId.trim(),
        code: authCode.trim(),
        store_id: storeId,
        merchant_id: merchantId.trim() || undefined,
      });
      const d = res.data;
      if (d?.success) {
        toast.success(`${storeName || 'Your store'} is now connected to Clover.`);
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

  return (
    <div className={embedded ? '' : 'max-w-xl mx-auto px-4 py-8 space-y-5'}>
      {!embedded && (
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Connect Your Clover POS</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Authorize Alcohol Delivered to sync your menu, prices, and orders with your Clover register.
          </p>
        </div>
        {storeId && <DownloadContractButton storeId={storeId} className="shrink-0" />}
      </div>

      {storeName && <p className="text-sm">Onboarding <b>{storeName}</b>.</p>}

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
          Click the button, log in to Clover, and click <b>Allow</b>. You'll be redirected back here automatically.
        </p>
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
          <p className="text-xs text-muted-foreground">Loading…</p>
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
          <h3 className="font-semibold">Connect</h3>
        </div>
        <div>
          <Label className="text-xs">Authorization Code</Label>
          <Input
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            className="mt-1 font-mono text-xs"
            placeholder="Auto-filled after authorization"
          />
        </div>
        <Button onClick={handleConnect} disabled={exchanging || !authCode.trim()} className="w-full gap-2" size="lg">
          {exchanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {exchanging ? 'Connecting…' : 'Connect'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your Clover merchant token is saved securely to your store only. No shared tokens are used, and your Clover app secret never leaves our server.
        </p>
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
    </div>
  );
}