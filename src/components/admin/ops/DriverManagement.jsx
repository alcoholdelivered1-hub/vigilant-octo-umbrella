import React from 'react';
import { CheckCircle2, XCircle, MapPin, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function bgColor(s) {
  if (s === 'clear') return 'text-emerald-600';
  if (s === 'failed' || s === 'error') return 'text-red-600';
  return 'text-amber-600';
}

export default function DriverManagement({ drivers }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Driver Management ({drivers.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Driver</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">GPS</th>
              <th className="py-2 pr-4 font-medium">Background Check</th>
              <th className="py-2 pr-4 font-medium">ID Verified</th>
              <th className="py-2 pr-4 font-medium">Vehicle</th>
              <th className="py-2 pr-4 font-medium">Deliveries</th>
              <th className="py-2 pr-4 font-medium">Vetting</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-3 pr-4">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.email}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={cn('inline-flex items-center gap-1 text-xs',
                    d.online ? 'text-emerald-600' : 'text-muted-foreground')}>
                    <span className={cn('h-2 w-2 rounded-full', d.online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    {d.online ? 'Online' : 'Offline'}
                  </span>
                  {!d.is_active && <div className="text-[10px] text-red-500">inactive</div>}
                </td>
                <td className="py-3 pr-4 text-xs">
                  {d.gps
                    ? <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {d.gps.lat.toFixed(4)}, {d.gps.lng.toFixed(4)}</span>
                    : <span className="text-muted-foreground/60">No GPS</span>}
                </td>
                <td className="py-3 pr-4">
                  <span className={cn('capitalize text-xs', bgColor(d.background_check_status))}>{d.background_check_status}</span>
                </td>
                <td className="py-3 pr-4">
                  {d.id_verified
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
                    : <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><XCircle className="h-3.5 w-3.5" /> Pending</span>}
                </td>
                <td className="py-3 pr-4 text-xs">{d.vehicle_info || '—'}</td>
                <td className="py-3 pr-4 text-xs">{d.total_deliveries}</td>
                <td className="py-3 pr-4">
                  {d.vetting_flagged
                    ? <span className="inline-flex items-center gap-1 text-red-600 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Flagged</span>
                    : <span className="text-xs text-muted-foreground">Clear</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}