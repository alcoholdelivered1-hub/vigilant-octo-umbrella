import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const isAdmin = user.role === 'admin';
    // Only an administrator may issue a certificate naming another person or back-dating completion.
    const recipientName = (isAdmin && body.name) || user.full_name || user.email;
    const completionDate = (isAdmin && body.date)
      ? body.date
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const modules = (isAdmin && Array.isArray(body.modules) && body.modules.length > 0) ? body.modules : [
      'Arkansas Alcohol Laws',
      'Responsible Consumption',
      'ID Verification & Your Rights',
      'Arkansas ACT 157 — Delivery Law',
      'Community Safety',
    ];

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(13, 27, 77); // deep navy
    doc.rect(0, 0, W, H, 'F');

    // Gold border
    doc.setDrawColor(212, 160, 23);
    doc.setLineWidth(4);
    doc.rect(20, 20, W - 40, H - 40, 'S');
    doc.setLineWidth(1.5);
    doc.rect(28, 28, W - 56, H - 56, 'S');

    // Corner ornaments
    const corners = [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]];
    corners.forEach(([x, y]) => {
      doc.setFillColor(212, 160, 23);
      doc.circle(x, y, 5, 'F');
    });

    // Header badge area
    doc.setFillColor(212, 160, 23);
    doc.roundedRect(W / 2 - 120, 40, 240, 36, 6, 6, 'F');
    doc.setTextColor(13, 27, 77);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('ALCOHOL DELIVERED, LLC', W / 2, 63, { align: 'center' });

    // Title
    doc.setTextColor(212, 160, 23);
    doc.setFontSize(34);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF COMPLETION', W / 2, 120, { align: 'center' });

    // Subtitle
    doc.setTextColor(180, 200, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Arkansas ACT 157 — Alcohol Delivery Driver Training Program', W / 2, 148, { align: 'center' });

    // Divider
    doc.setDrawColor(212, 160, 23);
    doc.setLineWidth(1);
    doc.line(80, 162, W - 80, 162);

    // "This certifies that"
    doc.setTextColor(200, 215, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'italic');
    doc.text('This certifies that', W / 2, 190, { align: 'center' });

    // Recipient Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text(recipientName, W / 2, 228, { align: 'center' });

    // Name underline
    const nameWidth = doc.getTextWidth(recipientName);
    doc.setDrawColor(212, 160, 23);
    doc.setLineWidth(1.2);
    doc.line(W / 2 - nameWidth / 2, 234, W / 2 + nameWidth / 2, 234);

    // Body text
    doc.setTextColor(200, 215, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'has successfully completed the required Alcohol Delivery Safety Training Program',
      W / 2, 258, { align: 'center' }
    );
    doc.text(
      'as mandated under Arkansas ACT 157 (A.C.A. §3-4-1106) for third-party alcohol delivery drivers.',
      W / 2, 274, { align: 'center' }
    );

    // Modules completed
    doc.setTextColor(212, 160, 23);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MODULES COMPLETED:', W / 2, 300, { align: 'center' });

    doc.setTextColor(180, 200, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const moduleLine = modules.join('  ·  ');
    doc.text(moduleLine, W / 2, 316, { align: 'center', maxWidth: W - 160 });

    // Divider
    doc.setDrawColor(212, 160, 23);
    doc.setLineWidth(0.8);
    doc.line(80, 336, W - 80, 336);

    // Footer columns
    const col1 = 130, col2 = W / 2, col3 = W - 130;
    const sigY = 390;

    // Date
    doc.setTextColor(212, 160, 23);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(completionDate, col1, sigY, { align: 'center' });
    doc.setDrawColor(180, 200, 255);
    doc.setLineWidth(0.8);
    doc.line(col1 - 80, sigY + 6, col1 + 80, sigY + 6);
    doc.setTextColor(180, 200, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Date of Completion', col1, sigY + 18, { align: 'center' });

    // Seal/stamp center
    doc.setFillColor(212, 160, 23);
    doc.circle(col2, sigY - 10, 32, 'S');
    doc.setFillColor(13, 27, 77);
    doc.circle(col2, sigY - 10, 28, 'F');
    doc.setTextColor(212, 160, 23);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL', col2, sigY - 14, { align: 'center' });
    doc.text('SEAL', col2, sigY - 4, { align: 'center' });
    doc.setFontSize(7);
    doc.text('AR ABC', col2, sigY + 6, { align: 'center' });

    // Authority
    doc.setTextColor(212, 160, 23);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Alcohol Delivered, LLC', col3, sigY, { align: 'center' });
    doc.setDrawColor(180, 200, 255);
    doc.line(col3 - 90, sigY + 6, col3 + 90, sigY + 6);
    doc.setTextColor(180, 200, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Issuing Authority · Pine Bluff, AR', col3, sigY + 18, { align: 'center' });

    // Footer note
    doc.setTextColor(120, 140, 180);
    doc.setFontSize(8);
    doc.text(
      'Permit required under A.C.A. §3-4-1101 through §3-4-1106  ·  alcohol-delivered.biz  ·  870-209-9109',
      W / 2, H - 38, { align: 'center' }
    );

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DriverTrainingCertificate-${recipientName.replace(/\s+/g, '_')}.pdf"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Certificate generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});