import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InventoryProductEditor({ product, storeName, busy, error, onSave, onClose }) {
  const [values, setValues] = useState({ name: product?.name || '', category: product?.category || 'beer', brand: product?.brand || '', volume: product?.volume || '', description: product?.description || '', price: product?.price ?? '', stock_quantity: product?.stock_quantity ?? '', in_stock: product ? Boolean(product.in_stock) : true });
  const change = (key, value) => setValues(old => ({ ...old, [key]: value }));
  const submit = event => {
    event.preventDefault();
    onSave({ ...values, price: Number(values.price), stock_quantity: values.stock_quantity === '' ? null : Number(values.stock_quantity) });
  };
  const fields = [
    { key: 'name', label: 'Product name', required: true, maxLength: 200 },
    { key: 'brand', label: 'Brand', maxLength: 200 },
    { key: 'volume', label: 'Size / volume', maxLength: 100, placeholder: 'e.g. 750ml or 6-pack' },
    { key: 'price', label: 'Price ($)', type: 'number', min: 0.01, max: 10000, step: '0.01', required: true },
    { key: 'stock_quantity', label: 'Stock quantity (optional)', type: 'number', min: 0, max: 100000, step: '1', placeholder: 'Not tracked' },
  ];
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%_-_2rem)] rounded-xl">
      <DialogHeader><DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle><DialogDescription>Inventory for {storeName} only.</DialogDescription></DialogHeader>
      <form onSubmit={submit} aria-describedby={error ? 'inventory-save-error' : undefined}>
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(({ key, label, ...props }) => <div key={key} className={key === 'name' ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}><Label htmlFor={`inventory-${key}`}>{label}</Label><Input id={`inventory-${key}`} value={values[key]} onChange={event => change(key, event.target.value)} className="min-h-11" {...props} /></div>)}
            <div className="space-y-1.5"><Label htmlFor="inventory-category">Category</Label><Select value={values.category} onValueChange={value => change('category', value)}><SelectTrigger id="inventory-category" className="w-full min-h-11 rounded-md border border-input bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent>{['beer', 'wine', 'spirits', 'mixers', 'accessories'].map(category => <SelectItem key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="inventory-description">Description</Label><Textarea id="inventory-description" maxLength={2000} value={values.description} onChange={event => change('description', event.target.value)} /></div>
          <label className="flex items-center gap-3 min-h-11 text-sm"><input type="checkbox" checked={values.in_stock} onChange={event => change('in_stock', event.target.checked)} className="h-5 w-5 accent-primary focus-visible:ring-2 focus-visible:ring-ring" />Available for purchase</label>
          {error && <p id="inventory-save-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</Button></div>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}