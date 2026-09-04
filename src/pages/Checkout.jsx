import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCart } from '@/hooks/useCart';
import { APP_CONFIG, GIS_BOUNDARY } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ShieldCheck, MapPin, Minus, Plus, Trash2, Loader2, CheckCircle2, DollarSign, AlertCircle, Clock, AlertTriangle } from 'lucide-react';

import { geocodeAddress, findZoneForLocation, isWithinZoneHours, getTodayHoursLabel } from '@/lib/zoneUtils';
import { calculateDistance, calculateMileageSurcharge } from '@/lib/distanceUtils';
import { calculateAlcoholExciseTax } from '@/lib/arkansasTax';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import BirthdateInput from '@/components/checkout/BirthdateInput';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, storeId, storeName, total, updateQuantity, clear } = useCart();
  const { user } = useAuth();
  const referralCreditCents = user?.referral_credits || 0;
  const referralCreditDollars = referralCreditCents / 100;
  const [step, setStep] = useState(1); // 1=cart, 2=id_verify, 3=delivery_info, 4=payment

  const [loading, setLoading] = useState(false);
  const [dob, setDob] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    delivery_address: '',
    notes: '',
  });

  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');

  const [zone, setZone] = useState(null);
  const [zones, setZones] = useState([]);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [storeCoords, setStoreCoords] = useState(null);
  const [store, setStore] = useState(null);

  // Fetch zones and store coords on mount
  useEffect(() => {
    base44.entities.DeliveryZone.filter({ is_active: true }, 'name', 100).then(setZones).catch(() => {});
    if (storeId) {
      base44.entities.Store.filter({ id: storeId }, 'name', 1).then((stores) => {
        const s = stores[0];
        if (s) {
          setStore(s);
          if (s.latitude && s.longitude) {
            setStoreCoords({ lat: s.latitude, lon: s.longitude });
          }
        }
      }).catch(() => {});
    }
  }, [storeId]);

  // Round each monetary component to cents BEFORE summing so the displayed
  // line items always reconcile exactly with the displayed total (and match
  // what Stripe charges). Summing raw floats then rounding the total is what
  // caused penny-off discrepancies between subtotal/taxes and final total.
  const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const MIN_ORDER = zone?.min_order_amount ?? 20.00;
  const subtotal = roundCents(total);
  const deliveryFee = roundCents(zone?.delivery_fee ?? 3.00);
  const mileageSurcharge = roundCents(calculateMileageSurcharge(distanceMiles));
  const serviceFee = roundCents(total * 0.25);
  const taxRate = zone?.tax_rate ?? 0.065;
  const tax = roundCents(total * taxRate);
  const alcoholExciseTax = roundCents(calculateAlcoholExciseTax(cart));
  const tipAmount = roundCents(tip);
  const grandTotal = roundCents(subtotal + deliveryFee + mileageSurcharge + serviceFee + tax + alcoholExciseTax + tipAmount);
  const appliedCredit = roundCents(Math.min(referralCreditDollars, grandTotal));
  const finalTotal = roundCents(grandTotal - appliedCredit);
  const meetsMinimum = total >= MIN_ORDER;

  const calcAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleAgeConfirm = () => {
    if (!dob) {
      toast.error('Please enter your date of birth');
      return;
    }
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      toast.error('Please enter a valid date of birth');
      return;
    }
    if (calcAge(birthDate) < 21) {
      toast.error('You must be 21 or older to purchase alcohol');
      return;
    }
    if (!ageConfirmed) {
      toast.error('Please confirm you understand the ID check requirement');
      return;
    }
    setStep(3);
  };

  // Full delivery-eligibility verification before allowing checkout
  const validateZone = async () => {
    if (!form.delivery_address) return true;
    setZoneLoading(true);
    setZoneError('');

    let coords = null;
    let matched = null;
    let rejectionReason = '';
    let finalResult = 'rejected';

    try {
      coords = await geocodeAddress(form.delivery_address + ', AR');

      if (!coords) {
        rejectionReason = 'Invalid or incomplete address — could not be geocoded.';
      } else {
        matched = findZoneForLocation(coords.lat, coords.lon, zones);

        if (!matched) {
          rejectionReason = 'Address is outside all approved Alcohol Delivered service zones.';
        } else if (!matched.is_wet) {
          rejectionReason = 'Address is in a dry jurisdiction — alcohol delivery is not legal here.';
        } else if (!isWithinZoneHours(matched)) {
          rejectionReason = `Deliveries in ${matched.name} are currently outside legal hours. Today: ${getTodayHoursLabel(matched)}. Please order during those hours.`;
        } else if (!store || store.compliance_status !== 'compliant' || !store.is_active) {
          rejectionReason = 'Selected retailer is not licensed or approved for delivery.';
        } else {
          // All checks passed
          setZone(matched);
          finalResult = 'approved';
          if (storeCoords) {
            const dist = calculateDistance(storeCoords.lat, storeCoords.lon, coords.lat, coords.lon);
            setDistanceMiles(dist);
          }
        }
      }
    } catch (err) {
      rejectionReason = `Mapping service error: ${err.message || 'timeout or failure'}. Please try again.`;
    }

    // Securely log every eligibility check (fire-and-forget — never block checkout)
    try {
      const sessionId = 'CHK-' + Date.now().toString(36).toUpperCase();
      base44.functions.invoke('logDeliveryEligibility', {
        order_or_session_id: sessionId,
        customer_latitude: coords?.lat || null,
        customer_longitude: coords?.lon || null,
        matched_municipality: matched?.name || '',
        matched_county: matched?.county || '',
        service_zone_result: matched ? `pass (${matched.name})` : 'fail (no matching zone)',
        wet_jurisdiction_result: matched
          ? (matched.is_wet ? 'pass (wet)' : 'fail (dry)')
          : 'unverified',
        retailer_eligibility_result: store
          ? (store.compliance_status === 'compliant' && store.is_active
              ? 'pass'
              : `fail (${store.compliance_status || 'unknown status'})`)
          : 'fail (no store selected)',
        boundary_dataset_version: GIS_BOUNDARY.boundary_version,
        final_result: finalResult,
        rejection_reason: finalResult === 'approved' ? '' : rejectionReason,
      }).catch(() => {});
    } catch {}

    if (finalResult === 'rejected') {
      // Hours-specific errors get a more actionable message; everything else gets the generic block message
      if (rejectionReason.includes('legal hours')) {
        setZoneError(rejectionReason);
      } else {
        setZoneError('Delivery is not currently available at this address. Alcohol Delivered only serves approved locations within eligible wet jurisdictions.');
      }
      setZoneLoading(false);
      return false;
    }

    setZoneLoading(false);
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!form.customer_name || !form.delivery_address || !form.customer_phone || !form.customer_email) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Block checkout if delivery eligibility has not been verified
    if (!zone) {
      toast.error('Please verify your delivery address before placing an order.');
      setStep(3);
      return;
    }

    // Guard against duplicate submission from repeated taps
    if (loading) return;
    setLoading(true);
    try {
      const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();

      // Re-fetch live prices from the database so the customer is always
      // charged the retailer's current price (not a stale cart snapshot).
      const productIds = cart.map(i => i.product_id);
      const liveProducts = await base44.entities.Product.filter({ id: { $in: productIds } }, 'name', 200);
      const priceMap = {};
      liveProducts.forEach(p => { priceMap[p.id] = p.price; });

      let priceChanged = false;
      const syncedCart = cart.map(item => {
        const livePrice = priceMap[item.product_id];
        if (livePrice != null && livePrice !== item.price) {
          priceChanged = true;
          return { ...item, price: livePrice, subtotal: livePrice * item.quantity };
        }
        return item;
      });

      // If any price changed, notify the customer before charging
      if (priceChanged) {
        toast.info('Some prices were updated by the store. Your total has been adjusted.');
      }

      // Check stock availability before charging — prevents selling out-of-stock items
      const stockIssues = [];
      syncedCart.forEach(item => {
        const product = liveProducts.find(p => p.id === item.product_id);
        if (!product) {
          stockIssues.push(`${item.product_name} is no longer available`);
        } else if (!product.in_stock) {
          stockIssues.push(`${item.product_name} is out of stock`);
        } else if (product.stock_quantity != null && product.stock_quantity < item.quantity) {
          stockIssues.push(`${item.product_name} — only ${product.stock_quantity} left (you have ${item.quantity} in cart)`);
        }
      });
      if (stockIssues.length > 0) {
        toast.error(`Unable to checkout: ${stockIssues.join('; ')}`);
        setLoading(false);
        return;
      }

      // Recalculate subtotal from synced prices — round each component to
      // cents before summing so the charged total matches the on-screen total.
      const syncedSubtotal = roundCents(syncedCart.reduce((sum, i) => sum + i.subtotal, 0));
      const syncedServiceFee = roundCents(syncedSubtotal * 0.25);
      const syncedTax = roundCents(syncedSubtotal * taxRate);
      const syncedAlcoholExciseTax = roundCents(calculateAlcoholExciseTax(syncedCart));
      const syncedGrandTotal = roundCents(syncedSubtotal + deliveryFee + mileageSurcharge + syncedServiceFee + syncedTax + syncedAlcoholExciseTax + tipAmount);

      // Pass ALL order data to Stripe metadata — order is only created in DB after payment succeeds (via webhook)
      const res = await base44.functions.invoke('createStripeCheckout', {
        referral_credit_cents: referralCreditCents,
        order_number: orderNumber,
        items: syncedCart,
        subtotal: parseFloat(syncedSubtotal.toFixed(2)),
        delivery_fee: parseFloat(deliveryFee.toFixed(2)),
        mileage_surcharge: parseFloat(mileageSurcharge.toFixed(2)),
        distance_miles: parseFloat(distanceMiles.toFixed(2)),
        service_fee: parseFloat(syncedServiceFee.toFixed(2)),
        tax: parseFloat(syncedTax.toFixed(2)),
        alcohol_excise_tax: parseFloat(syncedAlcoholExciseTax.toFixed(2)),
        tax_rate: taxRate,
        tip: parseFloat(tip.toFixed(2)),
        store_id: storeId,
        store_name: storeName,
        total: parseFloat(syncedGrandTotal.toFixed(2)),
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        delivery_address: form.delivery_address,
        notes: form.notes,
        date_of_birth: dob,
        is_in_legal_zone: !!zone,
      });

      if (res.data?.url) {
        clear();
        window.location.href = res.data.url;
      } else {
        toast.error('Failed to create payment session. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Check if ABC has approved sales
  if (!APP_CONFIG.ABC_APPROVED) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Coming Soon</h1>
            <p className="text-muted-foreground mt-2">
              We're awaiting final approval from the Arkansas ABC to launch sales.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back soon to place your first order!
            </p>
          </div>
          <Link to="/stores">
            <Button variant="outline">Browse Stores in the Meantime</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Your cart is empty</p>
        <Link to="/stores"><Button variant="outline" className="mt-4">Browse Stores</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Shopping
      </Link>

      {/* Steps */}
      <div className="flex items-center gap-1 sm:gap-3 mb-8">
        {[{ n: 1, label: 'Cart' }, { n: 2, label: 'Age Check' }, { n: 3, label: 'Delivery' }, { n: 4, label: 'Pay' }].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <div className={`flex-1 h-0.5 ${step >= s.n ? 'bg-primary' : 'bg-muted'}`} />}
            <div className={`flex items-center gap-1.5 ${step >= s.n ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step >= s.n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </div>
              <span className="text-xs sm:text-sm font-medium">{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Cart Review */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="font-display text-xl font-semibold mb-1">Your Order from {storeName}</h2>
            <div className="space-y-4 mt-4">
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.pack_size && item.pack_size !== 'Single' && <span className="text-primary font-medium">{item.pack_size} · </span>}
                      ${item.price.toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="w-7 h-7 min-h-[44px] min-w-[44px]" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="w-7 h-7 min-h-[44px] min-w-[44px]" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 min-h-[44px] min-w-[44px] text-destructive" onClick={() => updateQuantity(item.product_id, 0)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="font-semibold text-sm w-16 text-right">${item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <Separator className="my-4" />

            {/* Tip Selector */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5">💵 Add a tip for your driver</p>
              <div className="grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 5].map(amount => (
                  <button
                    key={amount}
                    onClick={() => { setTip(amount); setCustomTip(''); }}
                    className={`py-2 rounded-xl border-2 text-sm font-semibold transition-all ${tip === amount && customTip === '' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                  >
                    {amount === 0 ? 'None' : `$${amount}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Custom:</span>
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="$0.00"
                  className="h-8 w-28 text-sm"
                  value={customTip}
                  onChange={(e) => {
                    setCustomTip(e.target.value);
                    const val = parseFloat(e.target.value);
                    setTip(isNaN(val) ? 0 : val);
                  }}
                />
              </div>
            </div>

            <Separator className="my-4" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>${deliveryFee.toFixed(2)}</span></div>
              {mileageSurcharge > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span className="text-muted-foreground">Mileage Fee ({distanceMiles.toFixed(1)} mi, {(distanceMiles - 7).toFixed(1)} over 7)</span>
                  <span>+${mileageSurcharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee (25%)</span><span>${serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sales Tax ({(taxRate * 100).toFixed(2)}%)</span><span>${tax.toFixed(2)}</span></div>
              {alcoholExciseTax > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">AR Alcohol Excise Tax</span><span>${alcoholExciseTax.toFixed(2)}</span></div>
              )}
              {tip > 0 && <div className="flex justify-between text-emerald-700 font-medium"><span>Driver Tip 💵</span><span>+${tipAmount.toFixed(2)}</span></div>}
              {appliedCredit > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span className="flex items-center gap-1">🎁 Referral Credit</span>
                  <span>-${appliedCredit.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>{appliedCredit > 0 ? 'Total Due' : 'Total'}</span>
                <span>${finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {!meetsMinimum && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> ${(MIN_ORDER - total).toFixed(2)} more needed to reach the ${MIN_ORDER.toFixed(2)} minimum
              </p>
              <p className="text-xs text-amber-700">Use the + buttons above to add more of any item, or browse the store for more products.</p>
              <Link to={`/stores/${storeId}`}>
                <Button variant="outline" size="sm" className="mt-1 rounded-xl h-8 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Browse Store for More Items
                </Button>
              </Link>
            </div>
          )}
          <Button onClick={() => setStep(2)} className="w-full h-12 rounded-xl text-base" disabled={!meetsMinimum}>
            {meetsMinimum ? 'Continue to ID Verification' : `Need $${(MIN_ORDER - total).toFixed(2)} more`}
          </Button>
        </div>
      )}

      {/* Step 2: Age Confirmation */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Age Verification</h2>
                <p className="text-sm text-muted-foreground">You must be 21 or older to purchase alcohol</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <BirthdateInput value={dob} onChange={setDob} />
                {dob && calcAge(new Date(dob)) >= 21 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Age verified — you are {calcAge(new Date(dob))} years old.
                  </p>
                )}
                {dob && calcAge(new Date(dob)) < 21 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> You must be 21 or older to use this service.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-amber-900">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> ID Required at Delivery
              </p>
              <p>Your driver will inspect your valid government-issued photo ID at the time of delivery. The recipient must be 21 or older and must be the person who placed this order.</p>
              <div className="border-t border-amber-200 pt-2 mt-2">
                <p className="font-semibold">Delivery Refusal — No Refund</p>
                <p>Delivery may be refused without a refund where legally permitted if the recipient is underage, cannot present valid ID, or appears visibly intoxicated. Contactless or unattended alcohol delivery is not permitted.</p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-input"
              />
              <span className="text-sm leading-snug">
                I confirm that I am 21 years of age or older and understand that my government-issued photo ID will be checked at delivery.
              </span>
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button onClick={handleAgeConfirm} className="flex-1 h-12 rounded-xl">
              <ShieldCheck className="w-4 h-4 mr-2" />Continue to Delivery
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Delivery Info */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Delivery Information</h2>
                <p className="text-sm text-muted-foreground">Delivery to Pine Bluff, AR area only</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(870) 555-0123" />
              </div>
              <div className="space-y-2">
                <Label>Delivery Address *</Label>
                <Textarea value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} placeholder="Full delivery address in Jefferson County, AR" />
                <p className="text-xs text-muted-foreground italic">
                  Delivery availability is determined by your address, participating retailer coverage, local jurisdiction requirements, and Alcohol Delivered's approved service zones.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Order Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Gate code, special instructions, etc." />
              </div>
            </div>
          </div>

          {zoneError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">{zoneError}</div>
            </div>
          )}

          {zone && !zoneError && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Zone: {zone.name}</p>
              <div className="flex gap-4 text-xs text-blue-700">
                <span><DollarSign className="w-3 h-3 inline" /> Delivery fee: ${zone.delivery_fee?.toFixed(2)}</span>
                <span><Clock className="w-3 h-3 inline" /> Today's hours: {getTodayHoursLabel(zone)}</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-800">ID Check at Delivery</p>
              <p className="text-blue-700">Your driver will inspect your government-issued photo ID at delivery. Please have your ID ready. Delivery will be refused if you cannot present valid ID or appear intoxicated.</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-4 text-sm space-y-1">
            <div className="flex justify-between font-bold text-base"><span>{appliedCredit > 0 ? 'Total Due' : 'Order Total'}</span><span>${finalTotal.toFixed(2)}</span></div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={async () => { const ok = await validateZone(); if (ok) setStep(4); }}
              className="flex-1 h-12 rounded-xl text-base"
              disabled={!form.customer_name || !form.customer_email || !form.customer_phone || !form.delivery_address || zoneLoading}
            >
              {zoneLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue to Payment
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Payment */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Secure Payment</h2>
                <p className="text-sm text-muted-foreground">Pay safely with your credit or debit card</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>${deliveryFee.toFixed(2)}</span></div>
              {mileageSurcharge > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span className="text-muted-foreground">Mileage Fee ({distanceMiles.toFixed(1)} mi)</span>
                  <span>+${mileageSurcharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span>${serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sales Tax ({(taxRate * 100).toFixed(2)}%)</span><span>${tax.toFixed(2)}</span></div>
              {alcoholExciseTax > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">AR Alcohol Excise Tax</span><span>${alcoholExciseTax.toFixed(2)}</span></div>
              )}
              {tip > 0 && <div className="flex justify-between text-emerald-700"><span>Driver Tip 💵</span><span>+${tipAmount.toFixed(2)}</span></div>}
              {appliedCredit > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span className="flex items-center gap-1">🎁 Referral Credit</span>
                  <span>-${appliedCredit.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
                <span>{appliedCredit > 0 ? 'Total Due' : 'Total'}</span>
                <span>${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p>Your payment is secured by Stripe. We never store your card details.</p>
            </div>

            {/* Required legal notices */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-amber-900">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> ID Required at Delivery
              </p>
              <p>A valid government-issued photo ID is required at the time of delivery. The recipient must be 21 years of age or older and must be the person who placed this order.</p>
              <div className="border-t border-amber-200 pt-2 mt-2">
                <p className="font-semibold">Delivery Refusal — No Refund</p>
                <p>Delivery may be refused without a refund where legally permitted if the recipient is underage, cannot present valid ID, or appears visibly intoxicated. Unattended or contactless alcohol delivery is not permitted.</p>
              </div>
            </div>

            {window.self !== window.top && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                ⚠️ Stripe checkout only works from the published app, not within the preview iframe. Please open the app in a new tab.
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={handlePlaceOrder}
              className="flex-1 h-12 rounded-xl text-base"
              disabled={loading || window.self !== window.top}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Pay ${finalTotal.toFixed(2)} with Card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}