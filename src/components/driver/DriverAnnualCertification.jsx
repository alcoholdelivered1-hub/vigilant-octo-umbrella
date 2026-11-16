import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DriverCertificationForm from '@/components/driver/DriverCertificationForm';

export default function DriverAnnualCertification({ driver }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: records = [], isLoading, error } = useQuery({ queryKey: ['driver-annual-certifications', user?.id], enabled: !!user?.id, queryFn: async () => {
    const items = []; let cursor = null;
    do { const page = await base44.entities.DriverCompliance.list({ limit: 200, sort: '-reviewed_at', cursor }); items.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
    return items;
  } });
  const record = records.find(r => r.driver_id === driver.id);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  const current = record?.status === 'approved' && record.training_expires_date > today && record.license_expiration_date >= today && record.reviewed_license_number === driver.license_number && record.reviewed_date_of_birth === driver.date_of_birth && record.reviewed_background_check_id === driver.background_check_id;
  const saved = () => { setOpen(false); client.invalidateQueries(); };
  return <div className="space-y-2 text-sm">
    {isLoading ? <p role="status">Loading annual certification…</p> : error ? <p role="alert" className="text-destructive">Certification could not be loaded.</p> : <>
      <p className={current ? 'text-primary font-medium' : 'text-destructive font-medium'}>{current ? 'Annual evidence reviewed' : 'Annual certification review required'}</p>
      {record?.status === 'approved' && <p className="text-xs text-muted-foreground">Training renews {record.training_expires_date}; license expires {record.license_expiration_date}.</p>}
      <p className="text-xs text-muted-foreground">Carry training proof and your completed ABC Server Awareness form. Quiz completion alone does not qualify you.</p>
    </>}
    {user?.role === 'admin' && <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Review annual evidence</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Annual driver certification</DialogTitle></DialogHeader><DriverCertificationForm driver={driver} record={record} onSaved={saved} /></DialogContent></Dialog>
  </div>;
}