import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ShieldCheck, Star, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import useLaunchPartnerPlacement from '@/components/stores/useLaunchPartnerPlacement';
import { retailerDesigns } from '@/components/stores/retailerDesigns';
import '@/components/stores/retailerStorefronts.css';

const tierConfig = {
  premium: {
    border: 'border-amber-400',
    shadow: 'shadow-amber-100',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    badge: 'bg-amber-500 text-white border-0',
    label: '★ Premium',
    icon: Crown,
  },
  featured: {
    border: 'border-primary/40',
    shadow: 'shadow-primary/10',
    bg: 'bg-gradient-to-br from-primary/5 to-secondary/5',
    badge: 'bg-primary text-primary-foreground border-0',
    label: '◆ Featured',
    icon: Star,
  },
  standard: {
    border: 'border-border',
    shadow: '',
    bg: '',
    badge: 'bg-emerald-500 text-white border-0',
    label: null,
    icon: null,
  },
};

export default function StoreCard({ store }) {
  const placementTier = useLaunchPartnerPlacement();
  const design = retailerDesigns[store.id];
  const tier = tierConfig[placementTier(store)] || tierConfig.standard;
  const isLive = store.onboarding_status === 'live'
    && store.stripe_connection_status === 'connected'
    && store.compliance_status === 'compliant';
  const isPreview = store.is_browsable && !isLive;

  return (
    <Link to={`/stores/${store.id}`} aria-label={`View ${store.name} storefront`} className={`block group ${design ? `retailer-storefront retailer-design-${design.theme}` : ''}`}>
      <div className={`bg-card rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${tier.border} ${tier.shadow}`}>
        <div className={`aspect-[16/9] relative overflow-hidden ${tier.bg || 'bg-gradient-to-br from-primary/10 to-secondary/10'}`}>
          {store.image_url ? (
            <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className={`${design?.type === 'sans' ? 'font-sans font-bold' : 'font-display'} text-3xl text-primary`}>
                {store.name}
              </span>
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{design?.eyebrow || store.city}</span>
            </div>
          )}
          <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
            {tier.label && (
              <Badge className={`${tier.badge} text-xs`}>
                {tier.label}
              </Badge>
            )}
            {isPreview ? (
              <Badge className="bg-amber-500 text-white border-0 text-xs">
                {store.onboarding_status === 'pending' ? 'Pending' : 'Coming Soon'}
              </Badge>
            ) : (
              <Badge className="bg-emerald-500 text-white border-0 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Licensed
              </Badge>
            )}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{store.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {store.address}, {store.city}
          </div>
          {(store.operating_hours_start && store.operating_hours_end) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Clock className="w-3.5 h-3.5" />
              {store.operating_hours_start} – {store.operating_hours_end}
            </div>
          )}
          <span className="mt-4 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><span>View storefront</span><span aria-hidden="true">→</span></span>
        </div>
      </div>
    </Link>
  );
}