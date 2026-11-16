import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

export default function LaunchPartnerReview({ enrollment, mutation }) {
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState('');
  if (enrollment?.status !== 'pending_review') return null;
  return <div className="border-t pt-4 space-y-3">
    <h3 className="font-semibold text-sm">Admin qualification review</h3>
    <p className="text-sm text-muted-foreground">Review this store’s setup steps and evidence before approving the incentive. Approval does not activate the store or bypass launch checks.</p>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} /><span>I verified that all retailer-required information was submitted by the displayed deadline, including license, agreement, Stripe details, inventory and required POS information.</span></label>
    <label className="block text-sm space-y-1"><span>Review note (required for changes)</span><Textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!confirmed || mutation.isPending} onClick={() => mutation.mutate({ action: 'approve', confirmed: true, note })}>Approve incentive</Button>
      <Button variant="outline" disabled={!note.trim() || mutation.isPending} onClick={() => mutation.mutate({ action: 'request_changes', note })}>Request changes</Button>
    </div>
  </div>;
}