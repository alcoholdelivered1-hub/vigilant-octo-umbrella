import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Truck, MapPin, ShieldCheck, Package, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import OrderChat from '@/components/messaging/OrderChat';
import DriverTraining from '@/components/driver/DriverTraining';
import IDScanner from '@/components/driver/IDScanner';
import LiveGPSBroadcaster from '@/components/driver/LiveGPSBroadcaster';
import DriverWelcome from '@/components/driver/DriverWelcome';
import DriverNav from '@/components/driver/DriverNav';
import DriverAvailabilityToggle from '@/components/driver/DriverAvailabilityToggle';
import DriverLocationMap from '@/components/driver/DriverLocationMap';
import BackgroundCheck from '@/components/driver/BackgroundCheck';
import AvailableOrders from '@/components/driver/AvailableOrders';
import DriverEarnings from '@/pages/DriverEarnings';
import DriverSummary from '@/components/driver/DriverSummary';
import DriverDeliveryMap from '@/components/driver/DriverDeliveryMap';
import { toast } from 'sonner';
import FCMSetup from '@/components/notifications/FCMSetup';
import InstallAppPrompt from '@/components/driver/InstallAppPrompt';
import ShiftChecklist from '@/components/driver/ShiftChecklist';
import DriverServiceArea from '@/components/driver/DriverServiceArea';
import DriverAuditDocuments from '@/components/driver/DriverAuditDocuments';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';

