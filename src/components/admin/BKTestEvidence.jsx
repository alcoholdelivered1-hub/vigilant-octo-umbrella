import React from 'react';
import LaunchEvidenceForm from '@/components/admin/LaunchEvidenceForm';

export default function BKTestEvidence({ onComplete }) {
  return <LaunchEvidenceForm action="test" title="Record completed sandbox launch test" onComplete={onComplete}
    description="Admin task: complete a sandbox purchase, payment confirmation, retailer alert, driver assignment and delivery handoff before recording the result. No real payment is created by this form."
    fields={[
      { name: 'source', label: 'Sandbox test order / test-run reference', maxLength: 300 },
      { name: 'notes', label: 'Verified payment, tablet alert, pickup and delivery results', type: 'textarea', maxLength: 2000 },
    ]}
    attestation="I completed the sandbox flow and verified these outcomes; I am recording results, not requesting a test." />;
}