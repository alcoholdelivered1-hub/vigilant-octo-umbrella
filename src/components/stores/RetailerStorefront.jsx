import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import RetailerStorefrontHero from '@/components/stores/RetailerStorefrontHero';
import RetailerStorefrontCatalog from '@/components/stores/RetailerStorefrontCatalog';
import RetailerStorefrontFooter from '@/components/stores/RetailerStorefrontFooter';
import StorefrontLaunchProgress from '@/components/stores/StorefrontLaunchProgress';
import { retailerDesigns, defaultRetailerDesign } from '@/components/stores/retailerDesigns';
import '@/components/stores/retailerStorefronts.css';
export default function RetailerStorefront({ store, products, productsLoading, productsError, retryProducts, isStoreLive, activeCategory, setActiveCategory, handleAdd, itemCount }) {
  const design = retailerDesigns[store.id] || defaultRetailerDesign;
  return <div className={`retailer-storefront retailer-design-${design.theme} bg-background text-foreground min-h-full`}>
    <div className="max-w-7xl mx-auto px-5 sm:px-10">
      <div className="py-4 border-b flex items-center justify-between gap-3 text-xs text-muted-foreground"><Link to="/stores" className="inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" />All retailers</Link><span className="text-right">{isStoreLive ? 'Delivery ordering available' : 'Storefront preview · Coming soon'}</span></div>
      <header className="flex flex-wrap items-center justify-between gap-4 py-6 border-b"><p className={`${design.type === 'sans' ? 'font-sans font-bold' : 'font-display'} text-2xl text-primary`}>{store.name}</p><nav className="flex gap-5 items-center text-sm" aria-label={`${store.name} storefront`}><a href="#retailer-catalog">Catalog</a><a href="#retailer-visit">Store details</a>{itemCount > 0 && <Link to="/checkout" className="inline-flex gap-2 items-center rounded-full border px-4 py-3"><ShoppingBag className="w-4 h-4" />Cart ({itemCount})</Link>}</nav></header>
      <RetailerStorefrontHero store={store} design={design} />
      <StorefrontLaunchProgress key={store.id} store={store} isStoreLive={isStoreLive} />
      <RetailerStorefrontCatalog products={products} loading={productsLoading} error={productsError} retry={retryProducts} activeCategory={activeCategory} onCategoryChange={setActiveCategory} canOrder={isStoreLive} onAdd={handleAdd} design={design} />
      <RetailerStorefrontFooter store={store} />
    </div>
  </div>;
}