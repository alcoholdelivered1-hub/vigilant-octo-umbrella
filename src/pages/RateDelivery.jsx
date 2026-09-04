import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function RateDelivery() {
  const [order, setOrder] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  // Parse token from URL
  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid rating link.');
      setLoading(false);
      return;
    }

    const loadOrder = async () => {
      try {
        let decoded;
        try { decoded = atob(token); } catch {
          setError('Invalid or expired rating link.');
          setLoading(false);
          return;
        }

        // Token format: base64(orderId:driverId:hmacSignature) — signature
        // is verified server-side on submit; frontend only extracts IDs for display.
        const parts = decoded.split(':');
        const orderId = parts[0];
        const driverId = parts[1];
        if (!orderId || !driverId) {
          setError('Invalid rating link.');
          setLoading(false);
          return;
        }

        // Fetch order and driver (both are public-readable)
        const [orders, drivers] = await Promise.all([
          base44.entities.Order.filter({ id: orderId }, '-created_date', 1),
          base44.entities.Driver.filter({ id: driverId }, '-created_date', 1),
        ]);

        if (!orders[0]) {
          setError('Order not found.');
          setLoading(false);
          return;
        }

        const foundOrder = orders[0];
        setOrder(foundOrder);
        setDriver(drivers[0] || null);

        // Check if already rated (by order_id)
        const existingRatings = await base44.asServiceRole?.entities?.DriverRating?.filter?.({ order_id: orderId }) ?? [];
        if (existingRatings.length > 0) {
          setAlreadyRated(true);
        }
      } catch (e) {
        setError('Could not load your order. Please try again.');
      }
      setLoading(false);
    };

    loadOrder();
  }, [token]);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitDeliveryRating', {
        token,
        rating,
        comment,
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to submit rating. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="font-display text-2xl font-bold">Thanks for your feedback!</h1>
          <p className="text-muted-foreground text-sm">
            Your rating helps us reward great drivers and improve our service.
          </p>
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-7 h-7 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (alreadyRated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h1 className="font-display text-xl font-bold">Already Rated</h1>
          <p className="text-muted-foreground text-sm">You've already submitted a rating for this delivery. Thank you!</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-14 h-14 text-destructive mx-auto" />
          <h1 className="font-display text-xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-4xl mb-3">🍻</div>
          <h1 className="font-display text-2xl font-bold">How was your delivery?</h1>
          <p className="text-muted-foreground text-sm">
            Order <span className="font-semibold text-foreground">{order?.order_number}</span> from {order?.store_name}
          </p>
        </div>

        {/* Driver card */}
        {driver && (
          <div className="bg-card border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
              {driver.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-semibold">{driver.name}</p>
              <p className="text-xs text-muted-foreground">Your delivery driver</p>
              {driver.avg_rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-muted-foreground">{driver.avg_rating.toFixed(1)} avg rating</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Star rating */}
        <div className="bg-card border rounded-2xl p-6 space-y-4">
          <p className="text-sm font-semibold text-center">Tap to rate your experience</p>
          <div className="flex justify-center gap-2">
            {[1,2,3,4,5].map(i => (
              <button
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(i)}
                className="transition-transform active:scale-90 hover:scale-110"
              >
                <Star className={`w-10 h-10 transition-colors ${
                  i <= (hovered || rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                }`} />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm font-medium text-amber-600">
              {['', 'Poor 😕', 'Fair 😐', 'Good 😊', 'Great 😄', 'Excellent 🤩'][rating]}
            </p>
          )}

          {/* Optional comment */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Leave a comment (optional)</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was the delivery experience?"
              className="resize-none h-20 text-sm"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="w-full h-11 rounded-xl"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Rating
          </Button>
        </div>
      </div>
    </div>
  );
}