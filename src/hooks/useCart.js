import { useState, useEffect } from 'react';
import { cartStore } from '@/lib/cartStore';

export function useCart() {
  const [cart, setCart] = useState(cartStore.getCart());

  useEffect(() => {
    return cartStore.subscribe(setCart);
  }, []);

  return {
    cart,
    storeId: cartStore.getStoreId(),
    storeName: cartStore.getStoreName(),
    addItem: cartStore.addItem,
    updateQuantity: cartStore.updateQuantity,
    clear: cartStore.clear,
    total: cartStore.getTotal(),
    itemCount: cartStore.getItemCount(),
  };
}