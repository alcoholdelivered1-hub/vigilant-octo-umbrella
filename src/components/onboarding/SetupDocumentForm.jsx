import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SetupDocumentForm({ store, onSaved }) {
  const [kind, setKind] = useState('retail_license');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!file || file.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10 MB.');
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.functions.invoke('submitStoreSetupDocument', { store_id: store.id, kind, filename: file.name, file_uri });
      setFile(null); e.target.reset(); onSaved();
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-3">
    <label className="block text-sm">Document type
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger aria-label="Document type" className="mt-1 w-full min-h-11 border rounded-md bg-background px-3"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="retail_license">Arkansas ABC retail license</SelectItem>
          <SelectItem value="signed_agreement">Signed retailer agreement</SelectItem>
          <SelectItem value="inventory_export">Actual inventory / POS export</SelectItem>
          <SelectItem value="pos_details">POS provider and setup instructions</SelectItem>
        </SelectContent>
      </Select>
    </label>
    <label className="block text-sm">Choose a document (PDF, image, CSV or Excel; up to 10 MB)
      <input type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx" disabled={busy} onChange={e => setFile(e.target.files[0] || null)} className="mt-1 block w-full text-sm" />
    </label>
    <p className="text-xs text-muted-foreground">Private submission for team review. Do not upload passwords, access tokens, bank details or personal identity documents.</p>
    <Button type="submit" disabled={busy || !file}>{busy ? 'Submitting…' : 'Submit for review'}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}