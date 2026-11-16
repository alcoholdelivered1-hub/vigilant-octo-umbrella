import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react';
import ColonialHero from '@/components/stores/ColonialHero';
import ColonialCollections from '@/components/stores/ColonialCollections';
import ColonialCatalog from '@/components/stores/ColonialCatalog';
import StorefrontLaunchProgress from '@/components/stores/StorefrontLaunchProgress';

export default function ColonialStorefront({ store, products, productsLoading, isStoreLive, isPreview, activeCategory, setActiveCategory, handleAdd, itemCount }) {
  return (
    <div className="colonial-storefront bg-background text-foreground min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 sm:px-10 lg:px-14 py-4 border-b flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <Link to="/stores" className="inline-flex items-center gap-2 hover:text-primary"><ArrowLeft className="w-3.5 h-3.5" /> All stores</Link><span className="tracking-[0.1em] uppercase text-right">{isStoreLive ? 'Delivery ordering available' : 'Storefront preview · Delivery coming soon'}</span>
        </div>
        <header className="px-6 sm:px-10 lg:px-14 py-7 sm:py-9 flex items-center justify-between gap-4">
          <div aria-label={store.name}><p className="font-display text-4xl sm:text-5xl tracking-tight text-primary">Colonial<span className="italic">.</span></p><p className="uppercase tracking-[0.3em] text-[10px] mt-2 text-muted-foreground">Wines & Spirits</p></div>
          <nav className="flex items-center gap-5 sm:gap-8 text-sm" aria-label="Colonial storefront"><a href="#colonial-collection" className="hidden sm:block hover:text-primary">Collection</a><a href="#colonial-visit" className="hidden sm:block hover:text-primary">Visit us</a>{itemCount > 0 && <Link to="/checkout" className="flex items-center gap-2 border border-border px-4 py-3 text-primary"><ShoppingBag className="w-4 h-4" /><span>Cart ({itemCount})</span></Link>}</nav>
        </header>
        <div className="px-6 sm:px-10 lg:px-14"><StorefrontLaunchProgress key={store.id} store={store} isStoreLive={isStoreLive} /></div>
        <ColonialHero store={store} />
        <ColonialCollections activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        <ColonialCatalog products={products} loading={productsLoading} isStoreLive={isStoreLive} isPreview={isPreview} activeCategory={activeCategory} onCategoryChange={setActiveCategory} onAdd={handleAdd} />
        <footer id="colonial-visit" className="bg-primary text-primary-foreground px-6 sm:px-10 lg:px-14 py-10 sm:py-12 scroll-mt-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div><p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4">Find us in Little Rock</p><h2 className="font-display text-3xl mb-4">Your next discovery<br /><span className="italic">starts at Colonial.</span></h2><p className="flex items-start gap-2 text-sm opacity-80"><MapPin className="w-4 h-4 shrink-0 mt-0.5" />{store.address}, {store.city}, {store.state}</p></div>
            <div className="md:justify-self-end space-y-4 md:pt-8">
              {store.phone && <a href={`tel:${store.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 opacity-60" />{store.phone}<ArrowUpRight className="w-4 h-4 opacity-60" /></a>}
              {store.email && <a href={`mailto:${store.email}`} className="flex items-center gap-3 text-sm break-all"><Mail className="w-4 h-4 shrink-0 opacity-60" />{store.email}</a>}
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-9 pt-5 flex flex-col sm:flex-row justify-between gap-3 text-xs opacity-60"><span>{store.name} · {store.city}, Arkansas</span><span>Delivery by Alcohol Delivered · Adults 21+ only</span></div>
        </footer>
      </div>
    </div>
  );
}