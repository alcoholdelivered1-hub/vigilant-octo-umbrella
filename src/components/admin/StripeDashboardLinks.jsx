import React from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';

const dashboards = [
  {
    label: 'Admin Stripe',
    description: 'Open the main Stripe dashboard',
    href: 'https://dashboard.stripe.com/',
  },
  {
    label: 'Admin Stripe Express',
    description: 'Open the Stripe Express dashboard',
    href: 'https://connect.stripe.com/express_login',
  },
  {
    label: 'Reconnect Beverage King',
    description: 'Authorize the original Stripe Connect account',
    href: '/admin/beverage-king-golive',
  },
];

export default function StripeDashboardLinks() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-8">
      {dashboards.map((dashboard) => (
        <a
          key={dashboard.label}
          href={dashboard.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">{dashboard.label}</h2>
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}