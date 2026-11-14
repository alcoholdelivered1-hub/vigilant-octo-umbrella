import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Camera, CheckCircle2, AlertTriangle, Loader2, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

const REQUIRED_ATTESTATIONS = [
  'I verified that every item ordered by the customer is in the bag.',
  'I verified that the retailer sealed the order before pickup.',
  'I verified that there are no substitutions, missing items, damaged items, or incorrect quantities.',
];

const PROBLEM_REASONS = [
  'Missing item(s)',
  'Incorrect item(s)',
  'Damaged item(s)',
  'Wrong quantity',
  'Unapproved substitution',
  'Order not sealed',
  'Receipt missing',
  'Other (describe below)',
];

export default function PickupVerification({ order, user, onConfirmed }) {
  const [itemChecks, setItemChecks] = useState({});
  const [attestations, setAttestations] = useState({});
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [problemMode, setProblemMode] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [problemText, setProblemText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const fileInputRef = useRef(null);

  const allItemsChecked = (order.items || []).every((_, i) => itemChecks[i]);
  const allAttestationsChecked = REQUIRED_ATTESTATIONS.every((_, i) => attestations[i]);
  const canConfirm = allItemsChecked && allAttestationsChecked && photoUrl && !submitting && !problemMode;

  const toggleItemCheck = (i) => setItemChecks(prev => ({ ...prev, [i]: !prev[i] }));
  const toggleAttestation = (i) => setAttestations(prev => ({ ...prev, [i]: !prev[i] }));

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(res.file_url);
      toast.success('Photo uploaded');
    } catch {
      toast.error('Failed to upload photo');
    }
    setUploading(false);
    e.target.value = '';
  };

  const getGPS = async () => {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 5000,
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const gps = await getGPS();
      if (!gps) {
        toast.error('Could not get GPS location — please enable location access');
        setSubmitting(false);
        return;
      }

      const now = new Date();
      const checklist = [
        ...REQUIRED_ATTESTATIONS.filter((_, i) => attestations[i]),
        ...(order.items || []).map((item, i) => `Verified: ${item.product_name} (Qty: ${item.quantity})`),
      ];

      await base44.entities.PickupVerification.create({
        order_id: order.id,
        order_number: order.order_number,
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        store_id: order.store_id,
        store_name: order.store_name,
        pickup_latitude: gps.lat,
        pickup_longitude: gps.lng,
        pickup_confirmed_at: now.toISOString(),
        checklist,
        sealed_bag_photo_url: photoUrl,
        reported_problems: '',
        has_problems: false,
      });

      await base44.entities.Order.update(order.id, {
        status: 'in_transit',
        pickup_confirmed_at: now.toISOString(),
      });

      toast.success('Pickup verified — order is now Out for Delivery');
      onConfirmed?.();
    } catch (err) {
      toast.error('Failed to confirm pickup');
      console.error('[PickupVerification]', err);
    }
    setSubmitting(false);
  };

  const handleReportProblem = async () => {
    if (!problemReason) {
      toast.error('Please select a problem type');
      return;
    }
    setReporting(true);
    try {
      const gps = await getGPS();
      const now = new Date();
      const fullProblem = `${problemReason}${problemText.trim() ? ': ' + problemText.trim() : ''}`;

      await base44.entities.PickupVerification.create({
        order_id: order.id,
        order_number: order.order_number,
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        store_id: order.store_id,
        store_name: order.store_name,
        pickup_latitude: gps?.lat || null,
        pickup_longitude: gps?.lng || null,
        pickup_confirmed_at: now.toISOString(),
        checklist: [],
        sealed_bag_photo_url: photoUrl || '',
        reported_problems: fullProblem,
        has_problems: true,
      });

      await base44.entities.Order.update(order.id, {
        status: 'preparing',
        notes: `[PICKUP PROBLEM ${now.toISOString()}] ${fullProblem}`,
      });

      await base44.functions.invoke('notifyOrderProblem', {
        order_id: order.id,
        order_number: order.order_number,
        store_id: order.store_id,
        store_name: order.store_name,
        driver_name: user.full_name || user.email,
        problem: fullProblem,
      });

      toast.success('Problem reported — retailer and administrator have been notified. Do NOT pick up this order until resolved.');
      setProblemMode(false);
      setProblemReason('');
      setProblemText('');
      onConfirmed?.();
    } catch (err) {
      toast.error('Failed to report problem');
      console.error('[PickupVerification report]', err);
    }
    setReporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        <p className="font-semibold flex items-center gap-1.5">
          <Package className="w-4 h-4" /> Verify Order Before Pickup
        </p>
        <p className="text-xs mt-0.5">
          Complete every checklist item below before confirming pickup. The order cannot go Out for Delivery until verification is complete.
        </p>
      </div>

      {/* Order items with per-item checkboxes */}
      <div>
        <p className="text-sm font-semibold mb-2">
          Customer Order — {order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}
        </p>
        <div className="bg-muted/30 rounded-xl border p-3 space-y-2">
          {order.items?.map((item, i) => (
            <label key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
              <Checkbox
                checked={!!itemChecks[i]}
                onCheckedChange={() => toggleItemCheck(i)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity} · ${item.price?.toFixed(2)} each
                </p>
              </div>
              <span className="text-muted-foreground text-xs font-medium">${item.subtotal?.toFixed(2)}</span>
            </label>
          ))}
          {order.items?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No items in this order.</p>
          )}
        </div>
      </div>

      {/* Required attestation checkboxes */}
      <div>
        <p className="text-sm font-semibold mb-2">Required Verifications</p>
        <div className="space-y-1">
          {REQUIRED_ATTESTATIONS.map((attestation, i) => (
            <label key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
              <Checkbox
                checked={!!attestations[i]}
                onCheckedChange={() => toggleAttestation(i)}
                className="mt-0.5"
              />
              <span className="text-sm leading-snug">{attestation}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Photo upload */}
      <div>
        <p className="text-sm font-semibold mb-2">Sealed Bag Photo (Required)</p>
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt="Sealed bag" className="w-full rounded-xl border max-h-48 object-cover" />
            <button
              onClick={() => setPhotoUrl(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
            <span className="text-sm">{uploading ? 'Uploading…' : 'Take or upload photo of sealed bag'}</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* Report a problem */}
      {problemMode && (
        <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Report Order Problem
          </p>
          <p className="text-xs text-amber-700">
            Reporting a problem will notify the retailer and administrator. The order will remain at the retailer and cannot go Out for Delivery until the issue is resolved.
          </p>
          <Select value={problemReason} onValueChange={setProblemReason}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Select problem type…" /></SelectTrigger>
            <SelectContent>
              {PROBLEM_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Describe the problem in detail…"
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleReportProblem}
              disabled={reporting || !problemReason}
              className="flex-1"
            >
              {reporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Submit Problem Report
            </Button>
            <Button
              variant="outline"
              onClick={() => { setProblemMode(false); setProblemReason(''); setProblemText(''); }}
              disabled={reporting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!problemMode && (
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-11"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm Pickup — Out for Delivery
          </Button>
          <Button
            variant="outline"
            onClick={() => setProblemMode(true)}
            className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Order Problem
          </Button>
          {!canConfirm && (
            <p className="text-xs text-muted-foreground text-center">
              Check every item, complete all {REQUIRED_ATTESTATIONS.length} verifications, and upload a sealed-bag photo to confirm pickup.
            </p>
          )}
        </div>
      )}

      {/* Verification record info */}
      <div className="text-xs text-muted-foreground border-t pt-2 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Verification records driver name, order number, date, time, and GPS location.
      </div>
    </div>
  );
}