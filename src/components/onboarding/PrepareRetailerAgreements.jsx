import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
export default function PrepareRetailerAgreements() {
  const [busy,setBusy] = useState(false), [status,setStatus] = useState(''), [error,setError] = useState('');
  const batch = useRef(null), queryClient = useQueryClient();
  const prepare = async () => {
    setBusy(true); setError(''); batch.current ||= crypto.randomUUID();
    try { const { data } = await base44.functions.invoke('retailerAgreement',{ action:'prepare_all',confirmed:true,batch_id:batch.current }); if (data.error) throw new Error(data.error); setStatus(`${data.prepared} fresh retailer agreements prepared. Previous versions are preserved; no emails were sent.`); batch.current = null; await queryClient.invalidateQueries({ queryKey:['retailer-agreement'] }); } catch(e) { setError(e?.response?.data?.error || e.message); } finally { setBusy(false); }
  };
  return <section className="no-print mb-6 rounded-xl border bg-card p-4 space-y-3"><h2 className="font-semibold">Separate agreements for every retailer</h2><p className="text-sm text-muted-foreground">Prepare clean drafts with each store’s own business details. All representative answers and signatures start blank.</p><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline" disabled={busy}>{busy ? 'Preparing agreements…' : 'Prepare fresh agreements for all retailers'}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Prepare a fresh agreement for every retailer?</AlertDialogTitle><AlertDialogDescription>Each store gets its own separate draft and version history. This does not overwrite any existing agreement, sign documents, send emails or change launch status.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={prepare}>Prepare separate drafts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{status && <p role="status" className="text-sm">{status}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}