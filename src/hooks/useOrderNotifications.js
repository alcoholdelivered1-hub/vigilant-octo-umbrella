import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STATUS_NOTIFICATIONS = {
  confirmed: {
    title: '✅ Order Accepted!',
    message: 'Your order has been confirmed and is being prepared.',
  },
  pickup_ready: {
    title: '📦 Order Picked Up',
    message: 'Your order has been picked up from the store.',
  },
  in_transit: {
    title: '🚗 Out for Delivery!',
    message: 'Your driver is on the way with your order.',
  },
  delivered: {
    title: '🎉 Order Delivered!',
    message: 'Your order has been delivered. Enjoy!',
  },
};

/**
 * Subscribes to real-time order updates for a given user email.
 * Shows toast notifications when relevant status changes occur.
 * @param {string} userEmail - The email of the logged-in user
 * @param {function} onUpdate - Callback to refresh orders list
 */
export function useOrderNotifications(userEmail, onUpdate) {
  // Track previous statuses so we only notify on changes
  const prevStatuses = useRef({});

  useEffect(() => {
    if (!userEmail) return;

    const unsubscribe = base44.entities.Order.subscribe((event) => {   
      const order = event.data;

      // Only care about this user's orders
      if (!order || order.customer_email !== userEmail) return;

      const newStatus = order.status;
      const prevStatus = prevStatuses.current[event.id];

      // Notify only if status actually changed
      if (newStatus && newStatus !== prevStatus) {
        const notification = STATUS_NOTIFICATIONS[newStatus];
        if (notification) {
          toast(notification.title, {
            description: `Order ${order.order_number || ''} — ${notification.message}`,
            duration: 6000,
          });
        }
        prevStatuses.current[event.id] = newStatus;
      }

      // Trigger a re-fetch to update the UI
      if (event.type === 'update' || event.type === 'create') {
        onUpdate?.();
      }
    });

    return () => unsubscribe();
  }, [userEmail]);
}