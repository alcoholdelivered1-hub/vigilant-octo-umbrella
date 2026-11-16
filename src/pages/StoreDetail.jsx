import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPublicStores } from '@/api/publicStores';
import { useQuery } from '@tanstack/react-query';
import ColonialStorefront from '@/components/stores/ColonialStorefront';
import LiquorKingStorefront from '@/components/stores/LiquorKingStorefront';
import RetailerStorefront from '@/components/stores/RetailerStorefront';
import { useCart } from '@/hooks/useCart';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const categories = ['all', 'beer', 'wine', 'spirits', 'mixers', 'accessories'];

export default function StoreDetail() {
  const { storeId } = useParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const { addItem, itemCount } = useCart();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', storeId],
    refetchInterval: 60000,
    queryFn: async () => {
      const stores = await getPublicStores({ storeId });
      return stores[0];
    },
  });

  const isStoreLive = Boolean(
    store?.is_active &&
    store?.onboarding_status === 'live' &&
    store?.compliance_status === 'compliant' &&
    store?.stripe_connection_status === 'connected'
  );
  // Preview stores (retailer agreement pending) can be browsed but not ordered from
  const isPreview = Boolean(store?.is_browsable && !isStoreLive);
  const canOrder = isStoreLive;

  const isLiquorKing = storeId === '6abe70789403f586d10561db';
  const { data: products = [], isLoading: productsLoading, isError: productsError, refetch: retryProducts } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => (await base44.entities.Product.filter({ store_id: storeId, in_stock: true }, 'name', isLiquorKing ? 5000 : undefined))
      .filter(product => Number(product.price) > 0 && (product.stock_quantity == null || product.stock_quantity > 0)
        && Boolean(product.last_synced_at)
        && (isLiquorKing ? product.inventory_source === 'clover' : ['clover', 'manual', 'csv'].includes(product.inventory_source))),
    enabled: isStoreLive || isPreview,
    refetchInterval: isLiquorKing ? 30000 : false,
  });

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory);

  const handleAdd = (product) => {
    if (!canOrder) {
      toast.error('This retailer isn’t accepting orders yet — check back soon.');
      return;
    }
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

  if (isLiquorKing && store) {
    return <LiquorKingStorefront store={store} products={products} productsLoading={productsLoading} productsError={productsError} retryProducts={retryProducts} isStoreLive={isStoreLive} activeCategory={activeCategory} setActiveCategory={setActiveCategory} handleAdd={handleAdd} itemCount={itemCount} />;
  }

  if (storeId === '6a3bed91eb84bc989a04e479' && store) {
    return <ColonialStorefront store={store} products={filtered} productsLoading={productsLoading} isStoreLive={isStoreLive} isPreview={isPreview} activeCategory={activeCategory} setActiveCategory={setActiveCategory} handleAdd={handleAdd} itemCount={itemCount} />;
  }

  if (!store) return <div className="p-8 text-center"><p>Retailer not found.</p><Link to="/stores" className="text-primary underline">Back to stores</Link></div>;
  return <RetailerStorefront store={store} products={products} productsLoading={productsLoading} productsError={productsError} retryProducts={retryProducts} isStoreLive={isStoreLive} activeCategory={activeCategory} setActiveCategory={setActiveCategory} handleAdd={handleAdd} itemCount={itemCount} />;
}