import React from 'react';
import { Wine } from 'lucide-react';
const layouts = {
  split: 'grid md:grid-cols-2 items-center gap-8 py-10 sm:py-16',
  center: 'flex flex-col items-center text-center gap-8 py-12 sm:py-20',
  banner: 'grid md:grid-cols-[1.4fr_1fr] items-center gap-8 p-7 sm:p-12 bg-primary text-primary-foreground my-8 rounded-2xl',
  editorial: 'grid md:grid-cols-[1.25fr_1fr] items-end gap-8 py-10 sm:py-16 border-b',
};
export default function RetailerStorefrontHero({ store, design }) {
  const heading = design.type === 'sans' ? 'font-sans font-bold' : 'font-display';
  return <section className={layouts[design.layout]} aria-label={`${store.name} introduction`}>
    <div className={design.layout === 'center' ? 'max-w-2xl' : ''}>
      <p className="text-xs uppercase tracking-[0.22em] mb-5 opacity-75">{design.eyebrow}</p>
      <h1 className={`${heading} text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight`}>{design.title}</h1>
      <p className="mt-5 text-sm leading-relaxed opacity-75">{store.description || `Explore ${store.name} in ${store.city}, Arkansas. Browse verified products when available.`}</p>
      <a href="#retailer-catalog" className="inline-flex mt-7 border border-current rounded-full px-6 py-3 text-sm font-semibold">Explore the catalog</a>
    </div>
    <div className={`bg-muted text-primary overflow-hidden rounded-2xl w-full ${design.layout === 'center' ? 'max-w-lg aspect-[2/1]' : 'aspect-[4/3]'}`}>
      {store.image_url ? <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" /> : <div className="h-full flex flex-col items-center justify-center gap-5 p-6"><Wine className="w-12 h-12 opacity-50" aria-hidden="true" /><span className={`${heading} text-3xl text-center`}>{store.name}</span><span className="text-xs tracking-[0.2em] uppercase">{store.city}</span></div>}
    </div>
  </section>;
}