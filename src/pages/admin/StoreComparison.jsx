import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend
} from 'recharts';
import { Loader2, TrendingUp, Star, Truck, ShoppingBag, Clock, Trophy, ArrowUpDown } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';

const SORT_OPTIONS = [
  { key: 'orderVolume', label: 'Order Volume' },
  { key: 'avgDeliveryMins', label: 'Delivery Speed' },
  { key: 'avgRating', label: 'Satisfaction' },
  { key: 'revenue', label: 'Revenue' },
];

function Medal({ rank }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

function MiniStat({ icon: Icon, label, value, color = 'text-primary' }) {
  return (
    <div className="text-center">
      <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${color}`} />
      <p className="text-xs font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function StoreComparison() {
  const [sortKey, setSortKey] = useState('orderVolume');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['admin-all-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 200),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-all-orders-comparison'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ['admin-all-feedback'],
    queryFn: () => base44.entities.CustomerFeedback.list('-created_date', 500),
  });

  const storeStats = useMemo(() => {
    return stores.map(store => {
      const storeOrders = orders.filter(o => o.store_id === store.id);
      const delivered = storeOrders.filter(o => o.status === 'delivered');

      // Delivery speed: avg minutes from pickup_confirmed_at → delivery_confirmed_at
      const deliveryTimes = delivered
        .filter(o => o.pickup_confirmed_at && o.delivery_confirmed_at)
        .map(o => differenceInMinutes(parseISO(o.delivery_confirmed_at), parseISO(o.pickup_confirmed_at)))
        .filter(m => m > 0 && m < 180); // sanity filter

      const avgDeliveryMins = deliveryTimes.length > 0
        ? Math.round(deliveryTimes.reduce((s, m) => s + m, 0) / deliveryTimes.length)
        : null;

      // Revenue
      const revenue = delivered.reduce((s, o) => s + (o.total || 0), 0);

      // Customer satisfaction from CustomerFeedback
      const storeFeedback = feedback.filter(f => f.store_id === store.id);
      const avgRating = storeFeedback.length > 0
        ? parseFloat((storeFeedback.reduce((s, f) => s + (f.rating || 0), 0) / storeFeedback.length).toFixed(1))
        : null;

      // Order completion rate
      const cancelled = storeOrders.filter(o => ['cancelled', 'refused'].includes(o.status)).length;
      const completionRate = storeOrders.length > 0
        ? Math.round(((storeOrders.length - cancelled) / storeOrders.length) * 100)
        : 100;

      return {
        id: store.id,
        name: store.name,
        city: store.city,
        orderVolume: storeOrders.length,
        deliveredCount: delivered.length,
        avgDeliveryMins,
        revenue: parseFloat(revenue.toFixed(2)),
        avgRating,
        ratingCount: storeFeedback.length,
        completionRate,
      };
    });
  }, [stores, orders, feedback]);

  const sorted = useMemo(() => {
    return [...storeStats].sort((a, b) => {
      let aVal = a[sortKey] ?? (sortKey === 'avgDeliveryMins' ? 9999 : -1);
      let bVal = b[sortKey] ?? (sortKey === 'avgDeliveryMins' ? 9999 : -1);
      // For delivery speed, lower is better — default desc = fastest first
      if (sortKey === 'avgDeliveryMins') {
        return sortAsc ? bVal - aVal : aVal - bVal;
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [storeStats, sortKey, sortAsc]);

  const isLoading = storesLoading || ordersLoading;

  // Radar chart — top 5 stores normalized 0–100
  const radarData = useMemo(() => {
    const top5 = sorted.slice(0, 5);
    if (top5.length === 0) return [];

    const maxVol = Math.max(...top5.map(s => s.orderVolume), 1);
    const maxRev = Math.max(...top5.map(s => s.revenue), 1);
    const minSpeed = Math.min(...top5.filter(s => s.avgDeliveryMins).map(s => s.avgDeliveryMins), 60);
    const maxSpeed = Math.max(...top5.filter(s => s.avgDeliveryMins).map(s => s.avgDeliveryMins), 60);

    return [
      {
        metric: 'Orders',
        ...Object.fromEntries(top5.map(s => [s.name.slice(0, 12), Math.round((s.orderVolume / maxVol) * 100)])),
      },
      {
        metric: 'Revenue',
        ...Object.fromEntries(top5.map(s => [s.name.slice(0, 12), Math.round((s.revenue / maxRev) * 100)])),
      },
      {
        metric: 'Speed',
        ...Object.fromEntries(top5.map(s => {
          if (!s.avgDeliveryMins) return [s.name.slice(0, 12), 50];
          const range = maxSpeed - minSpeed || 1;
          return [s.name.slice(0, 12), Math.round(100 - ((s.avgDeliveryMins - minSpeed) / range) * 100)];
        })),
      },
      {
        metric: 'Rating',
        ...Object.fromEntries(top5.map(s => [s.name.slice(0, 12), s.avgRating ? Math.round((s.avgRating / 5) * 100) : 50])),
      },
      {
        metric: 'Completion',
        ...Object.fromEntries(top5.map(s => [s.name.slice(0, 12), s.completionRate])),
      },
    ];
  }, [sorted]);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const top5Names = sorted.slice(0, 5).map(s => s.name.slice(0, 12));

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading store data…
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <Trophy className="w-7 h-7 text-secondary" /> Store Performance Comparison
        </h1>
        <p className="text-muted-foreground mt-1">Compare all active stores by delivery speed, order volume, revenue, and customer satisfaction.</p>
      </div>

      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5" /> Sort by:
        </span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => {
              if (sortKey === opt.key) setSortAsc(a => !a);
              else { setSortKey(opt.key); setSortAsc(false); }
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${sortKey === opt.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            {opt.label} {sortKey === opt.key ? (sortAsc ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30">
          <h2 className="font-semibold text-sm">Store Leaderboard</h2>
        </div>
        <div className="divide-y">
          {sorted.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No store data available</p>
          ) : sorted.map((store, i) => (
            <div key={store.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
              {/* Rank */}
              <div className="w-8 flex items-center justify-center shrink-0">
                <Medal rank={i + 1} />
              </div>

              {/* Store name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.city}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:grid grid-cols-4 gap-6">
                <MiniStat icon={ShoppingBag} label="Orders" value={store.orderVolume} color="text-primary" />
                <MiniStat
                  icon={Clock}
                  label="Avg Speed"
                  value={store.avgDeliveryMins !== null ? `${store.avgDeliveryMins}m` : '—'}
                  color={store.avgDeliveryMins && store.avgDeliveryMins <= 25 ? 'text-emerald-600' : 'text-amber-500'}
                />
                <MiniStat
                  icon={Star}
                  label="Rating"
                  value={store.avgRating !== null ? `${store.avgRating} ★` : '—'}
                  color={store.avgRating && store.avgRating >= 4.5 ? 'text-emerald-600' : store.avgRating && store.avgRating < 3.5 ? 'text-red-500' : 'text-amber-500'}
                />
                <MiniStat icon={TrendingUp} label="Revenue" value={`$${store.revenue.toFixed(0)}`} color="text-blue-600" />
              </div>

              {/* Completion rate pill */}
              <div className={`hidden md:block text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${store.completionRate >= 95 ? 'bg-emerald-100 text-emerald-700' : store.completionRate >= 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {store.completionRate}% complete
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Volume */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" /> Order Volume
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Total orders per store</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted.slice(0, 10)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Bar dataKey="orderVolume" name="Orders" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Delivery Speed */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" /> Avg Delivery Time
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Minutes from pickup to door (lower = better)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted.filter(s => s.avgDeliveryMins).slice(0, 10)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="m" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={v => [`${v} min`, 'Avg Delivery']} />
              <Bar dataKey="avgDeliveryMins" name="Avg Delivery (min)" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction Rating */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" /> Customer Satisfaction
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Average feedback rating per store (1–5)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted.filter(s => s.avgRating).slice(0, 10)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={v => [`${v} ★`, 'Rating']} />
              <Bar dataKey="avgRating" name="Avg Rating" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Revenue
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Total revenue from delivered orders</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted.slice(0, 10)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={v => [`$${v}`, 'Revenue']} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar Chart — Top 5 */}
      {radarData.length > 0 && top5Names.length > 1 && (
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1">Top 5 Stores — Performance Radar</h3>
          <p className="text-xs text-muted-foreground mb-4">All metrics normalized to 0–100. Higher = better (speed inverted).</p>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              {top5Names.map((name, i) => (
                <Radar key={name} name={name} dataKey={name} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.12} strokeWidth={2} />
              ))}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}