import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, CreditCard, Loader2, AlertCircle } from 'lucide-react';

// Retailer-facing readiness only: deliberately no activate or charge button.
// Clover POS authorization does NOT authorize Ecommerce payments.
export default function CloverOnlinePaymentsPanel({ storeId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['clover-online-payments', storeId],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('cloverPaymentReadiness', { store_id: storeId });
      return data;
    },
    enabled: Boolean(storeId),
    retry: false,
  });

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4" aria-label="Clover online payments pilot">
      <div className="flex items-start gap-3">
        <CreditCard className="w-5 h-5 mt-0.5 text-primary shrink-0" />
        <div>
          <h3 className="font-semibold text-sm">Clover Online Payments — Pilot Setup</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Alcohol Delivered is preparing a secure Clover Hosted Checkout option for retailers such as Beverage King.
            The retailer remains seller of record. This does not replace your existing Clover register or change Stripe payments.
          </p>
        </div>
      </div>
      {isLoading && <p className="flex gap-2 items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking setup…</p>}
      {isError && <p className="flex gap-2 items-center text-sm text-destructive"><AlertCircle className="w-4 h-4" /> The payment setup checklist could not be loaded.</p>}
      {data && (
        <>
          <p className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm" role="status">
            Setup only — Clover customer payments are not enabled. A completed POS connection by itself is not sufficient.
          </p>
          <ul className="space-y-2" aria-label="Clover setup requirements">
            {data.checks?.map(check => (
              <li key={check.key} className="flex items-start gap-2 text-sm">
                {check.complete
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
        <p className="font-medium">Commission and driver pay</p>
        <p className="text-muted-foreground">
          Proposed settlement: Alcohol Delivered receives 25% of the merchandise subtotal from the retailer,
          not an extra 25% customer surcharge. Driver pay comes from the platform share. The fee collection,
          taxes, processing charges and driver payouts require an approved agreement and verified reconciliation.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        No live card payments, order release, or payment-status changes will occur from this setup screen.
      </p>
    </section>
  );
}