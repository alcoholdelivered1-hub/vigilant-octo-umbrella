import React from 'react';
import { Wine, Clock } from 'lucide-react';
import ProductCard from '@/components/stores/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';

const categories = ['all', 'wine', 'spirits', 'beer', 'mixers', 'accessories'];
export default function ColonialCatalog({ products, loading, isStoreLive, isPreview, activeCategory, onCategoryChange, onAdd }) {
  return (
    <section id="colonial-catalog" className="px-6 sm:px-10 lg:px-14 pb-14 scroll-mt-6">
      <div className="border-t pt-10 flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-7">
        <div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">The collection</p><h2 className="font-display text-3xl">Find something you’ll love.</h2></div>
        {isStoreLive && <span className="text-xs text-muted-foreground">{products.length} {products.length === 1 ? 'selection' : 'selections'}</span>}
      </div>
      <div className="flex flex-wrap gap-2 mb-8" aria-label="Product categories">
        {categories.map(category => <button type="button" key={category} aria-pressed={activeCategory === category} onClick={() => onCategoryChange(category)} className={`px-4 py-2.5 text-xs capitalize border ${activeCategory === category ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>{category === 'all' ? 'All selections' : category}</button>)}
      </div>
      {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div> : !isStoreLive ? (
        <div className="bg-muted/40 border border-border px-6 py-12 sm:py-16 text-center">
          <Wine className="w-10 h-10 mx-auto mb-5 text-primary" strokeWidth={1} />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">A new chapter, coming soon</p>
          <h3 className="font-display text-3xl mb-4">Good things are worth the wait.</h3>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">{isPreview ? 'We’re finalizing our partnership with Colonial. The full catalog and ordering will be available once the retailer agreement is signed.' : 'Colonial is not accepting delivery orders through Alcohol Delivered yet. The verified collection will appear here when the store is ready.'}</p>
          <p className="inline-flex items-center gap-2 text-xs text-primary mt-6"><Clock className="w-3.5 h-3.5" /> Online ordering is not yet available</p>
        </div>
      ) : products.length === 0 ? <p className="text-center py-16 text-muted-foreground">No verified products found in this category.</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{products.map(product => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}</div>
      )}
    </section>
  );
}