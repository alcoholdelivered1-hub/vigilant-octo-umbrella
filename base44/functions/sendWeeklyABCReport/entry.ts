import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

const ABC_EMAIL = null; // Notifications to Drew.Cousins@dfa.arkansas.gov disabled per request
const SENDER_EMAIL = 'alcohol.delivered1@gmail.com';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildMimeWithAttachment(to, subject, htmlBody, pdfBase64, filename) {
  const boundary = 'boundary_' + Math.random().toString(36).substring(2);
  const lines = [
    `From: Alcohol Delivered Compliance <${SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ];
  const message = lines.join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function buildPDF(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 0;

  // Header band
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Alcohol Delivered, LLC', margin, 35);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Weekly Jefferson County Delivery Summary', margin, 55);
  doc.setFontSize(9);
  doc.text('Arkansas Alcoholic Beverage Control (ABC) Compliance Filing', margin, 70);

  y = 110;
  doc.setTextColor(0, 0, 0);

  // Report period
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Period:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.weekStart} – ${report.weekEnd}`, margin + 80, y);
  doc.text(`Generated: ${report.generatedDate}`, margin + 300, y);

  y += 30;

  // Executive Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Executive Summary', margin, y);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFontSize(10);
  const stats = [
    ['Total Deliveries', report.totalDeliveries],
    ['Total Revenue', `$${report.totalRevenue.toFixed(2)}`],
    ['Delivery Fees Collected', `$${report.totalDeliveryFees.toFixed(2)}`],
    ['Driver Tips', `$${report.totalTips.toFixed(2)}`],
    ['Unique Stores Served', report.uniqueStores],
    ['Unique Drivers', report.uniqueDrivers],
    ['ID Verified at Checkout', report.idVerifiedCheckout],
    ['ID Verified at Delivery', report.idVerifiedDelivery],
    ['Refused Deliveries', report.refusedCount],
  ];

  for (const [label, value] of stats) {
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), margin + 220, y);
    y += 18;
  }

  y += 15;

  // Delivery Log table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Delivery Log', margin, y);
  y += 8;
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  const colWidths = [65, 60, 80, 85, 115, 65, 50];
  const headers = ['Order #', 'Delivered', 'Customer', 'Store', 'Address', 'Driver', 'Total'];
  const usableWidth = pageWidth - 2 * margin;

  function drawHeader() {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 10, usableWidth, 14, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 2, y);
      x += colWidths[i];
    }
    y += 14;
  }

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (report.deliveries.length === 0) {
    doc.setFontSize(10);
    doc.text('No deliveries recorded during this period.', margin, y + 10);
  }

  for (const d of report.deliveries) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 40;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
    }

    let x = margin;
    const cells = [
      d.orderNumber,
      d.deliveredDate,
      d.customerName,
      d.storeName,
      d.deliveryAddress,
      d.driverName,
      `$${d.total.toFixed(2)}`,
    ];

    for (let i = 0; i < cells.length; i++) {
      const text = String(cells[i] || '');
      const truncated = doc.splitTextToSize(text, colWidths[i] - 4)[0];
      doc.text(truncated, x + 2, y);
      x += colWidths[i];
    }
    y += 13;
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Alcohol Delivered, LLC · Pine Bluff, AR · Jefferson County · Arkansas ACT 157 Third-Party Delivery Permit',
      margin, pageHeight - 20
    );
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin - 50, pageHeight - 20);
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('arraybuffer');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin or scheduled automation
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch { /* unauthenticated — automation */ }

    const body = await req.json().catch(() => ({}));
    const isAutomation = body?.automation?.id;

    if (!isAdmin && !isAutomation) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [orders, stores] = await Promise.all([
      svc.entities.Order.list('-created_date', 500),
      svc.entities.Store.list(),
    ]);

    // Map store_id -> county
    const storeCounty = {};
    for (const s of stores) {
      storeCounty[s.id] = (s.county || '').toLowerCase();
    }

    // Filter: delivered, within last 7 days, Jefferson County store
    const weekDelivered = orders.filter(o => {
      if (o.status !== 'delivered') return false;
      const dateStr = o.delivery_confirmed_at || o.updated_date || o.created_date;
      if (!dateStr) return false;
      return new Date(dateStr) >= weekAgo;
    });

    const jeffersonDeliveries = weekDelivered.filter(o => {
      const county = storeCounty[o.store_id] || '';
      return county === 'jefferson';
    });

    const refused = orders.filter(o => {
      if (o.status !== 'refused') return false;
      const dateStr = o.updated_date || o.created_date;
      if (!dateStr) return false;
      return new Date(dateStr) >= weekAgo && storeCounty[o.store_id] === 'jefferson';
    });

    // Build delivery rows for PDF
    const deliveryRows = jeffersonDeliveries.map(o => ({
      orderNumber: o.order_number || o.id.slice(-8),
      deliveredDate: fmtDateTime(o.delivery_confirmed_at || o.updated_date),
      customerName: o.customer_name || '',
      storeName: o.store_name || '',
      deliveryAddress: o.delivery_address || '',
      driverName: o.driver_name || 'Unassigned',
      total: o.total || 0,
    }));

    const report = {
      weekStart: fmtDate(weekAgo.toISOString()),
      weekEnd: fmtDate(now.toISOString()),
      generatedDate: now.toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      totalDeliveries: jeffersonDeliveries.length,
      totalRevenue: jeffersonDeliveries.reduce((s, o) => s + (o.total || 0), 0),
      totalDeliveryFees: jeffersonDeliveries.reduce((s, o) => s + (o.delivery_fee || 0), 0),
      totalTips: jeffersonDeliveries.reduce((s, o) => s + (o.tip || 0), 0),
      uniqueStores: new Set(jeffersonDeliveries.map(o => o.store_id)).size,
      uniqueDrivers: new Set(jeffersonDeliveries.map(o => o.driver_id).filter(Boolean)).size,
      idVerifiedCheckout: jeffersonDeliveries.filter(o => o.id_verified_at_checkout).length,
      idVerifiedDelivery: jeffersonDeliveries.filter(o => o.id_verified_at_delivery).length,
      refusedCount: refused.length,
      deliveries: deliveryRows,
    };

    // Build PDF
    const pdfBuffer = buildPDF(report);
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);
    const filename = `Jefferson_County_Weekly_Delivery_Summary_${now.toISOString().split('T')[0]}.pdf`;

    // Email body
    const htmlBody = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e3a5f;border-radius:12px;padding:24px;margin-bottom:20px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Weekly Delivery Summary — Jefferson County</h1>
      <p style="color:#f59e0b;margin:4px 0 0;font-size:13px;">Arkansas ABC Compliance Filing</p>
    </div>
    <p style="color:#334155;font-size:14px;line-height:1.6;">
      Please find attached the weekly summary of all alcohol deliveries completed in Jefferson County, Arkansas
      for the period of <strong>${report.weekStart} – ${report.weekEnd}</strong>.
    </p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;">
      <table style="width:100%;font-size:13px;color:#334155;">
        <tr><td style="padding:4px 0;color:#64748b;">Total Deliveries:</td><td style="font-weight:700;">${report.totalDeliveries}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Total Revenue:</td><td style="font-weight:700;">$${report.totalRevenue.toFixed(2)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">ID Verified at Delivery:</td><td style="font-weight:700;">${report.idVerifiedDelivery}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Refused Deliveries:</td><td style="font-weight:700;">${report.refusedCount}</td></tr>
      </table>
    </div>
    <p style="color:#64748b;font-size:12px;line-height:1.5;">
      Alcohol Delivered, LLC · Pine Bluff, AR · Jefferson County<br>
      Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
    </p>
  </div>
</body></html>`;

    const subject = `Weekly Jefferson County Delivery Summary — ${report.weekStart} – ${report.weekEnd}`;

    // Notifications to Drew.Cousins@dfa.arkansas.gov have been disabled
    if (!ABC_EMAIL) {
      console.log('Weekly ABC report generated but not sent — ABC email notifications disabled');
      return Response.json({
        success: true,
        sent: false,
        reason: 'ABC email notifications disabled',
        period: `${report.weekStart} – ${report.weekEnd}`,
        total_deliveries: report.totalDeliveries,
        total_revenue: report.totalRevenue,
        refused: report.refusedCount,
      });
    }

    // Build MIME with PDF attachment and send via Gmail
    const { accessToken } = await svc.connectors.getConnection('gmail');
    const raw = buildMimeWithAttachment(ABC_EMAIL, subject, htmlBody, pdfBase64, filename);

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error('Gmail send failed:', errText);
      return Response.json({ error: `Gmail send failed: ${errText}` }, { status: 500 });
    }

    console.log(`Weekly ABC report sent to ${ABC_EMAIL}: ${report.totalDeliveries} deliveries, $${report.totalRevenue.toFixed(2)} revenue`);

    return Response.json({
      success: true,
      sent_to: ABC_EMAIL,
      period: `${report.weekStart} – ${report.weekEnd}`,
      total_deliveries: report.totalDeliveries,
      total_revenue: report.totalRevenue,
      refused: report.refusedCount,
    });
  } catch (error) {
    console.error('Weekly ABC report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});