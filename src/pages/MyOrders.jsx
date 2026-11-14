import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Package, MapPin, RefreshCw, Star, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import DriverRatingForm from '@/components/shared/DriverRatingForm';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function FeedbackForm({ order, onDone }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!rating) return;
    await base44.entities.CustomerFeedback.create({
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      store_id: order.store_id,
      store_name: order.store_name,
      driver_name: order.driver_name,
      rating,
      comment,
    });
    setSubmitted(true);
    setTimeout(onDone, 1500);
  };

  if (submitted) return <p className="text-center text-sm text-emerald-600 py-2 font-medium">✓ Thanks for your feedback!</p>;

  return (
    <div className="mt-3 p-4 bg-muted/50 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Rate your experience</p>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <button key={s} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(s)}>
            <Star className={cn('w-7 h-7 transition-colors', s <= (hovered || rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
          </button>
        ))}
      </div>
      <textarea
        className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        rows={2}
        placeholder="Leave a comment (optional)..."
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={!rating} className="flex-1">Submit</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Skip</Button>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const queryClient = useQueryClient();
  const [feedbackOpen, setFeedbackOpen] = useState(null);
  const [ratingOpen, setRatingOpen] = useState(null);
  const { addItem, storeId, clear } = useCart();

  // Handle Stripe checkout success redirect
  const urlParams = new URLSearchParams(window.location.search);
  const paymentSuccess = urlParams.get('payment') === 'success';
  const successOrderNum = urlParams.get('order');
  const [showSuccessBanner, setShowSuccessBanner] = useState(paymentSuccess);

  useEffect(() => {
    if (paymentSuccess) {
      toast.success('Payment successful! Your order is being processed.');
      // Clean the URL
      window.history.replaceState({}, '', '/orders');
      // Hide banner after 10 seconds
      const timer = setTimeout(() => setShowSuccessBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess]);

  const handleReorder = (order) => {
    if (storeId && storeId !== order.store_id) {
      if (!window.confirm(`Your cart has items from a different store. Clear cart and reorder from ${order.store_name}?`)) return;
      clear();
    }
    order.items?.forEach(item => {
      addItem({ id: item.product_id, name: item.product_name, price: item.price }, order.store_id, order.store_name);
      for (let i = 1; i < item.quantity; i++) {
        addItem({ id: item.product_id, name: item.product_name, price: item.price }, order.store_id, order.store_name);
      }
    });
    toast.success(`${order.items?.length} item(s) added to cart!`);
  };

  const { data: user, isError: userNotAuthenticated } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  // Real-time notifications + live order list updates
  useOrderNotifications(user?.email, () => {
    queryClient.invalidateQueries({ queryKey: ['my-orders', user?.email] });
  });

  const refreshing = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ['my-orders', user?.email] })
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {refreshing && (
        <div className="flex justify-center py-3">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <h1 className="font-display text-3xl font-bold mb-2">My Orders</h1>
      <p className="text-muted-foreground mb-8">Track and manage your deliveries</p>

      {showSuccessBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800">Payment successful!</p>
            <p className="text-sm text-emerald-700 mt-1">
              Your order{successOrderNum ? ` ${successOrderNum}` : ''} is being processed. You'll receive a confirmation email shortly.
            </p>
            {successOrderNum && (
              <p className="text-xs text-emerald-600 mt-2">
                Need to track it? Use your order number on the Track Order page.
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          {userNotAuthenticated ? (
            <>
              <p className="text-muted-foreground mt-4">Sign in to view your order history</p>
              <Button className="mt-4" onClick={() => base44.auth.redirectToLogin('/orders')}>Sign In</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mt-4">No orders yet</p>
              <Link to="/stores"><Button variant="outline" className="mt-4">Start Shopping</Button></Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-card rounded-2xl border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{order.order_number}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.store_name} · {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    {order.delivery_address}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">${order.total?.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.created_date ? format(new Date(order.created_date), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
              </div>
              {['in_transit', 'confirmed', 'preparing', 'pickup_ready'].includes(order.status) && (
                <Link to={`/track?orderId=${order.id}`} className="mt-3 block">
                  <Button variant="outline" size="sm" className="w-full rounded-xl">
                    <MapPin className="w-3.5 h-3.5 mr-1.5" />Track Delivery
                  </Button>
                </Link>
              )}
              {order.status === 'delivered' && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => handleReorder(order)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reorder
                    </Button>
                    {feedbackOpen === order.id
                      ? <FeedbackForm order={order} onDone={() => setFeedbackOpen(null)} />
                      : <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setFeedbackOpen(order.id)}>
                          <Star className="w-3.5 h-3.5 mr-1.5" />Leave Feedback
                        </Button>
                    }
                  </div>
                  {order.driver_id && ratingOpen !== `done-${order.id}` && (
                    ratingOpen === order.id
                      ? <DriverRatingForm order={order} onDone={() => setRatingOpen(`done-${order.id}`)} />
                      : <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => setRatingOpen(order.id)}>
                          <Star className="w-3.5 h-3.5 mr-1.5 fill-amber-400 text-amber-400" />Rate Your Driver
                        </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}