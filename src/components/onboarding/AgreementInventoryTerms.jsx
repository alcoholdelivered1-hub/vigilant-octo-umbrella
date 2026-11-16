import React from 'react';
export default function AgreementInventoryTerms() {
  return <section className="space-y-2">
    <h3 className="font-bold border-b pb-1">3A. POS AUTHORIZATION AND INVENTORY SETUP</h3>
    <ul className="list-disc list-inside space-y-2">
      <li>The owner or an authorized representative shall confirm the Retailer's POS provider and authorize access for catalog, pricing, and inventory synchronization. A provider such as mPower, City Hive, or Clover is not considered confirmed or connected until the Retailer confirms it and access is verified.</li>
      <li>The Retailer's confirmed POS is the authoritative source for product identifiers, prices, and stock availability. Platform listings shall use the Retailer's actual catalog, not invented or unverified products.</li>
      <li>The Retailer shall provide authorized API access or an agreed inventory feed, such as a refreshed CSV feed or Google Sheet, and confirm the refresh frequency with Alcohol Delivered. A fallback feed must reflect the Retailer's current POS data.</li>
      <li>Passwords, access tokens, bank details, and identity documents shall not be entered in this Agreement or emailed; use the secure setup forms and approved authorization process.</li>
      <li>The parties shall verify catalog accuracy, prices, stock availability, and a sandbox order and delivery-handoff test before opening customer ordering. Signing this Agreement does not by itself confirm a working POS connection, inventory sync, or activation.</li>
    </ul>
    <div className="grid sm:grid-cols-2 gap-4 pt-2">{['Confirmed POS Provider', 'Owner / Authorized POS Contact', 'Inventory Access Method (API / CSV / Sheet)', 'Agreed Inventory Refresh Frequency'].map(label => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><div className="border-b h-6" /></div>)}</div>
    <p className="pt-2">For license verification, POS setup, and onboarding assistance, contact <strong>John Bess: 870-718-1521</strong> or alcohol.delivered1@gmail.com.</p>
  </section>;
}