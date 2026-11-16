import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

export default function StoreExpiryRow({ document }) {
  const { store, label, number, expiration, days } = document;
  const urgent = days <= 7;
  return <li className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${urgent ? 'border-destructive/40 bg-destructive/5' : 'border-primary/20 bg-primary/5'}`}>
    <div className="min-w-0">
      <Link to={`/onboarding?store_id=${encodeURIComponent(store.id)}`} className="font-semibold text-primary underline underline-offset-4">{store.name}</Link>
      <p className="text-sm mt-1">{label}{number ? ` · ${number}` : ''}</p>
      <p className="text-sm text-muted-foreground">Expires {format(parseISO(expiration), 'MMM d, yyyy')}</p>
    </div>
    <span className={`flex items-center gap-2 text-sm font-semibold ${urgent ? 'text-destructive' : 'text-primary'}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />{days === 0 ? 'Expires today' : `${days} ${days === 1 ? 'day' : 'days'} remaining`}{urgent && ' · Urgent'}
    </span>
  </li>;
}