import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, ShoppingBag, TrendingUp, Clock, Download,
  CheckCircle2, AlertCircle, Loader2, Store, CalendarDays, MessageCircle, Trophy
} from 'lucide-react';
import OrderChat from '@/components/messaging/OrderChat';
import DriverPerformance from '@/components/partner/DriverPerformance';
import { format, subDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

// Platform service fee rate
const PLATFORM_FEE_RATE = 0.25;

function StatCard({ icon: Icon, label, value, sub, color = 'bg-primary/10 text-primary' }) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PayoutRow({ month, revenue, orders, payout, status }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium">{month}</td>
      <td className="px-4 py-3">{orders}</td>
      <td className="px-4 py-3 text-emerald-700 font-semibold">${revenue.toFixed(2)}</td>
      <td className="px-4 py-3 font-bold">${payout.toFixed(2)}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
          status === 'paid'    ? 'bg-emerald-100 text-emerald-700' :
          status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                 'bg-muted text-muted-foreground')}>
          {status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending' : 'Processing'}
        </span>
      </td>
    </tr>
  );
}

function ActiveOrdersChat({ storeId, storeName }) {
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['partner-active-orders', storeId],
    queryFn: () => base44.entities.Order.filter(
      { store_id: storeId },
      '-created_date',
      50
    ),
    select: (data) => data.filter(o => ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)),
    enabled: !!storeId,
    refetchInterval: 15000,
  });

  if (activeOrders.length === 0) return null;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Active Order Chats</h2>
        <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{activeOrders.length}</span>
      </div>
      <div className="divide-y">
        {activeOrders.map(order => (
          <div key={order.id} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">{order.order_number}</span>
                <span className="text-xs text-muted-foreground">· {order.customer_name}</span>
                {order.driver_name && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Driver: {order.driver_name}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">{order.status?.replace(/_/g, ' ')}</span>
            </div>
            <OrderChat
              orderId={order.id}
              orderNumber={order.order_number}
              senderRole="store"
              senderName={storeName || 'Store'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PartnerDashboard() {
  const [selectedStore, setSelectedStore] = useState('');
  const [rangeDays, setRangeDays] = useState(30);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['partner-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 100),
    onSuccess: (data) => {
      if (data.length > 0 && !selectedStore) setSelectedStore(data[0].id);
    }
  });

  // Auto-select first store
  const resolvedStore = selectedStore || (stores[0]?.id ?? '');
  const storeName = stores.find(s => s.id === resolvedStore)?.name ?? '';

  const { data: allOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['partner-orders', resolvedStore],
    queryFn: () => base44.entities.Order.filter({ store_id: resolvedStore, stripe_payment_status: 'paid' }, '-created_date', 500),
    enabled: !!resolvedStore,
  });

  const { data: dailyReports = [] } = useQuery({
    queryKey: ['partner-reports', resolvedStore],
    queryFn: () => base44.entities.DailyReport.filter({ store_id: resolvedStore }, '-report_date', 200),
    enabled: !!resolvedStore,
  });

  // --- Chart data (last N days) ---
  const cutoff = subDays(new Date(), rangeDays);
  const recentOrders = allOrders.filter(o => o.created_date && new Date(o.created_date) >= cutoff);

  const chartData = useMemo(() => {
    const byDate = {};
    recentOrders.forEach(o => {
      const d = format(new Date(o.created_date), 'MMM d');
      if (!byDate[d]) byDate[d] = { date: d, revenue: 0, orders: 0 };
      byDate[d].revenue += o.subtotal || 0;
      byDate[d].orders += 1;
    });
    return Object.values(byDate);
  }, [recentOrders]);

  // --- Monthly payout breakdown ---
  const monthlyData = useMemo(() => {
    const byMonth = {};
    allOrders.forEach(o => {
      if (!o.created_date) return;
      const key = format(new Date(o.created_date), 'yyyy-MM');
      if (!byMonth[key]) byMonth[key] = { key, label: format(new Date(o.created_date), 'MMMM yyyy'), revenue: 0, orders: 0 };
      byMonth[key].revenue += o.subtotal || 0;
      byMonth[key].orders += 1;
    });
    const now = new Date();
    const currentKey = format(now, 'yyyy-MM');
    return Object.values(byMonth)
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(m => ({
        ...m,
        payout: m.revenue, // Retailer keeps 100% of subtotal
        status: m.key === currentKey ? 'pending' : 'paid',
      }));
  }, [allOrders]);

  // --- Summary stats ---
  const totalRevenue = recentOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
  const totalOrders = recentOrders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const pendingPayout = monthlyData.filter(m => m.status === 'pending').reduce((s, m) => s + m.payout, 0);

  // --- Today's summary ---
  const todayStart = startOfDay(new Date());
  const todayOrders = allOrders.filter(o => o.created_date && new Date(o.created_date) >= todayStart);
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.subtotal || 0), 0);

  // --- Top-selling products (from selected period's orders) ---
  const topProducts = useMemo(() => {
    const productMap = {};
    recentOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.product_id || item.product_name;
        if (!productMap[key]) productMap[key] = { name: item.product_name, qty: 0, revenue: 0 };
        productMap[key].qty += item.quantity || 1;
        productMap[key].revenue += item.subtotal || (item.price * (item.quantity || 1)) || 0;
      });
    });
    return Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [recentOrders]);

  // --- PDF Statement Download ---
  const downloadStatement = (month) => {
    const doc = new jsPDF();
    const m = monthlyData.find(m => m.key === month);
    if (!m) return;

    doc.setFontSize(20);
    doc.text('Monthly Statement', 20, 25);
    doc.setFontSize(11);
    doc.text(`Alcohol Delivered, LLC — Partner Financial Statement`, 20, 35);
    doc.setDrawColor(200);
    doc.line(20, 40, 190, 40);

    doc.setFontSize(10);
    doc.text(`Store: ${storeName}`, 20, 50);
    doc.text(`Statement Period: ${m.label}`, 20, 58);
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 20, 66);
    doc.line(20, 72, 190, 72);

    doc.setFontSize(12);
    doc.text('Summary', 20, 82);
    doc.setFontSize(10);
    doc.text(`Total Orders Fulfilled:`, 20, 92);  doc.text(`${m.orders}`, 120, 92);
    doc.text(`Gross Product Revenue:`, 20, 100);  doc.text(`$${m.revenue.toFixed(2)}`, 120, 100);
    doc.text(`Platform Service Fee:`,  20, 108);  doc.text(`$0.00 (charged to customer)`, 120, 108);
    doc.text(`Net Payout to Retailer:`, 20, 116); doc.setFont(undefined, 'bold'); doc.text(`$${m.payout.toFixed(2)}`, 120, 116);
    doc.setFont(undefined, 'normal');

    doc.line(20, 122, 190, 122);
    doc.setFontSize(10);
    doc.text('Payment Status: ' + (m.status === 'paid' ? 'PAID' : 'PENDING'), 20, 132);

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz', 20, 275);
    doc.text('This statement is for internal accounting purposes only.', 20, 281);

    doc.save(`statement-${storeName.replace(/\s+/g, '-')}-${month}.pdf`);
  };

  const isLoading = storesLoading || ordersLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Partner Financial Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time sales, payouts & monthly statements</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stores.length > 1 && (
            <Select value={resolvedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48 h-9">
                <Store className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
        </div>
      ) : !resolvedStore ? (
        <div className="text-center py-20 text-muted-foreground">
          <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No stores found. Contact your administrator.</p>
        </div>
      ) : (
        <>
          {/* Store badge */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl px-4 py-2.5 w-fit">
            <Store className="w-4 h-4" />
            <span className="font-medium text-foreground">{storeName}</span>
            <span>· Partner account</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} label="Revenue (period)" value={`$${totalRevenue.toFixed(2)}`} color="bg-emerald-100 text-emerald-700" />
            <StatCard icon={ShoppingBag} label="Orders Fulfilled" value={totalOrders} color="bg-blue-100 text-blue-700" />
            <StatCard icon={TrendingUp} label="Avg Order Value" value={`$${avgOrder.toFixed(2)}`} color="bg-violet-100 text-violet-700" />
            <StatCard icon={Clock} label="Pending Payout" value={`$${pendingPayout.toFixed(2)}`} sub="Current month" color="bg-amber-100 text-amber-700" />
          </div>

          {/* Today's Summary + Top Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's snapshot */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
              <p className="text-xs font-medium opacity-75 mb-1">Today — {format(new Date(), 'EEEE, MMM d')}</p>
              <p className="text-3xl font-bold">${todayRevenue.toFixed(2)}</p>
              <p className="text-sm opacity-80 mt-1">{todayOrders.length} order{todayOrders.length !== 1 ? 's' : ''} delivered</p>
              {todayOrders.length > 0 && (
                <p className="text-xs opacity-70 mt-1">
                  Avg ${(todayRevenue / todayOrders.length).toFixed(2)} / order
                </p>
              )}
            </div>

            {/* Top-selling products */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Top Products
                <span className="text-xs text-muted-foreground font-normal">last {rangeDays}d</span>
              </h3>
              {topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No product data yet.</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => {
                    const maxQty = topProducts[0].qty;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{p.qty} sold · ${p.revenue.toFixed(0)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(p.qty / maxQty) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="font-semibold text-sm mb-4">Daily Revenue</h2>
            {chartData.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No sales data for this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly Payouts Table */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Monthly Payouts & Statements</h2>
              <span className="text-xs text-muted-foreground">Retailer receives 100% of product subtotal</span>
            </div>
            {monthlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No completed orders yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Month', 'Orders', 'Gross Revenue', 'Your Payout', 'Status', 'Statement'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyData.map(m => (
                      <tr key={m.key} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{m.label}</td>
                        <td className="px-4 py-3">{m.orders}</td>
                        <td className="px-4 py-3 text-emerald-700 font-semibold">${m.revenue.toFixed(2)}</td>
                        <td className="px-4 py-3 font-bold">${m.payout.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
                            m.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {m.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {m.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => downloadStatement(m.key)}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Driver Performance */}
          <DriverPerformance storeId={resolvedStore} />

          {/* Active Orders with Chat */}
          <ActiveOrdersChat storeId={resolvedStore} storeName={storeName} />

          {/* Recent Orders */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="font-semibold text-sm">Recent Paid Orders</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Order #', 'Date', 'Customer', 'Items', 'Subtotal', 'Tip', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.slice(0, 20).map(o => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{o.order_number}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{o.created_date ? format(new Date(o.created_date), 'MMM d, h:mm a') : '—'}</td>
                      <td className="px-4 py-2.5">{o.customer_name}</td>
                      <td className="px-4 py-2.5">{o.items?.length ?? 0}</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700">${(o.subtotal || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        {o.tip > 0
                          ? <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold">💵 ${o.tip.toFixed(2)}</span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                          o.status === 'in_transit' ? 'bg-sky-100 text-sky-700' :
                          o.status === 'pickup_ready' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-amber-100 text-amber-700')}>
                          {o.status ? o.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentOrders.length > 20 && (
                <p className="text-xs text-center text-muted-foreground py-3">Showing 20 of {recentOrders.length} orders</p>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> How Payouts Work</p>
            <p className="text-xs text-blue-700">You receive 100% of your product subtotal. The 25% platform service fee and delivery fee are charged separately to the customer. Payouts for completed months are remitted within the agreed payment schedule in your Retailer Partner Agreement.</p>
          </div>
        </>
      )}
    </div>
  );
}