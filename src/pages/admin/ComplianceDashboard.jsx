import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, Clock, FileX2, Search, Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-amber-100 text-amber-700',
  revoked: 'bg-red-100 text-red-700',
};

export default function ComplianceDashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: permits = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['compliance-permits'],
    queryFn: () => base44.entities.BusinessPermit.list('-updated_date', 500),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['compliance-stores'],
    queryFn: () => base44.entities.Store.list(),
  });

  const storeMap = useMemo(() => {
    const m = new Map();
    stores.forEach(s => m.set(s.id, s));
    return m;
  }, [stores]);

  const rows = useMemo(() => {
    return permits.map(p => {
      const store = storeMap.get(p.store_id);
      const expDate = p.expiration_date && isValid(parseISO(p.expiration_date)) ? parseISO(p.expiration_date) : null;
      const daysToExpire = expDate ? differenceInDays(expDate, new Date()) : null;
      return { ...p, storeName: store?.name || '—', storeCity: store?.city || '', expDate, daysToExpire };
    });
  }, [permits, storeMap]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.status === 'active').length;
    const expiringSoon = rows.filter(r => r.daysToExpire !== null && r.daysToExpire >= 0 && r.daysToExpire <= 30).length;
    const expired = rows.filter(r => r.status === 'expired' || (r.daysToExpire !== null && r.daysToExpire < 0)).length;
    const pendingVerify = rows.filter(r => !r.document_on_file).length;
    return { total: rows.length, active, expiringSoon, expired, pendingVerify };
  }, [rows]);

  const pendingTasks = useMemo(() => rows.filter(r => !r.document_on_file), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'expiring') {
          if (!(r.daysToExpire !== null && r.daysToExpire >= 0 && r.daysToExpire <= 30)) return false;
        } else if (statusFilter === 'pending') {
          if (r.document_on_file) return false;
        } else if (r.status !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.legal_name} ${r.permit_number} ${r.storeName} ${r.storeCity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> Compliance Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Retailer ABC permits, expirations, and verification tasks.</p>
        </div>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs">
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label="Active permits" value={stats.active} tone="emerald" />
        <StatCard icon={Clock} label="Expiring ≤30 days" value={stats.expiringSoon} tone="amber" />
        <StatCard icon={XCircle} label="Expired" value={stats.expired} tone="red" />
        <StatCard icon={FileX2} label="Pending verification" value={stats.pendingVerify} tone="slate" />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by store, permit, or license…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All permits</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending verification</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">No permits match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Store</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Permit #</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Expires</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.storeName}</div>
                      {p.storeCity && <div className="text-xs text-muted-foreground">{p.storeCity}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.permit_number}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'} variant="secondary">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {p.expDate ? (
                        <div>
                          <div>{format(p.expDate, 'MMM d, yyyy')}</div>
                          {p.daysToExpire !== null && (
                            <div className={p.daysToExpire < 0 ? 'text-red-600 font-medium' : p.daysToExpire <= 30 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                              {p.daysToExpire < 0 ? `${Math.abs(p.daysToExpire)}d overdue` : `in ${p.daysToExpire}d`}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.document_on_file
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingTasks.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm text-amber-800">Pending Verification Tasks</h2>
            <span className="ml-auto bg-amber-200 text-amber-800 text-xs font-bold rounded-full px-2 py-0.5">{pendingTasks.length}</span>
          </div>
          <div className="divide-y">
            {pendingTasks.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{p.storeName}</div>
                  <div className="text-xs text-muted-foreground">Permit #{p.permit_number} · {p.permit_type.replace(/_/g, ' ')}</div>
                </div>
                <div className="text-right shrink-0">
                  {!p.expiration_date && <Badge variant="outline" className="text-amber-700 border-amber-300">Missing expiry</Badge>}
                  {p.verification_notes && <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{p.verification_notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}