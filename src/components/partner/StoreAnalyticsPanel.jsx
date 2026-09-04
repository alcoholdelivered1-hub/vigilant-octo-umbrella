import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, ShoppingBag, Users, Clock, Repeat, DollarSign, Loader2 } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, getHours, parseISO } from 'date-fns';

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
);

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function StoreAnalyticsPanel({ storeId }) {
  const [rangeDays, setRangeDays] = useState(14);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['store-analytics-orders', storeId],
    queryFn: () => base44.entities.Order.filter({ store_id: storeId }, '-created_date', 500),
    enabled: !!storeId,
  });

  const completedOrders = useMemo(
    () => orders.filter(o => o.status === 'delivered'),
    [orders]
  );

  // ── Daily Sales Trend ─────────────────────────────────────────────────
  const dailySalesData = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, rangeDays - 1);
    const days = eachDayOfInterval({ start, end: today });

    return days.map(day => {
      const label = format(day, 'MMM d');
      const dayOrders = completedOrders.filter(o => {
        const d = o.delivery_confirmed_at || o.created_date;
        return d && format(parseISO(d), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      return {
        label,
        revenue: parseFloat(dayOrders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)),
        orders: dayOrders.length,
      };
    });
  }, [completedOrders, rangeDays]);

  // ── Peak Ordering Hours ───────────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ hour: HOUR_LABELS[i], orders: 0 }));
    completedOrders.forEach(o => {
      const d = o.delivery_confirmed_at || o.created_date;
      if (d) buckets[getHours(parseISO(d))].orders += 1;
    });
    return buckets;
  }, [completedOrders]);

  // ── Customer Retention ────────────────────────────────────────────────
  const retentionData = useMemo(() => {
    const emailMap = {};
    completedOrders.forEach(o => {
      if (!o.customer_email) return;
      emailMap[o.customer_email] = (emailMap[o.customer_email] || 0) + 1;
    });
    const counts = Object.values(emailMap);
    const oneTime   = counts.filter(c => c === 1).length;
    const returning = counts.filter(c => c === 2 || c === 3).length;
    const loyal     = counts.filter(c => c >= 4).length;
    return [
      { name: 'First-time', value: oneTime },
      { name: 'Returning (2-3x)', value: returning },
      { name: 'Loyal (4x+)', value: loyal },
    ].filter(d => d.value > 0);
  }, [completedOrders]);

  // ── Summary Stats ─────────────────────────────────────────────────────
  const { totalRevenue, avgOrderValue, uniqueCustomers, returnRate } = useMemo(() => {
    const total = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const avg = completedOrders.length > 0 ? total / completedOrders.length : 0;
    const emails = new Set(completedOrders.map(o => o.customer_email).filter(Boolean));
    const returning = Object.values(
      completedOrders.reduce((acc, o) => {
        if (o.customer_email) acc[o.customer_email] = (acc[o.customer_email] || 0) + 1;
        return acc;
      }, {})
    ).filter(c => c > 1).length;
    const rate = emails.size > 0 ? Math.round((returning / emails.size) * 100) : 0;
    return { totalRevenue: total, avgOrderValue: avg, uniqueCustomers: emails.size, returnRate: rate };
  }, [completedOrders]);

  // ── Category Breakdown ────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map = {};
    completedOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const cat = item.category || 'Other';
        map[cat] = (map[cat] || 0) + (item.subtotal || 0);
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [completedOrders]);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
    </div>
  );

  if (completedOrders.length === 0) return (
    <div className="text-center py-20 text-muted-foreground">
      <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium">No completed orders yet</p>
      <p className="text-sm mt-1">Analytics will appear once orders are delivered.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub="All completed orders" color="text-emerald-600" />
        <StatCard icon={ShoppingBag} label="Avg Order Value" value={`$${avgOrderValue.toFixed(2)}`} sub="Per delivered order" color="text-primary" />
        <StatCard icon={Users} label="Unique Customers" value={uniqueCustomers} sub="Distinct accounts" color="text-blue-500" />
        <StatCard icon={Repeat} label="Return Rate" value={`${returnRate}%`} sub="Ordered more than once" color="text-amber-500" />
      </div>

      {/* Daily Sales Trend */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm">Daily Sales Trend</h3>
            <p className="text-xs text-muted-foreground">Revenue from completed orders</p>
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setRangeDays(opt.days)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${rangeDays === opt.days ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dailySalesData}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
            <Tooltip
              formatter={(v, name) => [name === 'revenue' ? `$${v}` : v, name === 'revenue' ? 'Revenue' : 'Orders']}
              contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }}
            />
            <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Peak Ordering Hours */}
        <div className="bg-card border rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Peak Ordering Hours
            </h3>
            <p className="text-xs text-muted-foreground">Orders by hour of day (all time)</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
              <Tooltip
                formatter={v => [v, 'Orders']}
                contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }}
              />
              <Bar dataKey="orders" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Retention Pie */}
        <div className="bg-card border rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted-foreground" /> Customer Retention
            </h3>
            <p className="text-xs text-muted-foreground">Breakdown of order frequency per customer</p>
          </div>
          {retentionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={retentionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {retentionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
              Not enough data yet
            </div>
          )}
        </div>
      </div>

      {/* Category Revenue Breakdown */}
      {categoryData.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-sm">Revenue by Category</h3>
            <p className="text-xs text-muted-foreground">Top product categories by total sales</p>
          </div>
          <div className="space-y-3">
            {categoryData.map((cat, i) => {
              const maxVal = categoryData[0].value;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 truncate capitalize">{cat.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cat.value / maxVal) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-16 text-right">${cat.value.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}