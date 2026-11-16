import React from 'react';
import { Beer, Wine, Martini, MapPin, ArrowDown } from 'lucide-react';

export default function LiquorKingHero({ store, isStoreLive }) {
  return (
    <section className="grid lg:grid-cols-2 gap-8 items-center py-10 sm:py-16">
      <div className="max-w-xl">
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.2em] mb-5">White Hall, Arkansas</p>
        <h1 className="font-sans text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">Your local store.<br /><span className="text-primary">A fresh way to shop.</span></h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mt-6">Explore Liquor King’s beer, wine, and spirits in one simple place. {isStoreLive ? 'Delivery ordering is now available.' : 'Delivery ordering is coming soon.'}</p>
        <a href="#liquor-king-catalog" className="inline-flex items-center gap-3 bg-primary text-primary-foreground rounded-full px-6 py-3 mt-7 text-sm font-semibold">Browse the catalog <ArrowDown className="w-4 h-4" /></a>
        <p className="flex items-center gap-2 text-sm text-muted-foreground mt-6"><MapPin className="w-4 h-4 shrink-0" />{store.address}, {store.city}</p>
      </div>
      <div className="bg-muted/60 border rounded-3xl p-7 sm:p-10">
        <div className="flex items-center justify-between mb-8"><span className="font-semibold text-primary">LK / Liquor King</span><span className="text-xs text-muted-foreground">21+ only</span></div>
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Beer', Icon: Beer }, { label: 'Wine', Icon: Wine }, { label: 'Spirits', Icon: Martini }].map(({ label, Icon }) => (
            <div key={label} className="bg-card border rounded-t-full rounded-b-2xl flex flex-col items-center justify-center py-10 sm:py-14 gap-5"><Icon className="w-9 h-9 sm:w-12 sm:h-12 text-primary stroke-[1.25]" /><span className="text-xs sm:text-sm font-medium">{label}</span></div>
          ))}
        </div>
        <div className="mt-8 pt-5 border-t flex justify-between gap-4 text-xs text-muted-foreground"><span>6520 Dollarway Road</span><span>Local store · Online preview</span></div>
      </div>
    </section>
  );
}