export default function DriverPortal() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('checklist'); // 'checklist' | 'welcome' | 'summary' | 'map' | 'deliveries' | 'training'
  const [refusalReason, setRefusalReason] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [verifiedHandoffs, setVerifiedHandoffs] = useState({});
  const [completedOffer, setCompletedOffer] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Handle one-click claim from email link (?claim=<order_id>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimId = params.get('claim');
    if (!claimId || claiming) return;

    setClaiming(true);
    base44.functions.invoke('claimOrder', { order_id: claimId })
      .then(res => {
        const result = res.data;
        setClaimResult(result);
        if (result.success) {
          toast.success(`🎉 Order ${result.order_number} claimed! Head to ${result.store_name}`);
          queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
          setTab('deliveries');
        } else {
          toast.error(result.reason || 'Could not claim this order.');
        }
        // Clean the URL
        window.history.replaceState({}, '', '/driver');
      })
      .catch(() => toast.error('Failed to claim order'))
      .finally(() => setClaiming(false));
  }, []);

  const { data: orders = [], isLoading, isError: ordersError, refetch: reloadOrders } = useQuery({
    queryKey: ['driver-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email, status: { $in: ['confirmed', 'preparing', 'pickup_ready', 'in_transit'] } }, '-created_date', 100),
    enabled: Boolean(user?.email),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, action, refusal_reason, verification, handoff_confirmed }) => {
      const { data } = await base44.functions.invoke('updateDriverOrderStatus', { order_id: id, action, refusal_reason, verification, handoff_confirmed });
      if (data?.success !== true) throw new Error(data?.error || 'The order update was not confirmed.');
      return data;
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.message || 'Driver order update failed.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
      setSelectedOrder(null);
      setRefusalReason('');
    },
  });

  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status));
  const pendingPickup = orders.filter(o => o.status === 'pickup_ready');
  const inTransit = orders.filter(o => o.status === 'in_transit');

  const handlePickup = (order) => {
    updateMutation.mutate({ id: order.id, action: 'pickup' }, { onSuccess: () => toast.success('Pickup confirmed, delivery started') });
  };

  const handleVerified = (order, verification) => {
    if (!verification?.verified_at_delivery || verification.manual_override) {
      toast.error('A passing ID verification is required before handoff.');
      return;
    }
    setVerifiedHandoffs(previous => ({ ...previous, [order.id]: verification }));
  };

  const handleDelivered = (order) => {
    const verification = verifiedHandoffs[order.id];
    if (!verification) return toast.error('Verify the recipient’s ID first.');
    updateMutation.mutate({ id: order.id, action: 'deliver', verification, handoff_confirmed: true }, {
      onSuccess: () => {
        setCompletedOffer({ orderNumber: order.order_number, earnings: 3 + Number(order.tip || 0) + Number(order.mileage_surcharge || 0) });
        setVerifiedHandoffs(previous => { const next = { ...previous }; delete next[order.id]; return next; });
        toast.success('Delivery completed');
      },
    });
  };

  const handleRefuse = (order) => {
    if (!refusalReason) {
      toast.error('Please provide a reason for refusal');
      return;
    }
    updateMutation.mutate({ id: order.id, action: 'refuse', refusal_reason: refusalReason }, { onSuccess: () => toast.success('Delivery refused and recorded') });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <LiveGPSBroadcaster driverId={user?.id} driverEmail={user?.email} />

      {/* Claim in progress / result banner */}
      {claiming && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 text-blue-800">
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
          <span className="font-medium">Claiming order…</span>
        </div>
      )}
      {!claiming && claimResult && !claimResult.success && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium">
          ⚠️ {claimResult.reason}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Driver Portal</h1>
            <p className="text-sm text-muted-foreground">Manage your active deliveries</p>
          </div>
        </div>
        <Link to="/driver/signup">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Apply to Drive
          </Button>
        </Link>
      </div>
      <div className="mb-6">
        <FCMSetup
          firebaseConfig={FIREBASE_CONFIG}
          vapidKey={FIREBASE_VAPID_KEY}
          driverId={user?.id}
        />
      </div>

      <InstallAppPrompt />
      <DriverServiceArea email={user?.email} />

      {completedOffer && <div className="mb-5 rounded-2xl border bg-card p-5 text-center space-y-3" role="status">
        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
        <h2 className="text-xl font-bold">Delivery complete</h2>
        <p className="text-sm text-muted-foreground">Order {completedOffer.orderNumber}</p>
        <p className="text-3xl font-bold">${completedOffer.earnings.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">Estimated fee, tip and mileage. See Earnings for payout status.</p>
        <Button className="w-full" onClick={() => { setCompletedOffer(null); setTab('available'); }}>Continue delivering</Button>
      </div>}

      <DriverNav tab={tab} setTab={setTab} />

      {tab === 'checklist' && (
        <ShiftChecklist userEmail={user?.email} onComplete={() => setTab('welcome')} />
      )}

      {tab === 'welcome' && (
        <div className="space-y-6">
          <DriverAvailabilityToggle userEmail={user?.email} />
          <DriverWelcome user={user} onStart={(t) => setTab(t)} />
          <DriverLocationMap />
        </div>
      )}

      {tab === 'summary' && <DriverSummary userEmail={user?.email} />}
      {tab === 'map' && <DriverDeliveryMap orders={orders} userEmail={user?.email} />}
      {tab === 'available' && <AvailableOrders onAccepted={() => setTab('deliveries')} />}
      {tab === 'documents' && <DriverAuditDocuments userEmail={user?.email} />}
      {tab === 'training' && <DriverTraining onComplete={() => setTab('deliveries')} />}
      {tab === 'background' && <BackgroundCheck onComplete={() => setTab('welcome')} />}
      {tab === 'earnings' && <DriverEarnings />}

      {tab === 'deliveries' && <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-sm text-emerald-800">
        <span className="text-lg">💵</span>
        <span><strong>You keep 100% of all tips</strong> — plus your $3.00 delivery fee per order.</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{activeOrders.length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{pendingPickup.length}</p>
          <p className="text-xs text-muted-foreground">Ready for Pickup</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{inTransit.length}</p>
          <p className="text-xs text-muted-foreground">In Transit</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
      ) : ordersError ? (
        <div role="alert" className="py-10 text-center space-y-3"><p className="text-destructive">Your deliveries could not be loaded.</p><Button variant="outline" onClick={() => reloadOrders()}>Try again</Button></div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No active deliveries</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeOrders.map(order => (
            <div key={order.id} className="bg-card rounded-2xl border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{order.order_number}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{order.store_name}</p>
                </div>
                <span className="font-bold">${order.total?.toFixed(2)}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{order.delivery_address}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Navigate
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>{order.items?.length || 0} items · {order.customer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-700 text-xs font-medium">ID verified at checkout – verify again at delivery</span>
                </div>
              </div>

              <Separator className="my-4" />

              {order.status === 'pickup_ready' && (
                <Button onClick={() => handlePickup(order)} className="w-full" disabled={updateMutation.isPending}>
                  <Truck className="w-4 h-4 mr-2" />
                  Confirm Pickup & Start Delivery
                </Button>
              )}

              {order.status === 'in_transit' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Before delivering:
                    </p>
                    <ul className="text-xs text-amber-700 mt-1 space-y-0.5 ml-5 list-disc">
                      <li>Verify customer's government-issued ID (must be 21+)</li>
                      <li>Do NOT deliver if customer appears intoxicated</li>
                      <li>Deliver only to the person who placed the order</li>
                      <li>No unattended deliveries</li>
                    </ul>
                  </div>

                  {verifiedHandoffs[order.id] ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                    <p className="font-semibold text-emerald-800">Step 3 of 3 · Hand order to recipient</p>
                    <p className="text-sm">Confirm the verified recipient is present and not intoxicated. Hand them the order in person, then mark it delivered.</p>
                    <Button className="w-full" onClick={() => handleDelivered(order)} disabled={updateMutation.isPending}>Handed to recipient · Complete delivery</Button>
                    <Button variant="outline" className="w-full" onClick={() => setVerifiedHandoffs(previous => { const next = { ...previous }; delete next[order.id]; return next; })}>Verify again</Button>
                  </div> : <IDScanner
                    orderId={order.id}
                    orderCustomerName={order.customer_name}
                    onVerified={(verification) => {
                      handleVerified(order, verification);
                    }}
                    onBlocked={(reason) => {
                      toast.error(reason || 'ID verification failed — refuse delivery');
                    }}
                  />}

                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)} className="w-full" disabled={updateMutation.isPending}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Refuse Delivery
                    </Button>
                  </div>

                  {selectedOrder === order.id && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Reason for refusal (required)..."
                        value={refusalReason}
                        onChange={(e) => setRefusalReason(e.target.value)}
                      />
                      <Select onValueChange={(val) => setRefusalReason(val)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Quick reason..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Customer under 21">Customer under 21</SelectItem>
                          <SelectItem value="Invalid/expired ID">Invalid/expired ID</SelectItem>
                          <SelectItem value="Customer appears intoxicated">Customer appears intoxicated</SelectItem>
                          <SelectItem value="Wrong person at delivery">Wrong person at delivery</SelectItem>
                          <SelectItem value="Location outside legal zone">Location outside legal zone</SelectItem>
                          <SelectItem value="Customer not present">Customer not present</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="destructive" onClick={() => handleRefuse(order)} className="w-full" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Confirm Refusal
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {['confirmed', 'preparing'].includes(order.status) && (
                <p className="text-xs text-muted-foreground text-center">Waiting for store to prepare order...</p>
              )}

              <div className="mt-3 pt-3 border-t space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Store chat</p>
                <OrderChat
                  orderId={order.id}
                  orderNumber={order.order_number}
                  senderRole="driver"
                  senderName={user?.full_name || user?.email || 'Driver'}
                />
                <p className="text-xs text-muted-foreground font-medium pt-1">Customer chat</p>
                <OrderChat
                  orderId={order.id}
                  orderNumber={order.order_number}
                  senderRole="driver"
                  senderName={user?.full_name || user?.email || 'Driver'}
                  chatLabel="Customer"
                  filterRole="customer"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}