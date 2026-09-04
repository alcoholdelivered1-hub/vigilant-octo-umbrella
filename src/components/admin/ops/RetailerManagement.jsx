import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function Status({ ok, label, detail }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{detail}</div>
      </div>
    </div>
  );
}

export default function RetailerManagement({ retailers }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Retailer Management ({retailers.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Retailer</th>
              <th className="py-2 pr-4 font-medium">Onboarding</th>
              <th className="py-2 pr-4 font-medium">Clover</th>
              <th className="py-2 pr-4 font-medium">Stripe Express</th>
              <th className="py-2 pr-4 font-medium">Inventory Sync</th>
              <th className="py-2 pr-4 font-medium">Contract</th>
              <th className="py-2 pr-4 font-medium">Open/Closed</th>
              <th className="py-2 pr-4 font-medium">Last Sync</th>
              <th className="py-2 pr-4 font-medium">Test Order</th>
              <th className="py-2 pr-4 font-medium">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-3 pr-4">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.city}, {r.county}</div>
                </td>
                <td className="py-3 pr-4"><span className="capitalize rounded-md bg-muted px-2 py-1 text-xs">{r.onboarding_status}</span></td>
                <td className="py-3 pr-4">
                  {r.clover_connected
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>
                    : <span className="inline-flex items-center gap-1 text-red-600 text-xs"><XCircle className="h-3.5 w-3.5" /> Not connected</span>}
                </td>
                <td className="py-3 pr-4">
                  {r.stripe_onboarded
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Onboarded</span>
                    : <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertCircle className="h-3.5 w-3.5" /> Pending</span>}
                </td>
                <td className="py-3 pr-4">
                  <span className={cn('capitalize text-xs', r.inventory_sync_status === 'success' ? 'text-emerald-600' : r.inventory_sync_status === 'error' ? 'text-red-600' : 'text-muted-foreground')}>
                    {r.inventory_sync_status}
                  </span>
                </td>
                <td className="py-3 pr-4 capitalize text-xs">{r.contract_status}</td>
                <td className="py-3 pr-4">
                  <span className={cn('inline-flex items-center gap-1 text-xs', r.open_now ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {r.open_now ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {r.open_reason}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{r.last_sync ? new Date(r.last_sync).toLocaleString() : '—'}</td>
                <td className="py-3 pr-4">
                  {r.test_order_status === 'passed'
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Passed</span>
                    : <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><Clock className="h-3.5 w-3.5" /> Pending</span>}
                </td>
                <td className="py-3 pr-4">
                  <span className={cn('capitalize text-xs', r.compliance_status === 'compliant' ? 'text-emerald-600' : 'text-red-600')}>{r.compliance_status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}