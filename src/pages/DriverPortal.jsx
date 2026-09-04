import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Truck, MapPin, ShieldCheck, Package, CheckCircle2, XCircle, AlertTriangle, Loader2, BookOpen, Search, DollarSign, TrendingUp, Map, Navigation, Camera } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import OrderChat from '@/components/messaging/OrderChat';
import DriverTraining from '@/components/driver/DriverTraining';
import IDScanner from '@/components/driver/IDScanner';
import DeliveryProofCapture from '@/components/driver/DeliveryProofCapture';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import LiveGPSBroadcaster from '@/components/driver/LiveGPSBroadcaster';
import AutoArrivalNotifier from '@/components/driver/AutoArrivalNotifier';
import DriverWelcome from '@/components/driver/DriverWelcome';
import DriverAvailabilityToggle from '@/components/driver/DriverAvailabilityToggle';
import DriverLocationMap from '@/components/driver/DriverLocationMap';
import BackgroundCheck from '@/components/driver/BackgroundCheck';
import AvailableOrders from '@/components/driver/AvailableOrders';
import PickupVerification from '@/components/driver/PickupVerification';
import DriverEarnings from '@/pages/DriverEarnings';
import DriverSummary from '@/components/driver/DriverSummary';
import DriverDeliveryMap from '@/components/driver/DriverDeliveryMap';
import { toast } from 'sonner';
import { format } from 'date-fns';
import FCMSetup from '@/components/notifications/FCMSetup';
import ShiftChecklist from '@/components/driver/ShiftChecklist';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';

