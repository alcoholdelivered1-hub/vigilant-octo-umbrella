import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useRetailerInventory from '@/components/inventory/useRetailerInventory';
import InventoryProductEditor from '@/components/inventory/InventoryProductEditor';
import InventoryProductRow from '@/components/inventory/InventoryProductRow';
import InventoryDeleteDialog from '@/components/inventory/InventoryDeleteDialog';
import InventoryBulkUpload from '@/components/inventory/InventoryBulkUpload';

export default function RetailerInventoryWorkspace({ store }) {
  const { query, mutation, products } = useRetailerInventory(store.id);
  const [editor, setEditor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [notice, setNotice] = useState('');
  const error = mutation.error?.response?.data?.error || mutation.error?.message;
  const openEditor = product => { mutation.reset(); setNotice(''); setEditor({ product }); };
  const openRemove = product => { mutation.reset(); setNotice(''); setRemoving(product); };
  const save = values => mutation.mutate({ action: editor.product ? 'update' : 'create', product_id: editor.product?.id, ...values, reason: 'Retailer inventory management price update' }, { onSuccess: () => { setEditor(null); setNotice('Product saved.'); } });
  const remove = () => mutation.mutate({ action: 'delete', product_id: removing.id }, { onSuccess: () => { setRemoving(null); setNotice('Product removed.'); } });
  return <section className="space-y-4" aria-label={`${store.name} inventory`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold break-words">{store.name}</h2><Button onClick={() => openEditor(null)} disabled={mutation.isPending}><Plus aria-hidden="true" />Add product</Button></div>
    <p className="text-sm text-muted-foreground">Changes apply only to this store’s app inventory. A later POS sync may overwrite manual changes or restore removed POS products.</p>
    <InventoryBulkUpload store={store} disabled={mutation.isPending} />
    <p role="status" className="text-sm" aria-live="polite">{notice}</p>
    {query.isLoading ? <p role="status" className="flex items-center gap-2 text-muted-foreground py-10"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />Loading inventory…</p> : query.isError && !products.length ? <div role="alert" className="space-y-3"><p className="text-destructive">Could not load inventory.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !products.length ? <div className="rounded-xl border bg-card py-12 px-4 text-center"><p className="font-medium">No products yet</p><p className="text-sm text-muted-foreground mt-1">Add your first product to this store.</p></div> : <>
      <ul className="space-y-3">{products.map(product => <InventoryProductRow key={product.id} product={product} busy={mutation.isPending} onEdit={openEditor} onRemove={openRemove} />)}</ul>
      {query.isError && <p role="alert" className="text-sm text-destructive">Could not refresh or load more products. Your existing list is still shown.</p>}
      {(query.hasNextPage || query.isError) && <Button variant="outline" disabled={query.isFetching} onClick={() => query.isError ? query.refetch() : query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : query.isError ? 'Try again' : 'Load more products'}</Button>}
    </>}
    {editor && <InventoryProductEditor key={editor.product?.id || 'new'} product={editor.product} storeName={store.name} busy={mutation.isPending} error={error} onSave={save} onClose={() => setEditor(null)} />}
    {removing && <InventoryDeleteDialog product={removing} busy={mutation.isPending} error={error} onConfirm={remove} onClose={() => setRemoving(null)} />}
  </section>;
}