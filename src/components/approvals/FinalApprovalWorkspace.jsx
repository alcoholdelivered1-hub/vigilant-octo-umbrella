import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import RetailerLocation from './RetailerLocation';
import FinalApprovalStep from '@/components/approvals/FinalApprovalStep';
import SetupDocumentRow from '@/components/onboarding/SetupDocumentRow';
import SetupLaunchReview from '@/components/onboarding/SetupLaunchReview';
export default function FinalApprovalWorkspace({ storeId,onChanged }) {
  const query = useQuery({queryKey:['final-approval-detail',storeId],enabled:!!storeId,retry:false,refetchInterval:30000,queryFn:async () => { const {data} = await base44.functions.invoke('retailerSetup',{action:'get',store_id:storeId}); if (data.error) throw new Error(data.error); return data; }});
  const refresh = async () => { await query.refetch(); await onChanged(); };
  const data = query.data;
  if (!storeId) return <p className="rounded-xl border bg-card p-6 text-muted-foreground">Choose a retailer or a submitted change to begin approval.</p>;
  if (query.isLoading) return <p role="status">Loading this retailer’s evidence and launch requirements…</p>;
  if (query.error) return <div role="alert" className="space-y-3"><p className="text-destructive">{query.error.response?.data?.error || query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Retry retailer review</Button></div>;
  if (!data) return null;
  return <div className="space-y-4"><header className="rounded-xl border bg-card p-4"><h2 className="font-display text-xl font-bold">{data.store.name}</h2><p className="text-sm text-muted-foreground">{data.steps.filter(s => data.submissions.find(r => r.step === s.key)?.mapped_at).length} of {data.steps.length} steps approved and applied · {data.store.onboarding_status === 'live' ? 'Recorded live' : 'Not yet live'}</p></header>{!!data.ambiguity.length && <p role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{data.ambiguity.join(' ')}</p>}
    <RetailerLocation store={data.store} />
    <section className="rounded-xl border bg-card p-4 space-y-3"><h3 className="font-semibold">Documents to verify</h3>{data.documents.length ? data.documents.map(doc => <SetupDocumentRow key={`${doc.id}-${doc.status}`} doc={doc} storeId={storeId} isAdmin={true} onSaved={refresh} />) : <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>}</section>
    {data.steps.map(step => { const record = data.submissions.find(r => r.step === step.key); return <FinalApprovalStep key={`${storeId}-${step.key}-${record?.id}-${record?.status}`} step={step} record={record} storeId={storeId} blocked={!!data.ambiguity.length} onSaved={refresh} />; })}
    <section className="rounded-xl border bg-card p-4 space-y-3"><h3 className="font-semibold">Signed retailer agreement</h3><p className="text-sm">{data.agreements[0] ? `${data.agreements[0].status} · ${data.agreements[0].review_status || 'Awaiting contract review'}` : 'Waiting for a signed agreement.'}</p><Button asChild variant="outline"><Link to={`/retailer-contract?store_id=${encodeURIComponent(storeId)}`}>Review terms and countersign agreement</Link></Button></section>
    <SetupLaunchReview key={storeId} data={data} onSaved={refresh} />
  </div>;
}