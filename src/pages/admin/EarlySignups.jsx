import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Users, Truck, Wine, Search, CheckCircle2, XCircle, Phone, Mail, Car, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  pending:   'bg-amber-100 text-amber-700',
  contacted: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
};

const GIG_LABELS = {
  doordash: 'DoorDash', uber_eats: 'Uber Eats', instacart: 'Instacart',
  grubhub: 'GrubHub', multiple: 'Multiple apps', none: 'None', other: 'Other',
};

export default function EarlySignups() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: signups = [], isLoading } = useQuery({
    queryKey: ['early-signups'],
    queryFn: () => base44.entities.EarlySignup.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.EarlySignup.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['early-signups'] }),
  });

  const filtered = signups.filter(s => {
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all'   || s.role === roleFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const customers = signups.filter(s => s.role === 'customer').length;
  const drivers   = signups.filter(s => s.role === 'driver').length;
  const converted = signups.filter(s => s.status === 'converted').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Early Signups</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All pre-launch registrations from the early access form</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Signups', value: signups.length, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Customers',     value: customers,       icon: Wine,  color: 'bg-secondary/10 text-secondary' },
          { label: 'Drivers',       value: drivers,         icon: Truck, color: 'bg-blue-100 text-blue-700' },
          { label: 'Converted',     value: converted,       icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, email, city…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="driver">Drivers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No signups found.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Name', 'Role', 'Contact', 'Location', 'Driver Details', 'Referral', 'Date', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full',
                        s.role === 'customer' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary')}>
                        {s.role === 'customer' ? <Wine className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Mail className="w-3 h-3" /> {s.email}
                        </a>
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.city || '—'}</td>
                    <td className="px-4 py-3">
                      {s.role === 'driver' ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {s.gig_experience && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3" /> {GIG_LABELS[s.gig_experience] || s.gig_experience}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {s.has_vehicle ? (s.vehicle_type || 'Has vehicle') : 'No vehicle'}
                          </div>
                          <div className="flex items-center gap-1">
                            {s.has_valid_license
                              ? <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid license</>
                              : <><XCircle className="w-3 h-3 text-red-500" /> No license</>}
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.referral_source || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {s.created_date ? format(new Date(s.created_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.status || 'pending'}
                        onChange={e => updateMutation.mutate({ id: s.id, status: e.target.value })}
                        className={cn('text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer appearance-none', STATUS_COLORS[s.status] || STATUS_COLORS.pending)}
                      >
                        <option value="pending">Pending</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}