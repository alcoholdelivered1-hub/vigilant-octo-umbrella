import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Link2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const POS_OPTIONS = [
  { value: 'clover', label: 'Clover', needs: ['merchant_id', 'api_token', 'app_id'] },
  { value: 'square', label: 'Square', needs: ['merchant_id', 'api_token'] },
  { value: 'toast', label: 'Toast', needs: ['merchant_id', 'api_token'] },
  { value: 'ncr', label: 'NCR', needs: ['merchant_id', 'api_token'] },
  { value: 'lightspeed', label: 'Lightspeed', needs: ['merchant_id', 'api_token', 'api_secret'] },
  { value: 'shopkeep', label: 'ShopKeep', needs: ['merchant_id', 'api_token'] },
  { value: 'other', label: 'Other', needs: ['merchant_id', 'api_token'] },
  { value: 'none', label: 'No POS / Manual', needs: [] },
];

const DEFAULT_APP_ID = '0669dc706397718d01b810c1eb52a7f4';

export default function PosCredentialsForm({ store }) {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [exchanging, setExchanging] = useState(false);
  // Admin-only secure manual token entry (write-only, verified server-side)
  const [adminMerchantId, setAdminMerchantId] = useState('');
  const [adminApiToken, setAdminApiToken] = useState('');
  const [adminEnv, setAdminEnv] = useState('production');
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [adminResult, setAdminResult] = useState(null);

  // Auto-capture ?code= and ?merchant_id= from the Clover v2 OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const mid = params.get('merchant_id');
    if (code) setAuthCode(code);
    if (mid) setMerchantId(mid);
    if (code || mid) {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('merchant_id');
      window.history.replaceState({}, '', url.toString());
      if (code) toast.success('Authorization captured! Click Connect via OAuth to finish.');
    }
  }, []);
  const [form, setForm] = useState({
    pos_system: store?.pos_system || 'clover',
    merchant_id: '',
    api_token: '',
    api_secret: '',
    app_id: '',
    environment: 'production',
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ['store-pos-credential', store?.id],
    queryFn: () => base44.entities.StorePosCredential.filter({ store_id: store?.id }),
    enabled: !!store?.id,
  });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const existingCred = existing?.[0];

  useEffect(() => {
    if (existingCred) {
      setForm({
        pos_system: existingCred.pos_system || store?.pos_system || 'clover',
        merchant_id: existingCred.merchant_id || '',
        api_token: existingCred.api_token || '',
        api_secret: existingCred.api_secret || '',
        app_id: existingCred.app_id || '',
        environment: existingCred.environment || 'production',
      });
    }
  }, [existingCred]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isConfigured = !!(form.merchant_id && form.api_token);
      const payload = {
        store_id: store.id,
        store_name: store.name,
        store_email: store.email,
        pos_system: form.pos_system,
        merchant_id: form.merchant_id,
        api_token: form.api_token,
        api_secret: form.api_secret,
        app_id: form.app_id,
        environment: form.environment,
        is_configured: isConfigured,
      };

      if (existingCred) {
        return base44.entities.StorePosCredential.update(existingCred.id, payload);
      }
      return base44.entities.StorePosCredential.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-pos-credential'] });
      queryClient.invalidateQueries({ queryKey: ['my-pos-credential'] });
      toast.success('POS credentials saved successfully!');
    },
    onError: (e) => {
      toast.error(e?.response?.data?.error || 'Failed to save credentials');
    },
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleOAuthExchange = async () => {
    if (!authCode.trim()) {
      toast.error('Click Authorize Merchant first to get an authorization code.');
      return;
    }
    setExchanging(true);
    try {
      const res = await base44.functions.invoke('cloverOAuthExchange', {
        app_id: form.app_id.trim() || DEFAULT_APP_ID,
        code: authCode.trim(),
        store_id: store.id,
        merchant_id: merchantId.trim() || undefined,
      });
      const d = res.data;
      if (d?.success) {
        toast.success(`Connected! Token saved for ${store.name}`);
        setAuthCode('');
        setMerchantId('');
        queryClient.invalidateQueries({ queryKey: ['store-pos-credential', store.id] });
        queryClient.invalidateQueries({ queryKey: ['my-pos-credential', store.id] });
      } else {
        toast.error(d?.error || 'OAuth exchange failed', { duration: 8000 });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'unknown error';
      toast.error('Connection failed: ' + msg, { duration: 8000 });
    } finally {
      setExchanging(false);
    }
  };

  const handleAdminSecureSave = async () => {
    if (!adminMerchantId.trim() || !adminApiToken.trim()) {
      toast.error('Merchant ID and API token are required.');
      return;
    }
    setAdminVerifying(true);
    setAdminResult(null);
    try {
      const res = await base44.functions.invoke('saveCloverCredentialSecure', {
        store_id: store.id,
        merchant_id: adminMerchantId.trim(),
        api_token: adminApiToken.trim(),
        environment: adminEnv,
      });
      const d = res.data;
      setAdminResult(d);
      if (d?.success && d?.verified) {
        toast.success(`Verified & saved — merchant: ${d.merchant_name}`);
        setAdminApiToken('');
        setAdminMerchantId('');
        queryClient.invalidateQueries({ queryKey: ['store-pos-credential', store.id] });
        queryClient.invalidateQueries({ queryKey: ['admin-pos-credentials'] });
      } else {
        toast.error(d?.reason || d?.error || 'Verification failed', { duration: 8000 });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setAdminResult({ error: msg });
      toast.error('Secure save failed: ' + msg, { duration: 8000 });
    } finally {
      setAdminVerifying(false);
    }
  };

  const posConfig = POS_OPTIONS.find(p => p.value === form.pos_system) || POS_OPTIONS[0];
  const needsField = (field) => posConfig.needs.includes(field);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-2xl p-5 space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
        <p className="font-semibold">Important for retailer payments</p>
        <p className="mt-1">
          Clover connects your POS for inventory and order sync. Stripe Express must also be set up so your store can receive payouts. Complete both before going live.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="/stripe-express" className="font-medium underline">Set up Stripe Express</a>
          <a href="/store/clover-connect" className="font-medium underline">Connect Clover</a>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Connect Your POS System</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter your POS credentials so we can sync your inventory and sales automatically.
          </p>
        </div>
        {existingCred?.is_configured && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
          </Badge>
        )}
      </div>

      {/* POS System Selector */}
      <div className="space-y-2">
        <Label>POS System *</Label>
        <Select value={form.pos_system} onValueChange={v => update('pos_system', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {POS_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.pos_system === 'none' ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <ShieldCheck className="w-4 h-4 inline mr-1" />
          No problem — you can add products manually in the Store Dashboard. You can connect a POS system later.
        </div>
      ) : (
        <>
          {/* Merchant ID */}
          <div className="space-y-2">
            <Label>
              {form.pos_system === 'square' ? 'Location ID' : 'Merchant ID'} *
            </Label>
            <Input
              value={form.merchant_id}
              onChange={e => update('merchant_id', e.target.value)}
              placeholder={form.pos_system === 'clover' ? 'e.g. 6a32d14d09b760f5...' : 'Your POS merchant ID'}
              className="font-mono text-sm"
            />
          </div>

          {/* API Token */}
          <div className="space-y-2">
            <Label>API Token / Access Token *</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={form.api_token}
                onChange={e => update('api_token', e.target.value)}
                placeholder="Your POS API token"
                className="font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* App ID (Clover) */}
          {needsField('app_id') && (
            <div className="space-y-2">
              <Label>App ID / Client ID</Label>
              <Input
                value={form.app_id}
                onChange={e => update('app_id', e.target.value)}
                placeholder="Your POS app/client ID (optional)"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Some POS systems require an App ID in addition to the API token.</p>
            </div>
          )}

          {/* API Secret */}
          {needsField('api_secret') && (
            <div className="space-y-2">
              <Label>API Secret / Client Secret</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={form.api_secret}
                  onChange={e => update('api_secret', e.target.value)}
                  placeholder="Your POS API secret"
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Environment */}
          <div className="space-y-2">
            <Label>Environment</Label>
            <Select value={form.environment} onValueChange={v => update('environment', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production (Live)</SelectItem>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clover OAuth — authorize this merchant and exchange the code (v2) */}
          {form.pos_system === 'clover' && (
            <div className="space-y-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Authorize this merchant via Clover OAuth</p>
              </div>
              {(() => {
                const inIframe = typeof window !== 'undefined' && window.self !== window.top;
                // Canonical redirect URI — must match the Clover Developer
                // Dashboard. Always the live /store/clover-connect route, even
                // when this form is opened from /admin/stores.
                const redirectUri = typeof window !== 'undefined' ? window.location.origin + '/store/clover-connect' : '';
                const appId = form.app_id.trim() || DEFAULT_APP_ID;
                const authUrl = `https://www.clover.com/oauth/v2/authorize?client_id=${encodeURIComponent(appId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
                return (
                  <>
                    {inIframe ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 space-y-1">
                        <p className="font-semibold">Open the published app to authorize</p>
                        <p>Clover's authorization page can't open inside the builder preview. Open the live app, or copy this link into a new browser tab:</p>
                        <div className="break-all text-[10px] font-mono bg-white rounded px-1.5 py-1">{authUrl}</div>
                      </div>
                    ) : (
                      <a
                        href={authUrl}
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium underline"
                      >
                        Authorize Merchant <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                );
              })()}
              <p className="text-xs text-muted-foreground">
                After the merchant clicks <b>Allow</b>, Clover redirects back here with
                <code className="bg-white px-1 rounded mx-0.5">?code=…&amp;merchant_id=…</code> — both values are captured automatically below.
              </p>
              <div className="space-y-2">
                <Label>Authorization Code</Label>
                <Input
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  placeholder="Auto-filled after authorization"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Merchant ID</Label>
                <Input
                  value={merchantId}
                  onChange={e => setMerchantId(e.target.value)}
                  placeholder="Auto-filled after authorization"
                  className="font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full gap-2"
                disabled={exchanging || !authCode.trim()}
                onClick={handleOAuthExchange}
              >
                {exchanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {exchanging ? 'Connecting…' : 'Connect via OAuth'}
              </Button>
              <p className="text-xs text-muted-foreground">Uses our platform Clover app — no app secret needed from you.</p>
            </div>
          )}

          {/* Admin-only secure manual token entry — token is write-only & verified server-side */}
          {form.pos_system === 'clover' && user?.role === 'admin' && (
            <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-primary">Secure Manual Token Entry (Admin)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a fresh Clover API token. It is verified read-only against Clover and saved encrypted server-side — never shown in logs, page code, or chat.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Clover Merchant ID *</Label>
                <Input value={adminMerchantId} onChange={e => setAdminMerchantId(e.target.value)} placeholder="e.g. 5428143500034529" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Fresh API Token *</Label>
                <Input type="password" value={adminApiToken} onChange={e => setAdminApiToken(e.target.value)} placeholder="Paste fresh Clover API token" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Environment</Label>
                <Select value={adminEnv} onValueChange={setAdminEnv}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production (Live)</SelectItem>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="w-full gap-2" disabled={adminVerifying || !adminMerchantId.trim() || !adminApiToken.trim()} onClick={handleAdminSecureSave}>
                {adminVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {adminVerifying ? 'Verifying & Saving…' : 'Verify & Save Securely'}
              </Button>
              {adminResult && (
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-56">{JSON.stringify(adminResult, null, 2)}</pre>
              )}
            </div>
          )}

          {/* Security note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Your credentials are encrypted and only visible to you and the app administrator. They are never shared publicly.
            </p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!form.merchant_id && form.pos_system !== 'none')}
            className="w-full gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {existingCred ? 'Update Credentials' : 'Save Credentials'}
          </Button>
        </>
      )}

      {form.pos_system === 'none' && existingCred && (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Confirm
        </Button>
      )}
    </div>
  );
}