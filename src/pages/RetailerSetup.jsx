import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Loader2, AlertCircle, ArrowRight, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PosCredentialsForm from '@/components/retailer/PosCredentialsForm';

const STATUS_ORDER = ['invited', 'contract_sent', 'contract_signed', 'inventory_added', 'live'];

export default function RetailerSetup() {
  const queryClient = useQueryClient();

  const [selectedStoreId, setSelectedStoreId] = useState(null);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';

  const { data: myStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['my-store-onboarding', user?.email],
    queryFn: () => base44.entities.Store.filter({ email: user.email }),
    enabled: !!user?.email && !isAdmin,
  });

  const { data: allStores = [], isLoading: allStoresLoading } = useQuery({
    queryKey: ['admin-onboarding-stores'],
    queryFn: () => base44.entities.Store.list('-updated_date', 200),
    enabled: !!isAdmin,
  });

  const store = isAdmin
    ? allStores.find(s => s.id === selectedStoreId)
    : myStores[0];

  const { data: posCreds = [] } = useQuery({
    queryKey: ['my-pos-credential', store?.id],
    queryFn: () => base44.entities.StorePosCredential.filter({ store_id: store?.id }),
    enabled: !!store?.id,
  });
  const posConfigured = posCreds[0]?.is_configured || false;
  const statusIndex = store ? STATUS_ORDER.indexOf(store.onboarding_status || 'invited') : -1;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Store.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['admin-onboarding-stores'] });
      toast.success('Progress updated!');
    },
    onError: () => toast.error('Failed to update progress'),
  });

  const isLoading = userLoading || (isAdmin ? allStoresLoading : storesLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = [
    {
      id: 'account',
      title: 'Create Your Account',
      description: 'Register and verify your email address.',
      done: true,
      action: null,
    },
    {
      id: 'store',
      title: 'Store Connected',
      description: store
        ? `${store.name} — ${store.city}, ${store.county} County`
        : `Your login email (yourstore@email.com) must match your store's contact email. Contact the administrator if your store isn't showing.`,
      done: !!store,
      action: null,
      alert: !store,
    },
    {
      id: 'contract',
      title: 'Review & Sign Contract',
      description: 'Read the Retailer Partner Agreement and sign it.',
      done: statusIndex >= 2,
      action: store ? {
        label: statusIndex < 2 ? "I've Signed the Agreement" : null,
        link: '/retailer-contract',
        linkLabel: 'Sign Contract',
        onUpdate: () => updateMutation.mutate({ id: store.id, data: { onboarding_status: 'contract_signed' } }),
      } : null,
    },
    {
      id: 'pos',
      title: 'Connect Your POS System',
      description: posConfigured
        ? `POS credentials connected (${posCreds[0]?.pos_system || 'N/A'}).`
        : 'Connect Clover here for inventory and order sync. Stripe Express is a separate payout setup that must also be completed before going live.',
      done: posConfigured,
      scrollTargetId: 'pos-credentials-section',
      action: store && statusIndex >= 2 && !posConfigured ? {
        link: '/store/clover-connect',
        linkLabel: 'Connect Clover',
      } : null,
    },
    {
      id: 'inventory',
      title: 'Add Your Inventory',
      description: 'Add your products, prices, and stock levels in the Store Dashboard.',
      done: statusIndex >= 3,
      action: store && statusIndex >= 2 && statusIndex < 3 ? {
        label: "I've Added My Products",
        link: '/store/dashboard',
        linkLabel: 'Go to Dashboard',
        onUpdate: () => updateMutation.mutate({ id: store.id, data: { onboarding_status: 'inventory_added' } }),
      } : null,
    },
    {
      id: 'live',
      title: 'Go Live',
      description: 'Once live, customers can start ordering from your store immediately.',
      done: statusIndex >= 4,
      action: store && statusIndex >= 3 && statusIndex < 4 ? {
        label: 'Go Live',
        onUpdate: () => updateMutation.mutate({ id: store.id, data: { onboarding_status: 'live' } }),
      } : null,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Retailer Onboarding</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? 'Admin view — select any store to advance its onboarding steps.'
            : 'Welcome, Retailers! Complete these steps to start accepting orders.'}
        </p>
      </div>

      {/* Admin store selector */}
      {isAdmin && (
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">Select a store to onboard</label>
          <select
            value={selectedStoreId || ''}
            onChange={e => setSelectedStoreId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled>Select a store…</option>
            {allStores.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.city ? ` — ${s.city}` : ''} ({s.onboarding_status || 'invited'})
              </option>
            ))}
          </select>
        </div>
      )}

      {store || !isAdmin ? (
        <>
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <CreditCard className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h2 className="font-semibold text-sm">Two connections are required before launch</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Stripe Express handles payouts for your store. Clover handles POS inventory and order sync. Complete both before you go live.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/stripe-express">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      Set up Stripe Express <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Link to="/store/clover-connect">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      Connect Clover <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{completedCount} of {steps.length} complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <StepRow key={step.id} step={step} stepNumber={idx + 1} isPending={updateMutation.isPending} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground py-16">
          Select a store above to manage its onboarding steps.
        </div>
      )}

      {/* POS Credentials Form — shown after contract is signed and POS not yet configured */}
      {store && statusIndex >= 2 && !posConfigured && (
        <div id="pos-credentials-section" className="mt-6 scroll-mt-4">
          <PosCredentialsForm store={store} />
        </div>
      )}

      {/* Go to dashboard when live */}
      {store && statusIndex >= 4 && (
        <div className="mt-8 text-center">
          <Link to="/store/dashboard">
            <Button size="lg" className="gap-2">
              Go to Store Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function StepRow({ step, stepNumber, isPending }) {
  const canScroll = !!step.scrollTargetId && !step.done;
  const handleScroll = canScroll
    ? () => document.getElementById(step.scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    : null;
  return (
    <div
      onClick={handleScroll}
      className={cn(
        'border rounded-xl p-4 transition-colors',
        step.done ? 'border-emerald-200 bg-emerald-50/50' : step.alert ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card',
        canScroll && 'cursor-pointer hover:border-primary/40 hover:bg-accent/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {step.done ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          ) : step.alert ? (
            <AlertCircle className="w-6 h-6 text-amber-500" />
          ) : (
            <Circle className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">STEP {stepNumber}</span>
            {step.done && <span className="text-xs font-semibold text-emerald-600">Done</span>}
          </div>
          <h3 className="font-semibold text-sm mt-0.5">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>

          {step.action && (step.action.link || step.action.label) && !step.done && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {step.action.linkLabel && step.action.link && (
                <Link to={step.action.link}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    {step.action.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
              {step.action.label && (
                <Button size="sm" onClick={step.action.onUpdate} disabled={isPending} className="gap-1.5">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {step.action.label}
                </Button>
              )}
            </div>
          )}
          {step.action && step.action.link && step.done && (
            <div className="mt-3">
              <Link to={step.action.link}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  {step.action.linkLabel || 'View'} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}