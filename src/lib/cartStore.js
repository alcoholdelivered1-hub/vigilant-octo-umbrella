// Simple cart state management using module-level state + subscribers
let cart = [];
let storeId = null;
let storeName = '';
const subscribers = new Set();

function notify() {
  subscribers.forEach(fn => fn([...cart]));
}

export const cartStore = {
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  getCart() {
    return [...cart];
  },

  getStoreId() {
    return storeId;
  },

  getStoreName() {
    return storeName;
  },

  addItem(product, selectedStoreId, selectedStoreName) {
    // If adding from a different store, clear the cart
    if (storeId && storeId !== selectedStoreId) {
      cart = [];
    }
    storeId = selectedStoreId;
    storeName = selectedStoreName;

    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal = existing.quantity * existing.price;
    } else {
      cart.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
      });
    }
    notify();
  },

  updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      cart = cart.filter(item => item.product_id !== productId);
    } else {
      const item = cart.find(item => item.product_id === productId);
      if (item) {
        item.quantity = quantity;
        item.subtotal = item.quantity * item.price;
      }
    }
    notify();
  },

  clear() {
    cart = [];
    storeId = null;
    storeName = '';
    notify();
  },

  getTotal() {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getItemCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },
};