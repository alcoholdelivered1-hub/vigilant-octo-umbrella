import React from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Minus, Plus, Trash2, Store } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

const MIN_ORDER = 20.00;

export default function CartDrawer({ open, onClose }) {
  const { cart, storeName, total, updateQuantity, clear } = useCart();
  const meetsMinimum = total >= MIN_ORDER;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Your Cart
          </SheetTitle>
          {storeName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Store className="w-3 h-3" />{storeName}
            </p>
          )}
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
            <ShoppingCart className="w-12 h-12 opacity-20" />
            <p className="text-sm">Your cart is empty</p>
            <Button variant="outline" size="sm" onClick={onClose} asChild>
              <Link to="/stores">Browse Stores</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.pack_size && item.pack_size !== 'Single' && <span className="text-primary font-medium">{item.pack_size} · </span>}
                      ${item.price.toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 min-h-[44px] min-w-[44px] rounded-lg border bg-card flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3" />}
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 min-h-[44px] min-w-[44px] rounded-lg border bg-card flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold w-14 text-right">${item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">${total.toFixed(2)}</span>
              </div>
              {!meetsMinimum && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                  <p className="font-semibold">Add ${(MIN_ORDER - total).toFixed(2)} more</p>
                  <p className="text-amber-700 mt-0.5">Minimum order: ${MIN_ORDER.toFixed(2)}</p>
                </div>
              )}
              <Button className="w-full rounded-xl h-11 text-base" disabled={!meetsMinimum} asChild onClick={onClose}>
                <Link to="/checkout">{meetsMinimum ? 'Proceed to Checkout →' : `Add $${(MIN_ORDER - total).toFixed(2)}`}</Link>
              </Button>
              <button
                onClick={clear}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}