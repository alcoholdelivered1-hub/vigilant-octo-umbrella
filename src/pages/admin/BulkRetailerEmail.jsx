import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Send, Mail, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function BulkRetailerEmail() {
  const [subject, setSubject] = useState('Alcohol Delivered is LIVE — your store is ready to take orders');
  const [message, setMessage] = useState(`We're live! Alcohol Delivered is now accepting orders from customers across our approved service zones, and your store is part of the launch.

Customers can browse your inventory and place delivery orders right now at alcoholdelivered.com (or in the mobile app).

A few things to make sure you're ready:

• Your store hours are up to date in the partner portal — customers can only order while you're open.
• Keep your inventory and prices current so customers see what's actually on the shelf.
• If you haven't finished Stripe Connect yet, complete it so payouts reach your bank account — tap "Stripe Express" in your dashboard.

Your partner portal: alcoholdelivered.com/store/dashboard

Need help? Reply to this email or reach us at alcohol.delivered1@gmail.com.

Welcome to the launch — here's to a strong first week of deliveries.

— The Alcohol Delivered Team`);
  const [onlyActive, setOnlyActive] = useState(true);
  const [onlyPendingStripe, setOnlyPendingStripe] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['bulk-email-stores'],
    queryFn: () => base44.entities.Store.list('name', 500),
  });

  const recipients = stores.filter((s) => {
    if (!s.email) return false;
    if (onlyActive && s.is_active === false) return false;
    if (onlyPendingStripe && s.stripe_connect_onboarded) return false;
    return true;
  });

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('sendBulkRetailerEmail', {
        subject: subject.trim(),
        message: message.trim(),
        only_active: onlyActive,
        only_pending_stripe: onlyPendingStripe,
      });
      const d = res.data;
      if (d?.success) {
        setResult(d);
        toast.success(
          `Sent to ${d.sent} retailer${d.sent !== 1 ? 's' : ''}` + (d.failed ? `, ${d.failed} failed` : '')
        );
      } else {
        toast.error(d?.error || 'Send failed');
      }
    } catch (e) {
      toast.error('Send failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" /> Bulk Retailer Email
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send one notification to all your retail partners at once.
        </p>
      </div>

      {/* Recipient summary */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{recipients.length} recipients</p>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? 'Counting stores…'
                : `${stores.filter((s) => s.email).length} stores have an email on file`}
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipients</p>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
          Only active stores
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={onlyPendingStripe} onCheckedChange={(v) => setOnlyPendingStripe(!!v)} />
          Only stores that haven't finished Stripe Connect
        </label>
      </Card>

      {/* Composer */}
      <Card className="p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Action needed: complete your Stripe setup"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message to retailers. Use a blank line to separate paragraphs."
            rows={8}
          />
          <p className="text-xs text-muted-foreground">
            Plain text — paragraphs (separated by a blank line) are formatted automatically into a branded email.
          </p>
        </div>
        <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim() || recipients.length === 0} className="w-full gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? `Sending to ${recipients.length}…` : `Send to ${recipients.length} retailer${recipients.length !== 1 ? 's' : ''}`}
        </Button>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Sent: {result.sent} · Failed: {result.failed} · Total: {result.total}
          </div>
          {result.results?.some((r) => r.status === 'failed') && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              {result.results
                .filter((r) => r.status === 'failed')
                .map((r, i) => (
                  <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {r.store} ({r.email}): {r.error || 'failed'}
                  </p>
                ))}
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show all recipients
            </summary>
            <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {result.results?.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  {r.status === 'sent' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span className="font-medium">{r.store}</span>
                  <span className="text-muted-foreground">{r.email}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </div>
  );
}