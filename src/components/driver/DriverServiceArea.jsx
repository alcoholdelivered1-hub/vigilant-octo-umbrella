import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DriverApplicationDocuments from '@/components/driver/DriverApplicationDocuments';
import DriverAnnualCertification from '@/components/driver/DriverAnnualCertification';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DriverServiceArea({ email }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ service_city: '', date_of_birth: '', license_number: '', vehicle_info: '' });
  const { data, isLoading, error } = useQuery({ queryKey: ['driver-service-profile', email], enabled: !!email, queryFn: async () => {
    const [drivers, stores, coverage] = await Promise.all([base44.entities.Driver.filter({ email }, '-created_date', 1), base44.entities.Store.filter({ onboarding_status: 'live', is_active: true }, 'city', 100), base44.entities.DriverStoreCoverage.filter({ driver_email: email }, 'store_name', 100)]);
    return { driver: drivers[0], stores, coverage: coverage.filter(c => stores.some(s => s.id === c.store_id)) };
  } });
  useEffect(() => { if (data?.driver) setForm(Object.fromEntries(Object.keys(form).map(key => [key, data.driver[key] || '']))); }, [data?.driver?.id]);
  const save = useMutation({ mutationFn: () => base44.entities.Driver.update(data.driver.id, form), onSuccess: () => { client.invalidateQueries({ queryKey: ['driver-service-profile'] }); client.invalidateQueries({ queryKey: ['driver-retailer-coverage'] }); } });
  if (!email || isLoading) return <p role="status">Loading driver setup…</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!data.driver) return <div className="mb-5 rounded-xl border p-4"><p>Complete your driver application to choose a service area.</p><Link to="/driver/signup" className="text-primary underline">Apply to drive</Link></div>;
  const cities = [...new Set(data.stores.map(s => s.city.trim().toLowerCase()))].sort();
  const reportValid = data.driver.background_check_status === 'clear' && data.driver.background_check_id && !/^(simulated|test|demo|ad-)/i.test(data.driver.background_check_id) && data.driver.background_check_completed_at;
  return <section className="mb-5 rounded-xl border bg-card p-4 space-y-3">
    <h2 className="font-semibold">Your retailer service area</h2><p className="text-sm text-muted-foreground">Choose where you can work. This does not approve deliveries or guarantee orders.</p>
    {!reportValid && <p className="text-sm">Real background-check verification is still needed. Contact John Bess at <a className="text-primary underline" href="tel:+18707181521">870-718-1521</a>. Consent alone is not clearance.</p>}
    <label className="block text-sm">Preferred service city<Select value={form.service_city.toLowerCase()} onValueChange={value => setForm({ ...form, service_city: value })}><SelectTrigger aria-label="Preferred service city" className="mt-1 w-full rounded-md border bg-background p-3"><SelectValue placeholder="Choose a city" /></SelectTrigger><SelectContent>{cities.map(c => <SelectItem key={c} value={c}>{c.replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent></Select></label>
    <div className="grid gap-3 sm:grid-cols-3">{[['date_of_birth', 'Date of birth', 'date'], ['license_number', 'License number', 'text'], ['vehicle_info', 'Vehicle details', 'text']].map(([key,label,type]) => <label key={key} className="text-sm">{label}<Input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
    <Button disabled={!form.service_city || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save driver setup'}</Button>
    {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}{save.isSuccess && <p role="status" className="text-sm">Driver setup saved. Verification remains required.</p>}
    <DriverApplicationDocuments driver={data.driver} />
    <DriverAnnualCertification driver={data.driver} />
    <p className="text-sm text-muted-foreground">Planned retailers: {data.coverage.length ? data.coverage.map(c => c.store_name).join(', ') : 'None assigned yet'}</p>
  </section>;
}