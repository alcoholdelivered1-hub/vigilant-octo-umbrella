import React, { useMemo, useState } from 'react';
import { Search, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import LiquorKingProduct from '@/components/stores/LiquorKingProduct';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categories = ['all', 'beer', 'wine', 'spirits', 'mixers', 'accessories'];
export default function LiquorKingCatalog({ products, loading, error, retry, canOrder, activeCategory, onCategoryChange, onAdd }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const visible = useMemo(() => products.filter(p => (activeCategory === 'all' || p.category === activeCategory) && `${p.name} ${p.brand || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : a.name.localeCompare(b.name)), [products, activeCategory, search, sort]);
  return (
    <section id="liquor-king-catalog" className="py-10 border-t scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><p className="uppercase tracking-[0.2em] text-primary text-xs font-semibold mb-2">The catalog</p><h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Find your next favorite.</h2></div><p className="text-sm text-muted-foreground">{products.length} Clover products available</p></div>
      {!canOrder && <p className="bg-muted/60 border rounded-xl px-4 py-3 text-sm text-muted-foreground mb-6">Storefront preview — checkout stays closed until retailer setup is complete.</p>}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search Liquor King products" placeholder="Search products or brands" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 bg-card rounded-xl" /></div>
        <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Sort products" className="border rounded-xl bg-card text-foreground h-11 px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name: A–Z</SelectItem><SelectItem value="price-low">Price: low to high</SelectItem><SelectItem value="price-high">Price: high to low</SelectItem></SelectContent></Select>
      </div>
      <div className="flex flex-wrap gap-2 mb-8" aria-label="Product categories">{categories.map(c => <button key={c} type="button" aria-pressed={activeCategory === c} onClick={() => onCategoryChange(c)} className={activeCategory === c ? 'rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm capitalize' : 'rounded-full border bg-card text-muted-foreground px-4 py-2 text-sm capitalize'}>{c === 'all' ? 'All products' : c}</button>)}</div>
      {loading ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div> : error ? <div className="border rounded-2xl p-10 text-center"><p className="mb-4 text-muted-foreground">The catalog couldn’t load.</p><Button variant="outline" onClick={retry}>Try again</Button></div> : visible.length ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{visible.map(p => <LiquorKingProduct key={p.id} product={p} canOrder={canOrder} onAdd={onAdd} />)}</div> : <div className="border rounded-2xl py-16 px-6 text-center bg-muted/20"><PackageOpen className="w-10 h-10 mx-auto text-primary/50 mb-4" /><h3 className="font-semibold">{products.length ? 'No matching products' : 'Our Clover catalog is on its way'}</h3><p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{products.length ? 'Try another category or search term.' : 'Products, prices, and availability will appear here after Liquor King authorizes Clover and its inventory is synced. No sample stock is listed.'}</p>{products.length > 0 && <Button variant="outline" className="mt-5" onClick={() => { setSearch(''); onCategoryChange('all'); }}>Clear filters</Button>}</div>}
    </section>
  );
}