import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, subDays, isAfter } from 'date-fns';
import { Download, ShieldAlert, TrendingDown, FileBarChart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const RANGES = [
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: 'quarter', label: 'This Quarter', days: 90 },
  { key: 'all', label: 'All Time', days: null },
];

const CATEGORY_CONFIG = {
  id_verification_failed: { label: 'ID Verification Failed', color: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  intoxication_refused: { label: 'Intoxication Refused', color: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  minor_attempt: { label: 'Possible Minor', color: '#9333ea', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  other_refusal: { label: 'Other Refusal', color: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  refused_order: { label: 'Refused at Delivery', color: '#b91c1c', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
};

export default function FailedDeliveriesTab() {
  const [range, setRange] = useState('30d');

  const { data: incidents = [], isLoading: incLoading } = useQuery({
    queryKey: ['compliance-incidents'],
    queryFn: () => base44.entities.ComplianceIncident.list('-incident_date', 500),
  });

  const { data: orders = [], isLoading: ordLoading } = useQuery({
    queryKey: ['compliance-orders-refused'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const cutoff = useMemo(() => {
    const cfg = RANGES.find(r => r.key === range);
    if (!cfg || !cfg.days) return null;
    return subDays(new Date(), cfg.days);
  }, [range]);

  const filteredIncidents = useMemo(() => {
    if (!cutoff) return incidents;
    return incidents.filter(i => {
      const d = i.incident_date ? new Date(i.incident_date) : i.created_date ? new Date(i.created_date) : null;
      return d && isAfter(d, cutoff);
    });
  }, [incidents, cutoff]);

  const refusedOrders = useMemo(() => {
    const refused = orders.filter(o => o.status === 'refused' || o.status === 'cancelled');
    if (!cutoff) return refused;
    return refused.filter(o => o.created_date && isAfter(new Date(o.created_date), cutoff));
  }, [orders, cutoff]);

  // Build categorized dataset
  const categoryData = useMemo(() => {
    const counts = {};
    Object.keys(CATEGORY_CONFIG).forEach(k => counts[k] = 0);

    filteredIncidents.forEach(inc => {
      const key = inc.incident_type || 'other_refusal';
      counts[key] = (counts[key] || 0) + 1;
    });

    // Add refused orders that don't have a matching compliance incident
    const incidentOrderIds = new Set(filteredIncidents.map(i => i.order_id).filter(Boolean));
    refusedOrders.forEach(order => {
      if (!incidentOrderIds.has(order.id)) {
        counts.refused_order = (counts.refused_order || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        name: CATEGORY_CONFIG[key]?.label || key,
        count,
        color: CATEGORY_CONFIG[key]?.color || '#6b7280',
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredIncidents, refusedOrders]);

  const totalFailures = categoryData.reduce((sum, d) => sum + d.count, 0);
  const unresolvedCount = filteredIncidents.filter(i => !i.is_resolved).length;
  const isLoading = incLoading || ordLoading;

  // Breakdown by store
  const storeBreakdown = useMemo(() => {
    const storeMap = {};
    const addFailure = (storeName, category) => {
      if (!storeName) storeName = 'Unknown Store';
      if (!storeMap[storeName]) storeMap[storeName] = { total: 0, categories: {} };
      storeMap[storeName].total++;
      storeMap[storeName].categories[category] = (storeMap[storeName].categories[category] || 0) + 1;
    };

    filteredIncidents.forEach(inc => {
      addFailure(inc.store_name, inc.incident_type || 'other_refusal');
    });

    const incidentOrderIds = new Set(filteredIncidents.map(i => i.order_id).filter(Boolean));
    refusedOrders.forEach(order => {
      if (!incidentOrderIds.has(order.id)) {
        addFailure(order.store_name, 'refused_order');
      }
    });

    return Object.entries(storeMap)
      .map(([store, data]) => ({ store, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredIncidents, refusedOrders]);

  // Breakdown by driver
  const driverBreakdown = useMemo(() => {
    const driverMap = {};
    const addFailure = (driverName, category) => {
      if (!driverName) driverName = 'Unassigned';
      if (!driverMap[driverName]) driverMap[driverName] = { total: 0, categories: {} };
      driverMap[driverName].total++;
      driverMap[driverName].categories[category] = (driverMap[driverName].categories[category] || 0) + 1;
    };

    filteredIncidents.forEach(inc => {
      addFailure(inc.driver_name, inc.incident_type || 'other_refusal');
    });

    const incidentOrderIds = new Set(filteredIncidents.map(i => i.order_id).filter(Boolean));
    refusedOrders.forEach(order => {
      if (!incidentOrderIds.has(order.id)) {
        addFailure(order.driver_name, 'refused_order');
      }
    });

    return Object.entries(driverMap)
      .map(([driver, data]) => ({ driver, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredIncidents, refusedOrders]);

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Order #', 'Customer', 'Store', 'Driver', 'Reason', 'Address', 'Resolved'];
    const rows = [];

    filteredIncidents.forEach(inc => {
      rows.push([
        inc.incident_date ? format(new Date(inc.incident_date), 'MMM d, yyyy h:mm a') : '',
        CATEGORY_CONFIG[inc.incident_type]?.label || inc.incident_type || '',
        inc.order_number || '',
        inc.customer_name || '',
        inc.store_name || '',
        inc.driver_name || '',
        (inc.reason || '').replace(/"/g, '""'),
        (inc.delivery_address || '').replace(/"/g, '""'),
        inc.is_resolved ? 'Yes' : 'No',
      ]);
    });

    const incidentOrderIds = new Set(filteredIncidents.map(i => i.order_id).filter(Boolean));
    refusedOrders.forEach(order => {
      if (!incidentOrderIds.has(order.id)) {
        rows.push([
          order.created_date ? format(new Date(order.created_date), 'MMM d, yyyy h:mm a') : '',
          'Refused at Delivery',
          order.order_number || '',
          order.customer_name || '',
          order.store_name || '',
          order.driver_name || '',
          (order.refusal_reason || 'Delivery refused').replace(/"/g, '""'),
          (order.delivery_address || '').replace(/"/g, '""'),
          'N/A',
        ]);
      }
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed-deliveries-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" /> Failed Delivery Report
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All refused and failed delivery attempts, categorized by reason for Arkansas ABC compliance reporting.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={totalFailures === 0} className="rounded-xl gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Date range filter */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${range === r.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-3xl font-bold">{totalFailures}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Failed Deliveries</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-3xl font-bold text-red-600">{unresolvedCount}</p>
          <p className="text-xs text-red-700 mt-1">Unresolved Incidents</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-3xl font-bold text-orange-600">
            {categoryData.find(d => d.key === 'intoxication_refused')?.count || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Intoxication Refusals</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-3xl font-bold text-purple-600">
            {categoryData.find(d => d.key === 'minor_attempt')?.count || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Minor Attempts</p>
        </div>
      </div>

      {totalFailures === 0 ? (
        <div className="text-center py-20 bg-card border rounded-2xl">
          <TrendingDown className="w-12 h-12 text-emerald-500/50 mx-auto" />
          <p className="text-muted-foreground mt-4">No failed deliveries in this period</p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-primary" /> Failures by Refusal Reason
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Count of each failure type</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val) => [`${val} incident(s)`, 'Count']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-1">Distribution by Category</h3>
              <p className="text-xs text-muted-foreground mb-4">Percentage breakdown</p>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${((entry.count / totalFailures) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val} (${((val / totalFailures) * 100).toFixed(1)}%)`, 'Count']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category breakdown table */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="p-5 border-b">
              <h3 className="font-semibold">Category Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Refusal Reason</th>
                    <th className="text-right p-4 font-medium">Count</th>
                    <th className="text-right p-4 font-medium">% of Total</th>
                    <th className="text-left p-4 font-medium w-1/3">Visual</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categoryData.map(cat => {
                    const pct = totalFailures > 0 ? (cat.count / totalFailures) * 100 : 0;
                    const cfg = CATEGORY_CONFIG[cat.key] || {};
                    return (
                      <tr key={cat.key}>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                            {cat.name}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold">{cat.count}</td>
                        <td className="p-4 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                        <td className="p-4">
                          <div className="w-full bg-muted rounded-full h-2.5">
                            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="p-4">Total</td>
                    <td className="p-4 text-right">{totalFailures}</td>
                    <td className="p-4 text-right">100%</td>
                    <td className="p-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Store and driver breakdowns */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Top Stores by Failed Deliveries</h3>
              {storeBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {storeBreakdown.map(s => (
                    <div key={s.store}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{s.store}</span>
                        <span className="text-sm font-bold ml-2">{s.total}</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        {Object.entries(s.categories).map(([cat, count]) => (
                          <div
                            key={cat}
                            style={{ width: `${(count / s.total) * 100}%`, backgroundColor: CATEGORY_CONFIG[cat]?.color || '#6b7280' }}
                            title={`${CATEGORY_CONFIG[cat]?.label || cat}: ${count}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Top Drivers by Failed Deliveries</h3>
              {driverBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {driverBreakdown.map(d => (
                    <div key={d.driver}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{d.driver}</span>
                        <span className="text-sm font-bold ml-2">{d.total}</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        {Object.entries(d.categories).map(([cat, count]) => (
                          <div
                            key={cat}
                            style={{ width: `${(count / d.total) * 100}%`, backgroundColor: CATEGORY_CONFIG[cat]?.color || '#6b7280' }}
                            title={`${CATEGORY_CONFIG[cat]?.label || cat}: ${count}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}