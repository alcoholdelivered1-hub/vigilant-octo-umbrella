import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Rocket, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useRetailerActivation from '@/components/partner/useRetailerActivation';

export default function RetailerActivationCard({ store }) {
  const { agreed, setAgreed, running, result, error, request } = useRetailerActivation(store?.id);
  if (!store) return null;
  const consentId = `activation-consent-${store.id}`;
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3" aria-label={`Activation for ${store.name}`}>
      <div><h2 className="font-semibold">Launch review for {store.name}</h2><p className="text-sm text-muted-foreground">Submit saved details for administrator review. This does not activate ordering; final approval and all launch gates are required.</p></div>
      <form onSubmit={request} className="space-y-3">
        <label htmlFor={consentId} className="flex items-start gap-3 text-sm cursor-pointer">
          <input id={consentId} type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} disabled={running || result?.activated} className="mt-1 h-4 w-4 accent-primary" />
          <span>I am authorized to request activation for {store.name} and agree to check its saved business details. This does not replace the signed retailer agreement.</span>
        </label>
        <Button type="submit" disabled={!agreed || running || result?.activated}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : result?.activated ? <CheckCircle2 className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
          {running ? 'Checking requirements…' : result?.activated ? 'Store activated' : 'Submit for launch review'}
        </Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div aria-live="polite" className="text-sm space-y-2">
        {result?.activated && <p className="font-medium">{store.name} is live and ready to accept orders.</p>}
        {result && !result.activated && <><p className="font-medium">Launch review submitted; not activated. Administrator approval and any remaining requirements are needed:</p><ul className="list-disc pl-5 space-y-1 text-muted-foreground">{result.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul><Link className="inline-block text-primary underline underline-offset-4" to={`/onboarding?store_id=${encodeURIComponent(store.id)}`}>Complete this store’s setup</Link></>}
      </div>
    </section>
  );
}