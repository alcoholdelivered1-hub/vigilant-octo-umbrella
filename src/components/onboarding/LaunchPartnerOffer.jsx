import React, { useState } from 'react';
import { Gift, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useLaunchPartnerOffer from '@/components/onboarding/useLaunchPartnerOffer';
import LaunchPartnerReview from '@/components/onboarding/LaunchPartnerReview';

const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export default function LaunchPartnerOffer({ store, isAdmin, nextStep, onContinue }) {
  const { data, isLoading, error, refetch, mutation } = useLaunchPartnerOffer(store.id);
  const [confirmed, setConfirmed] = useState(false);
  const enrollment = data?.enrollment;
  const expired = enrollment && Date.now() > Date.parse(enrollment.deadline_at);
  const canSubmit = enrollment && ['enrolled', 'needs_changes'].includes(enrollment.status) && !expired;
  if (isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Launch Partner offer…</p>;
  if (error) return <div role="alert" className="rounded-xl border p-4"><p className="text-sm text-destructive">{error.response?.data?.error || error.message}</p><Button variant="outline" onClick={() => refetch()}>Retry offer</Button></div>;
  if (!enrollment && !data?.can_enroll) return null;
  return <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-3" aria-label="Launch Partner incentive">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-primary" />Launch Partner offer</h2>
    <p className="font-semibold">Earn 30 days of free featured placement</p>
    <p className="text-sm text-muted-foreground">Submit all required retailer setup information within seven days of starting this offer. After our team verifies your submission and your store goes live, your store receives 30 days of featured placement in the retailer directory, with no automatic charge.</p>
    <p className="text-sm text-muted-foreground">Required: store profile and license, signed agreement, Stripe business/identity/bank details, inventory and pricing, and POS information where required. Approval delays outside your control do not count against the submission deadline. Launch checks still apply; orders and payout timing are not guaranteed.</p>
    {!enrollment ? <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ action: 'start' })}>{mutation.isPending ? 'Starting…' : 'Start my seven-day offer'}</Button> : <div className="space-y-2 text-sm" aria-live="polite">
      <p><strong>Submission deadline:</strong> {date(enrollment.deadline_at)} (your local time)</p>
      {enrollment.submitted_at && <p>Submitted for review: {date(enrollment.submitted_at)}</p>}
      {enrollment.status === 'pending_review' && <p className="font-medium">Submission received on time. Qualification is pending team review.</p>}
      {enrollment.status === 'approved' && <p className="font-medium">Qualified! Your 30 free days begin after your store is approved to go live.</p>}
      {enrollment.status === 'rewarded' && data.placement && <p className="font-medium">{Date.parse(data.placement.ends_at) > Date.now() ? 'Featured placement active until' : 'Your free featured placement ended'} {date(data.placement.ends_at)}.</p>}
      {['enrolled', 'needs_changes'].includes(enrollment.status) && expired && <p>The offer deadline has passed. You can still finish onboarding without the incentive.</p>}
      {enrollment.review_note && <p><strong>Team note:</strong> {enrollment.review_note}</p>}
      {canSubmit && <><label className="flex items-start gap-2"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} /><span>I have submitted all required setup information, including my Stripe details, for review.</span></label><Button disabled={!confirmed || mutation.isPending} onClick={() => mutation.mutate({ action: 'submit', confirmed: true })}>{mutation.isPending ? 'Submitting…' : 'Submit for incentive review'}</Button></>}
    </div>}
    <div className="flex flex-wrap gap-2">
      {nextStep && <Button variant="outline" className="h-auto whitespace-normal text-left" onClick={onContinue}>Next: {nextStep.title}</Button>}
      <Button asChild variant="outline"><a href="tel:+18707181521"><Phone className="h-4 w-4" />Call John for setup help</a></Button>
    </div>
    {isAdmin && <LaunchPartnerReview enrollment={enrollment} mutation={mutation} />}
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.response?.data?.error || mutation.error.message}</p>}
  </section>;
}