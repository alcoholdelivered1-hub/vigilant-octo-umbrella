import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import LaunchEvidenceForm from '@/components/admin/LaunchEvidenceForm';

export default function BKDriverEvidence({ onComplete }) {
  const { data: drivers, isLoading, error } = useQuery({
    queryKey: ['bk-launch-justin'],
    queryFn: () => base44.entities.Driver.filter({ email: 'jpbsandiego@yahoo.com' }, '-updated_date', 1),
  });
  if (isLoading) return <p role="status">Loading driver details…</p>;
  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  const driver = drivers?.[0];
  if (!driver) return <p>Justin’s driver record was not found. <Link className="text-primary underline" to="/admin/drivers">Manage drivers</Link></p>;
  return <LaunchEvidenceForm key={driver.id} action="driver" title="Record Justin’s real driver clearance" onComplete={onComplete} context={{ driver_id: driver.id }}
    description="Admin task: review an actual completed provider or agency report before recording clearance. This form does not order a background check. Justin must still be trained, available and have notifications enabled in his driver portal."
    initialValues={{ date_of_birth: driver.date_of_birth, license_number: driver.license_number, vehicle_info: driver.vehicle_info }}
    fields={[
      { name: 'report_id', label: 'Actual report ID (not an app reference or simulated ID)', maxLength: 120 },
      { name: 'source', label: 'Provider / agency and report verification reference', maxLength: 300 },
      { name: 'completed_date', label: 'Report completion date', type: 'date' },
      { name: 'date_of_birth', label: 'Verified driver date of birth', type: 'date' },
      { name: 'license_number', label: 'Verified driver license number', maxLength: 60 },
      { name: 'vehicle_info', label: 'Verified vehicle details', maxLength: 200 },
    ]}
    attestation="I reviewed this real completed report, verified it belongs to Justin, and confirmed clearance and eligibility for production alcohol deliveries." />;
}