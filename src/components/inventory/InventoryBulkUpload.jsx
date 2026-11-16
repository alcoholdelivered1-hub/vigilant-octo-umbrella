import React from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InventoryBulkPreview from '@/components/inventory/InventoryBulkPreview';
import useInventoryBulkUpload from '@/components/inventory/useInventoryBulkUpload';

export default function InventoryBulkUpload({ store, disabled }) {
  const upload = useInventoryBulkUpload(store.id);
  const busy = upload.busy || disabled;
  return <section className="rounded-xl border bg-card p-4 space-y-4" aria-label="Bulk inventory upload">
    <div><h3 className="font-semibold flex items-center gap-2"><Upload className="h-5 w-5" aria-hidden="true" />Bulk upload inventory</h3><p className="mt-2 text-sm text-muted-foreground">Upload up to 500 products for {store.name} using CSV or Excel (first sheet, up to 5 MB). Preview the batch before applying it. Existing matches are updated; other products are added. Clover products stay POS-managed.</p></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => upload.download(false)} disabled={busy}><Download aria-hidden="true" />Download template</Button><Button variant="outline" onClick={() => upload.download(true)} disabled={busy}><Download aria-hidden="true" />Download current inventory</Button></div>
    <p className="text-xs text-muted-foreground">Required: product_name, category, price. Categories: beer, wine, spirits, mixers, accessories. Matching uses product_id, SKU/UPC/POS ID, or name + brand + volume. Blank optional values preserve existing data. Files are private.</p>
    <label className="block text-sm font-medium">Choose inventory file<input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={event => { const file=event.target.files?.[0]; event.target.value=''; if (file) upload.select(file); }} className="mt-2 block min-h-11 w-full rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground" /></label>
    {upload.busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Processing inventory…</p>}
    {upload.error && <p role="alert" className="text-sm text-destructive">{upload.error}</p>}
    <InventoryBulkPreview preview={upload.preview} />
    {upload.preview?.valid && <Button onClick={upload.apply} disabled={busy}>Apply {upload.preview.total_rows} products to {store.name}</Button>}
    {upload.result?.summary && <div role="status" className="rounded-lg border p-3 text-sm"><p>{upload.result.success ? 'Import complete.' : 'Import partially completed.'} {upload.result.summary.created} added, {upload.result.summary.updated} updated.</p>{upload.result.summary.errors.map((error,index) => <p key={index} className="mt-2 text-destructive">{error}</p>)}</div>}
  </section>;
}