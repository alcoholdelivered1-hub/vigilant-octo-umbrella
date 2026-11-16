import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SetupDocumentForm from '@/components/onboarding/SetupDocumentForm';
import SetupDocumentRow from '@/components/onboarding/SetupDocumentRow';
export default function StoreSetupDocuments({ store, onChanged, data: provided }) {
  const query = useQuery({ queryKey:['store-setup-documents',store.id],enabled:!provided,queryFn:async () => { const { data } = await base44.functions.invoke('retailerSetup',{ action:'get',store_id:store.id }); if (data.error) throw new Error(data.error); return data; },refetchOnWindowFocus:false });
  const data = provided || query.data;
  const refresh = async () => { if (!provided) await query.refetch(); await onChanged?.(); };
  return <section className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-semibold">Setup documents and evidence</h2><p className="text-sm text-muted-foreground">Upload the actual ABC license, signed paper agreement, inventory / POS export and POS instructions. Original documents are retained; corrections are separate uploads. Approval never follows from uploading alone.</p>{!data?.ambiguity.length && <SetupDocumentForm key={store.id} store={store} onSaved={refresh} />}{!provided && query.isLoading && <p role="status">Loading documents…</p>}{query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}{data?.documents.map(doc => <SetupDocumentRow key={doc.id} doc={doc} storeId={store.id} isAdmin={data.is_admin} onSaved={refresh} />)}{data && !data.documents.length && <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>}</section>;
}