import React from 'react';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';
import RetailerAgreementField from '@/components/onboarding/RetailerAgreementField';

export default function RetailerAgreementTerms() {
  const { details, form, record } = useAgreement();
  if (details.legacy) return <p role="status" className="rounded-xl border p-4">This older signed version is preserved in its original PDF below. Current template text is not substituted for signed terms. Review the original, or create a new version for corrections.</p>;
  const groups = { '2A.': ['license_expiration_date','license_source','renewal_contact','additional_email'], '3A.': ['pos_provider','pos_contact','inventory_method','inventory_refresh'] };
  return <>{details.terms.map(section => <section key={section.title} className="space-y-2">
    <h3 className="font-bold border-b pb-1">{section.title}</h3>
    {section.lines.map((text,i) => <p key={i}>{record?.status !== 'submitted' && section.title.startsWith('5.') && i === 3 ? `Payment to the Retailer shall be remitted within ${form.payment_days || '________'} business days of order completion.` : record?.status !== 'submitted' && section.title.startsWith('9.') && i === 0 ? `This Agreement begins on the date of signing and continues for ${form.term_months || '________'} months, renewing automatically unless terminated.` : text}</p>)}
    {Object.entries(groups).filter(([prefix]) => section.title.startsWith(prefix)).map(([prefix,keys]) => <div key={prefix} className="grid sm:grid-cols-2 gap-4 pt-2">{keys.map(key => <RetailerAgreementField key={key} name={key} type={key === 'license_expiration_date' ? 'date' : key === 'additional_email' ? 'email' : 'text'} />)}</div>)}
    {section.title.startsWith('5.') && <RetailerAgreementField name="payment_days" type="number" required className="max-w-xs" />}
    {section.title.startsWith('9.') && <RetailerAgreementField name="term_months" type="number" required className="max-w-xs" />}
  </section>)}</>;
}