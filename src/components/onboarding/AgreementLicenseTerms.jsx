import React from 'react';
export default function AgreementLicenseTerms() {
  return <section className="space-y-2">
    <h3 className="font-bold border-b pb-1">2A. LICENSE VERIFICATION, RENEWALS AND ALERTS</h3>
    <ul className="list-disc list-inside space-y-2">
      <li>The Retailer shall provide its actual Arkansas ABC retail license number, current license documentation, verification status, and expiration date, and keep these details current in the retailer onboarding tracker.</li>
      <li>A PENDING or PENDING-VERIFY entry means verification is incomplete; it is not proof of an active license or authorization to accept orders. The owner or an authorized representative shall coordinate verification with Alcohol Delivered before activation.</li>
      <li>The Retailer shall provide renewed documentation and the new expiration date when its license is renewed and promptly report expiration, suspension, revocation, or other changes in licensing status.</li>
      <li>The Platform checks recorded license details when they change and daily at 8 AM Central. Pending-verification issues appear on the Admin Dashboard; expiration warnings start 30 days before the recorded date, with another reminder at 7 days and after expiration.</li>
      <li>Administrative license alerts are directed to alcohol.delivered1@gmail.com. These alerts are operational reminders, not ABC verification, legal advice, or a substitute for the Retailer's own renewal responsibilities; expiration warnings require an accurate recorded expiration date.</li>
      <li>Retailer-specific licenses remain separate from the Platform's third-party delivery permit. Completion of this Agreement alone does not certify license compliance or launch readiness.</li>
    </ul>
    <div className="grid sm:grid-cols-2 gap-4 pt-2">{['ABC License Expiration Date', 'License Verification Status / Source', 'Renewal / Compliance Contact', 'Additional Authorized Contact Email'].map(label => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><div className="border-b h-6" /></div>)}</div>
  </section>;
}