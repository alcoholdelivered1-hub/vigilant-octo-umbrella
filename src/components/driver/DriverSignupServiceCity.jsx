import React from 'react';

export default function DriverSignupServiceCity({ value, onChange }) {
  // A preferred city is applicant input, not proof of approved delivery coverage.
  // Public applicants must not depend on access to private retailer records.
  return <label className="block text-sm font-medium">Preferred service city *
    <input type="text" required maxLength={100} autoComplete="address-level2" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Enter your preferred Arkansas city" aria-describedby="driver-service-city-help" className="mt-1 w-full rounded-md border bg-background p-3" />
    <span id="driver-service-city-help" className="mt-1 block text-sm font-normal text-muted-foreground">Tell us where you would like to deliver. Service availability and driver approval are confirmed during review.</span>
  </label>;
}