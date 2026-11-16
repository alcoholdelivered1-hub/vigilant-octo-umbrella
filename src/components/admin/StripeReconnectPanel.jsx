import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function StripeReconnectPanel({ onboardingUrl, loading }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const reset = () => { if (document.visibilityState === 'visible') setOpening(false); };
    window.addEventListener('focus', reset);
    document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('focus', reset); document.removeEventListener('visibilitychange', reset); };
  }, []);

  const reconnect = async () => {
    setOpening(true);
    setError('');

    // Open the destination tab during the user's click. Mobile Safari and the
    // Base44 editor iframe block redirects that begin only after an async call.
    const stripeTab = window.open('about:blank', '_blank');

    try {
      const response = await base44.functions.invoke('beverageKingGoLive', { action: 'stripe_reconnect' });
      const url = response.data?.stripe_onboarding_url;
      if (!url) throw new Error('Stripe did not return a secure onboarding link.');

      if (stripeTab) {
        stripeTab.opener = null;
        stripeTab.location.replace(url);
      } else {
        window.location.assign(url);
      }
    } catch (issue) {
      if (stripeTab) stripeTab.close();
      const message = issue.response?.data?.error
        || issue.response?.data?.stripe_error
        || issue.message
        || 'Unable to open Stripe onboarding.';
      setError(message);
      setOpening(false);
    }
  };

  const busy = loading || opening;

  return <section className="rounded-xl border bg-card p-5 space-y-4">
    <div><h2 className="font-semibold">Beverage King Stripe</h2><p className="text-sm text-muted-foreground">Open the secure onboarding form for the verified Beverage King account already mapped to this store. Mr. Singh can finish bank, EIN, identity, charge, and payout verification without creating another account.</p></div>
    <Button onClick={reconnect} disabled={busy}>{busy ? 'Preparing Stripe…' : <>Reconnect Beverage King Stripe <ExternalLink /></>}</Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    {!loading && !onboardingUrl && !error && <p className="text-sm text-muted-foreground">Tap Reconnect to request a fresh secure Stripe link.</p>}
    <p className="text-xs text-muted-foreground">Mr. Singh must personally complete the secure Stripe form. The app verifies that the mapped account name and owner email match Beverage King before opening onboarding.</p>
  </section>;
}