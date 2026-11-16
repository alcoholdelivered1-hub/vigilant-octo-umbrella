import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import usePrintableRetailerContacts from '@/components/admin/usePrintableRetailerContacts';
import RetailerContactPrintDocument from '@/components/admin/RetailerContactPrintDocument';
export default function PrintRetailerContactsButton({ leads }) {
  const { user } = useAuth();
  const contacts = usePrintableRetailerContacts(user?.role === 'admin');
  if (user?.role !== 'admin') return null;
  const sections = [...(contacts.data || []), { title: 'Public research leads — unverified (researched October 2, 2026)', rows: leads.map(row => ({ ...row, address: `${row.address}\n${row.city}, AR` })) }];
  return <div className="space-y-2">
    <Button variant="outline" disabled={contacts.isLoading || !!contacts.error || !contacts.data} onClick={() => window.print()}><Printer className="h-4 w-4" />{contacts.isLoading ? 'Loading retailer contacts…' : 'Print all retailer contacts / Save PDF'}</Button>
    {contacts.error && <p role="alert" className="text-sm text-destructive">Could not load saved contacts. <button className="underline" onClick={() => contacts.refetch()}>Retry</button></p>}
    {contacts.data && <RetailerContactPrintDocument sections={sections} />}
  </div>;
}