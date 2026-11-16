import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { assertAdmin } from '../../shared/authGuard.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverHasProductionCredentials } from '../../shared/verifiedTaxDriverReadiness.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const payload = await req.json().catch(() => ({}));
    const order = payload.data;

    // Verify this is a delivered order by Justin Bess
    if (order && (order.status !== 'delivered' || order.driver_email !== 'jpbsandiego@yahoo.com')) {
      return Response.json({ skipped: true, reason: 'Order not delivered by Justin — skipping' });
    }

    // Find all inactive drivers with clear background check + completed training
    const allDrivers = await base44.asServiceRole.entities.Driver.list('-created_date', 100);
    const reviewedDrivers = await attachDriverCompliance(base44, allDrivers);
    const toActivate = reviewedDrivers.filter(d => !d.is_active && driverHasProductionCredentials({ ...d, is_active: true }));

    // Idempotency: if no inactive vetted drivers remain, the go-live activation already ran
    if (toActivate.length === 0) {
      return Response.json({
        skipped: true,
        reason: 'No inactive vetted drivers — go-live activation already triggered'
      });
    }

    // Activate all qualifying drivers in one batch
    const updates = toActivate.map(d => ({ id: d.id, is_active: true, status: 'available' }));
    await base44.asServiceRole.entities.Driver.bulkUpdate(updates);

    // Send go-live email to each newly activated driver
    const emailResults = [];
    for (const driver of toActivate) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: driver.email,
          from_name: 'Alcohol Delivered Operations',
          subject: '🚀 Alcohol Delivered Is Going Live — You’re Activated!',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <h2 style="color:#1e3a5f;">Hi ${driver.name},</h2>
              <p>Great news — <strong>Alcohol Delivered is going live very soon!</strong></p>
              <p>Your driver account has been <strong style="color:#16a34a;">activated</strong>. You're cleared to start accepting delivery orders as soon as we launch.</p>
              <div style="background:#f0f7ff;border:1px solid #bcdcff;border-radius:12px;padding:16px;margin:20px 0;">
                <h3 style="margin:0 0 12px;color:#1e3a5f;">Before we go live, please:</h3>
                <ol style="line-height:1.8;margin:0;padding-left:20px;">
                  <li><strong>Enable push notifications</strong> — open the driver portal on your phone and tap "Allow" when prompted, so you get instant alerts for new orders near you.</li>
                  <li><strong>Set your status to "Available"</strong> — log into the driver portal and toggle your availability so you show up in dispatch.</li>
                  <li><strong>Keep your vehicle info current</strong> — confirm your registered vehicle is ready to go.</li>
                </ol>
              </div>
              <div style="text-align:center;margin:24px 0;">
                <a href="https://alcohol-delivered-0c72f042.base44.app/driver" style="display:inline-block;background:#1e3a5f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Open Driver Portal</a>
              </div>
              <p style="margin-top:20px;">We're excited to have you on the team. If you have any questions, reply to this email.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="font-size:12px;color:#9ca3af;">Alcohol Delivered LLC — Jefferson County, AR</p>
            </div>
          `
        });
        emailResults.push({ email: driver.email, sent: true });
      } catch (emailErr) {
        console.error(`Email failed for ${driver.email}:`, emailErr.message);
        emailResults.push({ email: driver.email, sent: false, error: emailErr.message });
      }
    }

    console.log(`Go-live activation complete: ${toActivate.length} drivers activated, ${emailResults.filter(r => r.sent).length} emails sent`);

    return Response.json({
      success: true,
      activated_count: toActivate.length,
      emails_sent: emailResults.filter(r => r.sent).length,
      emails_failed: emailResults.filter(r => !r.sent).length,
      drivers: toActivate.map(d => ({ name: d.name, email: d.email }))
    });
  } catch (error) {
    console.error('activateDriversOnGoLive error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}