import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Truck, ShoppingCart, Server, ShieldCheck, ListChecks, FileBarChart, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

import ExecutiveSummary from '@/components/admin/ops/ExecutiveSummary';
import RetailerManagement from '@/components/admin/ops/RetailerManagement';
import DriverManagement from '@/components/admin/ops/DriverManagement';
import OrdersOverview from '@/components/admin/ops/OrdersOverview';
import TechnologyDashboard from '@/components/admin/ops/TechnologyDashboard';
import ComplianceDashboard from '@/components/admin/ops/ComplianceDashboard';
import LaunchChecklist from '@/components/admin/ops/LaunchChecklist';
import ReportsHub from '@/components/admin/ops/ReportsHub';

const SECTIONS = [
  { key: 'executive', label: 'Executive', icon: LayoutDashboard },
  { key: 'retailers', label: 'Retailers', icon: Users },
  { key: 'drivers', label: 'Drivers', icon: Truck },
  { key: 'orders', label: 'Orders', icon: ShoppingCart },
  { key: 'technology', label: 'Technology', icon: Server },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'checklist', label: 'Launch Checklist', icon: ListChecks },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
];

export default function OperationsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('executive');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await base44.functions.invoke('getOperationsDashboard', {});
      if (res?.error) throw new Error(res.error);
      const d = res?.data;
      if (!d || !d.executive) throw new Error('Unexpected response from dashboard service');
      setData(d);
    } catch (e) {
      setLoadError(e.message);
      toast({ title: 'Failed to load dashboard', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-[60vh] text-center px-4">
        <p className="text-sm text-muted-foreground max-w-sm">
          {loadError || 'Unable to load the operations dashboard.'}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Executive control center · updated {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="gap-1.5">
                <s.icon className="h-4 w-4" /> {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="executive" className="mt-4"><ExecutiveSummary data={data.executive} /></TabsContent>
        <TabsContent value="retailers" className="mt-4"><RetailerManagement retailers={data.retailers} /></TabsContent>
        <TabsContent value="drivers" className="mt-4"><DriverManagement drivers={data.drivers} /></TabsContent>
        <TabsContent value="orders" className="mt-4"><OrdersOverview orders={data.orders} /></TabsContent>
        <TabsContent value="technology" className="mt-4"><TechnologyDashboard tech={data.technology} /></TabsContent>
        <TabsContent value="compliance" className="mt-4"><ComplianceDashboard compliance={data.compliance} /></TabsContent>
        <TabsContent value="checklist" className="mt-4"><LaunchChecklist checklist={data.launchChecklist} /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsHub /></TabsContent>
      </Tabs>
    </div>
  );
}