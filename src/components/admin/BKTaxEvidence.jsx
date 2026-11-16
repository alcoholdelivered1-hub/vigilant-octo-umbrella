import React from 'react';
import LaunchEvidenceForm from '@/components/admin/LaunchEvidenceForm';

export default function BKTaxEvidence({ onComplete }) {
  return <LaunchEvidenceForm action="tax" title="Record DFA tax confirmation" onComplete={onComplete}
    description="Admin task: record actual DFA guidance and the review of checkout tax coverage. Saving this does not obtain approval from DFA or change the tax calculation."
    fields={[
      { name: 'source', label: 'DFA guidance source / contact and reference', maxLength: 300 },
      { name: 'confirmed_date', label: 'Date guidance was confirmed', type: 'date' },
      { name: 'notes', label: 'Verified destinations, alcohol categories and checkout calculation', type: 'textarea', maxLength: 2000 },
    ]}
    attestation="I verified this guidance and confirmed the current checkout calculation covers the supported destinations and alcohol categories." />;
}