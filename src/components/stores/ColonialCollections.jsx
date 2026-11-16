import React from 'react';
import { Wine, Martini, Beer, ArrowUpRight } from 'lucide-react';

const collections = [
  { key: 'wine', number: '01', title: 'The wine collection', description: 'From a quiet evening to a celebratory toast.', label: 'Explore wines', icon: Wine },
  { key: 'spirits', number: '02', title: 'The spirit of the occasion', description: 'Find the foundation for your next perfect pour.', label: 'Explore spirits', icon: Martini },
  { key: 'beer', number: '03', title: 'A little more laid-back', description: 'For gathering around and slowing down.', label: 'Explore beers', icon: Beer },
];
export default function ColonialCollections({ activeCategory, onCategoryChange }) {
  return (
    <section id="colonial-collection" className="px-6 sm:px-10 lg:px-14 py-12 sm:py-16 scroll-mt-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div><p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-3">Find your next pour</p><h2 className="font-display text-3xl sm:text-4xl">A world of possibility.</h2></div>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">Wine, spirits, and a reason to bring people together.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {collections.map(({ key, number, title, description, label, icon: Icon }) => (
          <button key={key} type="button" aria-pressed={activeCategory === key} onClick={() => { onCategoryChange(key); document.getElementById('colonial-catalog')?.scrollIntoView({ block: 'start' }); }} className={`text-left border p-7 flex flex-col min-h-64 ${activeCategory === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-foreground border-border hover:border-primary'}`}>
            <div className="flex items-center justify-between mb-8"><span className="font-display italic text-sm opacity-60">{number}</span><Icon strokeWidth={1} className="w-9 h-9 opacity-70" /></div>
            <h3 className="font-display text-2xl mb-3">{title}</h3><p className="text-sm opacity-70 leading-relaxed mb-7">{description}</p>
            <span className="mt-auto flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em]">{label}<ArrowUpRight className="w-4 h-4" /></span>
          </button>
        ))}
      </div>
    </section>
  );
}