import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Search, MapPin } from 'lucide-react';

const TASK_LABELS = {
  agreement_signed: 'Retailer agreement signed',
  license_present: 'Store license recorded',
  compliance_clear: 'Compliance status clear',
  abc_permit: 'ABC delivery permit current',
  city_license: 'City business license current',
  tax_confirmed: 'DFA tax confirmation recorded',
  clover_connected: 'Clover POS connected',
  inventory_synced: 'Inventory synced',
  stripe_connected: 'Stripe connected',
  test_order_passed: 'Sandbox launch test passed',
};

export default function StoreComplianceDashboard() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['store-compliance-overview'],
    queryFn: async () => (await base44.functions.invoke('storeComplianceOverview', {})).data,
    refetchInterval: 60000,
  });

  const stores = data?.stores || [];
  const global = data?.global;

  const filtered = useMemo(() => {
    return stores.filter(store => {
      if (filter === 'live' && !store.fully_live) return false;
      if (filter === 'blocked' && store.fully_live) return false;
      if (filter === 'inprogress' && (store.fully_live || store.missing.length === Object.keys(TASK_LABELS).length)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!store.name?.toLowerCase().includes(q) && !store.city?.toLowerCase().includes(q) && !store.county?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [stores, filter, query]);

  const liveCount = stores.filter(s => s.fully_live).length;
  const blockedCount = stores.filter(s => !s.fully_live && s.missing.length < Object.keys(TASK_LABELS).length).length;
  const notStartedCount = stores.filter(s => s.missing.length === Object.keys(TASK_LABELS).length).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="text-center py-20 space-y-3">
      <p className="text-destructive">Failed to load compliance overview.</p>
      <Button onClick={() => refetch()} variant="outline">Try again</Button>
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Store Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground">Centralized view of live stores and outstanding launch tasks.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 self-start">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Fully live" value={liveCount} icon={<CheckCircle2 className="w-5 h-5" />} tone="success" />
        <SummaryCard label="In progress" value={stores.length - liveCount - notStartedCount} icon={<AlertTriangle className="w-5 h-5" />} tone="warning" />
        <SummaryCard label="Not started" value={notStartedCount} icon={<XCircle className="w-5 h-5" />} tone="muted" />
        <SummaryCard label="Total stores" value={stores.length} icon={<MapPin className="w-5 h-5" />} tone="primary" />
      </div>

      {/* Global platform checks */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Platform-wide checks</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <GlobalCheck label="Stripe webhook active" done={global?.webhook_active} />
          <GlobalCheck label="Webhook signing secret" done={global?.webhook_secret_configured} />
          <GlobalCheck label="Firebase push configured" done={global?.firebase_configured} />
          <GlobalCheck label="Qualified drivers available" done={global?.qualified_drivers > 0} value={`${global?.qualified_drivers || 0} ready`} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search store, city, or county…" className="pl-9" aria-label="Search stores" />
        </div>
        <div className="flex gap-1 rounded-lg border bg-card p-1" role="tablist" aria-label="Filter stores">
          {[
            { key: 'all', label: 'All' },
            { key: 'live', label: 'Live' },
            { key: 'blocked', label: 'Blocked' },
            { key: 'inprogress', label: 'In progress' },
          ].map(tab => (
            <button key={tab.key} role="tab" aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${filter === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Store rows */}
      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No stores match this filter.</p>}
        {filtered.map(store => {
          const done = Object.keys(TASK_LABELS).length - store.missing.length;
          const pct = Math.round((done / Object.keys(TASK_LABELS).length) * 100);
          return (
            <div key={store.store_id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{store.name}</h3>
                    {store.fully_live
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> Live</span>
                      : store.missing.length === Object.keys(TASK_LABELS).length
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">Not started</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><AlertTriangle className="w-3 h-3" /> {store.missing.length} task{store.missing.length !== 1 ? 's' : ''} left</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{[store.city, store.county, store.state].filter(Boolean).join(', ')}</p>
                </div>
                <Link to={`/stores/${store.store_id}`}><Button variant="outline" size="sm">View store</Button></Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full ${store.fully_live ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{done}/{Object.keys(TASK_LABELS).length}</span>
              </div>
              {store.missing.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {store.missing.map(key => (
                    <span key={key} className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-full px-2 py-0.5">
                      <XCircle className="w-3 h-3" /> {TASK_LABELS[key]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    success: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    muted: 'text-muted-foreground bg-muted border-border',
    primary: 'text-primary bg-primary/10 border-primary/20',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {icon}
      </div>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

function GlobalCheck({ label, done, value }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
      <span className="text-sm">{label}</span>
      {value && <span className="text-xs text-muted-foreground ml-auto">{value}</span>}
    </div>
  );
}