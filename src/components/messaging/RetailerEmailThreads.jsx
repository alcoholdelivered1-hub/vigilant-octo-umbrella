import React from 'react';
import { Button } from '@/components/ui/button';

export default function RetailerEmailThreads({ email }) {
  return <div className="space-y-2">
    <Button variant="outline" onClick={email.newEmail} disabled={!email.contacts.length}>New email</Button>
    {email.list.isLoading && <p className="text-sm text-muted-foreground">Loading conversations…</p>}
    {!email.list.isLoading && !email.threads.length && <p className="text-sm text-muted-foreground">No email conversations yet.</p>}
    <div className="max-h-80 overflow-y-auto space-y-1">
      {email.threads.map(thread => <button key={thread.id} type="button" onClick={() => email.selectThread(thread.id)} className={`w-full rounded-md border p-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${thread.id === email.threadId && !email.compose ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
        <span className="block font-medium">{thread.subject || '(No subject)'}</span><span className="block text-xs text-muted-foreground line-clamp-2">{thread.snippet}</span>
      </button>)}
    </div>
    {email.list.hasNextPage && <Button variant="outline" size="sm" onClick={() => email.list.fetchNextPage()} disabled={email.list.isFetchingNextPage}>{email.list.isFetchingNextPage ? 'Loading…' : 'Older conversations'}</Button>}
  </div>;
}