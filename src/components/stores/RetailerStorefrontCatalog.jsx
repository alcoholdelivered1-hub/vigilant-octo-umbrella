import React from 'react';
import ProductCard from '@/components/stores/ProductCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
const categories = ['all', 'beer', 'wine', 'spirits', 'mixers', 'accessories'];
export default function RetailerStorefrontCatalog({ products, loading, error, retry, activeCategory, onCategoryChange, canOrder, onAdd, design }) {
  const filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);
  return <section id="retailer-catalog" className="py-10 scroll-mt-6">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"><div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">The catalog</p><h2 className={`${design.type === 'sans' ? 'font-sans font-bold' : 'font-display'} text-3xl`}>Explore the selection</h2></div><p className="text-sm text-muted-foreground">{canOrder ? 'Delivery ordering available' : 'Storefront preview · Ordering not available yet'}</p></div>
    <div className="flex flex-wrap gap-2 mb-7" aria-label="Product categories">{categories.map(c => <Button key={c} variant={activeCategory === c ? 'default' : 'outline'} aria-pressed={activeCategory === c} onClick={() => onCategoryChange(c)} className="rounded-full capitalize">{c}</Button>)}</div>
    {loading ? <div role="status" aria-label="Loading products" className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div> : error ? <div role="alert" className="border rounded-xl p-8 text-center"><p className="mb-3">The catalog could not be loaded.</p><Button onClick={retry} variant="outline">Try again</Button></div> : filtered.length ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{filtered.map(p => <ProductCard key={p.id} product={p} onAdd={onAdd} canOrder={canOrder} />)}</div> : <div className="border border-dashed rounded-2xl p-10 text-center text-muted-foreground"><p className="font-semibold text-foreground">{activeCategory === 'all' ? 'Catalog coming soon' : 'No verified products in this category'}</p><p className="text-sm mt-2">Only verified inventory is displayed. Ordering stays disabled until the retailer completes launch checks.</p></div>}
  </section>;
}