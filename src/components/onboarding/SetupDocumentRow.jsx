import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import SetupReviewControls from '@/components/onboarding/SetupReviewControls';
export default function SetupDocumentRow({ doc, storeId, isAdmin, onSaved }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [viewed,setViewed] = useState(false);
  const open = async () => {
    const tab = window.open('','_blank'); if (!tab) return setError('Allow popups to view the private document.'); tab.opener = null; setBusy(true); setError('');
    try { const { data } = await base44.functions.invoke('retailerSetup',{ action:'document',store_id:storeId,entity:'StoreSetupDocument',id:doc.id }); if (!data.file_uri) throw new Error(data.error || 'Document is unavailable.'); const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri:data.file_uri }); tab.location.replace(signed_url); setViewed(true); }
    catch(e) { tab.close(); setError(e?.response?.data?.error || e.message); } finally { setBusy(false); }
  };
  const review = async (decision,note,both_parties_signed) => {
    setBusy(true); setError('');
    try { const { data } = await base44.functions.invoke('retailerSetup',{ action:'review_document',store_id:storeId,id:doc.id,decision,note,both_parties_signed }); if (data.error) throw new Error(data.error); await onSaved(); }
    catch(e) { setError(e?.response?.data?.error || e.message); } finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t pt-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{doc.filename}</p><p className="text-sm text-muted-foreground">{doc.kind.replaceAll('_',' ')} · {doc.status.replaceAll('_',' ')} · {new Date(doc.created_date).toLocaleDateString()}</p></div><Button type="button" variant="outline" disabled={busy} onClick={open}>View private document</Button></div>{doc.review_note && <p className="text-sm">Review: {doc.review_note}</p>}{isAdmin && doc.status === 'pending_review' && (viewed ? <SetupReviewControls busy={busy} signedDocument={doc.kind === 'signed_agreement'} onReview={review} /> : <p className="text-sm text-muted-foreground">Open the document before reviewing it.</p>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}