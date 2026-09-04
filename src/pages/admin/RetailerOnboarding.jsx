import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ShieldCheck, MapPin, Mail, Phone, ChevronRight, StickyNote, Upload, Send, Loader2, AlertCircle, Store as StoreIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STAGES = [
  { value: 'invited',          label: 'Invited',          color: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  { value: 'contract_sent',    label: 'Contract Sent',    color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  { value: 'contract_signed',  label: 'Contract Signed',  color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  { value: 'inventory_added',  label: 'Inventory Added',  color: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },
  { value: 'live',             label: 'Live',             color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
];

function StageColumn({ stage, stores, onUpdate }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
        <span className="font-semibold text-sm">{stage.label}</span>
        <span className="ml-auto text-xs font-medium bg-muted rounded-full px-2 py-0.5">{stores.length}</span>
      </div>
      <div className="space-y-3">
        {stores.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-xl h-20 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No retailers</p>
          </div>
        )}
        {stores.map(store => (
          <RetailerCard key={store.id} store={store} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

function RetailerCard({ store, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(store.onboarding_notes || '');

  const currentStage = STAGES.find(s => s.value === (store.onboarding_status || 'invited'));

  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{store.name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">{store.license_number}</span>
          </div>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground mt-0.5">
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate">{store.city}, {store.county} Co.</span>
      </div>

      {store.email && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{store.email}</span>
        </div>
      )}

      <div className="mt-3">
        <Select
          value={store.onboarding_status || 'invited'}
          onValueChange={(val) => onUpdate(store.id, { onboarding_status: val })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {store.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />{store.phone}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Added: {store.created_date ? format(new Date(store.created_date), 'MMM d, yyyy') : '—'}
          </p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notes
            </p>
            <Textarea
              className="text-xs min-h-[60px] resize-none"
              placeholder="Add onboarding notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (store.onboarding_notes || '')) {
                  onUpdate(store.id, { onboarding_notes: notes });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetailerOnboarding() {
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['retailer-onboarding'],
    queryFn: () => base44.entities.Store.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Store.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-onboarding'] });
      toast.success('Updated');
    },
  });

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

  const sendOnboardingMutation = useMutation({
    mutationFn: () => base44.functions.invoke('sendRetailerOnboardingEmail', {}).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retailer-onboarding'] });
      toast.success(`Sent ${data.sent} onboarding email(s)${data.failed ? `, ${data.failed} failed` : ''}`);
    },
    onError: () => toast.error('Failed to send onboarding emails'),
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => base44.functions.invoke('sendContractReminders', {}).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retailer-onboarding'] });
      toast.success(data.sent > 0 ? `Sent ${data.sent} reminder(s)` : 'No stores due for reminders');
    },
    onError: () => toast.error('Failed to send reminders'),
  });

  const storesMissingEmail = stores.filter(s => s.is_active && !s.email).length;

  const stageGroups = STAGES.reduce((acc, stage) => {
    acc[stage.value] = stores.filter(s => (s.onboarding_status || 'invited') === stage.value);
    return acc;
  }, {});

  const liveCount = stageGroups['live']?.length || 0;
  const inProgressCount = stores.length - liveCount;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Retailer Onboarding</h1>
            <p className="text-muted-foreground mt-1">Track each retailer's progress through the onboarding pipeline</p>
          </div>
          <Link to="/admin/store-onboarding-upload">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Upload Store List
            </Button>
          </Link>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          onClick={() => sendOnboardingMutation.mutate()}
          disabled={sendOnboardingMutation.isPending}
          className="gap-2"
        >
          {sendOnboardingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Onboarding Emails
        </Button>
        <Button
          onClick={() => sendReminderMutation.mutate()}
          disabled={sendReminderMutation.isPending}
          variant="outline"
          className="gap-2"
        >
          {sendReminderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Send Contract Reminders
        </Button>
        <Link to="/admin/stores">
          <Button variant="ghost" className="gap-2">
            <StoreIcon className="w-4 h-4" /> Manage Stores
          </Button>
        </Link>
      </div>

      {/* Missing email callout */}
      {storesMissingEmail > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <strong>{storesMissingEmail}</strong> active stores are missing a contact email — they won't receive onboarding emails or order notifications.
          </p>
          <Link to="/admin/stores" className="text-xs font-semibold text-amber-700 hover:underline flex-shrink-0">
            Add emails →
          </Link>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Retailers</p>
          <p className="text-3xl font-bold mt-1">{stores.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-700 uppercase font-semibold tracking-wide">Live</p>
          <p className="text-3xl font-bold mt-1 text-emerald-700">{liveCount}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 uppercase font-semibold tracking-wide">In Progress</p>
          <p className="text-3xl font-bold mt-1 text-amber-700">{inProgressCount}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 uppercase font-semibold tracking-wide">Awaiting Contract</p>
          <p className="text-3xl font-bold mt-1 text-blue-700">
            {(stageGroups['invited']?.length || 0) + (stageGroups['contract_sent']?.length || 0)}
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <p className="text-center py-16 text-muted-foreground">Loading...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => (
            <StageColumn
              key={stage.value}
              stage={stage}
              stores={stageGroups[stage.value] || []}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}