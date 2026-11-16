import React from 'react';
import { cn } from '@/lib/utils';

const URGENCY_STYLES = {
  current: 'bg-green-50 border-green-200 text-green-700',
  soon: 'bg-blue-50 border-blue-200 text-blue-700',
  urgent: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  critical: 'bg-orange-50 border-orange-200 text-orange-700',
  expired: 'bg-red-50 border-red-200 text-red-700',
  unknown: 'bg-gray-50 border-gray-200 text-gray-500',
};

const URGENCY_LABELS = {
  current: 'Current',
  soon: 'Renew soon',
  urgent: 'Renew urgent',
  critical: 'Critical',
  expired: 'Expired',
  unknown: 'No date',
};

export default function PermitStatusBadge({ urgency, days, label }) {
  const style = URGENCY_STYLES[urgency] || URGENCY_STYLES.unknown;
  let text = label || URGENCY_LABELS[urgency] || 'Unknown';
  if (days !== null && days !== undefined) {
    if (days < 0) text = `Expired ${Math.abs(days)}d ago`;
    else if (days === 0) text = 'Expires today';
    else text = `${days}d left`;
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', style)}>
      {text}
    </span>
  );
}