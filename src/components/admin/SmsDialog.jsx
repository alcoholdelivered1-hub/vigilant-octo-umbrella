import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, Link2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  { key: 'update', label: 'Order Update', build: (o) => `Alcohol Delivered: Update on order ${o.order_number}. Status: ${(o.status || '').replace(/_/g, ' ')}.` },
  { key: 'out_for_delivery', label: 'Out for Delivery', build: (o) => `Alcohol Delivered: Your order ${o.order_number} is out for delivery${o.driver_name ? ` with ${o.driver_name}` : ''}! Please have your ID ready.` },
  { key: 'delivered', label: 'Delivered', build: (o) => `Alcohol Delivered: Order ${o.order_number} has been delivered. Thanks for choosing us! Rate your delivery in the app.` },
  { key: 'reminder', label: 'Payment Reminder', build: (o) => `Alcohol Delivered: Your order ${o.order_number} is awaiting payment. Complete checkout to confirm your delivery.` },
];

export default function SmsDialog({ order, open, onOpenChange }) {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    if (open && order) {
      setTo(order.customer_phone || '');
      setBody(TEMPLATES[0].build(order));
    }
  }, [open, order]);

  const handleSend = async () => {
    if (!to || !body) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendSMS', { to, body });
      const data = res?.data || res;
      if (data.success) toast.success(`SMS sent to ${to}`, { description: `SID ${data.messageSid}` });
      else toast.error(data.error || 'SMS failed to send');
    } catch (e) {
      toast.error('SMS failed', { description: e.message });
    }
    setSending(false);
  };

  const handleInsertLink = async () => {
    setLoadingLink(true);
    try {
      const res = await base44.functions.invoke('getOrderPaymentLink', { order_id: order.id });
      const data = res?.data || res;
      if (data.url) {
        const linkLine = `Complete payment here: ${data.url}`;
        setBody((b) => (b ? `${b}\n${linkLine}` : linkLine));
        toast.success('Payment link added to message');
      } else {
        toast.error(data.error || 'No payment link available for this order');
      }
    } catch (e) {
      toast.error('Failed to fetch payment link', { description: e.message });
    }
    setLoadingLink(false);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Send SMS — {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-to">Recipient phone</Label>
            <Input id="sms-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1 555 123 4567" />
            <p className="text-xs text-muted-foreground">Customer: {order.customer_name || '—'}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Message</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBody(t.build(order))}
                  className="text-xs px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={320} />
            <p className="text-xs text-muted-foreground text-right">{body.length}/320</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleInsertLink} disabled={loadingLink}>
            {loadingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Insert Payment Link
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !to || !body}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}