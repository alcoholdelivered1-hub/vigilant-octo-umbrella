import React from 'react';
import { MapPin, Phone, Clock } from 'lucide-react';
export default function RetailerStorefrontFooter({ store }) {
  return <footer id="retailer-visit" className="border-t py-10 grid sm:grid-cols-2 gap-8 text-sm scroll-mt-6">
    <div><h2 className="font-display text-2xl mb-4">Visit {store.name}</h2><p className="flex gap-2 text-muted-foreground"><MapPin className="w-4 h-4 shrink-0 mt-0.5" />{store.address}, {store.city}, {store.state || 'AR'} {store.zip_code}</p>{store.phone && <a href={`tel:${store.phone.replace(/[^+\d]/g, '')}`} className="flex gap-2 mt-3"><Phone className="w-4 h-4" />{store.phone}</a>}</div>
    <div className="sm:justify-self-end space-y-3">{store.operating_hours_start && <p className="flex gap-2"><Clock className="w-4 h-4" />Hours: {store.operating_hours_start} – {store.operating_hours_end}</p>}{store.sunday_closed && <p className="text-muted-foreground">Closed Sundays</p>}<p className="text-xs text-muted-foreground">License on file: {store.license_number || 'Pending verification'}</p><p className="text-xs text-muted-foreground">Delivery by Alcohol Delivered · Adults 21+ only</p></div>
  </footer>;
}