import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';
import {
  AlertTriangle, CheckCircle2, XCircle, Store, Search,
  FileText, Clock, RefreshCw, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const EXPIRY_WARN_DAYS = 30; // warn if license expires within 30 days

function getLicenseStatus(store) {
  const issues = [];

  if (!store.license_number || store.license_number.trim() === '') {
    issues.push({ type: 'error', label: 'Missing license number' });
  }
  if (!store.email || store.email.trim() === '') {
    issues.push({ type: 'error', label: 'No contact email on file' });
  }
  if (!store.phone || store.phone.trim() === '') {
    issues.push({ type: 'warning', label: 'No phone number on file' });
  }
  if (!store.address || store.address.trim() === '') {
    issues.push({ type: 'error', label: 'Missing physical address' });
  }
  if (!store.county || store.county.trim() === '') {
    issues.push({ type: 'error', label: 'County not assigned (required for zone compliance)' });
  }
  if (!store.latitude || !store.longitude) {
    issues.push({ type: 'warning', label: 'GPS coordinates missing (affects delivery routing)' });
  }
  if (!store.operating_hours_start || !store.operating_hours_end) {
    issues.push({ type: 'warning', label: 'Operating hours not set' });
  }

  // Placement expiry check
  if (store.placement_tier !== 'standard' && store.placement_expires) {
    try {
      const daysLeft = differenceInDays(parseISO(store.placement_expires), new Date());
      if (daysLeft < 0) {
        issues.push({ type: 'error', label: `Paid placement expired ${Math.abs(daysLeft)} days ago` });
      } else if (daysLeft <= EXPIRY_WARN_DAYS) {
        issues.push({ type: 'warning', label: `Placement expires in ${daysLeft} days` });
      }
    } catch {}
  }

  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');

  return {
    issues,
    status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok',
  };
}

const STATUS_CONFIG = {
  error: { label: 'Action Required', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: XCircle, iconColor: 'text-red-500' },
  warning: { label: 'Needs Review', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' },
  ok: { label: 'Compliant', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, iconColor: 'text-emerald-500' },
};

function StoreRow({ store, audit }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[audit.status];
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-xl overflow-hidden ${audit.status !== 'ok' ? cfg.border : 'border-border'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/30 ${audit.status !== 'ok' ? cfg.bg : ''}`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{store.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
            {audit.issues.length > 0 && (
              <span className="text-xs text-muted-foreground">{audit.issues.length} issue{audit.issues.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {store.city}{store.county ? ` · ${store.county} Co.` : ''} · License: {store.license_number || <span className="text-red-500 font-semibold">MISSING</span>}
          </p>
        </div>
        <div className="flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t bg-card">
          {audit.issues.length === 0 ? (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5 mt-2">
              <CheckCircle2 className="w-4 h-4" /> All documentation fields are complete.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {audit.issues.map((issue, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                  {issue.type === 'error'
                    ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {issue.label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong>Email:</strong> {store.email || '—'}</span>
            <span><strong>Phone:</strong> {store.phone || '—'}</span>
            <span><strong>Address:</strong> {store.address || '—'}</span>
            <span><strong>Hours:</strong> {store.operating_hours_start && store.operating_hours_end ? `${store.operating_hours_start} – ${store.operating_hours_end}` : '—'}</span>
            <span><strong>Tier:</strong> {store.placement_tier || 'standard'}</span>
            <span><strong>GPS:</strong> {store.latitude && store.longitude ? '✓' : '✗ Missing'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreLicenseAudit() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'error' | 'warning' | 'ok'

  const { data: stores = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-license-audit'],
    queryFn: () => base44.entities.Store.list('name', 500),
  });

  const audited = useMemo(() =>
    stores.map(store => ({ store, audit: getLicenseStatus(store) })),
    [stores]
  );

  const summary = useMemo(() => ({
    error: audited.filter(a => a.audit.status === 'error').length,
    warning: audited.filter(a => a.audit.status === 'warning').length,
    ok: audited.filter(a => a.audit.status === 'ok').length,
  }), [audited]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return audited.filter(({ store, audit }) => {
      const matchSearch = !q || store.name.toLowerCase().includes(q) || store.city?.toLowerCase().includes(q) || store.county?.toLowerCase().includes(q) || store.license_number?.toLowerCase().includes(q);
      const matchFilter = filter === 'all' || audit.status === filter;
      return matchSearch && matchFilter;
    });
  }, [audited, search, filter]);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'error', label: 'Action Required', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
          { key: 'warning', label: 'Needs Review', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { key: 'ok', label: 'Compliant', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map(({ key, label, icon: Icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setFilter(f => f === key ? 'all' : key)}
            className={`rounded-2xl p-4 border-2 transition-all text-left ${filter === key ? `${bg} ${border}` : 'bg-card border-border hover:border-muted-foreground/30'}`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className={`text-2xl font-bold ${color}`}>{summary[key]}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stores…" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Auditing stores…
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Showing {filtered.length} of {stores.length} stores</p>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No stores match your filter</p>
              </div>
            ) : (
              // Sort: errors first, then warnings, then ok
              [...filtered]
                .sort((a, b) => {
                  const order = { error: 0, warning: 1, ok: 2 };
                  return order[a.audit.status] - order[b.audit.status];
                })
                .map(({ store, audit }) => (
                  <StoreRow key={store.id} store={store} audit={audit} />
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}