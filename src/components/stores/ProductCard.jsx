import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export default function ProductCard({ product, onAdd, canOrder = true }) {
  return (
    <div className="bg-card rounded-2xl border overflow-hidden group hover:shadow-md transition-all">
      <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-5xl font-bold text-primary/10">
            {product.category?.[0]?.toUpperCase()}
          </span>
        )}
        <Badge className="absolute top-2 left-2 text-xs capitalize" variant="secondary">
          {product.category}
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
        {product.brand && <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>}
        <div className="flex items-center gap-2 mt-1">
          {product.volume && <span className="text-xs text-muted-foreground">{product.volume}</span>}
          {product.abv > 0 && <span className="text-xs text-muted-foreground">· {product.abv}% ABV</span>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold">${product.price?.toFixed(2)}</span>
          <Button size="sm" disabled={!canOrder} onClick={() => onAdd(product)} className="rounded-xl h-8 px-3">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}