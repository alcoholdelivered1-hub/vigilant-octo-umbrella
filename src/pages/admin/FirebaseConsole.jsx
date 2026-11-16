import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2, Send, RefreshCw, Smartphone, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';
import FCMSetup from '@/components/notifications/FCMSetup';

export default function FirebaseConsole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [testTitle, setTestTitle] = useState('Test Push Notification');
  const [testBody, setTestBody] = useState('This is a test from the Firebase Console.');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState('');

  const health = useQuery({
    queryKey: ['firebase-health'],
    enabled: user?.role === 'admin',
    queryFn: async () => { const { data } = await base44.functions.invoke('checkFirebaseHealth'); return data; },
  });

  const tokens = useQuery({
    queryKey: ['fcm-tokens'],
    enabled: user?.role === 'admin',
    refetchInterval: 30000,
    queryFn: () => base44.entities.FCMToken.list('-created_date', 50),
  });

  const alerts = useQuery({
    queryKey: ['fcm-alerts'],
    enabled: user?.role === 'admin',
    refetchInterval: 30000,
    queryFn: () => base44.entities.RetailerApprovalAlert.filter({ recipient_user_id: user.id }, '-created_date', 10),
  });

  if (user?.role !== 'admin') return <Navigate to="/home" replace />;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['fcm-tokens'] });
    queryClient.invalidateQueries({ queryKey: ['fcm-alerts'] });
  };

  const sendTest = async () => {
    setSending(true);
    setSendError('');
    setSendResult(null);
    try {
      const { data } = await base44.functions.invoke('sendFCMPush', {
        user_emails: [user.email],
        title: testTitle,
        body: testBody,
        data: { type: 'console_test', sent_at: new Date().toISOString() },
      });
      setSendResult(data);
    } catch (err) {
      setSendError(err.response?.data?.error || err.message);
    } finally {
      setSending(false);
    }
  };

  const deleteToken = async (token) => {
    await base44.entities.FCMToken.delete(token.id);
    queryClient.invalidateQueries({ queryKey: ['fcm-tokens'] });
  };

  const configEntries = Object.entries(FIREBASE_CONFIG);
  const tokenList = tokens.data || [];
  const alertList = alerts.data || [];
  const sentCount = alertList.filter(a => a.push_status === 'sent').length;
  const failedCount = alertList.filter(a => a.push_status === 'failed').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Firebase Console</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Manage Firebase Cloud Messaging: project configuration, registered devices, test pushes, and delivery status.
          </p>
        </div>
        <Button size="icon" variant="outline" aria-label="Refresh" disabled={tokens.isFetching} onClick={refreshAll}>
          <RefreshCw className={tokens.isFetching ? 'animate-spin' : ''} />
        </Button>
      </header>

      {/* Service Account Health */}
      <section className={`rounded-xl border p-4 space-y-2 ${health.data?.healthy ? 'border-green-500' : health.data ? 'border-destructive' : ''}`}>
        <h2 className="font-semibold flex items-center gap-2">
          {health.data?.healthy ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : health.data ? <XCircle className="w-4 h-4 text-destructive" /> : <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
          Service Account Health
        </h2>
        {health.isLoading && <p role="status" className="text-sm text-muted-foreground">Checking Firebase credentials…</p>}
        {health.data?.healthy && (
          <div className="text-sm space-y-1">
            <p className="text-green-600">Credentials verified — push notifications are ready.</p>
            <p className="text-muted-foreground">Project: {health.data.project_id}</p>
            <p className="text-muted-foreground">Service account: {health.data.client_email}</p>
          </div>
        )}
        {health.data && !health.data.healthy && (
          <div className="text-sm space-y-1">
            <p className="text-destructive">{health.data.error}</p>
            {health.data.parse_error && <p className="text-muted-foreground">The secret value is not valid JSON. Copy the entire file contents from the downloaded .json.</p>}
            {health.data.missing_fields && <p className="text-muted-foreground">Missing: {health.data.missing_fields.join(', ')}</p>}
            <p className="text-muted-foreground">Fix in Settings → Secrets → FIREBASE_SERVICE_ACCOUNT, then refresh this page.</p>
          </div>
        )}
      </section>

      {/* Google Cloud Access */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Google Cloud Access</h2>
        <p className="text-sm text-muted-foreground">
          The app's service account isn't allowed to change project permissions, so team members are added by a project owner in the Google Cloud console.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Open the IAM &amp; Admin page with the button below.</li>
          <li>Click <strong className="text-foreground">Grant access</strong>.</li>
          <li>Add <strong className="text-foreground">gajendran.1087@gmail.com</strong> and choose the role <strong className="text-foreground">Owner</strong> (or Editor).</li>
          <li>Save. He can then sign in at console.cloud.google.com with that email.</li>
        </ol>
        <Button asChild>
          <a href={`https://console.cloud.google.com/iam-admin/iam?project=${health.data?.project_id || 'project-963d2d6b-eda5-4d8e-b5e'}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" /> Open IAM &amp; Grant Access
          </a>
        </Button>
      </section>

      {/* Project Configuration */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4" /> Project Configuration</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {configEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg border bg-background/50 px-3 py-2">
              <span className="block text-xs font-medium text-muted-foreground">{key}</span>
              <span className="block text-sm font-mono break-all">{value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-background/50 px-3 py-2">
          <span className="block text-xs font-medium text-muted-foreground">VAPID Key</span>
          <span className="block text-sm font-mono break-all">{FIREBASE_VAPID_KEY}</span>
        </div>
      </section>

      {/* Register This Device */}
      <section className="rounded-xl border bg-card p-4 space-y-2">
        <h2 className="font-semibold">Register This Device</h2>
        <p className="text-sm text-muted-foreground">
          Register the current browser or phone for push notifications. On iPhone/iPad, open the app from its home-screen icon first.
        </p>
        <FCMSetup firebaseConfig={FIREBASE_CONFIG} vapidKey={FIREBASE_VAPID_KEY} />
      </section>

      {/* Send Test Push */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4" /> Send Test Push</h2>
        <p className="text-sm text-muted-foreground">Sends a test notification to your registered devices only.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Title
            <input className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={testTitle} onChange={e => setTestTitle(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Body
            <input className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={testBody} onChange={e => setTestBody(e.target.value)} />
          </label>
        </div>
        <Button disabled={sending} onClick={sendTest}>
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Send Test Push'}
        </Button>
        {sendError && <p role="alert" className="text-sm text-destructive flex items-center gap-1"><XCircle className="w-4 h-4" /> {sendError}</p>}
        {sendResult?.success && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Push sent to {sendResult.tokens_targeted} device(s).</p>}
        {sendResult?.error && <p className="text-sm text-destructive flex items-center gap-1"><XCircle className="w-4 h-4" /> {sendResult.error}</p>}
      </section>

      {/* Delivery Summary */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold">{tokenList.length}</div>
          <div className="text-sm text-muted-foreground">Registered Devices</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{sentCount}</div>
          <div className="text-sm text-muted-foreground">Pushes Sent</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{failedCount}</div>
          <div className="text-sm text-muted-foreground">Push Failures</div>
        </div>
      </section>

      {/* Recent Push Alerts */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Recent Push Delivery Status</h2>
        {alerts.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading...</p>}
        {alertList.length === 0 && !alerts.isLoading && <p className="text-sm text-muted-foreground">No push alerts yet.</p>}
        {alertList.map(alert => (
          <div key={alert.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{alert.store_name}</span>
              <span className="block text-xs text-muted-foreground">{alert.step_label}</span>
              {alert.push_error && <span className="block text-xs text-destructive">{alert.push_error}</span>}
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${alert.push_status === 'sent' ? 'text-green-600' : alert.push_status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {alert.push_status === 'sent' ? <CheckCircle2 className="w-3 h-3" /> : alert.push_status === 'failed' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {alert.push_status}
            </span>
          </div>
        ))}
      </section>

      {/* Registered Tokens */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Registered Device Tokens</h2>
        {tokens.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading...</p>}
        {tokenList.length === 0 && !tokens.isLoading && <p className="text-sm text-muted-foreground">No devices registered yet.</p>}
        {tokenList.map(token => (
          <div key={token.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{token.user_email}</span>
              <span className="block text-xs text-muted-foreground">
                {token.user_role}{token.device_info ? ` · ${token.device_info}` : ''}{token.store_id ? ` · store:${token.store_id.slice(-6)}` : ''}{token.driver_id ? ` · driver:${token.driver_id.slice(-6)}` : ''}
              </span>
              <span className="block text-xs font-mono break-all text-muted-foreground">{token.token?.slice(0, 40)}...</span>
            </div>
            <Button size="icon" variant="ghost" aria-label="Delete token" onClick={() => deleteToken(token)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}