import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Zap } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import OrderChat from '@/components/messaging/OrderChat';

const statuses = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered', 'cancelled', 'refused'];

export default function AdminOrders() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders-list'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
    refetchInterval: 10000, // live refresh during soft opening
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] }),
  });

  const filtered = orders.filter(o => {
    const statusMatch = filter === 'all' || o.status === filter;
    const searchMatch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const allSelected = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all([...selectedIds].map(id => base44.entities.Order.update(id, { status: bulkStatus })));
      queryClient.invalidateQueries({ queryKey: ['admin-orders-list'] });
      toast.success(`Updated ${selectedIds.size} orders to "${bulkStatus.replace(/_/g, ' ')}"`);
      setSelectedIds(new Set());
      setBulkStatus('');
    } catch {
      toast.error('Some updates failed. Please try again.');
    }
    setBulkUpdating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold mb-6">Manage Orders</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-4">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">{selectedIds.size} order{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="flex-1" />
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Set status..." />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={applyBulkUpdate}
            disabled={!bulkStatus || bulkUpdating}
            className="h-8 px-4 text-xs"
          >
            {bulkUpdating ? 'Updating...' : 'Apply'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 px-3 text-xs text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      )}

      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-3 font-medium">Order</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Store</th>
                <th className="text-left p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">ID Verified</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Update</th>
                <th className="text-left p-3 font-medium">Chat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No orders found</td></tr>
              ) : (
                filtered.map(order => (
                  <tr key={order.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(order.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleOne(order.id)}
                      />
                    </td>
                    <td className="p-3 font-medium">{order.order_number}</td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3">{order.store_name}</td>
                    <td className="p-3 font-semibold">${order.total?.toFixed(2)}</td>
                    <td className="p-3"><StatusBadge status={order.status} /></td>
                    <td className="p-3">
                      <span className={order.id_verified_at_checkout ? 'text-emerald-600' : 'text-red-500'}>
                        {order.id_verified_at_checkout ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {order.created_date ? format(new Date(order.created_date), 'MMM d') : ''}
                    </td>
                    <td className="p-3">
                      <Select
                        value={order.status}
                        onValueChange={(val) => updateMutation.mutate({ id: order.id, data: { status: val } })}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <OrderChat
                        orderId={order.id}
                        orderNumber={order.order_number}
                        senderRole="store"
                        senderName="Admin"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}