import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Truck, DollarSign, ShieldCheck, Users, AlertTriangle, Map, Store, TrendingUp, Megaphone } from 'lucide-react';
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
import PosSystemSummary from '@/components/admin/PosSystemSummary';
import StripeOverview from '@/components/admin/StripeOverview';
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
      </div>

      <div className="mb-8">
        <GoLiveCountdown />
      </div>

      {/* Customer Signup Campaign Banner */}
      <Link to="/admin/customer-ads" className="block mb-6">
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-2xl p-5 flex items-center justify-between hover:opacity-95 transition-opacity">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="font-bold text-lg">Customer Signup Ad Campaign</p>
              <p className="text-sm text-primary-foreground/80">Ready-to-use ad copy & creatives for Facebook, Instagram, TikTok, X, Google & more — plus one-click email blast</p>
            </div>
          </div>
          <span className="text-sm font-semibold hidden sm:block">Launch Campaign →</span>
        </div>
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Active Orders" value={activeOrders} icon={ShoppingCart} />
        <StatCard title="Delivered Today" value={deliveredToday} icon={Truck} />
        <StatCard title="Active Drivers" value={activeDrivers} icon={Users} />
      </div>

      {/* Backend Setup Checklist */}
      <div className="mb-6">
        <BackendChecklist />
      </div>

      {/* Stripe Payments Overview */}
      <div className="mb-6">
        <StripeOverview />
      </div>

      {/* Smart Dispatch Panel */}
      <div className="mb-6">
        <SmartDispatchPanel />
      </div>

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

      {/* Service Area & Zone Compliance Map */}
      <div className="mb-6 bg-card rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" /> Service Area — Stores &amp; Delivery Zones
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">All deliveries must remain within Jefferson County wet zones</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/zones" className="text-xs text-primary hover:underline font-medium">Manage zones →</Link>
          </div>
        </div>
        <ServiceAreaMap height="400px" />
      </div>

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

          <PosSystemSummary />

          <div className="bg-card rounded-2xl border p-5">
            <h2 className="font-semibold mb-4">Driver Status</h2>
            <div className="space-y-2">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drivers registered</p>
              ) : (
                drivers.slice(0, 5).map(driver => (
                <div key={driver.id} className="flex items-center justify-between gap-2">
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
        </div>
      </div>
    </div>
  );
}