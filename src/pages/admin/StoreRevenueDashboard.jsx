import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Store, DollarSign, ShoppingBag, TrendingUp, TrendingDown,
  Search, RefreshCw, Loader2, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

function inPeriod(dateStr, period) {
  try {
    const d = parseISO(dateStr);
    if (period === 'today') return isToday(d);
    if (period === 'week') return isThisWeek(d, { weekStartsOn: 1 });
    if (period === 'month') return isThisMonth(d);
    return true;
  } catch { return false; }
}

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return dir === 'desc' ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
}

function RevenueBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StoreRevenueDashboard() {
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' });

  const { data: orders = [], isLoading: ordersLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-revenue-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 2000),
    refetchInterval: 60000,
  });

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['store-revenue-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 200),
  });

  const isLoading = ordersLoading || storesLoading;

  // Filter orders by period and non-cancelled status
  const periodOrders = useMemo(() =>
    orders.filter(o => !['cancelled', 'refused'].includes(o.status) && inPeriod(o.created_date, period)),
    [orders, period]
  );

  // Compute per-store metrics
  const storeMetrics = useMemo(() => {
    const map = {};
    for (const o of periodOrders) {
      if (!o.store_id) continue;
      if (!map[o.store_id]) map[o.store_id] = { revenue: 0, orders: 0, delivered: 0 };
      map[o.store_id].revenue += o.total || 0;
      map[o.store_id].orders++;
      if (o.status === 'delivered') map[o.store_id].delivered++;
    }

    return stores.map(store => {
      const m = map[store.id] || { revenue: 0, orders: 0, delivered: 0 };
      return {
        id: store.id,
        name: store.name,
        city: store.city,
        county: store.county,
        revenue: m.revenue,
        orders: m.orders,
        delivered: m.delivered,
        avgOrder: m.orders > 0 ? m.revenue / m.orders : 0,
        completionRate: m.orders > 0 ? Math.round((m.delivered / m.orders) * 100) : 0,
      };
    });
  }, [stores, periodOrders]);

  // Summary totals
  const totals = useMemo(() => ({
    revenue: storeMetrics.reduce((s, m) => s + m.revenue, 0),
    orders: storeMetrics.reduce((s, m) => s + m.orders, 0),
    activeStores: storeMetrics.filter(m => m.orders > 0).length,
    avgOrderValue: periodOrders.length > 0
      ? periodOrders.reduce((s, o) => s + (o.total || 0), 0) / periodOrders.length
      : 0,
  }), [storeMetrics, periodOrders]);

  const maxRevenue = useMemo(() => Math.max(...storeMetrics.map(m => m.revenue), 1), [storeMetrics]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return storeMetrics
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q) || m.county?.toLowerCase().includes(q))
      .sort((a, b) => {
        const mul = sort.dir === 'desc' ? -1 : 1;
        if (sort.key === 'name') return mul * a.name.localeCompare(b.name);
        return mul * (a[sort.key] - b[sort.key]);
      });
  }, [storeMetrics, search, sort]);

  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: 'desc' }
    );
  };

  const periodLabel = PERIODS.find(p => p.value === period)?.label || '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Store className="w-7 h-7 text-primary" /> Store Revenue Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Daily revenue and order counts across all {stores.length} stores</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex bg-muted rounded-xl p-1 gap-0.5">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p.value ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: `${periodLabel} Revenue`, value: `$${totals.revenue.toFixed(2)}`, icon: DollarSign, bg: 'bg-primary/10', color: 'text-primary' },
          { label: `${periodLabel} Orders`, value: totals.orders, icon: ShoppingBag, bg: 'bg-blue-100', color: 'text-blue-600' },
          { label: 'Active Stores', value: `${totals.activeStores} / ${stores.length}`, icon: Store, bg: 'bg-emerald-100', color: 'text-emerald-600' },
          { label: 'Avg Order Value', value: `$${totals.avgOrderValue.toFixed(2)}`, icon: TrendingUp, bg: 'bg-amber-100', color: 'text-amber-600' },
        ].map(card => (
          <div key={card.label} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold tabular-nums">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by store, city, or county…" className="pl-9" />
        </div>
        <p className="text-xs text-muted-foreground flex-shrink-0">{filtered.length} stores</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading store data…
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-8">#</th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="inline-flex items-center gap-1">Store <SortIcon active={sort.key === 'name'} dir={sort.dir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('revenue')}
                  >
                    <span className="inline-flex items-center gap-1">Revenue <SortIcon active={sort.key === 'revenue'} dir={sort.dir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('orders')}
                  >
                    <span className="inline-flex items-center gap-1">Orders <SortIcon active={sort.key === 'orders'} dir={sort.dir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none hidden sm:table-cell"
                    onClick={() => toggleSort('avgOrder')}
                  >
                    <span className="inline-flex items-center gap-1">Avg Order <SortIcon active={sort.key === 'avgOrder'} dir={sort.dir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none hidden md:table-cell"
                    onClick={() => toggleSort('completionRate')}
                  >
                    <span className="inline-flex items-center gap-1">Completion <SortIcon active={sort.key === 'completionRate'} dir={sort.dir} /></span>
                  </th>
                  <th className="px-4 py-3 hidden lg:table-cell w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search ? 'No stores match your search' : `No orders recorded ${periodLabel.toLowerCase()}`}
                    </td>
                  </tr>
                ) : filtered.map((store, i) => (
                  <tr key={store.id} className={`hover:bg-muted/20 transition-colors ${store.orders === 0 ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{store.name}</p>
                      <p className="text-xs text-muted-foreground">{store.city}{store.county ? ` · ${store.county} Co.` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-bold tabular-nums ${store.revenue > 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        ${store.revenue.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold tabular-nums">{store.orders}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground tabular-nums">
                      {store.orders > 0 ? `$${store.avgOrder.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {store.orders > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {store.completionRate >= 80
                            ? <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            : <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <span className={`text-xs font-semibold ${store.completionRate >= 80 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {store.completionRate}%
                          </span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <RevenueBar value={store.revenue} max={maxRevenue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between text-sm font-semibold">
            <span className="text-muted-foreground">{filtered.length} stores</span>
            <div className="flex gap-6">
              <span>Total: <span className="text-emerald-700">${filtered.reduce((s, m) => s + m.revenue, 0).toFixed(2)}</span></span>
              <span>Orders: <span className="text-primary">{filtered.reduce((s, m) => s + m.orders, 0)}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}