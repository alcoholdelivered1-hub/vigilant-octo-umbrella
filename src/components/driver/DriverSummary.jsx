import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Area
} from 'recharts';
import { DollarSign, Truck, Star, TrendingUp } from 'lucide-react';
import { subDays, parseISO, format, isAfter, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary', bg = 'bg-primary/10' }) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function DriverSummary({ userEmail }) {
  const { data: driver } = useQuery({
    queryKey: ['my-driver-profile', userEmail],
    queryFn: () => base44.entities.Driver.filter({ email: userEmail }, 'name', 1),
    enabled: !!userEmail,
    select: data => data[0] || null,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['driver-summary-orders', userEmail],
    queryFn: async () => {
      // Try to get driver record first to filter by driver_id
      const drivers = await base44.entities.Driver.filter({ email: userEmail }, 'name', 1);
      const driverRecord = drivers[0];
      if (driverRecord) {
        return base44.entities.Order.filter({ driver_id: driverRecord.id }, '-created_date', 500);
      }
      // Fallback: filter by driver_name matching email
      return base44.entities.Order.filter({ driver_name: userEmail }, '-created_date', 500);
    },
    enabled: !!userEmail,
  });

  const deliveredOrders = useMemo(() =>
    orders.filter(o => o.status === 'delivered'), [orders]);

  // Current week (Mon–today) daily data
  const weeklyData = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: today }).map(date => ({
      date,
      label: format(date, 'EEE'),
      earnings: 0,
      deliveries: 0,
    }));

    deliveredOrders.forEach(order => {
      try {
        const orderDate = parseISO(order.created_date);
        const dayEntry = days.find(d => format(d.date, 'yyyy-MM-dd') === format(orderDate, 'yyyy-MM-dd'));
        if (dayEntry) {
          dayEntry.earnings += (order.delivery_fee || 3) + (order.tip || 0);
          dayEntry.deliveries += 1;
        }
      } catch {}
    });

    return days.map(d => ({
      label: d.label,
      earnings: parseFloat(d.earnings.toFixed(2)),
      deliveries: d.deliveries,
    }));
  }, [deliveredOrders]);

  // Last 7 days daily earnings (kept for all-time chart)
  const dailyData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return { date, label: format(date, 'EEE'), earnings: 0, deliveries: 0 };
    });

    deliveredOrders.forEach(order => {
      try {
        const orderDate = parseISO(order.created_date);
        const dayEntry = days.find(d => format(d.date, 'yyyy-MM-dd') === format(orderDate, 'yyyy-MM-dd'));
        if (dayEntry) {
          dayEntry.earnings += (order.delivery_fee || 3) + (order.tip || 0);
          dayEntry.deliveries += 1;
        }
      } catch {}
    });

    return days.map(d => ({
      label: d.label,
      earnings: parseFloat(d.earnings.toFixed(2)),
      deliveries: d.deliveries,
    }));
  }, [deliveredOrders]);

  const totalEarnings = useMemo(() =>
    deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 3) + (o.tip || 0), 0),
    [deliveredOrders]);

  const totalTips = useMemo(() =>
    deliveredOrders.reduce((sum, o) => sum + (o.tip || 0), 0),
    [deliveredOrders]);

  const last7Days = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    return deliveredOrders.filter(o => {
      try { return isAfter(parseISO(o.created_date), cutoff); } catch { return false; }
    });
  }, [deliveredOrders]);

  const weekEarnings = weeklyData.reduce((sum, d) => sum + d.earnings, 0);
  const weekDeliveries = weeklyData.reduce((sum, d) => sum + d.deliveries, 0);

  if (isLoading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">Loading your summary…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly highlight banner */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
        <p className="text-xs font-medium opacity-75 mb-1">This Week</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">${weekEarnings.toFixed(2)}</p>
            <p className="text-sm opacity-80 mt-0.5">{weekDeliveries} deliveries completed</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">Tips</p>
            <p className="text-lg font-semibold">+${weeklyData.reduce((s, d) => s + d.earnings, 0) > 0 ? totalTips.toFixed(2) : '0.00'}</p>
          </div>
        </div>
      </div>

      {/* Combined weekly chart */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Weekly Earnings & Deliveries
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Current week (Mon – today)</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value, name) =>
                name === 'earnings' ? [`$${Number(value).toFixed(2)}`, 'Earnings'] : [value, 'Deliveries']
              }
            />
            <Bar yAxisId="left" dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.9} />
            <Line yAxisId="right" type="monotone" dataKey="deliveries" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--chart-2))' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block"></span> Earnings ($)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-amber-400 inline-block"></span> Deliveries (count)</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={DollarSign}
          label="Total Earnings"
          value={`$${totalEarnings.toFixed(2)}`}
          sub="all time"
          color="text-emerald-600"
          bg="bg-emerald-100"
        />
        <StatCard
          icon={Truck}
          label="All Deliveries"
          value={deliveredOrders.length}
          sub="completed"
          color="text-blue-600"
          bg="bg-blue-100"
        />
        <StatCard
          icon={TrendingUp}
          label="Last 7 Days"
          value={`$${last7Days.reduce((s, o) => s + (o.delivery_fee || 3) + (o.tip || 0), 0).toFixed(2)}`}
          sub={`${last7Days.length} deliveries`}
          color="text-primary"
          bg="bg-primary/10"
        />
        <StatCard
          icon={Star}
          label="Avg Rating"
          value={driver?.avg_rating ? driver.avg_rating.toFixed(1) + ' ⭐' : '—'}
          sub={`${driver?.total_deliveries || 0} rated`}
          color="text-amber-600"
          bg="bg-amber-100"
        />
      </div>

      {/* Tips breakdown */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800">💵 Total Tips Earned</p>
          <p className="text-xs text-emerald-700">You keep 100% of all tips</p>
        </div>
        <p className="text-2xl font-bold text-emerald-700">${totalTips.toFixed(2)}</p>
      </div>
    </div>
  );
}