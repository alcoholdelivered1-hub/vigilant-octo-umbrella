import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import SetupReviewControls from '@/components/onboarding/SetupReviewControls';
export default function FinalApprovalStep({ step,record,storeId,blocked,onSaved }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const review = async (decision,note,sandbox_test_verified) => {
    setBusy(true); setError('');
    try { const {data} = await base44.functions.invoke('retailerSetup',{action:'review',store_id:storeId,id:record.id,decision,note,sandbox_test_verified}); if (data.error) throw new Error(data.error); await onSaved(); }
    catch (e) { setError(e.response?.data?.error || e.message); } finally { setBusy(false); }
  };
  return <details className="rounded-xl border bg-card p-4" open={record?.status === 'submitted'}><summary className="min-h-11 cursor-pointer font-semibold">{step.title}<span className="ml-2 text-sm font-normal text-muted-foreground">{(record?.status || 'not submitted').replaceAll('_',' ')}{record ? ` · v${record.version}` : ''}</span></summary><div className="mt-3 space-y-4">{record ? <><p className="text-sm text-muted-foreground">{record.submitted_at ? `Submitted ${new Date(record.submitted_at).toLocaleString()}` : 'Draft only'}{record.mapped_at ? ' · Approved information applied to this retailer.' : ' · Not applied to store records.'}</p><dl className="grid gap-3 sm:grid-cols-2">{step.fields.map(field => <div key={field.key} className="min-w-0"><dt className="text-sm font-medium">{field.label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{typeof record.fields?.[field.key] === 'boolean' ? record.fields[field.key] ? 'Yes' : 'No' : record.fields?.[field.key] || 'Not provided'}</dd></div>)}</dl>{record.review_note && <p className="text-sm">Review: {record.review_note}</p>}{record.status === 'submitted' && <SetupReviewControls busy={busy || blocked} testReview={step.key === 'device'} onReview={review} />}</> : <p className="text-sm text-muted-foreground">Waiting for this retailer to submit the step.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div></details>;
}