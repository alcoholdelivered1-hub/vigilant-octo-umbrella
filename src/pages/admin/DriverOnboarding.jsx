import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, ShieldCheck, CheckCircle2, Clock, XCircle, Search, Car, IdCard } from 'lucide-react';
import { format } from 'date-fns';
import DriverRetailerCoverage from '@/components/admin/DriverRetailerCoverage';
import DriverApplicationDocuments from '@/components/driver/DriverApplicationDocuments';
import { toast } from 'sonner';

const BG_CONFIG = {
  clear: { label: 'Cleared', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function DriverOnboarding() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['onboarding-drivers'],
    queryFn: () => base44.entities.Driver.list('-created_date', 200),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['driver-applications'],
    queryFn: () => base44.entities.EarlySignup.filter({ role: 'driver' }, '-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Driver.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-drivers'] });
      toast.success('Driver updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update'),
  });

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.email?.toLowerCase().includes(q) || d.phone?.toLowerCase().includes(q);
  });

  const pendingBg = drivers.filter(d => d.background_check_status === 'pending').length;
  const trainingDone = drivers.filter(d => d.training_completed).length;
  const verifiedCheck = d => d.background_check_status === 'clear' && d.background_check_id && !/^(simulated|test|demo|ad-)/i.test(d.background_check_id) && d.background_check_completed_at;
  const ready = drivers.filter(d => d.is_active && verifiedCheck(d) && d.training_completed).length;

  const approve = (d) => updateMutation.mutate({ id: d.id, data: { is_active: true, status: 'available' } });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Driver Onboarding
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review driver applications, background checks, and training before approving them to deliver.
        </p>
      </div>

      <DriverRetailerCoverage />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <Users className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{drivers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Drivers</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-700">{pendingBg}</p>
          <p className="text-xs text-amber-700 mt-1">Background Checks Pending</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <ShieldCheck className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">{trainingDone}</p>
          <p className="text-xs text-muted-foreground mt-1">Training Complete</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold text-emerald-700">{ready}</p>
          <p className="text-xs text-emerald-700 mt-1">Approved to Drive</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search drivers by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Driver list */}
      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No drivers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const bg = d.background_check_status === 'clear' && !verifiedCheck(d) ? { ...BG_CONFIG.pending, label: 'Needs verified report' } : BG_CONFIG[d.background_check_status] || BG_CONFIG.pending;
            const canApprove = !d.is_active && verifiedCheck(d) && d.training_completed && d.license_number && d.vehicle_info && d.date_of_birth && new Date(d.date_of_birth) <= new Date(new Date().setFullYear(new Date().getFullYear() - 21));
            return (
              <div key={d.id} className="bg-card border rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-lg">{d.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bg.bg} ${bg.color}`}>{bg.label} BG</span>
                      {d.training_completed ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><ShieldCheck className="w-3.5 h-3.5" /> Trained</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock className="w-3.5 h-3.5" /> Training Due</span>
                      )}
                      {d.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium"><XCircle className="w-3.5 h-3.5" /> Inactive</span>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5 mt-3 text-sm text-muted-foreground">
                      <p>✉️ {d.email}</p>
                      <p>📞 {d.phone}</p>
                      <p className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> {d.vehicle_info || 'No vehicle info'}</p>
                      <p className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> {d.license_number || 'No license on file'}</p>
                      {d.background_check_completed_at && <p>✅ BG check: {format(new Date(d.background_check_completed_at), 'MMM d, yyyy')}</p>}
                      {d.training_completed_date && <p>🎓 Training: {format(new Date(d.training_completed_date), 'MMM d, yyyy')}</p>}
                    </div>
                    {d.background_check_id && <p className="text-xs text-muted-foreground mt-2">Report ID: {d.background_check_id}</p>}
                    <DriverApplicationDocuments driver={d} />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {canApprove ? (
                      <Button size="sm" onClick={() => approve(d)} disabled={updateMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve to Drive
                      </Button>
                    ) : d.is_active ? (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: d.id, data: { is_active: false, status: 'offline' } })}>
                        Deactivate
                      </Button>
                    ) : null}
                    {!d.training_completed && (
                      <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: d.id, data: { training_completed: true, training_completed_date: new Date().toISOString().split('T')[0] } })}>
                        Mark Training Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Early signups (applications not yet converted) */}
      {applications.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold pt-4">Pending Applications ({applications.filter(a => a.status === 'pending' || a.status === 'contacted').length})</h2>
          {applications.filter(a => a.status === 'pending' || a.status === 'contacted').map(a => (
            <div key={a.id} className="bg-muted/30 border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{a.full_name}</p>
                <p className="text-xs text-muted-foreground">{a.email} · {a.phone} · {a.city}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vehicle: {a.has_vehicle ? 'Yes' : 'No'} {a.vehicle_type ? `· ${a.vehicle_type}` : ''} · Exp: {a.gig_experience || 'none'}
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 capitalize">{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}