import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Clock, Truck, Navigation, Loader2, DollarSign } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const PINE_BLUFF = [34.2284, -92.0032];

// Play a ding sound using Web Audio API
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.8);
  } catch {}
}

export default function AvailableOrders({ onAccepted }) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [accepting, setAccepting] = useState(null);
  const prevCountRef = useRef(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['available-orders'],
    queryFn: () => base44.entities.Order.filter({ status: 'pending' }, '-created_date', 30),
    refetchInterval: 15000,
  });

  // Ding when new orders appear
  useEffect(() => {
    if (prevCountRef.current === null) {
      prevCountRef.current = orders.length;
      return;
    }
    if (orders.length > prevCountRef.current) {
      const newCount = orders.length - prevCountRef.current;
      playDing();
      toast.success(`🔔 ${newCount} new order${newCount > 1 ? 's' : ''} available!`, { duration: 4000 });
    }
    prevCountRef.current = orders.length;
  }, [orders.length]);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, driverData }) => base44.entities.Order.update(id, {
      status: 'confirmed',
      driver_id: driverData.id,
      driver_name: driverData.full_name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
      toast.success('Order accepted! Head to the store for pickup.');
      setAccepting(null);
      if (onAccepted) onAccepted();
    },
    onError: () => {
      toast.error('Failed to accept order. It may have already been taken.');
      setAccepting(null);
    }
  });

  const handleAccept = async (order) => {
    if (!user) return;
    setAccepting(order.id);
    acceptMutation.mutate({ id: order.id, driverData: user });
  };

  const mapOrders = orders.filter(o => o.delivery_latitude && o.delivery_longitude);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading available orders...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Available Orders</h2>
          <p className="text-xs text-muted-foreground">{orders.length} pending in your area</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'map' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
          >
            Map
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4 font-medium">No pending orders right now</p>
          <p className="text-xs text-muted-foreground mt-1">Check back soon — new orders refresh every 15 seconds</p>
        </div>
      ) : viewMode === 'map' ? (
        <div className="rounded-xl overflow-hidden border h-96">
          <MapContainer center={PINE_BLUFF} zoom={12} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {mapOrders.map(order => (
              <Marker key={order.id} position={[order.delivery_latitude, order.delivery_longitude]}>
                <Popup>
                  <div className="space-y-2 min-w-[180px]">
                    <p className="font-semibold text-sm">{order.order_number}</p>
                    <p className="text-xs text-gray-600">{order.store_name}</p>
                    <p className="text-xs">{order.delivery_address}</p>
                    <p className="font-bold">${order.total?.toFixed(2)}</p>
                    <button
                      onClick={() => handleAccept(order)}
                      disabled={accepting === order.id}
                      className="w-full bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg"
                    >
                      {accepting === order.id ? 'Accepting...' : 'Accept Order'}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-card border rounded-2xl p-4 space-y-3">
              {/* Order header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold text-sm">{order.order_number}</span>
                  <p className="text-xs text-muted-foreground">{order.store_name}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg">${order.total?.toFixed(2)}</span>
                  <p className="text-xs text-muted-foreground">+ $4.75 delivery fee</p>
                </div>
              </div>

              {/* Pay breakdown */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-800">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-semibold">Your Pay</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 text-base">
                    ${(3 + (order.tip || 0)).toFixed(2)}
                  </span>
                  <p className="text-xs text-emerald-600">
                    $4.75 fee{order.tip > 0 ? ` + $${order.tip.toFixed(2)} tip` : ' + any tip'}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{order.items?.length || 0} items · {order.customer_name}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground truncate">{order.delivery_address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground text-xs">
                    Placed {formatDistanceToNow(new Date(order.created_date), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" /> Preview Route
                </a>
                <Button
                  onClick={() => handleAccept(order)}
                  disabled={accepting === order.id || acceptMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9"
                >
                  {accepting === order.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Accepting...</>
                  ) : (
                    <><Truck className="w-4 h-4 mr-2" /> Accept Delivery</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}