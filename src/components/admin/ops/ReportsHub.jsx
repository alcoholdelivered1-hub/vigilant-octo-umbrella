import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Store, Users, XCircle, RefreshCw, CreditCard, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const reports = [
  { label: 'Daily Sales', path: '/admin/sales-reports', icon: BarChart3, desc: 'Revenue & order volume by day' },
  { label: 'Retailer Activity', path: '/admin/stores', icon: Store, desc: 'Store performance & onboarding' },
  { label: 'Driver Activity', path: '/admin/driver-analytics', icon: Users, desc: 'Deliveries, ratings & earnings' },
  { label: 'Failed Orders', path: '/admin/orders', icon: XCircle, desc: 'Cancelled & refused deliveries' },
  { label: 'Inventory Sync History', path: '/admin/clover-stripe-sync', icon: RefreshCw, desc: 'Clover ↔ Stripe sync logs' },
  { label: 'Payout Reports', path: '/admin/store-revenue', icon: CreditCard, desc: 'Store & driver payouts' },
  { label: 'ABC Permit Reports', path: '/admin/abc-permit-reports', icon: FileText, desc: 'Arkansas ABC compliance filings' },
  { label: 'Compliance Incidents', path: '/admin/compliance-incidents', icon: FileText, desc: 'ID refusals & failed deliveries' },
];

export default function ReportsHub() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {reports.map((r) => (
        <Link key={r.label} to={r.path}>
          <Card className="h-full hover:border-primary transition-colors">
            <CardContent className="pt-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-3 font-medium text-sm">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.desc}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}