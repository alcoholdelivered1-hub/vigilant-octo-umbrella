import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StarRating from './StarRating';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

/**
 * DriverRatingForm — shown after delivery to collect a star rating + optional comment.
 * Props: order (full order object), onDone () => void
 */
export default function DriverRatingForm({ order, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!order.driver_id) return null;

  const handleSubmit = async () => {
    if (!rating) { toast.error('Please select a star rating'); return; }
    setSubmitting(true);
    const res = await base44.functions.invoke('submitDriverRating', {
      driver_id: order.driver_id,
      driver_name: order.driver_name,
      order_id: order.id,
      order_number: order.order_number,
      rating,
      comment,
    });
    setSubmitting(false);
    if (res.data?.success) {
      setSubmitted(true);
      toast.success('Thanks for rating your driver!');
      setTimeout(onDone, 1500);
    } else {
      toast.error(res.data?.error || 'Could not submit rating');
      if (res.data?.error?.includes('already rated')) { onDone(); }
    }
  };

  if (submitted) {
    return (
      <p className="text-center text-sm text-emerald-600 py-2 font-medium flex items-center justify-center gap-1.5">
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Thanks for rating {order.driver_name}!
      </p>
    );
  }

  return (
    <div className="mt-3 p-4 bg-muted/50 rounded-xl space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          Rate your driver — {order.driver_name}
        </p>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>
      <Textarea
        rows={2}
        className="text-sm"
        placeholder="Any comments? (optional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !rating} className="flex-1">
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Skip</Button>
      </div>
    </div>
  );
}