import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Truck, TrendingUp, Calendar, CheckCircle2, Clock, XCircle, SkipForward } from 'lucide-react';
import PayoutSettings from '@/components/driver/PayoutSettings';
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, isWithinInterval, endOfWeek, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const DELIVERY_FEE_PER_ORDER = 4.75;


function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card rounded-2xl border p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  paid: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Paid' },
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Skipped' },
};

function PayoutHistory({ userId }) {
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['driver-payouts', userId],
    queryFn: () => base44.entities.DriverPayout.filter({ driver_id: userId }, '-week_start', 20),
    enabled: !!userId,
  });

  if (isLoading || payouts.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border">
      <div className="p-5 border-b">
        <h2 className="font-semibold">Payout History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Weekly Stripe payouts to your bank</p>
      </div>
      <div className="divide-y">
        {payouts.map((p) => {
          const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
          const StatusIcon = cfg.icon;
          return (
            <div key={p.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div>
                  <p className="font-medium">Week of {p.week_start}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.delivery_count} deliveries · ${(p.tips || 0).toFixed(2)} tips
                    {p.stripe_transfer_id && ` · ${p.stripe_transfer_id}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${p.status === 'paid' ? 'text-emerald-600' : 'text-foreground'}`}>
                  ${p.total_amount?.toFixed(2)}
                </p>
                <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DriverEarnings() {
  const [groupBy, setGroupBy] = useState('week'); // 'week' | 'month'
  const [periods] = useState(8); // how many periods to show

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['driver-earnings-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ status: 'delivered' }, '-delivery_confirmed_at', 500),
    enabled: !!user?.email,
  });

  // Filter to this driver's orders
  const myOrders = useMemo(() => {
    if (!user?.email) return [];
    return orders.filter(o => o.driver_id === user.email || o.driver_name === user.full_name);
  }, [orders, user]);

  // Build period buckets
  const periodData = useMemo(() => {
    const now = new Date();
    const buckets = [];

    for (let i = periods - 1; i >= 0; i--) {
      let start, end, label;
      if (groupBy === 'week') {
        const ref = subWeeks(now, i);
        start = startOfWeek(ref, { weekStartsOn: 1 });
        end = endOfWeek(ref, { weekStartsOn: 1 });
        label = `${format(start, 'MMM d')}`;
      } else {
        const ref = subMonths(now, i);
        start = startOfMonth(ref);
        end = endOfMonth(ref);
        label = format(start, 'MMM yyyy');
      }

      const periodOrders = myOrders.filter(o => {
        const d = o.delivery_confirmed_at ? new Date(o.delivery_confirmed_at) : o.created_date ? new Date(o.created_date) : null;
        return d && isWithinInterval(d, { start, end });
      });

      const deliveries = periodOrders.length;
      const fees = deliveries * DELIVERY_FEE_PER_ORDER;
      const tips = periodOrders.reduce((s, o) => s + (o.tip || 0), 0);
      const mileage = periodOrders.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
      const earnings = fees + tips + mileage;

      buckets.push({ label, deliveries, earnings: parseFloat(earnings.toFixed(2)), tips: parseFloat(tips.toFixed(2)), mileage: parseFloat(mileage.toFixed(2)) });
    }

    return buckets;
  }, [myOrders, groupBy, periods]);

  const totalDeliveries = myOrders.length;
  const totalTips = myOrders.reduce((s, o) => s + (o.tip || 0), 0);
  const totalMileage = myOrders.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
  const totalEarnings = totalDeliveries * DELIVERY_FEE_PER_ORDER + totalTips + totalMileage;
  const avgPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

  // Current period stats
  const currentBucket = periodData[periodData.length - 1];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted-foreground">
        Loading earnings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">My Earnings</h1>
          <p className="text-sm text-muted-foreground">$4.75 delivery fee per completed order</p>
        </div>
        {/* Period Toggle */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <button
            onClick={() => setGroupBy('week')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${groupBy === 'week' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${groupBy === 'month' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Truck}
          label="Total Deliveries"
          value={totalDeliveries}
          sub="All time completed"
          color="text-primary"
        />
        <StatCard
          icon={DollarSign}
          label="Total Earned"
          value={`$${totalEarnings.toFixed(2)}`}
          sub={`Fees + tips${totalMileage > 0 ? ` + $${totalMileage.toFixed(2)} mileage` : ''}`}
          color="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label={`This ${groupBy === 'week' ? 'Week' : 'Month'}`}
          value={`$${currentBucket?.earnings.toFixed(2) ?? '0.00'}`}
          sub={`${currentBucket?.deliveries ?? 0} deliveries`}
          color="text-amber-500"
        />
        <StatCard
          icon={Calendar}
          label="Avg per Delivery"
          value={`$${avgPerDelivery.toFixed(2)}`}
          sub="+ 100% of tips"
          color="text-blue-500"
        />
      </div>

      {/* Tips summary */}
      {totalTips > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 flex items-center gap-2">
          <span className="text-lg">💵</span>
          <span>You've earned <strong>${totalTips.toFixed(2)} in tips</strong> — already included in your total earnings above.</span>
        </div>
      )}

      {/* Earnings Chart */}
      <div className="bg-card rounded-2xl border p-5">
        <h2 className="font-semibold mb-4">{groupBy === 'week' ? 'Weekly' : 'Monthly'} Earnings</h2>
        {totalDeliveries === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No completed deliveries yet.</p>
            <p className="text-xs mt-1">Complete your first delivery to see earnings here.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip
                formatter={(value) => [`$${value.toFixed(2)}`, 'Earnings']}
                contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }}
              />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Payout Settings */}
      <PayoutSettings />

      {/* Payout History */}
      <PayoutHistory userId={user?.id} />

      {/* Delivery Breakdown Table */}
      <div className="bg-card rounded-2xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold">{groupBy === 'week' ? 'Weekly' : 'Monthly'} Breakdown</h2>
        </div>
        <div className="divide-y">
          {periodData.slice().reverse().map((row, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">{row.deliveries} deliveries</span>
              {row.tips > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  💵 ${row.tips.toFixed(2)} tips
                </span>
              )}
              {row.mileage > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  🚗 ${row.mileage.toFixed(2)} mileage
                </span>
              )}
              <span className={`font-semibold ${row.earnings > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                ${row.earnings.toFixed(2)}
              </span>
            </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}