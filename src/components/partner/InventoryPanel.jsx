import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = {
  beer:        'bg-amber-100 text-amber-700',
  wine:        'bg-rose-100 text-rose-700',
  spirits:     'bg-violet-100 text-violet-700',
  mixers:      'bg-cyan-100 text-cyan-700',
  accessories: 'bg-slate-100 text-slate-600',
};

export default function InventoryPanel({ storeId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['store-products', storeId],
    queryFn: () => base44.entities.Product.filter({ store_id: storeId }, 'name', 200),
    enabled: !!storeId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, in_stock }) => base44.entities.Product.update(id, { in_stock }),
    onMutate: async ({ id, in_stock }) => {
      await queryClient.cancelQueries({ queryKey: ['store-products', storeId] });
      const previous = queryClient.getQueryData(['store-products', storeId]);
      queryClient.setQueryData(['store-products', storeId], old =>
        (old || []).map(p => p.id === id ? { ...p, in_stock } : p)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['store-products', storeId], ctx.previous);
    },
  });

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const outOfStockCount = products.filter(p => !p.in_stock).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading inventory…
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {outOfStockCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{outOfStockCount}</strong> product{outOfStockCount !== 1 ? 's' : ''} currently marked out of stock.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No products match your search.' : 'No products found for this store.'}</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-2.5 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In Stock</span>
          </div>
          <div className="divide-y">
            {filtered.map(product => (
              <div
                key={product.id}
                className={cn(
                  'flex items-center justify-between px-5 py-3.5 transition-colors',
                  !product.in_stock && 'bg-red-50/50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={cn('font-medium text-sm truncate', !product.in_stock && 'line-through text-muted-foreground')}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {product.brand && <span className="text-xs text-muted-foreground">{product.brand}</span>}
                      {product.category && (
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-md', CATEGORY_COLORS[product.category] || 'bg-muted text-muted-foreground')}>
                          {product.category}
                        </span>
                      )}
                      {product.pack_size && product.pack_size !== 'Single' && (
                        <span className="text-xs text-primary font-medium">{product.pack_size}</span>
                      )}
                      <span className="text-xs font-semibold text-emerald-700">${(product.price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={!!product.in_stock}
                  onCheckedChange={checked => updateMutation.mutate({ id: product.id, in_stock: checked })}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}