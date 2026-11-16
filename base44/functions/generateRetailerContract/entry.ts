import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { store_id } = await req.json();
    if (!store_id) return Response.json({ error: 'store_id required' }, { status: 400 });

    const stores = await base44.asServiceRole.entities.Store.filter({ id: store_id });
    const store = stores[0];
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const pageW = 612;
    const margin = 60;
    const contentW = pageW - margin * 2;
    let y = 60;

    const checkPage = (neededSpace = 40) => {
      if (y + neededSpace > 740) {
        doc.addPage();
        y = 60;
      }
    };

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('THIRD-PARTY ALCOHOL DELIVERY AGREEMENT', pageW / 2, y, { align: 'center' });
    y += 16;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('RETAIL PARTNER AGREEMENT', pageW / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Between Alcohol Delivered, LLC ("Delivery Platform") and the Retailer identified below', pageW / 2, y, { align: 'center' });
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 16;

    // Effective date
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`This Agreement is entered into as of: ${today}`, pageW / 2, y, { align: 'center' });
    y += 20;

    // ── Retailer Info Box ────────────────────────────────────────────────────
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, contentW, 130, 4, 4, 'FD');

    const col1X = margin + 16;
    const col2X = margin + contentW / 2 + 8;
    let rowY = y + 20;

    const infoField = (label, value, x, fy) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(label, x, fy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(value || '________________________________', x, fy + 12);
      doc.setDrawColor(180, 180, 180);
      doc.line(x, fy + 14, x + (contentW / 2 - 32), fy + 14);
    };

    infoField('Retailer / Store Name', store.name, col1X, rowY);
    infoField('Owner / Authorized Representative', '', col2X, rowY);
    rowY += 32;

    infoField('ABC License Number', store.license_number, col1X, rowY);
    infoField('Title / Position', '', col2X, rowY);
    rowY += 32;

    infoField('Store Address', store.address, col1X, rowY);
    infoField('Phone Number', store.phone || '', col2X, rowY);
    rowY += 32;

    infoField('City, State, ZIP', `${store.city}, ${store.state || 'AR'} ${store.zip_code || ''}`, col1X, rowY);
    infoField('Email Address', store.email || '', col2X, rowY);

    y += 148;

    // ── Section helper ───────────────────────────────────────────────────────
    const section = (title, lines) => {
      checkPage(60);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(title, margin, y);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y + 2, pageW - margin, y + 2);
      y += 14;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line, contentW);
        checkPage(wrapped.length * 11 + 3);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 11 + 3;
      }
      y += 8;
    };

    section('1. PURPOSE', [
      'This Agreement establishes the terms under which Alcohol Delivered, LLC ("Platform") will facilitate the delivery of alcoholic beverages on behalf of ' + (store.name || 'the Retailer') + ' ("Retailer") to customers located within lawful wet jurisdictions in Arkansas. The Retailer remains the seller of record at all times. The Platform acts solely as a third-party delivery service and does not hold title to or sell any alcohol.',
    ]);

    section('2. ARKANSAS ABC COMPLIANCE', [
      '• The Retailer holds a valid Arkansas Alcoholic Beverage Control (ABC) retail license (License #: ' + (store.license_number || '___________') + ') and agrees to maintain it in good standing.',
      '• The Platform holds a valid Arkansas Third-Party Delivery Permit and agrees to maintain it in good standing.',
      '• All deliveries shall occur only during legally permitted alcohol sale hours and only to lawful wet areas.',
      '• Deliveries shall be made only within the same county or an adjacent wet county as the Retailer\'s licensed premises (' + (store.county || '___________') + ' County).',
      '• No alcohol shall be delivered to any person under the age of 21, or to any person who appears intoxicated.',
    ]);

    section('2A. LICENSE VERIFICATION, RENEWALS AND ALERTS', [
      'The Retailer shall provide its actual Arkansas ABC retail license number, current license documentation, verification status, and expiration date, and keep these details current in the retailer onboarding tracker.',
      'A PENDING or PENDING-VERIFY entry means verification is incomplete; it is not proof of an active license or authorization to accept orders. The owner or an authorized representative shall coordinate verification with Alcohol Delivered before activation.',
      'The Retailer shall provide renewed documentation and the new expiration date when its license is renewed and promptly report expiration, suspension, revocation, or other changes in licensing status.',
      'The Platform checks recorded license details when they change and daily at 8 AM Central. Pending-verification issues appear on the Admin Dashboard; expiration warnings start 30 days before the recorded date, with another reminder at 7 days and after expiration.',
      'Administrative license alerts are directed to alcohol.delivered1@gmail.com. These alerts are operational reminders, not ABC verification, legal advice, or a substitute for the Retailer\'s own renewal responsibilities; expiration warnings require an accurate recorded expiration date.',
      'Retailer-specific licenses remain separate from the Platform\'s third-party delivery permit. Completion of this Agreement alone does not certify license compliance or launch readiness.',
      'ABC License Expiration Date: ' + (store.license_expiration_date || '________________________'),
      'Recorded License Status: ' + (store.license_status || (/pending/i.test(store.license_number || '') ? 'PENDING' : 'Not verified')),
      'License Verification Source: ________________________',
      'Renewal / Compliance Contact: ________________________',
      'Additional Authorized Contact Email: ________________________',
    ]);

    section('3. ROLES AND RESPONSIBILITIES', [
      'Retailer Responsibilities:',
      '• Receive and confirm customer orders placed through the Platform.',
      '• Prepare and package orders in sealed, tamper-evident packaging.',
      '• Ensure all items are accurately picked, labeled, and ready for driver pickup within agreed timeframes.',
      '• Maintain accurate product inventory and pricing in the Platform system.',
      '• Immediately notify the Platform of any product unavailability or fulfillment issues.',
      'Platform Responsibilities:',
      '• Operate and maintain a technology platform for order placement, routing, and customer communication.',
      '• Recruit, train, and manage delivery drivers in compliance with Arkansas ABC regulations.',
      '• Verify customer age (21+) at time of order placement via digital ID upload.',
      '• Ensure drivers verify customer ID again at the point of delivery.',
      '• Maintain delivery logs and ID verification records for ABC inspection upon request.',
      '• Carry commercial auto and general liability insurance for all delivery operations.',
    ]);

    section('3A. POS AUTHORIZATION AND INVENTORY SETUP', [
      'The owner or an authorized representative shall confirm the Retailer\'s POS provider and authorize access for catalog, pricing, and inventory synchronization. A provider such as mPower, City Hive, or Clover is not considered confirmed or connected until the Retailer confirms it and access is verified.',
      'The Retailer\'s confirmed POS is the authoritative source for product identifiers, prices, and stock availability. Platform listings shall use the Retailer\'s actual catalog, not invented or unverified products.',
      'The Retailer shall provide authorized API access or an agreed inventory feed, such as a refreshed CSV feed or Google Sheet, and confirm the refresh frequency with Alcohol Delivered. A fallback feed must reflect the Retailer\'s current POS data.',
      'Passwords, access tokens, bank details, and identity documents shall not be entered in this Agreement or emailed; use the secure setup forms and approved authorization process.',
      'The parties shall verify catalog accuracy, prices, stock availability, and a sandbox order and delivery-handoff test before opening customer ordering. Signing this Agreement does not by itself confirm a working POS connection, inventory sync, or activation.',
      'Confirmed POS Provider: ________________________',
      'Owner / Authorized POS Contact: ________________________',
      'Inventory Access Method (API / CSV / Sheet): ________________________',
      'Agreed Inventory Refresh Frequency: ________________________',
      'For license verification, POS setup, and onboarding assistance, contact John Bess: 870-718-1521 or alcohol.delivered1@gmail.com.',
    ]);

    section('4. ORDER PROCESS', [
      '1. Customer places order through the Platform\'s app/website.',
      '2. Customer\'s age is verified digitally at checkout (21+ required).',
      '3. Order is transmitted to ' + (store.name || 'Retailer') + ' for preparation.',
      '4. Platform assigns a trained, compliant driver to pick up the order.',
      '5. Driver presents Platform ID badge and picks up the sealed order.',
      '6. Driver delivers to customer, verifies government-issued ID at door, and refuses delivery if customer is underage or intoxicated.',
      '7. Delivery confirmation and ID verification record are logged in the Platform system.',
    ]);

    section('5. FEES AND PAYMENT', [
      '• The Platform collects a service fee of 25% of the order subtotal from the customer.',
      '• The Platform collects a delivery fee (as set per delivery zone) from the customer.',
      '• The Retailer receives 100% of the product subtotal, minus any agreed Platform listing or integration fees.',
      '• Payment to the Retailer shall be remitted within ________ business days of order completion.',
      '• The Retailer is responsible for all applicable alcohol excise taxes and state sales taxes on products sold.',
    ]);

    section('6. PLACEMENT TIERS (OPTIONAL)', [
      'Standard — Free: Basic listing in store directory',
      'Featured — $50/mo: Highlighted listing, priority placement in search results',
      'Premium — $150/mo: Top placement, featured on homepage, promotional banners',
    ]);

    section('7. PROHIBITED CONDUCT', [
      '• Sell or deliver alcohol to any person under 21 years of age.',
      '• Deliver to an intoxicated person.',
      '• Deliver to a dry county or outside legally permitted hours.',
      '• Allow the Platform to hold title to or take possession of alcohol inventory.',
      '• Misrepresent pricing, availability, or licensing status.',
    ]);

    section('8. INSURANCE', [
      'Each party shall maintain, at its own expense, appropriate insurance coverage including general liability insurance of no less than $1,000,000 per occurrence. The Platform shall maintain commercial auto insurance covering all delivery vehicles operated under this Agreement. The Retailer is strongly encouraged to carry liquor liability insurance.',
    ]);

    section('9. TERM AND TERMINATION', [
      '• This Agreement begins on the date of signing and continues for ________ months, renewing automatically unless terminated.',
      '• Either party may terminate this Agreement with 30 days\' written notice.',
      '• Either party may terminate immediately for cause, including ABC license revocation, fraud, or material breach.',
    ]);

    section('10. LIABILITY AND INDEMNIFICATION', [
      'Each party agrees to indemnify and hold harmless the other from any claims, damages, or penalties arising from its own acts or omissions. The Platform assumes full responsibility for driver conduct during delivery. The Retailer assumes full responsibility for product quality and accurate fulfillment. Neither party shall be liable for consequential or indirect damages.',
    ]);

    section('11. GOVERNING LAW', [
      'This Agreement shall be governed by the laws of the State of Arkansas. Any disputes shall be resolved in Jefferson County, Arkansas. This Agreement constitutes the entire understanding between the parties and supersedes all prior discussions.',
    ]);

    // ── Signature Block ──────────────────────────────────────────────────────
    checkPage(160);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('SIGNATURES', pageW / 2, y, { align: 'center' });
    y += 16;

    const sigCol1 = margin;
    const sigCol2 = pageW / 2 + 10;
    const sigW = contentW / 2 - 10;

    const sigBlock = (title, x) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(title.toUpperCase(), x, y);
      let sy = y + 16;
      ['Authorized Signature', 'Printed Name', 'Title', 'Date'].forEach(lbl => {
        doc.setDrawColor(160, 160, 160);
        doc.line(x, sy + 12, x + sigW, sy + 12);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(lbl, x, sy + 20);
        sy += 34;
      });
    };

    sigBlock('Alcohol Delivered, LLC', sigCol1);
    sigBlock(store.name || 'Retailer / Liquor Store', sigCol2);
    y += 172;

    // ── Notary Block ─────────────────────────────────────────────────────────
    checkPage(100);
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, contentW, 90, 4, 4, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTARY ACKNOWLEDGMENT (OPTIONAL)', pageW / 2, y + 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(`State of Arkansas, County of ${store.county || '_______________'}`, margin + 12, y + 30);
    doc.text('Subscribed and sworn before me this ______ day of ________________, 20____', margin + 12, y + 44);
    doc.line(margin + 12, y + 68, margin + 12 + sigW - 10, y + 68);
    doc.text('Notary Public Signature', margin + 12, y + 76);
    doc.line(sigCol2, y + 68, sigCol2 + sigW - 10, y + 68);
    doc.text('Commission Expires', sigCol2, y + 76);
    y += 104;

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text('Alcohol Delivered, LLC  ·  Pine Bluff, AR  ·  alcohol-delivered.biz  ·  Confidential — For Authorized Parties Only', pageW / 2, y, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    const fileName = `RetailerContract_${(store.name || 'store').replace(/\s+/g, '_')}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('generateRetailerContract error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}