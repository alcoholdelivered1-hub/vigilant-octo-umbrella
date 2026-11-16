import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CalendarCheck, ExternalLink, RefreshCw } from 'lucide-react';

const STATUS_STYLE = {
  certified: 'bg-green-100 text-green-800',
  pending_abc_certification: 'bg-yellow-100 text-yellow-800',
  not_available: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL = {
  certified: 'In effect',
  pending_abc_certification: 'Awaiting ABC certification',
  not_available: 'Not available',
};

export default function SundaySalesPanel() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const jurisdictions = useQuery({
    queryKey: ['sunday-sales-jurisdictions'],
    queryFn: () => base44.entities.SundaySalesJurisdiction.list('-updated_date', 50),
  });

  const checkABC = async () => {
    setChecking(true); setError(''); setResult(null);
    try {
      const { data } = await base44.functions.invoke('checkSundaySalesABC', {});
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['sunday-sales-jurisdictions'] });
    } catch (issue) {
      setError(issue.response?.data?.error || issue.message || 'The ABC check could not finish.');
    } finally {
      setChecking(false);
    }
  };

  const rows = jurisdictions.data || [];

  return (
    <section className="mb-6 rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Sunday Alcohol Sales — Arkansas ABC</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Local options approved by voters take effect only after Arkansas ABC certifies them. Sunday delivery stays blocked in a city or county until its record here is certified and the effective date has arrived.
          </p>
        </div>
        <Button size="sm" onClick={checkABC} disabled={checking}>
          {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
          {checking ? 'Checking ABC…' : 'Check ABC now'}
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result?.success && (
        <p className="text-sm text-muted-foreground">
          ABC check finished: {result.jurisdictions_reviewed} jurisdiction(s) reviewed, {result.changes?.length || 0} updated.
        </p>
      )}
      {jurisdictions.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading jurisdictions…</p>}
      {!jurisdictions.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No Sunday sales jurisdictions are being tracked yet.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(row => (
          <div key={row.id} className="rounded-lg border px-3 py-2 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.jurisdiction_type === 'city' ? `${row.city} (city)` : `${row.county} County (county-wide)`}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status] || 'bg-muted'}`}>{STATUS_LABEL[row.status] || row.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              County: {row.county}
              {row.effective_date ? ` · In effect ${row.effective_date}` : ' · No effective date yet'}
            </p>
            {row.evidence_notes && <p className="text-xs text-muted-foreground">{row.evidence_notes}</p>}
            {row.source_url && (
              <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}