import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import PermitStatusBadge from '@/components/admin/PermitStatusBadge';

const URGENCY_ROW_STYLES = {
  current: 'border-green-100',
  soon: 'border-blue-100',
  urgent: 'border-yellow-200 bg-yellow-50/30',
  critical: 'border-orange-300 bg-orange-50/50',
  expired: 'border-red-300 bg-red-50/50',
  unknown: 'border-gray-100',
};

export default function ABCPermitRow({ row }) {
  const { store, licenseDays, licenseUrgency, deliveryPermit, deliveryDays, deliveryUrgency, cityLicense, hasDeliveryPermit } = row;
  const licenseExpiration = store.license_expiration_date ? format(parseISO(store.license_expiration_date), 'MMM d, yyyy') : 'Not recorded';

  return (
    <tr className={cn('border-b transition-colors hover:bg-muted/30', URGENCY_ROW_STYLES[licenseUrgency] || URGENCY_ROW_STYLES.unknown)}>
      <td className="py-3 px-4 align-top">
        <Link to={`/onboarding?store_id=${encodeURIComponent(store.id)}`} className="font-medium text-primary underline underline-offset-4">
          {store.name}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">{store.city}, {store.county}</p>
      </td>
      <td className="py-3 px-4 align-top">
        <p className="text-sm font-mono">{store.license_number || '—'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{store.license_status || 'unknown'}</p>
      </td>
      <td className="py-3 px-4 align-top">
        <p className="text-sm">{licenseExpiration}</p>
        {store.license_expiration_date && <PermitStatusBadge urgency={licenseUrgency} days={licenseDays} />}
      </td>
      <td className="py-3 px-4 align-top">
        {hasDeliveryPermit ? (
          <>
            <p className="text-sm">{deliveryPermit.permit_number || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{deliveryPermit.status}</p>
            {deliveryPermit.expiration_date && <div className="mt-1"><PermitStatusBadge urgency={deliveryUrgency} days={deliveryDays} /></div>}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No delivery permit</span>
        )}
      </td>
      <td className="py-3 px-4 align-top">
        {cityLicense ? (
          <>
            <p className="text-sm">{cityLicense.permit_number || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cityLicense.status}</p>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Not on file</span>
        )}
      </td>
    </tr>
  );
}