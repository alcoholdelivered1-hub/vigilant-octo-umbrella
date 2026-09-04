import { useState, useEffect } from 'react';
import { cartStore } from '@/lib/cartStore';

export function useCart() {
  const [cart, setCart] = useState(cartStore.getCart());

  useEffect(() => {
    return cartStore.subscribe(setCart);
  }, []);

  // Derive total and itemCount from React cart state so they always stay in sync
  const total = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    cart,
    storeId: cartStore.getStoreId(),
    storeName: cartStore.getStoreName(),
    addItem: cartStore.addItem,
    updateQuantity: cartStore.updateQuantity,
    clear: cartStore.clear,
    total,
    itemCount,
  };
}