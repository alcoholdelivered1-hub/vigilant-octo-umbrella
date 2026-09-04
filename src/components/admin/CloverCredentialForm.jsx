import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Save, ExternalLink, Link2, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

export default function CloverCredentialForm({ onSaved }) {
  const [cred, setCred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Manual entry fields (fallback)
  const [apiToken, setApiToken] = useState('');
  const [merchantId, setMerchantId] = useState('');

  // OAuth flow fields
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const callbackUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) { /* clipboard blocked */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const creds = await base44.entities.StorePosCredential.filter({ store_id: BEVERAGE_KING_STORE_ID });
        if (creds[0]) {
          setCred(creds[0]);
          setApiToken(creds[0].api_token || '');
          setMerchantId(creds[0].merchant_id || '');
          setAppId(creds[0].app_id || '');
          // OAuth was used if an app_id is stored alongside the token
          if (creds[0].app_id && creds[0].api_token) {
            setOauthConnected(true);
          }
        }
      } catch (e) {
        console.error('Failed to load credential:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const authUrl = appId
    ? `https://www.clover.com/oauth/authorize?client_id=${encodeURIComponent(appId)}&response_type=code`
    : '';

  const handleOAuthExchange = async () => {
    if (!appId.trim() || !appSecret.trim() || !authCode.trim()) {
      toast.error('App ID, App Secret, and Authorization Code are all required');
      return;
    }
    setExchanging(true);
    try {
      const res = await base44.functions.invoke('cloverOAuthExchange', {
        app_id: appId.trim(),
        app_secret: appSecret.trim(),
        code: authCode.trim(),
        store_id: BEVERAGE_KING_STORE_ID,
      });
      const d = res.data;
      if (d?.success) {
        toast.success(`Connected! Token: ${d.access_token_preview}`);
        setOauthConnected(true);
        setApiToken('');
        setAuthCode('');
        if (onSaved) onSaved();
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

  const handleSave = async () => {
    if (!apiToken.trim() || !merchantId.trim()) {
      toast.error('Both API Token and Merchant ID are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: BEVERAGE_KING_STORE_ID,
        store_name: 'BEVERAGE KING',
        store_email: 'bevking71603@gmail.com',
        pos_system: 'clover',
        merchant_id: merchantId.trim(),
        api_token: apiToken.trim(),
        app_id: appId.trim() || undefined,
        environment: 'production',
        is_configured: true,
      };
      if (cred) {
        await base44.entities.StorePosCredential.update(cred.id, payload);
      } else {
        await base44.entities.StorePosCredential.create(payload);
      }
      toast.success('Clover credentials updated — ready to sync!');
      if (onSaved) onSaved();
    } catch (e) {
      toast.error('Failed to save: ' + (e.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading credentials...
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4 border-amber-200 bg-amber-50/50">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-600" />
        <h3 className="font-semibold text-sm">Clover API Connection</h3>
        {oauthConnected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> OAuth Connected
          </span>
        )}
      </div>

      {/* OAuth Flow — Primary Method */}
      <div className="space-y-3 p-3 rounded-lg bg-white/60 border border-emerald-200">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-600" />
          <h4 className="font-medium text-xs text-emerald-700">Connect via OAuth (Recommended)</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          This is the official Clover method for production access. You'll need a Clover Developer App —
          create one at{' '}
          <a href="https://www.clover.com/global-developer-home" target="_blank" rel="noopener noreferrer"
             className="text-primary underline inline-flex items-center gap-0.5">
            Global Developer Dashboard <ExternalLink className="w-3 h-3" />
          </a>.
        </p>
        <div className="space-y-2">
          <div>
            <Label className="text-xs font-medium">Clover App ID (Client ID)</Label>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Your Clover app's client ID"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Clover App Secret (Client Secret)</Label>
            <Input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Your Clover app's client secret"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>

        <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-xs font-medium text-blue-700 mb-1">Base44 Callback URL — register this exact URL as your Clover App's Site URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-2 py-1.5 rounded text-xs break-all select-all">{callbackUrl}</code>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={copyCallback}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">In your Clover Developer App, set the Site URL to exactly this. After "Allow", Clover redirects here with <code className="bg-white px-1 rounded">?code=</code> — copy that code into the field below.</p>
        </div>

        {authUrl && (
          <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200">
            <p className="text-xs text-muted-foreground mb-1.5">Step 1 — Click to authorize your merchant:</p>
            <a href={authUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium underline">
              Authorize Merchant <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-1.5">
              After clicking "Allow", you'll be redirected to your app's URL with <code className="bg-white px-1 rounded">?code=XXXX</code> — copy that code.
            </p>
          </div>
        )}

        <div>
          <Label className="text-xs font-medium">Authorization Code (from redirect URL)</Label>
          <Input
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Paste the code from the redirect URL"
            className="mt-1 font-mono text-xs"
          />
        </div>
        <Button onClick={handleOAuthExchange} disabled={exchanging} className="w-full gap-2" size="sm">
          {exchanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {exchanging ? 'Connecting...' : 'Connect via OAuth'}
        </Button>
      </div>

      {/* Manual Token Entry — Fallback */}
      <div className="space-y-3 pt-2 border-t border-amber-200">
        <p className="text-xs text-muted-foreground font-medium">Or enter token manually (sandbox only):</p>
        <div className="space-y-2">
          <div>
            <Label className="text-xs font-medium">Merchant ID</Label>
            <Input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="e.g. 97cef02e-6df7-..."
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">API Token</Label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Paste Clover API token"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full gap-2" size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Manually'}
        </Button>
      </div>
    </Card>
  );
}