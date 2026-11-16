import React, { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function BKStaffSequenceForm({ onSent }) {
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const send = async () => {
    setSending(true);
    setMessage('');
    try {
      const staff_emails = emails.split(/[\s,;]+/).filter(Boolean);
      const res = await base44.functions.invoke('beverageKingMasterChecklist', { action: 'send', staff_emails });
      const results = res.data.results || [];
      const sent = results.filter((r) => r.status === 'sent').length;
      const failed = results.filter((r) => r.status === 'failed');
      setMessage(`Sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed.length ? ` · failed: ${failed.map((f) => f.to).join(', ')}` : ''}.`);
      if (sent) setEmails('');
      onSent?.();
    } catch (issue) {
      setMessage(issue?.response?.data?.error || issue?.message || 'Unable to send the onboarding sequence.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Send to Beverage King staff</p>
      <p className="text-xs text-muted-foreground">The store email always receives it. Add up to 10 staff emails, separated by commas or new lines.</p>
      <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="cashier@example.com, manager@example.com" rows={2} />
      <Button onClick={send} disabled={sending}>
        {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send onboarding sequence</>}
      </Button>
      {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}