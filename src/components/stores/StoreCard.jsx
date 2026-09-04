import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, Star, Crown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const tierConfig = {
  premium: {
    border: 'border-amber-400',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    badge: 'bg-amber-500 text-white border-0',
    label: '★ Premium',
    icon: Crown,
  },
  featured: {
    border: 'border-primary/40',
    bg: 'bg-gradient-to-br from-primary/5 to-secondary/5',
    badge: 'bg-primary text-primary-foreground border-0',
    label: '◆ Featured',
    icon: Star,
  },
  standard: {
    border: 'border-border',
    bg: '',
    badge: '',
    label: null,
    icon: null,
  },
};

export default function StoreCard({ store }) {
  const tier = tierConfig[store.placement_tier] || tierConfig.standard;

  return (
    <Link to={`/stores/${store.id}`} className="block group">
      <div className={`bg-card rounded-2xl border ${tier.border} overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
        <div className={`aspect-[16/9] relative overflow-hidden ${tier.bg || 'bg-gradient-to-br from-primary/10 to-secondary/10'}`}>
          {store.image_url ? (
            <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-4xl font-bold text-primary/20">
                {store.name?.[0]}
              </span>
            </div>
          )}
          {tier.label && (
            <div className="absolute top-3 right-3">
              <Badge className={`${tier.badge} text-xs`}>{tier.label}</Badge>
            </div>
          )}
        </div>
        <div className="p-4 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">{store.name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{store.city}</span>
              <ShieldCheck className="w-3 h-3 text-emerald-500 ml-1 shrink-0" />
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
}