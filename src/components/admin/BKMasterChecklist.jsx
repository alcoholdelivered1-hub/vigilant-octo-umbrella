import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2, ListChecks } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import BKStaffSequenceForm from '@/components/admin/BKStaffSequenceForm';

export default function BKMasterChecklist({ result, loading = false, onRefresh }) {
  const controlled = result !== undefined;
  const query = useQuery({
    queryKey: ['bk-master-checklist'],
    queryFn: async () => (await base44.functions.invoke('beverageKingMasterChecklist', { action: 'preview' })).data,
    enabled: !controlled,
  });
  const data = controlled ? result : query.data;
  const isLoading = controlled ? loading : query.isLoading;
  const error = controlled ? null : query.error;
  const refetch = onRefresh || query.refetch;

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5" /> Master go-live checklist</h2>
        {data && <span className="text-sm text-muted-foreground">{data.done} of {data.total} complete</span>}
      </div>
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking status…</div>}
      {error && <p className="text-sm text-destructive">{error?.response?.data?.error || error.message}</p>}
      {data && <>
        <Progress value={(data.done / data.total) * 100} />
        <ul className="space-y-2">
          {data.checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              {item.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
              <span className={item.done ? 'text-muted-foreground line-through' : ''}>{item.title}</span>
              <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">{item.owner}</span>
            </li>
          ))}
        </ul>
      </>}
      {(!controlled || result?.is_admin) && <BKStaffSequenceForm onSent={refetch} />}
    </section>
  );
}