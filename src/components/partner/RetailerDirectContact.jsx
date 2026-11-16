import React from 'react';
import { Phone } from 'lucide-react';

export default function RetailerDirectContact() {
  return (
    <div className="rounded-xl border bg-card p-4 text-left">
      <p className="text-sm font-semibold">Contact John Bess directly</p>
      <a href="tel:+18707181521" className="mt-1 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
        <Phone className="h-4 w-4" aria-hidden="true" /> 870-718-1521
      </a>
    </div>
  );
}