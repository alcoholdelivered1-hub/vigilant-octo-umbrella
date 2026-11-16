import React from 'react';
import { Wine, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiquorKingProduct({ product, canOrder, onAdd }) {
  return (
    <article className="bg-card border rounded-2xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-muted/40 flex items-center justify-center p-6">
        {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-contain" /> : <Wine className="w-16 h-16 text-primary/30 stroke-[1]" />}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-muted-foreground capitalize mb-2">{product.category}{product.volume ? ` · ${product.volume}` : ''}</p>
        <h3 className="font-semibold text-sm leading-relaxed">{product.name}</h3>
        {product.brand && <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>}
        <div className="flex items-center justify-between gap-2 mt-auto pt-5">
          <span className="font-semibold">${Number(product.price).toFixed(2)}</span>
          <Button size="icon" className="rounded-full" disabled={!canOrder} onClick={() => onAdd(product)} aria-label={`Add ${product.name} to cart`}><Plus className="w-4 h-4" /></Button>
        </div>
        {!canOrder && <p className="text-xs text-muted-foreground mt-3">Ordering coming soon</p>}
      </div>
    </article>
  );
}