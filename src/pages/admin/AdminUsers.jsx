import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, Shield, Loader2, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'driver', label: 'Driver', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'retailer_owner', label: 'Retailer Owner', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'retailer_staff', label: 'Retailer Staff', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'customer', label: 'Customer', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'user', label: 'Customer (legacy)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

function RoleBadge({ role }) {
  const opt = ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS.find(r => r.value === 'user');
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${opt.color}`}>
      <Shield className="w-3 h-3" />
      {opt.label}
    </span>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.User.list('-created_date', 200);
      setUsers(list || []);
    } catch (err) {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const changeRole = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q);
  });

  const counts = ROLE_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = users.filter(u => u.role === opt.value).length;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Assign and manage roles — server-side permissions are enforced automatically.</p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ROLE_OPTIONS.map(opt => (
          <div key={opt.value} className="rounded-xl border bg-card p-3 text-center">
            <p className="text-2xl font-bold">{counts[opt.value] || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className="flex items-center gap-4 rounded-xl border bg-card p-3 md:p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.full_name || 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {u.email}
                </p>
              </div>
              <div className="hidden sm:block">
                <RoleBadge role={u.role} />
              </div>
              <Select
                value={u.role}
                onValueChange={(v) => changeRole(u.id, v)}
                disabled={updatingId === u.id}
              >
                <SelectTrigger className="w-[140px] sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}