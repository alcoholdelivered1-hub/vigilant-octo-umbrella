import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PartnerStatus from '@/components/retailers/PartnerStatus';
export default function PartnerDocumentsDialog({ row, onClose }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const openFile = async file => {
    setError('');
    const tab = window.open('', '_blank');
    if (!tab) { setError('Allow popups to view this document.'); return; }
    tab.opener = null; setBusy(file.id);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: file.uri });
      if (!signed_url || new URL(signed_url).protocol !== 'https:') throw new Error('Could not open this document.');
      tab.location.replace(signed_url);
    } catch (failure) { tab.close(); setError(failure.message || 'Could not open this document.'); }
    finally { setBusy(''); }
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{row.store.name}: documents</DialogTitle><DialogDescription>Original uploads and agreement copies. Collection is not approval; current-version status is shown on the dashboard.</DialogDescription></DialogHeader>
    <div className="space-y-3">{row.documentItems.length ? row.documentItems.map(file => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{file.kind}{file.date ? ` · ${new Date(file.date).toLocaleDateString()}` : ''}</p><div className="mt-2"><PartnerStatus state={file.status} /></div></div><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => openFile(file)} aria-label={`View ${file.name}`}>{busy === file.id ? 'Opening…' : 'View file'}</Button></div>) : <p className="py-4 text-sm text-muted-foreground">No documents have been collected for this retailer yet.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4"><Button asChild><Link to={`/onboarding?store_id=${encodeURIComponent(row.store.id)}`}>Upload or review documents</Link></Button><Button asChild variant="outline"><Link to={`/retailer-contract?store_id=${encodeURIComponent(row.store.id)}`}>Review agreement</Link></Button></div>
    </div></DialogContent></Dialog>;
}