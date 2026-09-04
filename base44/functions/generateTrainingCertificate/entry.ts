import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use only server-verified data from the authenticated user's profile
    const recipientName = user.full_name || user.email;
    const completionDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const modules = [
      'Arkansas Alcohol Laws',
      'Responsible Consumption',
      'ID Verification & Your Rights',
      'Arkansas ACT 157 — Delivery Law',
      'Community Safety',
    ];

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Colors
    const NAVY = [13, 27, 77];
    const GOLD = [212, 160, 23];
    const GRAY = [100, 116, 139];

    // Plain white background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // Navy border (outer + inner)
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(3);
    doc.rect(20, 20, W - 40, H - 40, 'S');
    doc.setLineWidth(0.8);
    doc.rect(28, 28, W - 56, H - 56, 'S');

    // Gold accent line between borders
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.rect(24, 24, W - 48, H - 48, 'S');

    // Header badge area
    doc.setFillColor(...NAVY);
    doc.roundedRect(W / 2 - 130, 44, 260, 32, 6, 6, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ALCOHOL DELIVERED, LLC', W / 2, 64, { align: 'center' });

    // Title
    doc.setTextColor(...NAVY);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF COMPLETION', W / 2, 118, { align: 'center' });

    // Subtitle
    doc.setTextColor(...GRAY);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('Arkansas ACT 157 — Alcohol Delivery Driver Training Program', W / 2, 144, { align: 'center' });

    // Divider
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(80, 158, W - 80, 158);

    // "This certifies that"
    doc.setTextColor(...GRAY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.text('This certifies that', W / 2, 184, { align: 'center' });

    // Recipient Name
    doc.setTextColor(...NAVY);
    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.text(recipientName, W / 2, 222, { align: 'center' });

    // Name underline
    const nameWidth = doc.getTextWidth(recipientName);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.line(W / 2 - nameWidth / 2, 228, W / 2 + nameWidth / 2, 228);

    // Body text
    doc.setTextColor(...GRAY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'has successfully completed the required Alcohol Delivery Safety Training Program',
      W / 2, 252, { align: 'center' }
    );
    doc.text(
      'as mandated under Arkansas ACT 157 (A.C.A. §3-4-1106) for third-party alcohol delivery drivers.',
      W / 2, 268, { align: 'center' }
    );

    // Modules completed
    doc.setTextColor(...NAVY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MODULES COMPLETED:', W / 2, 294, { align: 'center' });

    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const moduleLine = modules.join('  ·  ');
    doc.text(moduleLine, W / 2, 310, { align: 'center', maxWidth: W - 160 });

    // Divider
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(80, 330, W - 80, 330);

    // Footer columns
    const col1 = 130, col2 = W / 2, col3 = W - 130;
    const sigY = 384;

    // Date
    doc.setTextColor(...NAVY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(completionDate, col1, sigY, { align: 'center' });
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.6);
    doc.line(col1 - 80, sigY + 6, col1 + 80, sigY + 6);
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Date of Completion', col1, sigY + 18, { align: 'center' });

    // Seal/stamp center
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.circle(col2, sigY - 10, 30, 'S');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.circle(col2, sigY - 10, 26, 'S');
    doc.setTextColor(...NAVY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL', col2, sigY - 14, { align: 'center' });
    doc.text('SEAL', col2, sigY - 4, { align: 'center' });
    doc.setFontSize(7);
    doc.text('AR ABC', col2, sigY + 6, { align: 'center' });

    // Authority
    doc.setTextColor(...NAVY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Alcohol Delivered, LLC', col3, sigY, { align: 'center' });
    doc.setDrawColor(...GRAY);
    doc.line(col3 - 90, sigY + 6, col3 + 90, sigY + 6);
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Issuing Authority · Pine Bluff, AR', col3, sigY + 18, { align: 'center' });

    // Footer note
    doc.setTextColor(...GRAY);
    doc.setFontSize(7.5);
    doc.text(
      'Permit required under A.C.A. §3-4-1101 through §3-4-1106  ·  alcohol-delivered.biz  ·  870-209-9109',
      W / 2, H - 38, { align: 'center' }
    );

    // Output as base64, convert to File, and upload so the frontend gets a
    // shareable URL the driver can view/save on their device without a printer.
    const base64 = doc.output('arraybuffer');
    const bytes = new Uint8Array(base64);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], `DriverTrainingCertificate-${recipientName.replace(/\s+/g, '_')}.pdf`, {
      type: 'application/pdf',
    });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    return Response.json({ success: true, download_url: file_url });
  } catch (error) {
    console.error('Certificate generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});