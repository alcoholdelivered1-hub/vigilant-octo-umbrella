import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Truck, DollarSign, ShieldCheck, Users, AlertTriangle, Map, Store, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarRating from '@/components/shared/StarRating';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import LiveDriverMap from '@/components/admin/LiveDriverMap';
import ServiceAreaMap from '@/components/admin/ServiceAreaMap';
import SmartDispatchPanel from '@/components/admin/SmartDispatchPanel';
import BackendChecklist from '@/components/admin/BackendChecklist';
import GoLiveCountdown from '@/components/admin/GoLiveCountdown';
import ABCExportButton from '@/components/admin/ABCExportButton';
import StripeDashboardLinks from '@/components/admin/StripeDashboardLinks';
import LicenseAlerts from '@/components/admin/LicenseAlerts';
import StoreExpiryTracker from '@/components/admin/StoreExpiryTracker';
import SundaySalesPanel from '@/components/admin/SundaySalesPanel';
import DailyReportCard from '@/components/admin/DailyReportCard';
import RoleSectionDivider from '@/components/admin/RoleSectionDivider';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 100),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const totalRevenue = orders.reduce((sum, o) => o.status !== 'cancelled' ? sum + (o.total || 0) : sum, 0);
  const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'refused'].includes(o.status)).length;
  const deliveredToday = orders.filter(o => {
    if (o.status !== 'delivered') return false;
    const d = new Date(o.created_date);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;
  const activeDrivers = drivers.filter(d => d.status === 'available' || d.status === 'on_delivery').length;

  const recentOrders = orders.slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor operations, compliance, and performance</p>
        <Link to="/admin/store-launch-progress" className="inline-flex mt-4 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold">Review retailer launch readiness</Link>
      </div>

      <div className="mb-8">
        <GoLiveCountdown />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Order Value" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Active Orders" value={activeOrders} icon={ShoppingCart} />
        <StatCard title="Delivered Today" value={deliveredToday} icon={Truck} />
        <StatCard title="Active Drivers" value={activeDrivers} icon={Users} />
      </div>

      <DailyReportCard />
      <StoreExpiryTracker />
      <LicenseAlerts />
      <section className="mb-8 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> ABC Permit Status</h2>
          <Link to="/admin/abc-permits" className="text-sm text-primary underline">View full dashboard</Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Track all retailer ABC licenses and third-party delivery permits in one place. Annual renewal deadline is June 30.</p>
      </section>
      <SundaySalesPanel />
      <StripeDashboardLinks />

      <details className="mb-6 rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer font-semibold">Technical setup and diagnostics</summary><BackendChecklist /></details>

      {/* Smart Dispatch Panel */}
      <div className="mb-6">
        <SmartDispatchPanel />
      </div>

      <RoleSectionDivider role="drivers" />

      {/* Live Map Preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Map className="w-4 h-4 text-primary" /> Live Driver Map</h2>
          <div className="flex items-center gap-3">
            <Link to="/admin/store-performance" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              <Store className="w-3 h-3" /> Store Performance →
            </Link>
            <Link to="/admin/store-comparison" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Store Comparison →
            </Link>
            <Link to="/admin/live-map" className="text-xs text-primary hover:underline font-medium">Open full map →</Link>
            <Link to="/admin/compliance-incidents" className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Incident Log →
            </Link>
          </div>
        </div>
        <LiveDriverMap height="300px" />
      </div>

      {/* Driver Status (moved into Drivers zone) */}
      <div className="mb-6 bg-card rounded-2xl border p-5">
        <h2 className="font-semibold mb-4">Driver Status</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drivers registered</p>
          ) : (
            drivers.slice(0, 6).map(driver => (
              <div key={driver.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{driver.name}</p>
                  <StarRating value={driver.avg_rating || 0} size="sm" showValue />
                </div>
                <StatusBadge status={driver.status} />
              </div>
            ))
          )}
        </div>
      </div>

      <RoleSectionDivider role="retailers" />

      {/* Service Area & Zone Compliance Map */}
      <div className="mb-6 bg-card rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" /> Service Area — Stores &amp; Delivery Zones
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Delivery eligibility follows the configured wet delivery zones.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/zones" className="text-xs text-primary hover:underline font-medium">Manage zones →</Link>
          </div>
        </div>
        <ServiceAreaMap height="400px" />
      </div>

      <RoleSectionDivider role="customers" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Recent Orders</h2>
          </div>
          <div className="divide-y">
            {ordersLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>
              ))
            ) : recentOrders.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">No orders yet</p>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.customer_name} · {order.store_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">${order.total?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.created_date ? format(new Date(order.created_date), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Compliance Overview</h2>
              <ABCExportButton />
            </div>
            <div className="space-y-3">
              {[
                { label: 'ID Verified Orders', value: orders.filter(o => o.id_verified_at_checkout).length, icon: ShieldCheck, color: 'text-emerald-600' },
                { label: 'Delivery Verified', value: orders.filter(o => o.id_verified_at_delivery).length, icon: ShieldCheck, color: 'text-blue-600' },
                { label: 'Refused Deliveries', value: orders.filter(o => o.status === 'refused').length, icon: AlertTriangle, color: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}