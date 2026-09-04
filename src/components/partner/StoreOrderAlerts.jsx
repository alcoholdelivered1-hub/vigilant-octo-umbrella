import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { ShoppingBag, X } from 'lucide-react';

/**
 * Real-time incoming-order alert for the store dashboard.
 * Subscribes to Order entity create events and, the instant a new order
 * lands for one of the watched stores, plays a chime, fires a toast,
 * shows a dismissible banner, and refreshes the active-orders list —
 * so the retailer sees it immediately instead of waiting on the 15s poll.
 */
export default function StoreOrderAlerts({ storeIds = [], storeNames = {} }) {
  const queryClient = useQueryClient();
  const [alerts, setAlerts] = useState([]);
  const knownIds = useRef(new Set());

  const playChime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.47);
      osc.onended = () => ctx.close();
    } catch (e) {
      /* audio not available — toast still fires */
    }
  }, []);

  useEffect(() => {
    const idSet = new Set(storeIds.map(String));
    if (idSet.size === 0) return;

    const unsubscribe = base44.entities.Order.subscribe((event) => {
      if (!event || event.type !== 'create') return;
      const order = event.data;
      if (!order || !order.store_id) return;
      if (!idSet.has(String(order.store_id))) return;
      if (knownIds.current.has(order.id)) return;
      knownIds.current.add(order.id);

      playChime();

      const storeName = storeNames[order.store_id] || order.store_name || 'your store';
      const total = Number(order.total || 0).toFixed(2);
      const itemCount = Array.isArray(order.items) ? order.items.length : 0;

      toast.success('🛎️ New order!', {
        description: `#${order.order_number} · ${order.customer_name || 'Customer'} · ${itemCount} item(s) · $${total} — ${storeName}`,
        duration: 8000,
      });

      setAlerts((prev) => [{ ...order, _ts: Date.now() }, ...prev].slice(0, 4));
      queryClient.invalidateQueries({ queryKey: ['store-active-orders', order.store_id] });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [storeIds, storeNames, playChime, queryClient]);

  const dismiss = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  if (alerts.length === 0) return null;

  return (
    <div className="px-4 pt-3 space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="relative flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900 text-sm flex items-center gap-2">
              New order <span className="font-mono">#{a.order_number}</span>
            </p>
            <p className="text-emerald-700 text-xs truncate">
              {a.customer_name || 'Customer'} · {Array.isArray(a.items) ? a.items.length : 0} item(s) · ${(a.total || 0).toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="text-emerald-500 hover:text-emerald-700 p-1 -m-1"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}