import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { sendDriverOnboardingOutreach } from '../../shared/driverOnboardingOutreach.ts';

const PORTAL_URL = 'https://alcohol-delivered.biz/driver';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const payload = await req.json();
    if (payload.action === 'onboarding') return Response.json(await sendDriverOnboardingOutreach(base44, payload.preview_only === true));

    const drivers = await base44.asServiceRole.entities.Driver.list();

    const results = [];
    for (const driver of drivers) {
      if (!driver.email) {
        results.push({ driver: driver.name, status: 'skipped', reason: 'No email on file' });
        continue;
      }

      const subject = '📱 Add the Alcohol Delivered App to Your Home Screen';
      const iconUrl = 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/d89819219_generated_image.png';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${iconUrl}" alt="Alcohol Delivered" width="120" height="120" style="border-radius: 24px;" />
            <h1 style="color: #2A2350; margin: 16px 0 4px;">Your Driver App</h1>
            <p style="color: #6b7280; margin: 0;">Add it to your home screen for fast, app-like access</p>
          </div>
          <p>Hi ${driver.name || 'Driver'},</p>
          <p>You can now install the Alcohol Delivered Driver Portal as an app on your phone — no app store needed. Once installed, it opens full-screen with its own icon, just like a native app.</p>

          <h3 style="color: #2A2350;">iPhone (Safari)</h3>
          <ol>
            <li>Open <a href="${PORTAL_URL}">${PORTAL_URL}</a> in Safari</li>
            <li>Tap the <strong>Share</strong> button (square with up arrow) at the bottom</li>
            <li>Tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>Add</strong> — the icon appears on your home screen</li>
          </ol>

          <h3 style="color: #2A2350;">Android (Chrome)</h3>
          <ol>
            <li>Open <a href="${PORTAL_URL}">${PORTAL_URL}</a> in Chrome</li>
            <li>Tap the <strong>three-dot menu</strong> (top right)</li>
            <li>Tap <strong>"Add to Home screen"</strong> (or "Install app")</li>
            <li>Tap <strong>Install</strong> — the icon appears on your home screen</li>
          </ol>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 16px; margin: 20px 0;">
            <strong style="color: #166534;">Log in with:</strong> ${driver.email}<br/>
            <span style="color: #166534; font-size: 13px;">No password yet? Use "Sign Up" with that same email.</span>
          </div>

          <h3 style="color: #2A2350;">Inside the app you can:</h3>
          <ul>
            <li>View and claim nearby delivery orders</li>
            <li>Accept pickups and track delivery status</li>
            <li>Verify customer IDs (21+) at delivery</li>
            <li>Broadcast live GPS during deliveries</li>
            <li>Complete alcohol safety training</li>
            <li>View earnings and weekly payouts</li>
            <li>Get push notifications for new orders</li>
          </ul>

          <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">Questions? Reply to this email and we'll help you right away.<br/>— Alcohol Delivered Team</p>
        </div>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: driver.email,
          subject,
          html,
        });
        results.push({ driver: driver.name, email: driver.email, status: 'sent' });
      } catch (err) {
        results.push({ driver: driver.name, email: driver.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, total: drivers.length, sent, skipped, failed, results });
  } catch (error) {
    console.error('sendDriverPortalInstructions error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}