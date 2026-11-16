import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ShieldCheck, MapPin, Mail, Phone, ChevronRight, StickyNote, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import StoreTemplateLink from '@/components/onboarding/StoreTemplateLink';
import PartnerOnboardingOverview from '@/components/retailers/PartnerOnboardingOverview';
import PartnerKanbanBoard from '@/components/retailers/PartnerKanbanBoard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';

const STAGES = [
  { value: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground border-border', dot: 'bg-primary' },
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

      <StoreTemplateLink store={store} />
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
  const { user } = useAuth();
  const [view, setView] = useState('kanban');
  const { data: stores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['retailer-onboarding'], enabled: user?.role === 'admin' && view === 'pipeline',
    queryFn: async () => {
      const records = []; let cursor = null;
      do { const page = await base44.entities.Store.list({ sort: 'name', limit: 100, cursor }); records.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
      return records;
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Store.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['retailer-onboarding'] }); queryClient.invalidateQueries({ queryKey: ['partner-onboarding-overview'] }); toast.success('Updated'); }
  });
  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });
  const stageGroups = STAGES.reduce((acc, stage) => { acc[stage.value] = stores.filter(s => (s.onboarding_status || 'invited') === stage.value); return acc; }, {});
  const liveCount = stageGroups.live?.length || 0;
  const summaries = [
    { label: 'Total Retailers', count: stores.length, className: 'bg-card border rounded-xl p-4' },
    { label: 'Live', count: liveCount, className: 'bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700' },
    { label: 'In Progress', count: stores.length-liveCount, className: 'bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700' },
    { label: 'Awaiting Contract', count: (stageGroups.pending?.length || 0)+(stageGroups.invited?.length || 0)+(stageGroups.contract_sent?.length || 0), className: 'bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700' }
  ];
  if (user?.role !== 'admin') return <p className="p-8 text-muted-foreground">Sign in as an administrator to view all retailer partners.</p>;
  return <div className="max-w-screen-2xl mx-auto px-4 py-8">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-bold">Retailer Partner Dashboard</h1><p className="text-muted-foreground mt-1">Onboarding progress and document collection for every retailer, in one view.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/retailer-contacts">Retailer contacts</Link></Button><Button asChild variant="outline"><Link to="/admin/store-launch-progress">Go-Live Command Center</Link></Button><Button asChild variant="outline"><Link to="/admin/store-onboarding-upload"><Upload className="w-4 h-4" />Upload Store List</Link></Button></div></header>
    <Tabs value={view} onValueChange={setView}>
      <TabsList className="mb-5 flex h-auto w-fit max-w-full flex-wrap"><TabsTrigger value="kanban">Kanban board</TabsTrigger><TabsTrigger value="overview">All partners & documents</TabsTrigger><TabsTrigger value="pipeline">Onboarding pipeline</TabsTrigger></TabsList>
      <TabsContent value="kanban"><PartnerKanbanBoard /></TabsContent>
      <TabsContent value="overview"><PartnerOnboardingOverview /></TabsContent>
      <TabsContent value="pipeline">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">{summaries.map(summary => <div key={summary.label} className={summary.className}><p className="text-xs uppercase font-semibold tracking-wide">{summary.label}</p><p className="text-3xl font-bold mt-1">{summary.count}</p></div>)}</div>
        {isLoading ? <p role="status" className="text-center py-16 text-muted-foreground">Loading…</p> : isError ? <div role="alert"><p className="text-destructive">Could not load the retailer pipeline.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : <div className="flex gap-4 overflow-x-auto pb-4">{STAGES.map(stage => <StageColumn key={stage.value} stage={stage} stores={stageGroups[stage.value] || []} onUpdate={handleUpdate} />)}</div>}
      </TabsContent>
    </Tabs>
  </div>;
}