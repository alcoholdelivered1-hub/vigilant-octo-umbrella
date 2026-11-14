import React from 'react';
import { CheckCircle2, XCircle, Server, CreditCard, Bell, MapPin, ShieldCheck, Database, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function TechnologyDashboard({ tech }) {
  const items = [
    { key: 'clover', label: 'Clover POS', icon: Server },
    { key: 'stripe', label: 'Stripe Payments', icon: CreditCard },
    { key: 'firebase', label: 'Firebase', icon: Database },
    { key: 'push', label: 'Push Notifications', icon: Bell },
    { key: 'maps', label: 'Maps / GPS', icon: MapPin },
    { key: 'security', label: 'Security Monitoring', icon: ShieldCheck },
    { key: 'api', label: 'API Health', icon: Wifi },
    { key: 'database', label: 'Database Health', icon: Database },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => {
        const s = tech[it.key];
        return (
          <Card key={it.key}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <it.icon className="h-5 w-5 text-primary" />
                </div>
                {s.ok
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : <XCircle className="h-5 w-5 text-red-500" />}
              </div>
              <div className="mt-3 font-medium text-sm">{it.label}</div>
              <div className={cn('text-xs', s.ok ? 'text-emerald-600' : 'text-red-600')}>{s.detail}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}