import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, CreditCard, Database, ClipboardCheck, Send, BadgeCheck, ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { key: 'credentials', icon: CreditCard, title: 'Clover POS credentials entered', detail: 'Merchant ID + API token saved in Store POS Credentials.', action: { to: '/admin/stores', label: 'Enter credentials' } },
  { key: 'connection', icon: ShieldCheck, title: 'Clover connection verified', detail: 'API token authenticates against the Beverage King merchant.', action: { verify: true, label: 'Verify connection' } },
  { key: 'inventory_provided', icon: Database, title: 'Real POS inventory provided', detail: 'Official CSV/Excel export from Beverage King (replaces placeholder catalog).', action: { to: '/admin/inventory-upload', label: 'Import inventory' } },
  { key: 'spot_check', icon: ClipboardCheck, title: 'Inventory spot-checked & promoted', detail: 'Admin reviewed staged items and approved them to the live catalog.', action: { to: '/admin/inventory-sync', label: 'Review staging' } },
  { key: 'test_order', icon: Send, title: 'Controlled test order pushed to Clover', detail: 'One test order pushed to Clover POS from the Active Deliveries page.', action: { to: '/admin/deliveries', label: 'Push test order' } },
  { key: 'onboarding_live', icon: BadgeCheck, title: 'Store onboarding status set to Live', detail: 'Beverage King moved to "live" in the onboarding pipeline.', action: { to: '/admin/retailer-onboarding', label: 'Set onboarding' } },
  { key: 'compliance', icon: ShieldCheck, title: 'Compliance & store profile complete', detail: 'Compliance status compliant, store active, hours + contact email set.', action: { to: '/admin/stores', label: 'Edit store' } },
];

export default function BeverageKingGoLiveChecklist() {
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [connectionOk, setConnectionOk] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bk-go-live'],
    queryFn: async () => {
      const stores = await base44.entities.Store.list('name', 200);
      const bk = stores.find(s => (s.name || '').toLowerCase().includes('beverage king'));
      let creds;
      let staging = [];
      let testOrders = [];
      if (bk) {
        const [c, s] = await Promise.all([
          base44.entities.StorePosCredential.filter({ store_id: bk.id }),
          base44.entities.CloverInventoryStaging.filter({ store_id: bk.id }),
        ]);
        creds = c[0];
        staging = s;
        testOrders = await base44.entities.Order.filter({ store_id: bk.id }, '-created_date', 50);
      }
      return { bk, creds, staging, testOrders };
    },
  });

  const { bk, creds, staging, testOrders } = data || {};

  const credConfigured = !!(creds && creds.is_configured && creds.api_token && creds.merchant_id);
  const inventoryProvided = (staging || []).length > 0;
  const spotChecked = (staging || []).some(s => s.spot_check_status === 'approved');
  const testOrderPushed = (testOrders || []).some(o => o.clover_order_id);
  const onboardingLive = bk?.onboarding_status === 'live';
  const complianceComplete = !!(bk && bk.compliance_status === 'compliant' && bk.is_active && bk.operating_hours_start && bk.email);

  const statuses = {
    credentials: credConfigured,
    connection: connectionOk === true,
    inventory_provided: inventoryProvided,
    spot_check: spotChecked,
    test_order: testOrderPushed,
    onboarding_live: onboardingLive,
    compliance: complianceComplete,
  };

  const handleVerify = async () => {
    if (!bk) return;
    setVerifying(true);
    try {
      const res = await base44.functions.invoke('verifyCloverOrderConnection', { store_id: bk.id });
      const d = res?.data || res;
      if (d.connected && d.merchant_scoped) {
        setConnectionOk(true);
        toast.success('Clover connection verified for Beverage King');
      } else {
        setConnectionOk(false);
        toast.error(d.error || d.reason || 'Connection not verified', { description: d.hint || '' });
      }
      queryClient.invalidateQueries({ queryKey: ['bk-go-live'] });
    } catch (e) {
      setConnectionOk(false);
      toast.error('Verification failed', { description: e.message });
    }
    setVerifying(false);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 mb-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const doneCount = STEPS.filter(s => statuses[s.key]).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Beverage King Go-Live Checklist</h2>
        </div>
        <span className={`text-sm font-bold ${doneCount === STEPS.length ? 'text-emerald-600' : 'text-primary'}`}>
          {doneCount}/{STEPS.length}
        </span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all ${doneCount === STEPS.length ? 'bg-emerald-500' : 'bg-primary'}`}
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const done = statuses[step.key];
          const Icon = step.icon;
          return (
            <div key={step.key} className={`flex items-start gap-3 rounded-xl p-3 border ${done ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-muted/30'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium flex items-center gap-1.5 ${done ? 'text-emerald-800' : ''}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" /> {step.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
              </div>
              <div className="flex-shrink-0">
                {step.action?.verify ? (
                  <Button size="sm" variant={done ? 'ghost' : 'outline'} className="h-8 text-xs" onClick={handleVerify} disabled={verifying || !credConfigured}>
                    {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {done ? 'Re-verify' : step.action.label}
                  </Button>
                ) : step.action ? (
                  <Button asChild size="sm" variant={done ? 'ghost' : 'outline'} className="h-8 text-xs">
                    <Link to={step.action.to}>{done ? 'View' : step.action.label}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!bk && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> No "Beverage King" store found. Create the store record to begin tracking.
        </p>
      )}
    </div>
  );
}