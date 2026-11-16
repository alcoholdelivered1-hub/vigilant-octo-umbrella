import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Package, MapPin, RefreshCw, Star, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(null);
  const [ratingOpen, setRatingOpen] = useState(null);
  const { addItem, storeId, clear } = useCart();
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const paymentOrderNum = searchParams.get('order');

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

  const { data: user } = useQuery({

    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user?.email,
    refetchInterval: query => paymentStatus === 'success' && !query.state.data?.some(o => o.order_number === paymentOrderNum && o.stripe_payment_status === 'paid') ? 3000 : false,
  });
  const confirmedPayment = orders.find(o => o.order_number === paymentOrderNum && o.stripe_payment_status === 'paid');
  const clearedPayment = useRef(null);
  useEffect(() => {
    if (paymentStatus === 'success' && confirmedPayment && clearedPayment.current !== confirmedPayment.id) {
      clearedPayment.current = confirmedPayment.id;
      if (storeId === confirmedPayment.store_id) clear();
    }
  }, [paymentStatus, confirmedPayment, storeId, clear]);

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

      {paymentStatus === 'success' && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">{confirmedPayment ? 'Payment received' : 'Confirming your payment…'}</p>
            <p className="text-sm text-emerald-700 mt-1">
              {confirmedPayment ? `Order ${paymentOrderNum} is paid. ${confirmedPayment.store_name} is the seller of record; follow the retailer’s acceptance and preparation status below.` : 'Waiting for secure payment confirmation. Your order will appear here automatically.'}
            </p>
          </div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 flex gap-3">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">Payment cancelled</p>
            <p className="text-sm text-amber-700 mt-1">Your card was not charged. You can try again anytime.</p>
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
          <p className="text-muted-foreground mt-4">No orders yet</p>
          <Link to="/stores"><Button variant="outline" className="mt-4">Start Shopping</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/track?orderId=${order.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/track?orderId=${order.id}`); } }}
              className="bg-card rounded-2xl border p-5 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
                    <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={(e) => { e.stopPropagation(); handleReorder(order); }}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reorder
                    </Button>
                    {feedbackOpen === order.id
                      ? <FeedbackForm order={order} onDone={() => setFeedbackOpen(null)} />
                      : <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={(e) => { e.stopPropagation(); setFeedbackOpen(order.id); }}>
                          <Star className="w-3.5 h-3.5 mr-1.5" />Leave Feedback
                        </Button>
                    }
                  </div>
                  {order.driver_id && ratingOpen !== `done-${order.id}` && (
                    ratingOpen === order.id
                      ? <DriverRatingForm order={order} onDone={() => setRatingOpen(`done-${order.id}`)} />
                      : <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={(e) => { e.stopPropagation(); setRatingOpen(order.id); }}>
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