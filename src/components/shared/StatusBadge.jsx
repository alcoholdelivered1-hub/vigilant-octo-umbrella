import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  preparing: 'bg-purple-100 text-purple-800 border-purple-200',
  pickup_ready: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  in_transit: 'bg-sky-100 text-sky-800 border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  refused: 'bg-red-100 text-red-800 border-red-200',
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  on_delivery: 'bg-sky-100 text-sky-800 border-sky-200',
  offline: 'bg-gray-100 text-gray-800 border-gray-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  pickup_ready: 'Ready for Pickup',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refused: 'Refused',
  available: 'Available',
  on_delivery: 'On Delivery',
  offline: 'Offline',
  suspended: 'Suspended',
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold border', statusStyles[status] || 'bg-muted text-muted-foreground')}>
      {statusLabels[status] || status}
    </Badge>
  );
}