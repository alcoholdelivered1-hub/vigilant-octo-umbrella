import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

function currentMondayStr() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export default function RequestPayoutButton({ userId }) {
  const queryClient = useQueryClient();
  const weekStart = currentMondayStr();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['driver-payouts', userId],
    queryFn: () => base44.entities.DriverPayout.filter({ driver_id: userId }, '-week_start', 20),
    enabled: !!userId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['payout-request-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ status: 'delivered' }, '-created_date', 500),
    enabled: !!user?.email,
  });

  const weekEarnings = useMemo(() => {
    if (!user?.email) return { deliveries: 0, total: 0 };
    const monday = new Date(weekStart + 'T00:00:00');
    const now = new Date();
    const mine = orders.filter(o =>
      o.driver_email === user.email &&
      new Date(o.created_date) >= monday &&
      new Date(o.created_date) <= now
    );
    const deliveries = mine.length;
    const fees = deliveries * 3;
    const tips = mine.reduce((s, o) => s + (o.tip || 0), 0);
    const mileage = mine.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
    return { deliveries, total: fees + tips + mileage };
  }, [orders, user, weekStart]);

  const existingThisWeek = payouts.find(p => p.week_start === weekStart);

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('requestDriverPayout', {}),
    onSuccess: (res) => {
      const data = res.data || res;
      if (data.success) {
        toast.success(data.message || 'Payout requested');
        queryClient.invalidateQueries({ queryKey: ['driver-payouts', userId] });
      } else {
        toast.info(data.message || 'Could not request payout right now');
      }
    },
    onError: (e) => {
      toast.error(e.response?.data?.error || e.message || 'Failed to request payout');
    },
  });

  // Already has a payout queued/paid for this week
  if (existingThisWeek) {
    const isPaid = existingThisWeek.status === 'paid';
    return (
      <div className="bg-card rounded-2xl border p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {isPaid ? 'Payout sent' : 'Payout pending approval'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Week of {existingThisWeek.week_start} · ${existingThisWeek.total_amount?.toFixed(2)} · {existingThisWeek.delivery_count} deliveries
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {existingThisWeek.status}
        </span>
      </div>
    );
  }

  const hasEarnings = weekEarnings.total > 0;

  return (
    <div className="bg-card rounded-2xl border p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Wallet className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">Request Early Payout</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasEarnings
            ? `${weekEarnings.deliveries} deliveries · $${weekEarnings.total.toFixed(2)} available this week`
            : 'No completed deliveries this week yet'}
        </p>
      </div>
      <Button
        size="sm"
        disabled={!hasEarnings || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
        {mutation.isPending ? 'Requesting…' : 'Request Payout'}
      </Button>
    </div>
  );
}