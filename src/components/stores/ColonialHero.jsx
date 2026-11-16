import React from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

export default function ColonialHero({ store }) {
  return (
    <section className="grid lg:grid-cols-[1fr_1.05fr] bg-primary text-primary-foreground overflow-hidden">
      <div className="px-6 py-12 sm:px-10 lg:p-14 flex flex-col justify-center">
        <p className="text-xs uppercase tracking-[0.25em] opacity-75 mb-7">Little Rock, Arkansas · Wines & spirits</p>
        <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl leading-[1.08] tracking-tight">A good bottle.<br /><span className="italic">A great moment.</span></h1>
        <div className="w-12 border-t border-primary-foreground/40 my-7" />
        <p className="text-sm sm:text-base leading-relaxed opacity-80 max-w-sm">Discover the world of wine and spirits with {store.name}. For the everyday table. For the occasions worth remembering.</p>
        <div className="flex flex-wrap items-center gap-5 mt-9">
          <a href="#colonial-collection" className="inline-flex items-center gap-3 px-6 py-3.5 bg-background text-primary text-sm font-medium">Explore the collection <ArrowDown className="w-4 h-4" /></a>
          {store.phone && <a href={`tel:${store.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 text-sm border-b border-primary-foreground/40 pb-1">Speak with the store <ArrowUpRight className="w-4 h-4" /></a>}
        </div>
        <p className="mt-12 text-[10px] tracking-[0.2em] uppercase opacity-60">Colonial Wines & Spirits · Alcohol Delivered</p>
      </div>
      <div className="relative min-h-[340px] lg:min-h-[530px]">
        <img src="https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/a39a4b287_generated_image.png" alt="Wine bottle and red wine glass in warm cellar light; editorial illustration" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
        <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8 border border-primary-foreground/40 bg-primary/80 backdrop-blur-sm px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-primary-foreground">
          <span className="font-display italic text-xl">Something worth savoring.</span><span className="text-[10px] uppercase tracking-[0.2em]">The Colonial collection</span>
        </div>
      </div>
    </section>
  );
}