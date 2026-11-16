import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FileText, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Mirrors the emailed Daily Team Report: the latest generated report date,
// per-store revenue, completed orders and the day's compliance incidents.
export default function DailyReportCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-team-report'],
    queryFn: async () => {
      const reports = await base44.entities.DailyReport.list('-report_date', 100);
      const reportDate = reports[0]?.report_date || null;
      let incidents = [];
      if (reportDate) {
        const start = new Date(`${reportDate}T00:00:00.000Z`);
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
        incidents = await base44.entities.ComplianceIncident.filter({
          $or: [
            { incident_date: { $gte: start.toISOString(), $lt: end.toISOString() } },
            { created_date: { $gte: start.toISOString(), $lt: end.toISOString() } },
          ],
        });
      }
      return { reports, reportDate, incidents };
    },
  });

  if (isLoading) {
    return <div className="mb-6 rounded-2xl border bg-card p-5"><Skeleton className="h-32 w-full" /></div>;
  }

  const { reports, reportDate, incidents } = data || {};
  const rows = (reports || []).filter(r => r.report_date === reportDate);
  const totalRevenue = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.total_orders || 0), 0);
  const totalFees = rows.reduce((s, r) => s + (r.delivery_fees_collected || 0), 0);

  return (
    <section className="mb-6 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Daily Team Report</h2>
        <span className="text-xs text-muted-foreground">
          {reportDate ? `${format(new Date(reportDate), 'EEEE, MMM d, yyyy')} · emailed to the team every morning at 8am CT` : 'Generated each morning at 8am CT'}
        </span>
      </div>
      {!reportDate ? (
        <p className="text-sm text-muted-foreground mt-3">
          No daily report recorded yet. The 8am CT run creates a report for the previous day; it will appear here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Completed orders</p>
              <p className="text-lg font-bold">{totalOrders}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Delivery fees</p>
              <p className="text-lg font-bold">${totalFees.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Incidents</p>
              <p className="text-lg font-bold">{(incidents || []).length}</p>
            </div>
          </div>
          {rows.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-4 font-medium">Store</th>
                    <th className="py-2 px-4 font-medium">Orders</th>
                    <th className="py-2 px-4 font-medium">Avg order</th>
                    <th className="py-2 pl-4 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)).map(r => (
                    <tr key={r.id}>
                      <td className="py-2 pr-4">{r.store_name}</td>
                      <td className="py-2 px-4">{r.total_orders}</td>
                      <td className="py-2 px-4">${(r.avg_order_value || 0).toFixed(2)}</td>
                      <td className="py-2 pl-4 text-right font-semibold">${(r.total_revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Compliance incidents</h3>
            {(incidents || []).length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No compliance incidents were recorded on this date.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {incidents.slice(0, 5).map(i => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{i.incident_type}{i.order_number ? ` · #${i.order_number}` : ''}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.store_name}{i.store_name && i.reason ? ' — ' : ''}{i.reason}</p>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-2 py-1 ${i.is_resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {i.is_resolved ? 'Resolved' : 'Open'}
                    </span>
                  </li>
                ))}
                {incidents.length > 5 && (
                  <li><Link to="/admin/compliance-incidents" className="text-xs text-primary hover:underline font-medium">View all {incidents.length} incidents →</Link></li>
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}