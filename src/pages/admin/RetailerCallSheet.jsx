import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, Mail, Save, Loader2, CheckCircle2, Search, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RetailerCallSheet() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('all');
  const [emailDrafts, setEmailDrafts] = useState({});

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-all'],
    queryFn: () => base44.entities.Store.list(),
  });

  const FALLBACK_EMAIL = 'alcohol.delivered1@gmail.com';

  const noEmailStores = useMemo(
    () => stores.filter(s => !s.email || s.email === FALLBACK_EMAIL),
    [stores]
  );

  const counties = useMemo(() => {
    const set = new Set(noEmailStores.map(s => s.county).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [noEmailStores]);

  const filtered = useMemo(() => {
    return noEmailStores
      .filter(s => countyFilter === 'all' || s.county === countyFilter)
      .filter(s =>
        !search ||
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.city?.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const cc = (a.county || '').localeCompare(b.county || '');
        if (cc !== 0) return cc;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [noEmailStores, countyFilter, search]);

  const updateMutation = useMutation({
    mutationFn: ({ id, email }) => base44.entities.Store.update(id, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-all'] });
      toast.success('Email saved — contract can now be sent!');
    },
    onError: () => toast.error('Failed to save email'),
  });

  const handleSave = (store) => {
    const email = (emailDrafts[store.id] || '').trim();
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    updateMutation.mutate({ id: store.id, email });
  };

  const remaining = noEmailStores.length;
  const collected = stores.length - remaining;

  const handlePrint = () => window.print();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 print:fit-page">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Retailer Call Sheet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {remaining} stores need their real email — call to collect, then save it to send the contract.
          </p>
        </div>
        {remaining > 0 && (
          <Button variant="outline" size="sm" onClick={handlePrint} className="shrink-0 gap-1.5 print:hidden">
            <Printer className="w-4 h-4" /> Print Call List
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 print:hidden">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stores.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Stores</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{collected}</p>
          <p className="text-xs text-muted-foreground mt-1">Have Email</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{remaining}</p>
          <p className="text-xs text-muted-foreground mt-1">Need Email</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <select
          value={countyFilter}
          onChange={(e) => setCountyFilter(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm bg-card"
        >
          {counties.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Counties' : `${c} County`}</option>
          ))}
        </select>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Retailer Call List — Stores Needing Email</h1>
        <p className="text-sm text-gray-600">{remaining} stores • Generated {new Date().toLocaleDateString()}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-muted-foreground mt-4">All stores have email addresses! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3 print:space-y-1">
          {filtered.map((store, idx) => (
            <div
              key={store.id}
              className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 print:border-gray-300 print:rounded-md print:py-1 print:px-2"
            >
              {/* Store info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="hidden print:inline text-xs text-gray-500 font-mono">{idx + 1}.</span>
                  <h3 className="font-semibold text-sm">{store.name}</h3>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 print:hidden">
                    {store.county} County
                  </span>
                  <span className="hidden print:inline text-xs text-gray-500">{store.county}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{store.city}, AR</p>
                {store.phone && (
                  <a
                    href={`tel:${store.phone.replace(/[^0-9]/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary mt-1.5 hover:underline print:text-black print:no-underline"
                  >
                    <Phone className="w-3.5 h-3.5 print:hidden" />
                    {store.phone}
                  </a>
                )}
              </div>

              {/* Email input */}
              <div className="flex items-center gap-2 sm:w-80 print:hidden">
                <div className="relative flex-1">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="collect@email.com"
                    value={emailDrafts[store.id] || ''}
                    onChange={(e) => setEmailDrafts(prev => ({ ...prev, [store.id]: e.target.value }))}
                    className="pl-8 text-sm h-9"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(store)}
                  disabled={updateMutation.isPending && updateMutation.variables?.id === store.id}
                  className="gap-1.5 shrink-0"
                >
                  {updateMutation.isPending && updateMutation.variables?.id === store.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}