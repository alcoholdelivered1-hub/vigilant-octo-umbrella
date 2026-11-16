import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star, MessageSquare, CheckCircle2, Store, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={cn('w-4 h-4', s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export default function CustomerComments() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // 'all' | 'unreviewed' | rating
  const [storeFilter, setStoreFilter] = useState('');

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['customer-feedback'],
    queryFn: () => base44.entities.CustomerFeedback.list('-created_date', 200),
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomerFeedback.update(id, { is_reviewed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-feedback'] }),
  });

  const stores = [...new Set(feedback.map(f => f.store_name).filter(Boolean))];

  const filtered = feedback.filter(f => {
    if (filter === 'unreviewed' && f.is_reviewed) return false;
    if (filter !== 'all' && filter !== 'unreviewed' && f.rating !== Number(filter)) return false;
    if (storeFilter && f.store_name !== storeFilter) return false;
    return true;
  });

  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : '—';

  const unreviewed = feedback.filter(f => !f.is_reviewed).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Customer Feedback</h1>
        <p className="text-muted-foreground mt-1">Reviews and comments from delivered orders</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold">{feedback.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Reviews</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold flex items-center justify-center gap-1">
            {avgRating} <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Rating</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{unreviewed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Needs Review</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {feedback.filter(f => f.rating >= 4).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Positive (4–5★)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {['all', 'unreviewed', '5', '4', '3', '2', '1'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter === f ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' ? 'All' : f === 'unreviewed' ? 'Unreviewed' : `${f}★`}
            </button>
          ))}
        </div>
        {stores.length > 0 && (
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger aria-label="Filter by store" className="min-w-[8.5rem] px-3 py-1.5 rounded-xl border text-xs bg-card">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Feedback list */}
      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading feedback...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">No feedback found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(f => (
            <div key={f.id} className={cn('bg-card border rounded-2xl p-5', !f.is_reviewed && 'border-amber-200 bg-amber-50/30')}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{f.customer_name || f.customer_email}</span>
                    {f.order_number && (
                      <Badge variant="outline" className="text-xs">{f.order_number}</Badge>
                    )}
                    {!f.is_reviewed && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">New</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <StarRating rating={f.rating} />
                    <span className="text-xs text-muted-foreground">
                      {f.created_date ? format(new Date(f.created_date), 'MMM d, yyyy h:mm a') : ''}
                    </span>
                  </div>
                </div>
                {!f.is_reviewed && (
                  <Button size="sm" variant="outline" onClick={() => markReviewedMutation.mutate(f.id)} className="flex-shrink-0 text-xs gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed
                  </Button>
                )}
              </div>

              {f.comment && (
                <p className="text-sm text-foreground bg-muted/50 rounded-xl p-3 mb-3">{f.comment}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {f.store_name && (
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5" /> {f.store_name}
                  </span>
                )}
                {f.driver_name && (
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> {f.driver_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}