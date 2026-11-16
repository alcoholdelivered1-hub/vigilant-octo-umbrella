import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, ShieldCheck, AlertTriangle, CalendarClock, FileCheck } from 'lucide-react';
import useABCPermitStatus from '@/hooks/useABCPermitStatus';
import SundaySalesPanel from '@/components/admin/SundaySalesPanel';
import ABCPermitRow from '@/components/admin/ABCPermitRow';
import StatCard from '@/components/shared/StatCard';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical (≤7d)' },
  { key: 'urgent', label: 'Urgent (≤30d)' },
  { key: 'soon', label: 'Soon (≤60d)' },
  { key: 'expired', label: 'Expired' },
  { key: 'missing', label: 'Missing dates' },
];

export default function ABCPermitDashboard() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const { storeRows, summary, isLoading, error, refetch, isFetching } = useABCPermitStatus();

  const filtered = useMemo(() => {
    return storeRows.filter(row => {
      const { store, licenseUrgency, deliveryUrgency } = row;
      // Determine the worst urgency across license + delivery permit
      const worst = pickWorstUrgency(licenseUrgency, deliveryUrgency);
      if (filter === 'critical' && worst !== 'critical') return false;
      if (filter === 'urgent' && !['critical', 'urgent'].includes(worst)) return false;
      if (filter === 'soon' && !['critical', 'urgent', 'soon'].includes(worst)) return false;
      if (filter === 'expired' && worst !== 'expired') return false;
      if (filter === 'missing' && worst !== 'unknown') return false;
      if (query) {
        const q = query.toLowerCase();
        if (!store.name?.toLowerCase().includes(q) && !store.city?.toLowerCase().includes(q) && !store.county?.toLowerCase().includes(q) && !store.license_number?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [storeRows, filter, query]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-destructive">Failed to load ABC permit data.</p>
        <Button onClick={() => refetch()} variant="outline">Try again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          ABC Permit Status Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Track Arkansas ABC retail licenses and third-party delivery permits. All permits expire June 30 annually.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Licenses" value={summary.activeLicenses} icon={ShieldCheck} />
        <StatCard title="Delivery Permits" value={`${summary.activeDeliveryPermits}/${summary.deliveryPermits}`} icon={FileCheck} />
        <StatCard title="Need Renewal (≤60d)" value={summary.needsRenewal} icon={CalendarClock} />
        <StatCard title="Expired" value={summary.expired} icon={AlertTriangle} />
      </div>

      {/* Renewal Notice */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Annual Renewal Deadline: June 30</p>
            <p className="text-sm text-blue-700 mt-0.5">
              All ABC permits expire June 30 each year. Late fees apply: 50% surcharge July 1–Aug 29, 100% surcharge Aug 30–Oct 28.
              {summary.needsRenewal > 0 && ` ${summary.needsRenewal} permit(s) need renewal within 60 days.`}
            </p>
          </div>
        </div>
      </div>

      {/* Sunday Sales Local Options */}
      <SundaySalesPanel />

      {/* Search + Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search store, city, county, or license number…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No permits match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="py-3 px-4 font-semibold">Store</th>
                  <th className="py-3 px-4 font-semibold">License #</th>
                  <th className="py-3 px-4 font-semibold">License Expiration</th>
                  <th className="py-3 px-4 font-semibold">Delivery Permit</th>
                  <th className="py-3 px-4 font-semibold">City License</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <ABCPermitRow key={row.store.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {summary.missingDates > 0 && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-sm text-yellow-800">
            {summary.missingDates} document(s) have missing or invalid expiration dates and cannot be assessed for renewal urgency.
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {summary.totalStores} retailers
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}

const URGENCY_RANK = { expired: 0, critical: 1, urgent: 2, soon: 3, current: 4, unknown: 5 };
function pickWorstUrgency(a, b) {
  const ra = URGENCY_RANK[a] ?? 99;
  const rb = URGENCY_RANK[b] ?? 99;
  return ra <= rb ? a : b;
}