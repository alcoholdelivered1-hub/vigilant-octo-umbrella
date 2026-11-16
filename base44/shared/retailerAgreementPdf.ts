import { jsPDF } from 'npm:jspdf@4.0.0';
import { agreementFields, agreementTerms } from './retailerAgreementTerms.ts';

export function retailerAgreementPdf(record) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = 48;
  const line = (text, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9);
    for (const row of doc.splitTextToSize(text, 516)) {
      if (y > 740) { doc.addPage(); y = 48; }
      doc.text(row, 48, y); y += 13;
    }
    y += 5;
  };
  line('RETAIL PARTNER AGREEMENT', true);
  line('Between Alcohol Delivered, LLC (Delivery Platform) and the Retailer identified below');
  line(`Effective date: ${record.fields.effective_date}`);
  for (const [key,label] of Object.entries(agreementFields)) if (!['signature', 'signature_date', 'payment_days', 'term_months'].includes(key)) line(`${label}: ${record.fields[key] || '(not provided)'}`);
  if (!record.terms_snapshot?.length) throw new Error('Use the preserved original PDF for legacy signed agreements; do not regenerate signed terms.');
  for (const section of record.terms_snapshot) { line(section.title, true); section.lines.forEach(text => line(text)); }
  line('SIGNATURES', true);
  line(`Alcohol Delivered, LLC: ${record.platform_signature || '____________________ (platform countersignature pending)'}`);
  line(`Platform printed name: ${record.platform_name || '(pending)'} | Title: ${record.platform_title || '(pending)'} | Date: ${record.platform_date || '(pending)'}`);
  if (record.reviewed_at) line(`Countersignature recorded: ${record.reviewed_at} | Administrator: ${record.reviewed_by}`);
  line(`Retailer electronic signature: ${record.fields.signature}`);
  line(`Printed name: ${record.fields.owner_name} | Title: ${record.fields.title} | Signature date: ${record.fields.signature_date}`);
  line('The signer confirmed authorization to represent the retailer, accepted the complete agreement above, and consented to using their typed name as an electronic signature.');
  line(`Recorded at: ${record.submitted_at} | Signed-in account: ${record.submitted_by}`);
  line(`Agreement version: ${record.terms_version} | SHA-256: ${record.terms_hash}`);
  line('NOTARY ACKNOWLEDGMENT (OPTIONAL)', true);
  line('State of Arkansas, County of ____________________');
  line('Subscribed and sworn before me this ____ day of ____________, 20____');
  line('Notary Public Signature: ____________________ | Commission Expires: ____________________');
  line('Alcohol Delivered, LLC | Pine Bluff, AR | alcohol-delivered.biz | Confidential, for authorized parties only');
  return doc.output('arraybuffer');
}