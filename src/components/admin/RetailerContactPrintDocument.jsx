import React from 'react';
import { createPortal } from 'react-dom';
const value = text => text || 'Not recorded';
export default function RetailerContactPrintDocument({ sections }) {
  return createPortal(<div className="retailer-print-root">
    <style>{`
      .retailer-print-root { display: none; }
      @media print {
        @page { size: landscape; margin: 12mm; }
        html:has(.retailer-print-root), body:has(.retailer-print-root) { height: auto !important; overflow: visible !important; padding: 0 !important; }
        body:has(.retailer-print-root) > :not(.retailer-print-root) { display: none !important; }
        .retailer-print-root { display: block !important; color: #000; background: #fff; font: 10pt Arial, sans-serif; }
        .retailer-print-root h1 { font-size: 20pt; margin: 0 0 6pt; }
        .retailer-print-root h2 { font-size: 13pt; margin: 16pt 0 6pt; break-after: avoid; }
        .retailer-print-root p { margin: 0 0 8pt; }
        .retailer-print-root table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .retailer-print-root thead { display: table-header-group; }
        .retailer-print-root tr { break-inside: avoid; page-break-inside: avoid; }
        .retailer-print-root th, .retailer-print-root td { border: 1px solid #999; padding: 6pt; vertical-align: top; text-align: left; overflow-wrap: anywhere; white-space: pre-line; }
        .retailer-print-root small { display: block; margin-top: 5pt; }
      }
    `}</style>
    <h1>Alcohol Delivered — Retailer Contact List</h1>
    <p>Printed {new Date().toLocaleDateString()} · All saved contact details and public research leads.</p>
    <p>Sources are listed separately; the same retailer may appear in more than one section. “Not recorded” means that information was not supplied. Public research contacts are unverified.</p>
    {sections.filter(section => section.rows.length).map(section => <section key={section.title}>
      <h2>{section.title} ({section.rows.length})</h2>
      <table><thead><tr><th>Retailer / County</th><th>Address</th><th>Contact person</th><th>Phone numbers</th><th>Email addresses</th><th>Website / Source / Notes</th></tr></thead>
        <tbody>{section.rows.map((row, index) => <tr key={index}>
          <td><strong>{row.name}</strong><small>{value(row.county)}{row.county ? ' County' : ''}</small></td>
          <td>{value(row.address)}</td><td>{value(row.contacts)}</td><td>{value(row.phones || row.phone)}</td><td>{value(row.emails || row.email)}</td>
          <td>{[row.website, row.source_url, row.notes].filter(Boolean).join('\n') || 'Not recorded'}</td>
        </tr>)}</tbody>
      </table>
    </section>)}
  </div>, document.body);
}