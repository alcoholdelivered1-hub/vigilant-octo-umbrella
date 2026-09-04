import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

function buildHoursReminderHTML(storeName) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Please Review Your Store Hours</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.6;">Hello ${storeName} Team,</p>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              As we prepare for the launch of <strong>Alcohol Delivered LLC</strong>, we're asking each retail partner to review and update their store hours in our platform.
            </p>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              Please make sure your listed hours accurately reflect the times you want to accept delivery orders. Customers will only be able to place orders during the hours you choose.
            </p>
            <p style="margin:0 0 12px;color:#1e293b;font-size:15px;line-height:1.6;"><strong>Please review and update the following:</strong></p>
            <ul style="margin:0 0 24px;padding-left:22px;color:#475569;font-size:15px;line-height:1.8;">
              <li>Opening time</li>
              <li>Closing time</li>
              <li>Days of operation</li>
              <li>Holiday hours (if applicable)</li>
              <li>Any temporary schedule changes</li>
            </ul>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              If your hours are already correct, no action is needed.
            </p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              If you need assistance updating your hours or have any questions, please reply to this email or call me directly at <strong>(870) 718-1521</strong>. If I don't answer, please leave a voicemail with your store name, your name, and a callback number, and I'll return your call as soon as possible.
            </p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              Thank you for partnering with Alcohol Delivered LLC. We appreciate your support and look forward to serving customers together.
            </p>

            <!-- Signature -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="color:#1e293b;font-size:15px;line-height:1.6;">
                Sincerely,<br><br>
                <strong style="color:#1e3a5f;">John Bess</strong><br>
                Alcohol Delivered LLC<br>
                Phone: (870) 718-1521<br>
                Website: <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">https://alcohol-delivered.biz</a>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC &middot; Pine Bluff, AR &middot; alcohol-delivered.biz<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only trigger
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const { accessToken, senderEmail } = await getGmailSender(base44);

    // Bulk mode: email every active store with an email on file
    if (body.send_to_all) {
      const stores = await base44.asServiceRole.entities.Store.filter({ is_active: true }, 'name', 500);
      const storesWithEmail = stores.filter(s => s.email);

      const results = [];
      for (const store of storesWithEmail) {
        const subject = `Please Review Your Store Hours — ${store.name}`;
        const htmlBody = buildHoursReminderHTML(store.name);
        const res = await sendGmail(accessToken, store.email, senderEmail, subject, htmlBody);
        results.push({ store: store.name, email: store.email, ok: res.ok, status: res.status });
        // Small delay to avoid Gmail rate limits
        await new Promise((r) => setTimeout(r, 250));
      }

      const sent = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok);
      console.log(`Store hours reminder bulk send: ${sent}/${storesWithEmail.length} succeeded`);
      if (failed.length) console.error('Failed sends:', JSON.stringify(failed));

      return Response.json({
        success: true,
        total_sent: sent,
        total_attempted: storesWithEmail.length,
        skipped_no_email: stores.length - storesWithEmail.length,
        failures: failed,
      });
    }

    // Single-store mode
    const targetEmail = body.email || 'alcohol.delivered1@gmail.com';
    const storeName = body.store_name || 'Store Partner';

    const subject = `Please Review Your Store Hours — ${storeName}`;
    const htmlBody = buildHoursReminderHTML(storeName);

    const res = await sendGmail(accessToken, targetEmail, senderEmail, subject, htmlBody);
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }

    console.log(`Store hours reminder sent to ${targetEmail}`);
    return Response.json({ success: true, sent_to: targetEmail });
  } catch (error) {
    console.error('sendStoreHoursReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});