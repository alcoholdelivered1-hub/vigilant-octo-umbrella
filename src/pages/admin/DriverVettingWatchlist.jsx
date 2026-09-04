import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldAlert, Flag, Download, Loader2, CheckCircle2, XCircle, AlertTriangle,
  UserX, Phone, Mail, CreditCard, Calendar, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';

// A driver counts as "unverified" (incomplete vetting) if:
//  - background check is not 'clear', OR
//  - the check id is missing / simulated / test (not a real provider result), OR
//  - training has not been completed.
// These are the drivers to keep inactive and potentially hand to investigators.
function isGenuineCheck(d) {
  const id = d.background_check_id;
  return d.background_check_status === 'clear' && !!id && !id.startsWith('simulated_') && !id.startsWith('test_');
}
function isVetted(d) {
  return isGenuineCheck(d) && d.training_completed === true;
}

export default function DriverVettingWatchlist() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('incomplete'); // incomplete | flagged | all
  const [flaggingId, setFlaggingId] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [notesDraft, setNotesDraft] = useState({});
  const [busyId, setBusyId] = useState(null);

  const { data: drivers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vetting-watchlist-drivers'],
    queryFn: () => base44.entities.Driver.list('-created_date', 500),
  });

  const unverified = useMemo(() => drivers.filter((d) => !isVetted(d)), [drivers]);
  const flagged = useMemo(() => unverified.filter((d) => d.vetting_flagged), [unverified]);

  const shown = filter === 'flagged' ? flagged : filter === 'all' ? unverified : unverified;

  const updateDriver = async (id, data, msg) => {
    setBusyId(id);
    try {
      await base44.entities.Driver.update(id, data);
      await queryClient.invalidateQueries({ queryKey: ['vetting-watchlist-drivers'] });
      toast.success(msg);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleFlag = (driver) => {
    setFlaggingId(driver.id);
    setFlagReason(driver.vetting_flagged_reason || '');
  };

  const submitFlag = async (driver) => {
    if (!flagReason.trim()) {
      toast.error('Enter a reason for flagging this driver for investigation.');
      return;
    }
    await updateDriver(
      driver.id,
      {
        vetting_flagged: true,
        vetting_flagged_at: new Date().toISOString(),
        vetting_flagged_reason: flagReason.trim(),
      },
      `${driver.name} flagged for investigation`
    );
    setFlaggingId(null);
    setFlagReason('');
  };

  const handleSaveNote = async (driver) => {
    const note = notesDraft[driver.id] ?? driver.investigation_notes ?? '';
    await updateDriver(driver.id, { investigation_notes: note }, 'Investigation note saved');
  };

  const handleActivate = async (driver) => {
    // Admin override: mark fully vetted and activate so they can take orders.
    await updateDriver(
      driver.id,
      {
        is_active: true,
        background_check_status: 'clear',
        training_completed: true,
        vetting_flagged: false,
      },
      `${driver.name} verified and activated`
    );
  };

  const handleSuspend = async (driver) => {
    await updateDriver(driver.id, { is_active: false, status: 'suspended' }, `${driver.name} suspended`);
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'DOB', 'License #', 'Signup Date', 'Days Since Signup', 'Training', 'BG Check Status', 'Check ID', 'Genuine Check', 'Active', 'Flagged', 'Flag Reason', 'Investigation Notes'],
    ];
    unverified.forEach((d) => {
      const signup = d.created_date ? format(parseISO(d.created_date), 'yyyy-MM-dd') : '';
      const days = d.created_date ? differenceInCalendarDays(new Date(), parseISO(d.created_date)) : '';
      rows.push([
        d.name || '',
        d.email || '',
        d.phone || '',
        d.date_of_birth || '',
        d.license_number || '',
        signup,
        days,
        d.training_completed ? 'Yes' : 'No',
        d.background_check_status || 'pending',
        d.background_check_id || '',
        isGenuineCheck(d) ? 'Yes' : 'No',
        d.is_active ? 'Yes' : 'No',
        d.vetting_flagged ? 'Yes' : 'No',
        (d.vetting_flagged_reason || '').replace(/"/g, "'"),
        (d.investigation_notes || '').replace(/"/g, "'"),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-vetting-watchlist-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Watchlist exported for investigator handover');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-600" /> Driver Vetting Watchlist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drivers kept inactive until verified (genuine cleared background check + training). Flag incomplete
            applicants for police investigation and export the list for handover.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={unverified.length === 0}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-600">{unverified.length}</p>
          <p className="text-xs text-muted-foreground">Unverified drivers</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-red-600">{flagged.length}</p>
          <p className="text-xs text-muted-foreground">Flagged for investigation</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-emerald-600">{drivers.length - unverified.length}</p>
          <p className="text-xs text-muted-foreground">Fully verified</p>
        </Card>
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { k: 'incomplete', label: `Unverified (${unverified.length})` },
            { k: 'flagged', label: `Flagged (${flagged.length})` },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === t.k ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
          {filter === 'flagged'
            ? 'No drivers currently flagged for investigation.'
            : 'All drivers are fully verified. Nothing to hand to investigators.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((d) => {
            const days = d.created_date ? differenceInCalendarDays(new Date(), parseISO(d.created_date)) : null;
            const flagged = d.vetting_flagged;
            return (
              <Card key={d.id} className={`p-4 ${flagged ? 'border-red-300 bg-red-50/40' : 'border-amber-200 bg-amber-50/30'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{d.name}</p>
                      {flagged && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                          <Flag className="w-3 h-3" /> Flagged
                        </span>
                      )}
                      {!d.is_active && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                          <UserX className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {d.email}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {d.phone}</span>
                      {d.license_number && <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {d.license_number}</span>}
                      {d.date_of_birth && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {d.date_of_birth}</span>}
                      {days != null && <span>📅 {days}d since signup</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${d.training_completed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {d.training_completed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        Training {d.training_completed ? 'done' : 'missing'}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                        d.background_check_status === 'clear'
                          ? (isGenuineCheck(d) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {d.background_check_status === 'clear' ? (isGenuineCheck(d) ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />) : <XCircle className="w-3 h-3" />}
                        BG: {d.background_check_status || 'pending'}{d.background_check_status === 'clear' && !isGenuineCheck(d) ? ' (simulated)' : ''}
                      </span>
                    </div>
                    {flagged && d.vetting_flagged_reason && (
                      <p className="mt-2 text-xs text-red-700 bg-red-100/60 border border-red-200 rounded-lg p-2">
                        <strong>Flag reason:</strong> {d.vetting_flagged_reason}
                      </p>
                    )}
                    {d.investigation_notes && (
                      <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                        <strong>Notes:</strong> {d.investigation_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Flag form */}
                {flaggingId === d.id ? (
                  <div className="mt-3 space-y-2 bg-card border rounded-lg p-3">
                    <Textarea
                      placeholder="Why flag this driver for investigation? (e.g. never completed vetting, suspicious signup, fake details)"
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => submitFlag(d)} disabled={busyId === d.id}>
                        {busyId === d.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Flag className="w-4 h-4 mr-1" />}
                        Confirm Flag
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setFlaggingId(null); setFlagReason(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!flagged && (
                      <Button size="sm" variant="destructive" onClick={() => handleFlag(d)}>
                        <Flag className="w-4 h-4 mr-1" /> Flag for Investigation
                      </Button>
                    )}
                    {flagged && (
                      <Button size="sm" variant="outline" onClick={() => updateDriver(d.id, { vetting_flagged: false, vetting_flagged_reason: '' }, 'Flag cleared')}>
                        Unflag
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setNotesDraft((p) => ({ ...p, [d.id]: d.investigation_notes ?? '' }))}>
                      Add Note
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSuspend} disabled={busyId === d.id}>
                      <UserX className="w-4 h-4 mr-1" /> Suspend
                    </Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleActivate(d)} disabled={busyId === d.id}>
                      <ShieldCheck className="w-4 h-4 mr-1" /> Verify &amp; Activate
                    </Button>
                  </div>
                )}

                {/* Notes editor */}
                {notesDraft[d.id] !== undefined && flaggingId !== d.id && (
                  <div className="mt-3 bg-card border rounded-lg p-3 space-y-2">
                    <Textarea
                      placeholder="Investigator / admin notes…"
                      value={notesDraft[d.id] || ''}
                      onChange={(e) => setNotesDraft((p) => ({ ...p, [d.id]: e.target.value }))}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveNote(d)} disabled={busyId === d.id}>Save Note</Button>
                      <Button size="sm" variant="ghost" onClick={() => setNotesDraft((p) => { const n = { ...p }; delete n[d.id]; return n; })}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}