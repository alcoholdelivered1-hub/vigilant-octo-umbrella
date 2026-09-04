import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ABCExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [orders, verifications] = await Promise.all([
        base44.entities.Order.list(),
        base44.entities.IDVerification.list(),
      ]);

      const dateStr = format(new Date(), 'yyyy-MM-dd');

      // Orders CSV
      const orderRows = orders.map(o => ({
        order_number: o.order_number,
        date: o.created_date ? format(new Date(o.created_date), 'yyyy-MM-dd HH:mm') : '',
        status: o.status,
        customer_name: o.customer_name,
        customer_email: o.customer_email,
        delivery_address: o.delivery_address,
        store_name: o.store_name,
        driver_name: o.driver_name || '',
        total: o.total,
        id_verified_at_checkout: o.id_verified_at_checkout ? 'Yes' : 'No',
        id_verified_at_delivery: o.id_verified_at_delivery ? 'Yes' : 'No',
        is_in_legal_zone: o.is_in_legal_zone ? 'Yes' : 'No',
        stripe_payment_status: o.stripe_payment_status,
        delivery_confirmed_at: o.delivery_confirmed_at ? format(new Date(o.delivery_confirmed_at), 'yyyy-MM-dd HH:mm') : '',
        refusal_reason: o.refusal_reason || '',
      }));

      // ID Verification CSV
      const idRows = verifications.map(v => ({
        order_id: v.order_id,
        verification_type: v.verification_type,
        customer_name: v.customer_name,
        customer_email: v.customer_email,
        id_type: v.id_type || '',
        date_of_birth: v.date_of_birth || '',
        is_verified: v.is_verified ? 'Yes' : 'No',
        verified_by: v.verified_by || '',
        date: v.created_date ? format(new Date(v.created_date), 'yyyy-MM-dd HH:mm') : '',
        notes: v.notes || '',
      }));

      downloadCSV(`ABC_Orders_${dateStr}.csv`, toCSV(orderRows));
      setTimeout(() => downloadCSV(`ABC_IDVerifications_${dateStr}.csv`, toCSV(idRows)), 300);

      toast.success(`Exported ${orderRows.length} orders & ${idRows.length} ID verifications`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? 'Exporting…' : 'Export ABC Audit CSV'}
    </Button>
  );
}