import React from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Training is considered "current" for 1 year; license renewal flagged if DOB age near 21 boundary or training > 365 days old
function getTrainingAge(dateStr) {
  if (!dateStr) return null;
  return differenceInDays(new Date(), parseISO(dateStr));
}

function StatusBadge({ days }) {
  if (days === null) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Missing</Badge>;
  if (days > 365) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Expired ({Math.floor(days / 30)}mo ago)</Badge>;
  if (days > 300) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Expiring Soon ({365 - days}d left)</Badge>;
  return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Current</Badge>;
}

export default function ExpiringDocuments({ drivers }) {
  const activeDrivers = drivers.filter(d => d.is_active && d.status !== 'suspended');

  const flagged = activeDrivers.filter(d => {
    const age = getTrainingAge(d.training_completed_date);
    return !d.training_completed || age === null || age > 300;
  });

  const rows = activeDrivers.map(d => {
    const trainingDays = getTrainingAge(d.training_completed_date);
    const hasLicense = !!d.license_number;
    const expiringSoon = !d.training_completed || trainingDays === null || trainingDays > 300;
    return { ...d, trainingDays, hasLicense, expiringSoon };
  }).sort((a, b) => {
    // Flagged first
    if (a.expiringSoon && !b.expiringSoon) return -1;
    if (!a.expiringSoon && b.expiringSoon) return 1;
    return (b.trainingDays || 9999) - (a.trainingDays || 9999);
  });

  return (
    <div className="bg-card rounded-2xl border">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Driver Document Status
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">ABC training validity (annual renewal required)</p>
        </div>
        {flagged.length > 0 && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold">
            {flagged.length} Action Required
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium">Driver</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">License #</th>
              <th className="text-left p-3 font-medium">ABC Training</th>
              <th className="text-left p-3 font-medium">Training Date</th>
              <th className="text-left p-3 font-medium">Training Age</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No active drivers</td></tr>
            )}
            {rows.map(d => (
              <tr key={d.id} className={d.expiringSoon ? 'bg-amber-50/40' : ''}>
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-2">
                    {d.expiringSoon && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    {d.name}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.email}</p>
                </td>
                <td className="p-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    d.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                    d.status === 'on_delivery' ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-muted-foreground'
                  }`}>{d.status}</span>
                </td>
                <td className="p-3">
                  {d.hasLicense
                    ? <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />{d.license_number}</span>
                    : <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3.5 h-3.5" />Missing</span>}
                </td>
                <td className="p-3">
                  {d.training_completed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                </td>
                <td className="p-3 text-muted-foreground text-xs">{d.training_completed_date || '—'}</td>
                <td className="p-3"><StatusBadge days={d.trainingDays} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}