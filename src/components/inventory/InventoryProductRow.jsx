import React from 'react';
import { Package, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InventoryProductRow({ product, busy, onEdit, onRemove }) {
  return <li className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
    <div className="flex items-start gap-3 flex-1 min-w-0">
      <div className="rounded-lg bg-muted p-3 shrink-0"><Package className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></div>
      <div className="min-w-0"><h3 className="font-semibold break-words">{product.name}</h3><p className="text-sm text-muted-foreground break-words capitalize">{[product.category, product.brand, product.volume].filter(Boolean).join(' · ')}</p><p className="text-sm mt-1">{product.in_stock ? 'Available' : 'Unavailable'} · {product.stock_quantity == null ? 'Quantity not tracked' : `${product.stock_quantity} in stock`}</p></div>
    </div>
    <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap"><span className="font-semibold tabular-nums">{Number(product.price || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}><Pencil aria-hidden="true" />Edit</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => onRemove(product)} aria-label={`Remove ${product.name}`}><Trash2 aria-hidden="true" />Remove</Button></div></div>
  </li>;
}