import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPublicStores } from '@/api/publicStores';
import { useCart } from '@/hooks/useCart';
import { APP_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ShieldCheck, MapPin, Minus, Plus, Trash2, Upload, Loader2, CheckCircle2, DollarSign, AlertCircle, Clock } from 'lucide-react';

import { findZoneForLocation, isWithinZoneHours } from '@/lib/zoneUtils';
import { calculateDistance, calculateMileageSurcharge } from '@/lib/distanceUtils';
import { toast } from 'sonner';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, storeId, storeName, total, updateQuantity, clear } = useCart();
  const [step, setStep] = useState(1); // 1=cart, 2=id_verify, 3=delivery_info, 4=payment

  const [loading, setLoading] = useState(false);
  const [idFile, setIdFile] = useState(null);
  const [idType, setIdType] = useState('');
  const [dob, setDob] = useState('');
  const [idUploaded, setIdUploaded] = useState(false);
  const [checkoutVerificationId, setCheckoutVerificationId] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
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
  const [checkoutError, setCheckoutError] = useState('');
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [storeCoords, setStoreCoords] = useState(null);
  const [storeTaxRate, setStoreTaxRate] = useState(0.085);

  // Fetch zones and store coords on mount
  useEffect(() => {
    base44.entities.DeliveryZone.filter({ is_active: true }, 'name', 100).then(setZones).catch(() => setZoneError('Delivery areas could not be loaded. Please refresh and try again.'));
    if (storeId) {
      getPublicStores({ storeId }).then((stores) => {
        const s = stores[0];
        if (s?.latitude && s?.longitude) {
          setStoreCoords({ lat: s.latitude, lon: s.longitude });
        }
        if (typeof s?.sales_tax_rate === 'number') setStoreTaxRate(s.sales_tax_rate);
      }).catch(() => {});
    }
  }, [storeId]);

  const MIN_ORDER = zone?.min_order_amount ?? 20.00;
  const deliveryFee = zone?.delivery_fee ?? 3.00;
  const mileageSurcharge = calculateMileageSurcharge(distanceMiles);
  // The customer pays the 25% service fee on merchandise.
  const serviceFee = Number((total * 0.25).toFixed(2));
  const appSupportFee = Number((total * 0.04).toFixed(2));
  const taxRate = storeTaxRate;
  const tax = Number((total * taxRate).toFixed(2));
  const grandTotal = total + deliveryFee + mileageSurcharge + serviceFee + appSupportFee + tax + tip;
  const meetsMinimum = total >= MIN_ORDER;

  const handleIdUpload = async () => {
    if (!idFile || !idType || !dob) {
      toast.error('Please fill in all ID verification fields');
      return;
    }

    setLoading(true);
    try {
      // ID photos are private; send only the private reference for verification.
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: idFile });

      // Run AI-based ID verification
      const res = await base44.functions.invoke('verifyCustomerID', {
        id_image_file_uri: file_uri,
        declared_dob: dob,
        id_type: idType,
      });

      const result = res.data;

      if (!result.verified || !result.checkout_verification_id) {
        toast.error(result.block_reason || 'ID verification failed. Please try again.');
        setLoading(false);
        return;
      }

      setCheckoutVerificationId(result.checkout_verification_id);
      setIdUploaded(true);
      toast.success('ID verified successfully ✓');
      setStep(3);
      setCheckoutError('');
    } catch (error) {
      setCheckoutError(error.response?.data?.error || error.message || 'ID verification could not finish. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Geocode address and match zone when user proceeds from delivery info step
  const validateZone = async () => {
    setZoneLoading(true); setZoneError(''); setZone(null); setDistanceMiles(0);
    try {
      if (!form.delivery_address.trim()) throw new Error('Enter your full delivery address.');
      if (!zones.length) throw new Error('Delivery areas are unavailable. Please refresh and try again.');
      const { data } = await base44.functions.invoke('validateDeliveryArea', { store_id: storeId, delivery_address: form.delivery_address });
      if (!data?.success) throw new Error(data?.error || 'The official ABC map could not confirm delivery eligibility.');
      const coords = { lat: data.latitude, lon: data.longitude };
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) throw new Error('We could not verify that address. Check the street, city and ZIP code.');
      const matched = findZoneForLocation(coords.lat, coords.lon, zones);
      if (!matched) throw new Error('This address is outside our current legal delivery zones.');
      if (!isWithinZoneHours(matched)) throw new Error(`Delivery hours for ${matched.name} are ${matched.legal_hours_start}–${matched.legal_hours_end}, Central Time.`);
      const minimum = Number(matched.min_order_amount ?? 20);
      if (total < minimum) throw new Error(`The minimum order for this delivery area is $${minimum.toFixed(2)}. Return to your cart to add more items.`);
      setZone(matched);
      if (storeCoords) setDistanceMiles(calculateDistance(storeCoords.lat, storeCoords.lon, coords.lat, coords.lon));
      return true;
    } catch (error) {
      setZoneError(error.response?.data?.error || error.message || 'Unable to verify delivery availability. Please try again.');
      return false;
    } finally { setZoneLoading(false); }
  };

  const handlePlaceOrder = async () => {
    if (!form.customer_name || !form.delivery_address || !form.customer_phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!zone || !checkoutVerificationId || !meetsMinimum) {
      setCheckoutError('Complete ID and delivery-address verification before payment.');
      return;
    }
    setCheckoutError('');
    const isFramed = window.self !== window.top;
    const checkoutTab = isFramed ? window.open('', '_blank') : null;
    if (isFramed && !checkoutTab) { toast.error('Allow popups to continue to checkout.'); return; }
    if (checkoutTab) checkoutTab.opener = null;
    setLoading(true);
    try {
      const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();

      // Pass ALL order data to Stripe metadata — order is only created in DB after payment succeeds (via webhook)
      const res = await base44.functions.invoke('createStripeCheckout', {
        order_number: orderNumber,
        items: cart,
        delivery_fee: parseFloat(deliveryFee.toFixed(2)),
        mileage_surcharge: parseFloat(mileageSurcharge.toFixed(2)),
        distance_miles: parseFloat(distanceMiles.toFixed(2)),
        service_fee: parseFloat(serviceFee.toFixed(2)),
        app_support_fee: parseFloat(appSupportFee.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        tip: parseFloat(tip.toFixed(2)),
        store_id: storeId,
        store_name: storeName,
        total: parseFloat(grandTotal.toFixed(2)),
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        delivery_address: form.delivery_address,
        notes: form.notes,
        date_of_birth: dob,
        checkout_verification_id: checkoutVerificationId,
        is_in_legal_zone: !!zone,
      });

      if (!res.data?.url) throw new Error('Failed to create payment session. Please try again.');
      if (checkoutTab) checkoutTab.location.replace(res.data.url);
      else window.location.assign(res.data.url);
    } catch (error) {
      checkoutTab?.close();
      setCheckoutError(error.response?.data?.error || error.message || 'Payment is not available yet.');
    } finally {
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
        {[{ n: 1, label: 'Cart' }, { n: 2, label: 'Verify ID' }, { n: 3, label: 'Delivery' }, { n: 4, label: 'Pay' }].map((s, i) => (
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

      {checkoutError && <p role="alert" className="mb-6 rounded-xl border border-destructive p-4 text-sm text-destructive">{checkoutError}</p>}
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
                    <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="w-11 h-11" aria-label={`Decrease ${item.product_name} quantity`} onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="w-11 h-11" aria-label={`Increase ${item.product_name} quantity`} onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-11 h-11 text-destructive" aria-label={`Remove ${item.product_name} from cart`} onClick={() => updateQuantity(item.product_id, 0)}>
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
                    setTip(Number((Number.isFinite(val) ? Math.min(100, Math.max(0, val)) : 0).toFixed(2)));
                  }}
                />
              </div>
            </div>

            <Separator className="my-4" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>${deliveryFee.toFixed(2)}</span></div>
              {mileageSurcharge > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span className="text-muted-foreground">Mileage Fee ({distanceMiles.toFixed(1)} mi, {(distanceMiles - 7).toFixed(1)} over 7)</span>
                  <span>+${mileageSurcharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee (25%)</span><span>${serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">App Support Fee (4%)</span><span>${appSupportFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated Sales Tax ({(taxRate * 100).toFixed(1)}%)</span><span>${tax.toFixed(2)}</span></div>
              {tip > 0 && <div className="flex justify-between text-emerald-700 font-medium"><span>Driver Tip 💵</span><span>+${tip.toFixed(2)}</span></div>}
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
          {!meetsMinimum && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <p className="font-semibold">Minimum order: ${MIN_ORDER.toFixed(2)}</p>
              <p className="text-xs text-amber-700 mt-1">Add ${(MIN_ORDER - total).toFixed(2)} more to proceed</p>
            </div>
          )}
          <Button onClick={() => setStep(2)} className="w-full h-12 rounded-xl text-base" disabled={!meetsMinimum}>
            {meetsMinimum ? 'Continue to ID Verification' : `Add $${(MIN_ORDER - total).toFixed(2)} more`}
          </Button>
        </div>
      )}

      {/* Step 2: ID Verification */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Age Verification Required</h2>
                <p className="text-sm text-muted-foreground">Arkansas law requires valid government-issued ID</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ID Type</Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="state_id">State ID</SelectItem>
                    <SelectItem value="military_id">Military ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label>Upload ID Photo</Label>
                <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('id-upload').click()}>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {idFile ? idFile.name : 'Click to upload your ID'}
                  </p>
                </div>
                <input id="id-upload" type="file" accept="image/*" className="hidden" onChange={(e) => setIdFile(e.target.files[0])} />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button onClick={handleIdUpload} className="flex-1 h-12 rounded-xl" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying ID…</> : <><ShieldCheck className="w-4 h-4 mr-2" />Verify & Continue</>}
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
                <p className="text-sm text-muted-foreground">Eligible wet territory in the retailer county or an adjoining county, within our service area.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(870) 555-0123" />
              </div>
              <div className="space-y-2">
                <Label>Delivery Address *</Label>
                <Textarea value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} placeholder="Full street address, city and ZIP code in Arkansas" />
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
                <span><Clock className="w-3 h-3 inline" /> Hours: {zone.legal_hours_start} – {zone.legal_hours_end}</span>
              </div>
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-800">ID Verified at Checkout</p>
              <p className="text-emerald-700">Your driver will also verify your ID at delivery. Please have your ID ready.</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-4 text-sm space-y-1">
            <div className="flex justify-between font-bold text-base"><span>Order Total</span><span>${grandTotal.toFixed(2)}</span></div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={async () => { const ok = await validateZone(); if (ok) setStep(4); }}
              className="flex-1 h-12 rounded-xl text-base"
              disabled={!form.customer_name || !form.customer_phone || !form.delivery_address || zoneLoading}
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
                <p className="text-sm text-muted-foreground">{storeName} is the seller of record. Card checkout currently uses the retailer’s Stripe account. Clover Hosted Checkout is being prepared for participating stores.</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>${deliveryFee.toFixed(2)}</span></div>
              {mileageSurcharge > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span className="text-muted-foreground">Mileage Fee ({distanceMiles.toFixed(1)} mi)</span>
                  <span>+${mileageSurcharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee (25%)</span><span>${serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">App Support Fee</span><span>${appSupportFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated Sales Tax ({(taxRate * 100).toFixed(1)}%)</span><span>${tax.toFixed(2)}</span></div>
              {tip > 0 && <div className="flex justify-between text-emerald-700"><span>Driver Tip 💵</span><span>+${tip.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t mt-1"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
            </div>

            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p>Your card details are handled by Stripe. Alcohol Delivered does not store your card number.</p>
            </div>

            {storeId === '6a32d14d09b760f592dbf19e' && (
              <div className="rounded-xl border p-4 space-y-2" role="status">
                <p className="font-semibold text-sm">Clover online checkout — coming to Beverage King</p>
                <p className="text-xs text-muted-foreground">Clover merchant approval, a 25% retailer commission agreement, secure payment confirmation and checkout testing are still required. Clover is not available to charge customers yet.</p>
                <Button type="button" variant="outline" className="w-full" disabled>Pay using Clover — setup pending</Button>
              </div>
            )}

          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={handlePlaceOrder}
              className="flex-1 h-12 rounded-xl text-base"
              disabled={loading || !checkoutVerificationId}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Pay ${grandTotal.toFixed(2)} with Card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}