import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Store, Search, Mail, Phone, MapPin, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const BUSINESS_LABELS = {
  liquor_store: 'Liquor Store', wine_spirits: 'Wine & Spirits', convenience: 'Convenience',
  grocery: 'Grocery', restaurant_bar: 'Restaurant / Bar', other: 'Other',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  contacted: { label: 'Contacted', bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { label: 'Approved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  onboarded: { label: 'Onboarded', bg: 'bg-primary/10', text: 'text-primary' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function RetailerSignups() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: signups = [], isLoading } = useQuery({
    queryKey: ['retailer-signups'],
    queryFn: () => base44.entities.RetailerSignup.list('-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RetailerSignup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-signups'] });
      toast.success('Application updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update'),
  });

  const filtered = signups.filter(s => {
    const matchesSearch = !search ||
      s.store_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_email?.toLowerCase().includes(search.toLowerCase()) ||
      s.license_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    pending: signups.filter(s => s.status === 'pending').length,
    contacted: signups.filter(s => s.status === 'contacted').length,
    approved: signups.filter(s => s.status === 'approved').length,
    onboarded: signups.filter(s => s.status === 'onboarded').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Store className="w-7 h-7 text-primary" /> Retailer Signups
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Self-submitted retailer applications. Review and move them through onboarding.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: counts.pending, cls: 'text-amber-700' },
          { label: 'Contacted', value: counts.contacted, cls: 'text-blue-700' },
          { label: 'Approved', value: counts.approved, cls: 'text-emerald-700' },
          { label: 'Onboarded', value: counts.onboarded, cls: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by store, contact, email, or license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger aria-label="Filter by status" className="min-w-[9.5rem] px-4 py-2.5 rounded-xl border bg-card text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="onboarded">Onboarded</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No retailer applications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
            return (
              <div key={s.id} className="bg-card border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-lg">{s.store_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      <span className="text-xs text-muted-foreground">{BUSINESS_LABELS[s.business_type] || s.business_type}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5 mt-3 text-sm text-muted-foreground">
                      <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /> {s.contact_email}</p>
                      <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {s.contact_phone || 'No phone'}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {[s.address, s.city, s.county, s.state, s.zip_code].filter(Boolean).join(', ')}</p>
                      <p className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 shrink-0" /> License: {s.license_number || 'Not provided'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Contact: {s.contact_name}</span>
                      {s.num_locations > 1 && <span>· {s.num_locations} locations</span>}
                      {s.has_pos && <span>· POS: {s.pos_provider || 'Yes'}</span>}
                      {s.operating_hours && <span>· Hours: {s.operating_hours}</span>}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded p-2">{s.description}</p>}
                    {s.referral_source && <p className="text-xs text-muted-foreground mt-1">Heard about us via: {s.referral_source}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{s.created_date ? format(new Date(s.created_date), 'MMM d, yyyy') : ''}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                  <Select
                    value={s.status}
                    onValueChange={(val) => updateMutation.mutate({ id: s.id, data: { status: val } })}
                  >
                    <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([val, c]) => (
                        <SelectItem key={val} value={val} className="text-xs">{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {s.status === 'approved' && (
                    <Link to="/admin/retailer-onboarding">
                      <Button size="sm" variant="outline"><Store className="w-4 h-4 mr-1.5" /> Continue Onboarding</Button>
                    </Link>
                  )}
                  {s.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: s.id, data: { status: 'contacted' } })}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Contacted
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}