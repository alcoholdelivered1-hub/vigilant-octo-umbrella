import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, ShoppingCart, Link2, ArrowRight, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CARDS = [
  {
    title: 'Store Order Dashboard',
    description: 'Enable tablet sound, receive and confirm orders, fill and seal them, then mark Ready for pickup. Check the assigned driver at handoff.',
    icon: ShoppingCart,
    to: '/store/dashboard',
    label: 'RETAILER OPERATIONS',
  },
  {
    title: 'Payment and Clover Connection Status',
    description: 'Check the current connections and inventory sync. Launch status is based on verification, not this page.',
    icon: Link2,
    to: '/admin/beverage-king-golive',
    label: 'CURRENT SETUP STATUS',
  },
  {
    title: 'Retailer Agreement Reference',
    description: 'For agreement questions and records. Previously signed paperwork should be linked by Alcohol Delivered administration; this is not a request to sign again.',
    icon: FileText,
    to: '/retailer-contract',
    label: 'REFERENCE',
  },
  {
    title: 'Compliance Reference',
    description: 'Review permits and operating requirements when needed. Existing records should be reviewed by Alcohol Delivered administration rather than restarting onboarding.',
    icon: ShieldCheck,
    to: '/abc-compliance',
    label: 'REFERENCE',
  },
];

export default function BKStaffLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground">
            <Wine className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Beverage King Staff</h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
              Use the tablet to handle delivery orders and check connection status. Agreement and compliance links are references, not a new three-step checklist.
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.to} to={card.to} className="block">
                <div className="group rounded-2xl border bg-card p-5 flex items-center gap-4 hover:shadow-md hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{card.label}</span>
                    </div>
                    <h2 className="font-semibold text-sm mt-0.5">{card.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/onboarding">View full onboarding tracker</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}