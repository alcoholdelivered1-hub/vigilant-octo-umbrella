import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, FileText, LayoutDashboard, ArrowRight, ShoppingBag } from 'lucide-react';

const LINKS = [
  { to: '/retailer-onboarding', label: 'Onboarding Portal', desc: 'Step-by-step setup — account, store, contract, POS, inventory, go live', icon: ShoppingBag, primary: true },
  { to: '/retailer-contract', label: 'View Retailer Agreement', desc: 'Read the third-party alcohol delivery contract', icon: FileText },
  { to: '/store/dashboard', label: 'Store Dashboard', desc: 'Manage orders, inventory & payouts (for connected stores)', icon: LayoutDashboard },
];

export default function RetailerOnboardingCard() {
  return (
    <div className="w-full max-w-sm print:hidden">
      <div className="bg-card border-2 border-border rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">Own a liquor store?</h2>
            <p className="text-xs text-muted-foreground">Partner with SipSwift & get onboarding fast.</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {LINKS.map(l => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{l.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{l.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </Link>
            );
          })}
        </div>

        <Button asChild className="w-full gap-2">
          <Link to="/retailer-onboarding">
            <Store className="w-4 h-4" /> Start Retailer Onboarding
          </Link>
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Already onboarded? Sign in with your store email to open your dashboard.
        </p>
      </div>
    </div>
  );
}