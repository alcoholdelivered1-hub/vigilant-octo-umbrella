import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';

const STATUS_LABELS = {
  pending: 'awaiting review',
  contacted: 'in review — we have been in touch',
  approved: 'approved — onboarding in progress',
  onboarded: 'onboarded',
  rejected: 'not approved',
};

// Shows only the signed-in applicant's own application summary: no licence,
// address or contact details, and never another applicant's record.
export default function ExistingApplicationNotice({ application }) {
  if (!application) return null;
  const submitted = application.created_date
    ? new Date(application.created_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const resume = application.status === 'approved' || application.status === 'onboarded';
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-left text-sm space-y-2">
      <p className="font-semibold text-amber-900 flex items-center gap-2"><Clock className="w-4 h-4" /> Application already submitted</p>
      <p className="text-amber-900/80">
        We have your application{application.store_name ? <> for <strong>{application.store_name}</strong></> : null}{submitted ? <> from <strong>{submitted}</strong></> : null}. Status: <strong>{STATUS_LABELS[application.status] || application.status || 'awaiting review'}</strong>.
      </p>
      <p className="text-amber-900/80">
        You do not need to apply again. Reviewing an application does not activate ordering or make your store visible to customers.
      </p>
      {resume && <Button asChild variant="outline" className="w-full"><Link to="/onboarding">Resume your store setup</Link></Button>}
      <RetailerDirectContact />
    </div>
  );
}