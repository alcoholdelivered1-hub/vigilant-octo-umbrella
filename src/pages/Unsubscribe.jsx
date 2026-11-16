import { useEffect, useState } from 'react';
import { MailX, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function Unsubscribe() {
  const [status, setStatus] = useState('loading'); // loading | success | invalid | error
  const [token, setToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const t = params.get('token');
    if (!t) {
      setStatus('invalid');
      return;
    }
    setToken(t);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/app-emails/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t }),
        });
        if (cancelled) return;
        if (res.ok) {
          setStatus('success');
        } else if (res.status === 400) {
          setStatus('invalid');
        } else {
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md w-full bg-card border rounded-2xl shadow-sm p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <h1 className="font-display text-2xl font-bold mt-4">Processing…</h1>
            <p className="text-muted-foreground text-sm mt-2">Confirming your unsubscribe request.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="font-display text-2xl font-bold mt-4">You're unsubscribed</h1>
            <p className="text-muted-foreground text-sm mt-2">
              You will no longer receive marketing emails from Alcohol Delivered.
              Transactional emails like order receipts and password resets will still arrive.
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="font-display text-2xl font-bold mt-4">This link is invalid</h1>
            <p className="text-muted-foreground text-sm mt-2">
              The unsubscribe link may have expired or was already used.
              Contact support if you need help managing your email preferences.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <MailX className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="font-display text-2xl font-bold mt-4">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mt-2">
              We couldn't complete your request right now. Please try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}