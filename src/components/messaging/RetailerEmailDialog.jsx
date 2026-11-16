import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import useRetailerEmail from '@/components/messaging/useRetailerEmail';
import RetailerEmailThreads from '@/components/messaging/RetailerEmailThreads';
import RetailerEmailComposer from '@/components/messaging/RetailerEmailComposer';

export default function RetailerEmailDialog({ selection, onClose, onRead }) {
  const email = useRetailerEmail(selection.storeId, selection.threadId);
  useEffect(() => {
    if (!email.compose && !email.detail.isFetching && !email.detail.isError && email.detail.data?.messages) onRead?.(selection.storeId, email.detail.data.messages);
  }, [email.compose, email.detail.isFetching, email.detail.isError, email.detail.data, selection.storeId, onRead]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{selection.storeName} — Gmail Conversations</DialogTitle><DialogDescription>Business inbox: alcohol.delivered1@gmail.com. Retailers reply by email, no app login needed.</DialogDescription></DialogHeader>
      {email.error && <div role="alert" className="text-sm text-destructive">{email.error} <Button size="sm" variant="outline" onClick={() => { email.list.refetch(); if (email.threadId) email.detail.refetch(); }}>Retry</Button></div>}
      {email.list.data?.pages[0]?.notice && <p className="text-sm text-muted-foreground">{email.list.data.pages[0].notice}</p>}
      <div className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-5"><RetailerEmailThreads email={email} /><RetailerEmailComposer email={email} /></div>
    </DialogContent>
  </Dialog>;
}