import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, MapPin, Mail, Phone } from 'lucide-react';
import LiquorKingHero from '@/components/stores/LiquorKingHero';
import LiquorKingCatalog from '@/components/stores/LiquorKingCatalog';
import StorefrontLaunchProgress from '@/components/stores/StorefrontLaunchProgress';

export default function LiquorKingStorefront({ store, products, productsLoading, productsError, retryProducts, isStoreLive, activeCategory, setActiveCategory, handleAdd, itemCount }) {
  return (
    <div className="liquor-king-storefront bg-background text-foreground font-sans min-h-full">
      <div className="max-w-7xl mx-auto px-5 sm:px-10">
        <div className="flex justify-between items-center gap-4 py-4 text-xs border-b text-muted-foreground"><Link to="/stores" className="inline-flex gap-2 items-center"><ArrowLeft className="w-4 h-4" />All stores</Link><span>{isStoreLive ? 'Delivery ordering available' : 'Storefront preview · Coming soon'}</span></div>
        <header className="flex items-center justify-between gap-4 py-6 border-b"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary text-primary-foreground p-3 text-sm font-bold">LK</span><div><p className="text-xl font-semibold tracking-tight">Liquor King</p><p className="text-xs text-muted-foreground">White Hall’s neighborhood store</p></div></div><nav aria-label="Liquor King storefront" className="flex items-center gap-5 text-sm"><a href="#liquor-king-catalog" className="hidden sm:block">Catalog</a><a href="#liquor-king-visit" className="hidden sm:block">Store details</a>{itemCount > 0 && <Link to="/checkout" className="flex items-center gap-2 border rounded-full px-4 py-3"><ShoppingBag className="w-4 h-4" />Cart ({itemCount})</Link>}</nav></header>
        <StorefrontLaunchProgress key={store.id} store={store} isStoreLive={isStoreLive} />
        <LiquorKingHero store={store} isStoreLive={isStoreLive} />
        <LiquorKingCatalog products={products} loading={productsLoading} error={productsError} retry={retryProducts} canOrder={isStoreLive} activeCategory={activeCategory} onCategoryChange={setActiveCategory} onAdd={handleAdd} />
        <footer id="liquor-king-visit" className="py-10 border-t grid sm:grid-cols-2 gap-7 text-sm">
          <div><h2 className="text-lg font-semibold mb-3">Visit Liquor King</h2><p className="flex items-start gap-2 text-muted-foreground"><MapPin className="w-4 h-4 mt-0.5 shrink-0" />{store.address}, {store.city}, {store.state} {store.zip_code}</p>{store.operating_hours_start && <p className="mt-3 text-muted-foreground">Hours: {store.operating_hours_start} – {store.operating_hours_end}</p>}</div>
          <div className="sm:justify-self-end space-y-3">{store.email && <a href={`mailto:${store.email}`} className="flex items-center gap-2 break-all"><Mail className="w-4 h-4 shrink-0 text-primary" />{store.email}</a>}{store.phone && <a href={`tel:${store.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" />{store.phone}</a>}<p className="text-xs text-muted-foreground">Delivery by Alcohol Delivered · Adults 21+ only</p></div>
        </footer>
      </div>
    </div>
  );
}