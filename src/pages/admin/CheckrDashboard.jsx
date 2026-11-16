import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import DriverBackgroundCheckPanel from '@/components/admin/DriverBackgroundCheckPanel';

const WEBHOOK_URL = 'https://alcohol-delivered-0c72f042.base44.app/functions/checkrWebhook';

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  clear: { label: 'Clear', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  manual_clear: { label: 'Verified (Manual)', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  error: { label: 'Error', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
};

export default function CheckrDashboard() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: driversPage, isLoading } = useQuery({
    queryKey: ['checkr-dashboard-drivers'],
    queryFn: () => base44.entities.Driver.filter({}, { sort: '-created_date', limit: 100 }),
  });
  const drivers = driversPage?.items || [];

  const runCheckMutation = useMutation({
    mutationFn: (driverId) => base44.functions.invoke('runDriverBackgroundCheck', { driver_id: driverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkr-dashboard-drivers'] });
      toast.success('Background check submitted to Checkr');
    },
    onError: (err) => toast.error(err.message || 'Checkr check failed'),
  });

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Webhook URL copied to clipboard');
  };

  const stats = {
    total: drivers.length,
    pending: drivers.filter(d => d.background_check_status === 'pending').length,
    clear: drivers.filter(d => d.background_check_status === 'clear').length,
    manual_clear: drivers.filter(d => d.background_check_status === 'manual_clear').length,
    failed: drivers.filter(d => d.background_check_status === 'failed').length,
    error: drivers.filter(d => d.background_check_status === 'error').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Checkr Background Check Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage driver background checks and Checkr API integration</p>
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Checkr Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">CHECKR_API_KEY — Set</Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">CHECKR_WEBHOOK_SECRET — Set</Badge>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Checkr Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 break-all">{WEBHOOK_URL}</code>
              <Button size="sm" variant="outline" onClick={handleCopyWebhook} className="shrink-0">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Register this URL in your <a href="https://dashboard.checkr.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Checkr Dashboard <ExternalLink className="w-3 h-3" /></a> under Webhooks to receive real-time status updates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Drivers', value: stats.total, color: 'text-foreground' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'Clear (Checkr)', value: stats.clear, color: 'text-emerald-600' },
          { label: 'Verified (Manual)', value: stats.manual_clear, color: 'text-blue-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
          { label: 'Error', value: stats.error, color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Driver List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Driver Background Checks</CardTitle>
            <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['checkr-dashboard-drivers'] })}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No drivers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left p-2 font-semibold">Driver</th>
                    <th className="text-left p-2 font-semibold">Email</th>
                    <th className="text-left p-2 font-semibold">Status</th>
                    <th className="text-left p-2 font-semibold">Checkr ID</th>
                    <th className="text-left p-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => {
                    const cfg = STATUS_CONFIG[driver.background_check_status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <tr key={driver.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <p className="font-medium text-sm">{driver.name}</p>
                        </td>
                        <td className="p-2 text-xs">{driver.email}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.color}`}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="p-2 text-xs font-mono">{driver.background_check_id || '—'}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              disabled={runCheckMutation.isPending && runCheckMutation.variables === driver.id}
                              onClick={() => runCheckMutation.mutate(driver.id)}
                            >
                              {runCheckMutation.isPending && runCheckMutation.variables === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3 mr-1" />
                              )}
                              Run Check
                            </Button>
                            <DriverBackgroundCheckPanel driver={driver} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}