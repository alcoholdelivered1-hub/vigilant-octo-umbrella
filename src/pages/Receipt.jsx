import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Receipt() {
  const params = useParams();
  const urlParams = new URLSearchParams(window.location.search);
  const orderNumber = params.orderNumber || urlParams.get('order') || '';
  const receiptToken = urlParams.get('token') || '';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderNumber || !receiptToken) {
      setError('Missing order number or receipt token');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke('getOrderReceipt', {
          order_number: orderNumber,
          receipt_token: receiptToken,
        });
        setOrder(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load receipt');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderNumber, receiptToken]);

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="font-display text-xl font-bold mt-4">Receipt unavailable</h1>
          <p className="text-muted-foreground text-sm mt-2">{error || 'We could not find this order.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 print:py-0 print:px-0">
      <div className="max-w-lg w-full mx-auto bg-card border rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-0">
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-8 py-6 text-center print:bg-primary">
          <img src="https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/0c398d505_Untitled_Artwork.jpg" alt="Alcohol Delivered" className="w-10 h-10 mx-auto mb-2 rounded" />
          <h1 className="font-display text-lg font-bold tracking-widest uppercase">Alcohol Delivered</h1>
          <p className="text-xs opacity-80 mt-1">Receipt</p>
        </div>

        {/* Order info */}
        <div className="px-8 py-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order #</span>
            <span className="font-mono font-semibold">{order.order_number}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span>{fmtDate(order.created_date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span>{order.customer_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Store</span>
            <span>{order.store_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery Address</span>
            <span className="text-right max-w-[60%]">{order.delivery_address}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <span className="capitalize">{order.stripe_payment_status}</span>
          </div>
        </div>

        {/* Items */}
        <div className="px-8 pb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Items</h2>
          <div className="space-y-2">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="flex-1">
                  {item.product_name}
                  <span className="text-muted-foreground"> × {item.quantity}</span>
                </span>
                <span className="font-mono">{fmt(item.subtotal || item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6">
          <div className="border-t pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmt(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span className="font-mono">{fmt(order.delivery_fee)}</span></div>
            {order.mileage_surcharge > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Mileage</span><span className="font-mono">{fmt(order.mileage_surcharge)}</span></div>
            )}
            {order.service_fee > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-mono">{fmt(order.service_fee)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">{fmt(order.tax)}</span></div>
            {order.tip > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tip</span><span className="font-mono">{fmt(order.tip)}</span></div>
            )}
            <div className="flex justify-between border-t pt-2 mt-2 text-base font-bold">
              <span>Total</span>
              <span className="font-mono">{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-muted/50 text-center print:bg-muted/50">
          <p className="text-xs text-muted-foreground">
            This is your electronic receipt for your Alcohol Delivered order.
            Please retain it for your records.
          </p>
        </div>
      </div>

      {/* Print button */}
      <div className="max-w-lg mx-auto mt-6 text-center print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          <Printer className="w-4 h-4" /> Print Receipt
        </button>
      </div>
    </div>
  );
}