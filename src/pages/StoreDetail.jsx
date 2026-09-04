import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, ArrowLeft, MapPin, Clock, ShieldCheck, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ProductCard from '@/components/stores/ProductCard';
import { useCart } from '@/hooks/useCart';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const categories = ['all', 'beer', 'wine', 'spirits', 'mixers', 'accessories'];

export default function StoreDetail() {
  const { storeId } = useParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showInfo, setShowInfo] = useState(false);
  const [search, setSearch] = useState('');
  const { addItem, itemCount } = useCart();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const stores = await base44.entities.Store.filter({ id: storeId });
      return stores[0];
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => base44.entities.Product.filter({ store_id: storeId, in_stock: true }),
  });

  const q = search.trim().toLowerCase();
  const filtered = products.filter(p => {
    const catOk = activeCategory === 'all' || p.category === activeCategory;
    if (!catOk) return false;
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  });

  const handleAdd = (product) => {
    addItem(product, storeId, store?.name || '');
    toast.success(`${product.name} added to cart`);
  };

  if (storeLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link to="/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Stores
      </Link>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-bold truncate">{store?.name}</h1>
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            {store?.city}
            {showInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {itemCount > 0 && (
          <Link to="/checkout" className="shrink-0">
            <Button className="rounded-xl">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Cart ({itemCount})
            </Button>
          </Link>
        )}
      </div>

      {showInfo && (
        <div className="bg-muted/40 rounded-xl p-4 mb-6 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {store?.address}, {store?.city}, {store?.state} {store?.zip_code}
          </div>
          {store?.operating_hours_start && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {store?.operating_hours_start} – {store?.operating_hours_end}
            </div>
          )}
          <p className="text-xs text-muted-foreground">License: {store?.license_number}</p>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-background pt-2 pb-4 -mx-4 px-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search for a drink, brand, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-11"
          />
        </div>
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="bg-muted/50 w-full overflow-x-auto">
            {categories.map(c => (
              <TabsTrigger key={c} value={c} className="capitalize text-xs flex-1">{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">{search ? 'No products match your search' : 'No products found in this category'}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} onAdd={handleAdd} />
          ))}
        </div>
      )}
    </div>
  );
}