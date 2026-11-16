import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import RetailerOnboardingReviewItem from '@/components/admin/RetailerOnboardingReviewItem';

export default function RetailerOnboardingAttentionButton({ store, attention }) {
  const [open, setOpen] = useState(false);
  const items = attention.pending.filter(item => item.store_id === store.id);
  return <>
    {items.length ? <Button size="sm" variant="outline" className="retailer-reply-attention" aria-label={`${store.name}: ${items.length} onboarding items need review`} onClick={() => setOpen(true)}>Retailer setup · {items.length} need review</Button> : <Button asChild size="sm" variant="outline"><Link to={`/onboarding?store_id=${store.id}`}>Retailer setup</Link></Button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{store.name} — Onboarding review</DialogTitle><DialogDescription>View each submission, then mark it reviewed to clear your flashing alert in this browser. This does not approve documents or activate the store.</DialogDescription></DialogHeader>
        {items.length ? items.map(item => <RetailerOnboardingReviewItem key={item.reviewKey} item={item} onReviewed={attention.markReviewed} />) : <p className="text-sm text-muted-foreground">All submitted items have been reviewed.</p>}
        <Button asChild variant="outline"><Link to={`/onboarding?store_id=${store.id}`}>Open retailer setup</Link></Button>
      </DialogContent>
    </Dialog>
  </>;
}