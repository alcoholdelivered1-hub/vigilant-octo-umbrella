import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RetailerEmailComposer({ email }) {
  const messages = email.detail.data?.messages || [];
  const enabled = email.contacts.length > 0 && (email.compose || !!email.detail.data) && !email.detail.isError;
  return <div className="min-w-0 space-y-3">
    {!email.compose && <div className="max-h-72 overflow-y-auto space-y-3" aria-live="polite">
      {email.detail.isLoading && <p className="text-sm text-muted-foreground">Loading email…</p>}
      {messages.map(message => <article key={message.id} className={`rounded-lg border p-3 ${message.incoming ? 'bg-muted/40' : 'bg-primary/5'}`}>
        <p className="text-sm font-semibold break-words">{message.from}</p><p className="text-xs text-muted-foreground">{message.date}</p><h3 className="text-sm font-medium mt-2">{message.subject}</h3><p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.text}</p>
      </article>)}
    </div>}
    <form onSubmit={e => { e.preventDefault(); email.mutation.mutate(); }} className="space-y-3 border-t pt-3">
      {email.compose && <>
        <Label htmlFor="retailer-email-recipient">To</Label><Select value={email.recipient} onValueChange={email.setRecipient} disabled={email.mutation.isPending}><SelectTrigger id="retailer-email-recipient" className="w-full rounded-md border bg-background p-2 text-sm"><SelectValue placeholder="Select a recipient" /></SelectTrigger><SelectContent>{email.contacts.map(contact => <SelectItem key={contact} value={contact}>{contact}</SelectItem>)}</SelectContent></Select>
        <Label htmlFor="retailer-email-subject">Subject</Label><Input id="retailer-email-subject" required maxLength={200} value={email.subject} onChange={e => email.setSubject(e.target.value)} disabled={email.mutation.isPending} />
      </>}
      <Label htmlFor="retailer-email-message">{email.compose ? 'Message' : 'Your reply'}</Label><Textarea id="retailer-email-message" required maxLength={10000} value={email.text} onChange={e => email.setText(e.target.value)} placeholder="Write your message…" disabled={!enabled || email.mutation.isPending} />
      <Button type="submit" disabled={!enabled || !email.text.trim() || email.mutation.isPending}>{email.mutation.isPending ? 'Sending…' : email.compose ? 'Send email' : 'Send reply'}</Button>
      {email.mutation.isSuccess && <p role="status" className="text-sm text-muted-foreground">Email sent from alcohol.delivered1@gmail.com.</p>}
    </form>
  </div>;
}