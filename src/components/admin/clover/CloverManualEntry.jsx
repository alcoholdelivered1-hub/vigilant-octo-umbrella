import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, HandCoins, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CloverManualEntry({ disabled, onDone }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [cloverOrderId, setCloverOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount greater than $0');
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('syncCloverSalesToStripe', {
        action: 'manual',
        amount: parsed,
        description: description.trim() || `Clover POS Sale — Manual Entry`,
        clover_order_id: cloverOrderId.trim() || undefined,
      });
      const d = res.data;
      if (d?.success) {
        toast.success(`Mirror invoice created: ${d.invoice_number} — $${parsed.toFixed(2)}`);
        setAmount('');
        setDescription('');
        setCloverOrderId('');
        if (onDone) onDone();
      } else {
        toast.error(d?.error || 'Failed to create manual entry', { duration: 8000 });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'unknown error';
      toast.error('Manual entry failed: ' + msg, { duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('This will void all open (unpaid) Clover-originated invoices in Stripe. Continue?')) return;
    setCleanupRunning(true);
    try {
      const res = await base44.functions.invoke('syncCloverSalesToStripe', { action: 'cleanup' });
      const d = res.data;
      if (d?.success) {
        toast.success(`Cleanup complete — voided ${d.voided} orphaned invoice${d.voided !== 1 ? 's' : ''}`);
        if (onDone) onDone();
      } else {
        toast.error(d?.error || 'Cleanup failed', { duration: 8000 });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'unknown error';
      toast.error('Cleanup failed: ' + msg, { duration: 8000 });
    } finally {
      setCleanupRunning(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <HandCoins className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Manual Entry & Cleanup</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Record a Clover POS sale that wasn't auto-synced, or clean up orphaned open invoices from failed sync attempts.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium">Sale Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="35.20"
              disabled={disabled || submitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Clover Order ID (optional)</Label>
            <Input
              value={cloverOrderId}
              onChange={(e) => setCloverOrderId(e.target.value)}
              placeholder="Auto-generated if blank"
              disabled={disabled || submitting}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-medium">Description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Clover POS Sale — Manual Entry"
            disabled={disabled || submitting}
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={disabled || submitting} className="w-full gap-2" size="sm">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
          {submitting ? 'Creating...' : 'Create Mirror Invoice'}
        </Button>
      </form>

      <div className="pt-3 border-t">
        <Button
          onClick={handleCleanup}
          disabled={disabled || cleanupRunning}
          variant="outline"
          className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
          size="sm"
        >
          {cleanupRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          {cleanupRunning ? 'Cleaning up...' : 'Void Orphaned Open Invoices'}
        </Button>
      </div>
    </Card>
  );
}