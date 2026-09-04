import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShieldAlert, Search, CheckCircle2, Clock, User, Store, Truck, MapPin, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_CONFIG = {
  id_verification_failed: { label: 'ID Verification Failed', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  intoxication_refused: { label: 'Intoxication Refused', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  minor_attempt: { label: 'Possible Minor', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  other_refusal: { label: 'Delivery Refused', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

export default function ComplianceIncidents() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['compliance-incidents'],
    queryFn: () => base44.entities.ComplianceIncident.list('-incident_date', 200),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.ComplianceIncident.update(id, {
      is_resolved: true,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-incidents'] });
      setResolvingId(null);
      setResolutionNotes('');
    },
  });

  const filtered = incidents.filter(inc => {
    const matchesSearch = !search ||
      inc.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      inc.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      inc.store_name?.toLowerCase().includes(search.toLowerCase()) ||
      inc.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || inc.incident_type === filterType;
    return matchesSearch && matchesType;
  });

  const unresolved = incidents.filter(i => !i.is_resolved);
  const resolved = incidents.filter(i => i.is_resolved);

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Order #', 'Customer', 'Store', 'Driver', 'Reason', 'Address', 'Resolved', 'Notes'];
    const rows = filtered.map(i => [
      i.incident_date ? format(new Date(i.incident_date), 'MMM d, yyyy h:mm a') : '',
      TYPE_CONFIG[i.incident_type]?.label || i.incident_type,
      i.order_number || '',
      i.customer_name || '',
      i.store_name || '',
      i.driver_name || '',
      (i.reason || '').replace(/"/g, '""'),
      (i.delivery_address || '').replace(/"/g, '""'),
      i.is_resolved ? 'Yes' : 'No',
      (i.resolution_notes || '').replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-incidents-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-red-600" /> Compliance Incident Log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Failed delivery attempts — ID verification failures, intoxication refusals, and minor attempts. Records retained for Arkansas ABC compliance.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-2xl font-bold">{incidents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Incidents</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-600">{unresolved.length}</p>
          <p className="text-xs text-red-700 mt-1">Unresolved</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-2xl font-bold text-emerald-600">{resolved.length}</p>
          <p className="text-xs text-emerald-700 mt-1">Resolved</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-2xl font-bold text-orange-600">
            {incidents.filter(i => i.incident_type === 'intoxication_refused').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Intoxication Refusals</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order, customer, store, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 rounded-xl border bg-card text-sm font-medium"
        >
          <option value="all">All Types</option>
          <option value="id_verification_failed">ID Verification Failed</option>
          <option value="intoxication_refused">Intoxication Refused</option>
          <option value="minor_attempt">Possible Minor</option>
          <option value="other_refusal">Other Refusal</option>
        </select>
        <Button variant="outline" onClick={exportCSV} className="rounded-xl shrink-0">
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Incident list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No compliance incidents recorded</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inc => {
            const cfg = TYPE_CONFIG[inc.incident_type] || TYPE_CONFIG.other_refusal;
            return (
              <div key={inc.id} className={`bg-card border rounded-2xl p-5 ${inc.is_resolved ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    {inc.is_resolved ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Unresolved
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {inc.incident_date ? format(new Date(inc.incident_date), 'MMM d, h:mm a') : ''}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-foreground">{inc.order_number || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    {inc.customer_name || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    {inc.store_name || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    {inc.driver_name || 'N/A'}
                  </div>
                </div>

                <div className="mt-3 bg-muted/40 rounded-lg p-3 text-sm">
                  <p className="font-medium text-foreground">{inc.reason}</p>
                  {inc.delivery_address && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                      <MapPin className="w-3 h-3" /> {inc.delivery_address}
                    </p>
                  )}
                </div>

                {inc.is_resolved && inc.resolution_notes && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Resolution Notes</p>
                    <p className="text-emerald-800">{inc.resolution_notes}</p>
                  </div>
                )}

                {!inc.is_resolved && (
                  <div className="mt-3">
                    {resolvingId === inc.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Document the follow-up action taken..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="rounded-xl text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => resolveMutation.mutate({ id: inc.id, notes: resolutionNotes })}
                            disabled={!resolutionNotes.trim() || resolveMutation.isPending}
                            className="rounded-xl"
                          >
                            {resolveMutation.isPending ? 'Saving…' : 'Save & Mark Resolved'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setResolvingId(null); setResolutionNotes(''); }}
                            className="rounded-xl"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setResolvingId(inc.id); setResolutionNotes(''); }}
                        className="rounded-xl"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark as Resolved
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}