export default function DriverPortal() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('deliveries'); // 'checklist' | 'welcome' | 'summary' | 'map' | 'deliveries' | 'training'
  const [refusalReason, setRefusalReason] = useState('');
  const [refusalIdPhoto, setRefusalIdPhoto] = useState(null);
  const [uploadingIdPhoto, setUploadingIdPhoto] = useState(false);
  const { url: refusalPhotoSigned } = useSignedImageUrl(refusalIdPhoto);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [arrivingOrderId, setArrivingOrderId] = useState(null);
  const [mapFullscreenTrigger, setMapFullscreenTrigger] = useState(0);
  const [idVerified, setIdVerified] = useState({});

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

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['driver-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 50),
    refetchInterval: 10000,
  });

  // Cache stores so we can navigate the driver to the correct pickup store via GPS
  const { data: stores = [] } = useQuery({
    queryKey: ['driver-stores-cache'],
    queryFn: () => base44.entities.Store.list('name', 200),
    staleTime: 10 * 60 * 1000,
  });
  const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['driver-orders'] });
      const previous = queryClient.getQueryData(['driver-orders']);
      queryClient.setQueryData(['driver-orders'], (old = []) =>
        old.map(o => o.id === id ? { ...o, ...data } : o)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['driver-orders'], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
      setSelectedOrder(null);
      setRefusalReason('');
      setRefusalIdPhoto(null);
    },
  });

  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status));
  const pendingPickup = orders.filter(o => o.status === 'pickup_ready');
  const inTransit = orders.filter(o => o.status === 'in_transit');

  const handleArrived = async (order) => {
    setArrivingOrderId(order.id);
    try {
      const res = await base44.functions.invoke('notifyStoreDriverArrived', { order_id: order.id });
      if (res.data?.success) {
        toast.success(`📍 ${order.store_name} notified you've arrived!`);
      } else {
        toast.error(res.data?.reason || 'Could not notify store');
      }
    } catch (e) {
      toast.error('Failed to notify store');
    }
    setArrivingOrderId(null);
  };


  const handleDelivered = async (order, verification, proof) => {
    updateMutation.mutate({
      id: order.id,
      data: {
        status: 'delivered',
        id_verified_at_delivery: true,
        delivery_confirmed_at: new Date().toISOString(),
        delivery_signature_url: verification?.id_image_uri || null,
        delivery_photo_url: proof?.photoUrl || null,
        delivery_confirmed_latitude: proof?.latitude ?? null,
        delivery_confirmed_longitude: proof?.longitude ?? null,
      }
    });
    setIdVerified((prev) => { const next = { ...prev }; delete next[order.id]; return next; });

    const user = await base44.auth.me();
    await base44.entities.IDVerification.create({
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      order_id: order.id,
      verification_type: 'delivery',
      is_verified: true,
      verified_by: user.email,
      id_image_url: verification?.id_image_uri || null,
      date_of_birth: verification?.extracted?.date_of_birth || null,
      id_type: verification?.extracted?.id_type || null,
      notes: verification?.manual_override
        ? 'Manually approved by driver after physical ID check'
        : verification?.extracted
          ? `Age: ${verification.extracted.age} | Name match: ${verification.extracted.full_name}`
          : null,
    });

    toast.success('Delivery confirmed with ID verification');
  };

  const handleIdPhotoUpload = async (file) => {
    if (!file) return;
    setUploadingIdPhoto(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      setRefusalIdPhoto(res.file_uri);
      toast.success('ID photo attached');
    } catch (e) {
      toast.error('Failed to upload ID photo');
    } finally {
      setUploadingIdPhoto(false);
    }
  };

  const handleRefuse = (order) => {
    if (!refusalReason && !refusalIdPhoto) {
      toast.error('Upload an ID photo or select a reason code to refuse delivery');
      return;
    }
    updateMutation.mutate({
      id: order.id,
      data: {
        status: 'refused',
        refusal_reason: refusalReason || 'See attached ID photo',
        refusal_id_photo_url: refusalIdPhoto || null,
      }
    });
    toast.success('Delivery refused and recorded');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <LiveGPSBroadcaster driverId={user?.id} driverEmail={user?.email} />
      <AutoArrivalNotifier orders={orders} />

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

      </div>
      <div className="mb-6">
        <FCMSetup
          firebaseConfig={FIREBASE_CONFIG}
          vapidKey={FIREBASE_VAPID_KEY}
          driverId={user?.id}
        />
      </div>

      {/* Tabs */}
      {/* Daily workflow first, then money, then onboarding/setup */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('welcome')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'welcome' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          🏠 Home
        </button>
        <button
          onClick={() => setTab('checklist')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'checklist' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          ✅ Pre-Shift
        </button>
        <button
          onClick={() => setTab('available')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'available' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <Search className="w-4 h-4" /> Find Orders
        </button>
        <button
          onClick={() => setTab('deliveries')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'deliveries' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <Truck className="w-4 h-4" /> My Deliveries
        </button>
        <button
          onClick={() => setTab('map')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'map' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <Map className="w-4 h-4" /> Route Map
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'summary' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <TrendingUp className="w-4 h-4" /> Summary
        </button>
        <button
          onClick={() => setTab('earnings')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'earnings' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <DollarSign className="w-4 h-4" /> Earnings
        </button>
        <button
          onClick={() => setTab('training')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'training' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <BookOpen className="w-4 h-4" /> Training
        </button>
        <button
          onClick={() => setTab('background')}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'background' ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
        >
          <ShieldCheck className="w-4 h-4" /> BGC
        </button>
      </div>

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
      {tab === 'map' && <DriverDeliveryMap orders={orders} userEmail={user?.email} autoFullscreen={mapFullscreenTrigger} />}
      {tab === 'available' && <AvailableOrders onAccepted={() => { setTab('map'); setMapFullscreenTrigger(t => t + 1); }} />}
      {tab === 'training' && <DriverTraining userEmail={user?.email} onComplete={() => setTab('deliveries')} />}
      {tab === 'background' && <BackgroundCheck onComplete={() => setTab('welcome')} />}
      {tab === 'earnings' && <DriverEarnings />}

      {tab === 'deliveries' && <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-sm text-emerald-800">
        <span className="text-lg">💵</span>
        <span><strong>You keep 100% of all tips</strong> — plus your $4.75 delivery fee per order.</span>
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
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_latitude && order.delivery_longitude ? `${order.delivery_latitude},${order.delivery_longitude}` : order.delivery_address)}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Navigate
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>{order.items?.length || 0} items · {order.customer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700 text-xs font-medium">Customer confirmed age 21+ at checkout — verify government-issued photo ID at delivery</span>
                </div>
              </div>

              <Separator className="my-4" />

              {order.status === 'pickup_ready' && (
                <PickupVerification
                  order={order}
                  user={user}
                  onConfirmed={() => {
                    queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
                  }}
                />
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

                  <IDScanner
                    orderId={order.id}
                    orderCustomerName={order.customer_name}
                    onVerified={(verification) => {
                      setIdVerified((prev) => ({ ...prev, [order.id]: verification }));
                      toast.success('ID verified — now capture drop-off proof (GPS + photo) to complete delivery.');
                    }}
                    onBlocked={(reason) => {
                      toast.error(reason || 'ID verification failed — refuse delivery');
                    }}
                  />

                  {idVerified[order.id] && (
                    <DeliveryProofCapture
                      order={order}
                      disabled={updateMutation.isPending}
                      onComplete={(proof) => {
                        handleDelivered(order, idVerified[order.id], proof);
                      }}
                    />
                  )}

                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)} className="w-full" disabled={updateMutation.isPending}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Refuse Delivery
                    </Button>
                  </div>

                  {selectedOrder === order.id && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1">Audit requirement (ABC)</p>
                        <p className="text-xs text-amber-700">You must <strong>either</strong> upload a photo of the refused customer's ID <strong>or</strong> select a reason code below. This is logged for state compliance audit.</p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">ID photo (if available)</label>
                        <div className="mt-1 flex items-center gap-3">
                          <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-input rounded-lg py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50">
                            {uploadingIdPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            {uploadingIdPhoto ? 'Uploading…' : refusalIdPhoto ? 'Photo attached ✓' : 'Upload / take ID photo'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handleIdPhotoUpload(e.target.files?.[0])}
                              disabled={uploadingIdPhoto}
                            />
                          </label>
                          {refusalIdPhoto && refusalPhotoSigned && (
                            <img src={refusalPhotoSigned} alt="Refused ID" className="w-14 h-14 rounded-lg object-cover border" />
                          )}
                        </div>
                      </div>

                      <Textarea
                        placeholder="Reason for refusal (optional if ID photo attached)..."
                        value={refusalReason}
                        onChange={(e) => setRefusalReason(e.target.value)}
                      />
                      <Select onValueChange={(val) => setRefusalReason(val)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Quick reason code..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Customer under 21">Customer under 21</SelectItem>
                          <SelectItem value="Invalid/expired ID">Invalid/expired ID</SelectItem>
                          <SelectItem value="Customer appears intoxicated">Customer appears intoxicated</SelectItem>
                          <SelectItem value="Wrong person at delivery">Wrong person at delivery</SelectItem>
                          <SelectItem value="Location outside legal zone">Location outside legal zone</SelectItem>
                          <SelectItem value="Customer not present">Customer not present</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        onClick={() => handleRefuse(order)}
                        className="w-full"
                        disabled={updateMutation.isPending || uploadingIdPhoto || (!refusalReason && !refusalIdPhoto)}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Confirm Refusal
                      </Button>
                      {!refusalReason && !refusalIdPhoto && (
                        <p className="text-xs text-red-600 text-center">Upload an ID photo or select a reason code to continue.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {['confirmed', 'preparing', 'pickup_ready'].includes(order.status) && (() => {
                const store = order.store_id ? storeMap[order.store_id] : null;
                const storeDest = store?.latitude && store?.longitude
                  ? `${store.latitude},${store.longitude}`
                  : store
                    ? `${store.address}, ${store.city}, ${store.state} ${store.zip_code || ''}`.trim()
                    : order.store_name;
                return (
                  <div className="space-y-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(storeDest)}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Navigate to Store
                    </a>
                    {store?.address && (
                      <p className="text-xs text-muted-foreground text-center truncate">
                        📍 {store.name} — {store.address}, {store.city}
                      </p>
                    )}
                    {['confirmed', 'preparing'].includes(order.status) && (
                      <Button
                        onClick={() => handleArrived(order)}
                        disabled={arrivingOrderId === order.id}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {arrivingOrderId === order.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4 mr-2" />
                        )}
                        I've Arrived at Store
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground text-center">Tap "Navigate to Store" for GPS directions, then "I've Arrived" when you reach the store.</p>
                  </div>
                );
              })()}

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