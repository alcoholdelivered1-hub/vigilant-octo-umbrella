import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search } from 'lucide-react';

const STATUS_COLORS = {
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-700',
  refused: 'bg-red-100 text-red-700',
  in_transit: 'bg-sky-100 text-sky-800',
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  pickup_ready: 'bg-indigo-100 text-indigo-800',
};

const STATUS_LABELS = {
  delivered: 'Delivered', cancelled: 'Cancelled', refused: 'Refused',
  in_transit: 'In Transit', pending: 'Pending', confirmed: 'Confirmed',
  preparing: 'Preparing', pickup_ready: 'Pickup Ready',
};

export default function StoreOrderHistory({ storeId, storeName }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['store-order-history', storeId],
    queryFn: () => base44.entities.Order.filter({ store_id: storeId }, '-created_date', 200),
    enabled: !!storeId,
  });

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || o.order_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total || 0), 0);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{orders.length}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{deliveredCount}</p>
          <p className="text-xs text-muted-foreground">Delivered</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">${totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Revenue</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order # or customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Order list */}
      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground text-sm">Loading orders…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No orders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <div key={order.id} className="bg-card border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{order.order_number}</span>
                  <Badge className={`text-xs border-0 ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.customer_name} · {order.created_date ? format(new Date(order.created_date), 'MMM d, yyyy h:mm a') : '—'}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{order.delivery_address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold">${order.total?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{order.items?.length || 0} items</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}