import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import StarRating from '@/components/shared/StarRating';
import { toast } from 'sonner';
import DriverAnnualCertification from '@/components/driver/DriverAnnualCertification';
import DriverBackgroundCheckPanel from '@/components/admin/DriverBackgroundCheckPanel';

export default function AdminDrivers() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', date_of_birth: '', license_number: '', vehicle_info: '' });
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['admin-drivers-list'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Driver.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
      setOpen(false);
      setForm({ name: '', email: '', phone: '', date_of_birth: '', license_number: '', vehicle_info: '' });
      toast.success('Driver added');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Driver.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
      toast.success('Driver updated');
    },
  });

  const handleCreate = () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Please fill required fields');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Drivers</h1>
          <p className="text-muted-foreground mt-1">Manage delivery personnel</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Driver</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Driver</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div className="space-y-2"><Label>License Number</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Vehicle Info</Label><Input value={form.vehicle_info} onChange={(e) => setForm({ ...form, vehicle_info: e.target.value })} /></div>
              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>Add Driver</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Contact</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Background</th>
              <th className="text-left p-3 font-medium">Training</th>
              <th className="text-left p-3 font-medium">Deliveries</th>
              <th className="text-left p-3 font-medium">Avg Rating</th>
              <th className="text-left p-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No drivers yet</td></tr>
            ) : (
              drivers.map(driver => (
                <tr key={driver.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.vehicle_info}</p>
                  </td>
                  <td className="p-3">
                    <p className="text-xs">{driver.email}</p>
                    <p className="text-xs text-muted-foreground">{driver.phone}</p>
                  </td>
                  <td className="p-3">
                    <Select
                      value={driver.status}
                      onValueChange={(val) => updateMutation.mutate({ id: driver.id, data: { status: val } })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['available', 'on_delivery', 'offline', 'suspended'].map(s => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <DriverBackgroundCheckPanel driver={driver} />
                  </td>
                  <td className="p-3">
                    <DriverAnnualCertification driver={driver} />
                  </td>
                  <td className="p-3 font-medium">{driver.total_deliveries || 0}</td>
                  <td className="p-3">
                    <StarRating value={driver.avg_rating || 0} size="sm" showValue count={undefined} />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={driver.is_active}
                      onCheckedChange={(val) => updateMutation.mutate({ id: driver.id, data: { is_active: val } })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}