import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

const ALERT_STATUSES = ['flagged', 'expired', 'suspended'];

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const storeData = body.data;
    const oldData = body.old_data;

    const newStatus = storeData?.compliance_status;
    const oldStatus = oldData?.compliance_status;

    // Only alert when status changes INTO a problem state
    if (!ALERT_STATUSES.includes(newStatus) || newStatus === oldStatus) {
      return Response.json({ skipped: true, reason: 'no actionable compliance status change' });
    }

    const storeName = storeData.name || 'Your Store';
    const storeEmail = storeData.email;
    const city = storeData.city || '';
    const county = storeData.county || '';
    const notes = storeData.compliance_notes || '';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const STATUS_LABELS = {
      flagged: 'Flagged for Review',
      expired: 'License / Compliance Expired',
      suspended: 'Account Suspended',
    };

    const STATUS_ACTIONS = {
      flagged: 'Our compliance team has flagged your store for review. Please log in to your dashboard and update any missing or incorrect information as soon as possible.',
      expired: 'Your store\'s license or compliance documentation has expired. Deliveries from your store may be paused until this is resolved. Please upload your renewed documentation immediately.',
      suspended: 'Your store account has been suspended due to a compliance issue. All deliveries have been paused. Please contact us immediately to resolve this.',
    };

    const statusLabel = STATUS_LABELS[newStatus];
    const actionText = STATUS_ACTIONS[newStatus];

    // Notify the store owner
    if (storeEmail) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: storeEmail,
        subject: `⚠️ Compliance Alert: ${statusLabel} — ${storeName}`,
        body: `Hi ${storeName} team,

IMPORTANT: Your compliance status has changed.

New Status: ${statusLabel.toUpperCase()}
Store: ${storeName}
Location: ${city}${county ? ', ' + county + ' County' : ''}
Updated: ${timestamp}
${notes ? `\nAdmin Note: ${notes}` : ''}

${actionText}

Log in to your store dashboard at https://alcoholdelivered.com/store/dashboard to review and resolve this issue.

If you believe this is an error or need assistance, please contact us at alcohol.delivered1@gmail.com.

— Alcohol Delivered Compliance Team`,
        from_name: 'Alcohol Delivered — Compliance Alert',
      });
      console.log(`Compliance alert (${newStatus}) sent to store owner: ${storeName} <${storeEmail}>`);
    }

    // Always notify admin
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'alcohol.delivered1@gmail.com',
      subject: `[Compliance] ${storeName} status changed to ${newStatus.toUpperCase()}`,
      body: `Compliance status change detected.

Store: ${storeName}
Location: ${city}${county ? ', ' + county + ' County' : ''}
Contact Email: ${storeEmail || '(no email on file)'}

Previous Status: ${oldStatus || '(none)'}
New Status: ${newStatus.toUpperCase()}
${notes ? `\nAdmin Note: ${notes}` : ''}

Updated at: ${timestamp}

Review in admin dashboard: https://alcoholdelivered.com/admin/compliance`,
      from_name: 'Alcohol Delivered — Store Alerts',
    });

    return Response.json({ success: true, store: storeName, status: newStatus });
  } catch (error) {
    console.error('notifyComplianceStatusChange error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});