import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, Search, Loader2, AlertTriangle, Edit2, Check, X, Tag } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import PriceEditor from '@/components/partner/PriceEditor';

const CATEGORY_COLORS = {
  beer:        'bg-amber-100 text-amber-700',
  wine:        'bg-rose-100 text-rose-700',
  spirits:     'bg-violet-100 text-violet-700',
  mixers:      'bg-cyan-100 text-cyan-700',
  accessories: 'bg-slate-100 text-slate-600',
};

function QuantityEditor({ product, storeId }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const mutation = useMutation({
    mutationFn: (qty) => base44.entities.Product.update(product.id, { stock_quantity: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products', storeId] });
      setEditing(false);
    },
  });

  const current = product.stock_quantity;
  const LOW_THRESHOLD = 5;
  const isLow = current != null && current <= LOW_THRESHOLD && product.in_stock;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="w-16 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') mutation.mutate(Number(val));
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <button
          onClick={() => mutation.mutate(Number(val))}
          disabled={mutation.isPending}
          className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
        >
          {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setEditing(false)} className="p-1 rounded text-red-400 hover:bg-red-50">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setVal(current ?? ''); setEditing(true); }}
      className={cn(
        'flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg transition-colors group',
        current == null ? 'text-muted-foreground hover:bg-muted' :
        isLow ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' :
        'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
      )}
    >
      {current == null ? '—' : current}
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

export default function InventoryManagerPanel({ storeId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['store-products', storeId],
    queryFn: () => base44.entities.Product.filter({ store_id: storeId }, 'name', 200),
    enabled: !!storeId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, in_stock }) => base44.entities.Product.update(id, { in_stock }),
    onMutate: async ({ id, in_stock }) => {
      await queryClient.cancelQueries({ queryKey: ['store-products', storeId] });
      const prev = queryClient.getQueryData(['store-products', storeId]);
      queryClient.setQueryData(['store-products', storeId], old =>
        (old || []).map(p => p.id === id ? { ...p, in_stock } : p)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['store-products', storeId], ctx.prev);
    },
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const outOfStockCount = products.filter(p => !p.in_stock).length;
  const lowStockCount = products.filter(p => p.in_stock && p.stock_quantity != null && p.stock_quantity <= 5).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading inventory…
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tip banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <Tag className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Click any <strong>price</strong> or <strong>quantity</strong> to edit it instantly. Changes go live immediately for customers.</p>
      </div>

      {/* Summary banners */}
      <div className="flex flex-wrap gap-3">
        {outOfStockCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{outOfStockCount}</strong> out of stock</span>
          </div>
        )}
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{lowStockCount}</strong> low stock (≤5 units)</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No products match your search.' : 'No products found.'}</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-2.5 border-b bg-muted/30 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-20">Qty</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-24">Price</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-16">In Stock</span>
          </div>
          <div className="divide-y">
            {filtered.map(product => (
              <div
                key={product.id}
                className={cn('grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 transition-colors', !product.in_stock && 'bg-red-50/40')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
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
                    </div>
                  </div>
                </div>
                <div className="w-20 flex justify-center">
                  <QuantityEditor product={product} storeId={storeId} />
                </div>
                <div className="w-24 flex justify-center">
                  <PriceEditor product={product} storeId={storeId} />
                </div>
                <div className="w-16 flex justify-center">
                  <Switch
                    checked={!!product.in_stock}
                    onCheckedChange={checked => toggleMutation.mutate({ id: product.id, in_stock: checked })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}