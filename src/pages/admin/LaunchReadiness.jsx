import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Store, Truck, ShieldCheck, CreditCard, Mail, Rocket, Users, MapPin, CheckCircle2 } from 'lucide-react';
import ReadinessBlocker from '@/components/admin/ReadinessBlocker';
import BeverageKingGoLiveChecklist from '@/components/admin/BeverageKingGoLiveChecklist';

const LAUNCH_DATE = new Date('2026-07-16T00:00:00');

export default function LaunchReadiness() {
  const { data, isLoading } = useQuery({
    queryKey: ['launch-readiness'],
    queryFn: async () => {
      const [stores, drivers, zones, orders, earlySignups] = await Promise.all([
        base44.entities.Store.list('-created_date', 200),
        base44.entities.Driver.list('-created_date', 200),
        base44.entities.DeliveryZone.list('-created_date', 100),
        base44.entities.Order.list('-created_date', 200),
        base44.entities.EarlySignup.list('-created_date', 500),
      ]);
      return { stores, drivers, zones, orders, earlySignups };
    },
  });

  const stores = data?.stores || [];
  const drivers = data?.drivers || [];
  const orders = data?.orders || [];
  const zones = data?.zones || [];
  const signups = data?.earlySignups || [];

  const daysUntil = Math.ceil((LAUNCH_DATE - new Date()) / (1000 * 60 * 60 * 24));

  const metrics = {
    storesLive: stores.filter(s => s.onboarding_status === 'live').length,
    storesWithEmail: stores.filter(s => s.is_active && s.email).length,
    activeStores: stores.filter(s => s.is_active).length,
    driversBGCleared: drivers.filter(d => d.is_active && d.background_check_status === 'clear').length,
    driversTrained: drivers.filter(d => d.is_active && d.training_completed).length,
    driversAvailable: drivers.filter(d => d.is_active && d.status === 'available').length,
    paidOrders: orders.filter(o => o.stripe_payment_status === 'paid').length,
    deliveredOrders: orders.filter(o => o.status === 'delivered').length,
    activeWetZones: zones.filter(z => z.is_active && z.is_wet).length,
    signups: signups.length,
  };

  const blockers = [
    {
      title: 'Stores Live',
      current: metrics.storesLive,
      target: 5,
      description: 'Stores at "live" onboarding status with contracts signed and inventory loaded. Minimum viable soft launch.',
      linkTo: '/admin/retailer-onboarding',
      linkLabel: 'Onboard stores',
      icon: Store,
    },
    {
      title: 'Stores with Email',
      current: metrics.storesWithEmail,
      target: metrics.activeStores,
      description: 'Active stores with a contact email on file. Without this, stores receive no order or arrival notifications.',
      linkTo: '/admin/stores',
      linkLabel: 'Add store emails',
      icon: Mail,
    },
    {
      title: 'Drivers BG Cleared',
      current: metrics.driversBGCleared,
      target: 2,
      description: 'Active drivers with cleared background checks. Legally required for alcohol delivery in Arkansas.',
      linkTo: '/admin/drivers',
      linkLabel: 'Run background checks',
      icon: ShieldCheck,
    },
    {
      title: 'Drivers Trained',
      current: metrics.driversTrained,
      target: 2,
      description: 'Active drivers who completed alcohol safety training and ABC compliance modules.',
      linkTo: '/admin/drivers',
      linkLabel: 'View driver training',
      icon: Users,
    },
    {
      title: 'Drivers Available Now',
      current: metrics.driversAvailable,
      target: 1,
      description: 'Drivers currently marked available to accept dispatches right now.',
      linkTo: '/admin/drivers',
      linkLabel: 'Check driver status',
      icon: Truck,
    },
    {
      title: 'Paid Orders (E2E)',
      current: metrics.paidOrders,
      target: 1,
      description: 'At least one real Stripe-paid order run through the full dispatch → pickup → ID verify → delivery flow.',
      linkTo: '/admin/orders',
      linkLabel: 'View orders',
      icon: CreditCard,
    },
  ];

  const readinessPct = Math.round(
    blockers.reduce((sum, b) => sum + Math.min(1, b.current / b.target), 0) / blockers.length * 100
  );

  const allClear = blockers.every(b => b.current >= b.target);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header + countdown */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Rocket className="w-7 h-7 text-primary" /> Launch Readiness
          </h1>
          <p className="text-muted-foreground mt-1">Live status of your July 16 go-live blockers</p>
        </div>
        <div className={`text-center rounded-2xl px-6 py-3 border ${daysUntil <= 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-3xl font-bold ${daysUntil <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
            {daysUntil > 0 ? daysUntil : 'Today'}
          </p>
          <p className="text-xs text-muted-foreground font-medium">{daysUntil > 0 ? 'days until launch' : 'launch day'}</p>
        </div>
      </div>

      {/* Overall readiness bar */}
      <div className={`rounded-2xl p-5 border mb-8 ${allClear ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {allClear
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <Rocket className="w-5 h-5 text-primary" />}
            <span className="font-semibold">Overall Readiness</span>
          </div>
          <span className={`text-2xl font-bold ${allClear ? 'text-emerald-600' : 'text-primary'}`}>{readinessPct}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${allClear ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${readinessPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {allClear
            ? 'All blockers cleared — you are go for launch.'
            : `${blockers.filter(b => b.current < b.target).length} of ${blockers.length} blockers still need attention before July 16.`}
        </p>
      </div>

      {/* Blocker grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {blockers.map(b => (
          <ReadinessBlocker key={b.title} {...b} />
        ))}
      </div>

      <BeverageKingGoLiveChecklist />

      {/* What's already good */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        <h2 className="font-semibold text-sm text-emerald-800 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Platform Ready
        </h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-700"><strong>{metrics.activeWetZones}</strong> active delivery zones</span>
          </div>
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-700"><strong>{metrics.activeStores}</strong> active stores loaded</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-700"><strong>{metrics.signups}</strong> early signups captured</span>
          </div>
        </div>
      </div>
    </div>
  );
}