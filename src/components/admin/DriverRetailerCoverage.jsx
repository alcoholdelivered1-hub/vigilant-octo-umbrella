import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import DriverRecruitmentAreas from '@/components/admin/DriverRecruitmentAreas';

export default function DriverRetailerCoverage() {
  const client = useQueryClient();
  const [outreach, setOutreach] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['driver-retailer-coverage'], queryFn: async () => (await base44.functions.invoke('driverRetailerCoverage', {})).data });
  const send = useMutation({ mutationFn: async () => (await base44.functions.invoke('sendDriverPortalInstructions', { action: 'onboarding' })).data, onSuccess: setOutreach });
  const match = useMutation({ mutationFn: async () => (await base44.functions.invoke('driverRetailerCoverage', { action: 'match' })).data, onSuccess: () => client.invalidateQueries({ queryKey: ['driver-retailer-coverage'] }) });
  if (isLoading) return <p role="status">Loading retailer coverage…</p>;
  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  return <section className="rounded-2xl border bg-card p-5 space-y-5">
    <div><h2 className="font-display text-xl font-bold">Driver rollout for live retailers</h2>
      <p className="text-sm text-muted-foreground mt-1">{data.stores.length} retailers · {data.total_drivers} drivers · {data.qualified_drivers} production-qualified · {data.blocked_drivers} need verification or setup</p></div>
    <p className="text-sm text-muted-foreground">Coverage planning does not activate retailers or bypass launch checks. Matching requires reviewed annual ABC-approved training, a completed Server Awareness form, a current license, real background clearance, age 21+, vehicle, availability, and a driver-selected service city.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={() => send.mutate()} disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Send applicant setup guidance'}</Button>
      <Button variant="outline" onClick={() => match.mutate()} disabled={match.isPending || !data.available_matches}>{match.isPending ? 'Matching…' : `Match qualified drivers (${data.available_matches})`}</Button></div>
    {(send.error || match.error) && <p role="alert" className="text-destructive">{(send.error || match.error).message}</p>}
    {outreach && <div role="status" className="rounded-xl bg-muted p-3 text-sm"><p>{outreach.sent} sent · {outreach.skipped} skipped · {outreach.failed} failed</p>{outreach.results.filter(r => r.status !== 'sent').map((r,i) => <p key={i}>{r.name}: {r.reason || r.error}</p>)}</div>}
    {!data.qualified_drivers && <p className="rounded-xl border p-3 text-sm">No drivers can be matched yet. Simulated or missing background reports do not count as clearance.</p>}
    <DriverRecruitmentAreas stores={data.stores} />
    <div><h3 className="font-semibold mb-2">Retailer coverage</h3><div className="divide-y">{data.stores.map(s => <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
      <span>{s.name} <span className="text-muted-foreground">· {s.city}</span></span><span className="text-muted-foreground">{s.drivers.length ? s.drivers.map(d => d.name).join(', ') : 'Uncovered: recruit / verify drivers'}</span>
    </div>)}</div></div>
  </section>;
}