import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';

const STATUS_STYLES = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  open: 'bg-amber-100 text-amber-700 border-amber-200',
  void: 'bg-red-100 text-red-700 border-red-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  uncollectible: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CloverInvoiceList({ invoices }) {
  if (invoices.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No Clover sales have been synced to Stripe yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Click "Sync Now" to pull recent POS orders.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv) => {
        const amount = (inv.total ?? inv.amount_paid ?? 0) / 100;
        const status = inv.status || 'unknown';
        return (
          <Card key={inv.id} className="p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {inv.description || `Invoice ${inv.number}`}
                  </span>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
                    {status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {inv.clover_order_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      Clover: {inv.clover_order_id.slice(0, 16)}
                    </span>
                  )}
                  {inv.number && (
                    <span className="text-xs text-muted-foreground">
                      #{inv.number}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(inv.created), 'MMM d, yyyy · h:mm a')}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">
                  ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground uppercase">{inv.currency || 'usd'}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}