import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function buildRawEmail(to, subject, html, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      order_id,
      order_number,
      store_id,
      store_name,
      driver_name,
      problem,
    } = await req.json();

    if (!order_id || !problem) {
      return Response.json({ error: 'Missing order_id or problem' }, { status: 400 });
    }

    // Fetch store to get retailer email
    let storeEmail = null;
    let storePhone = null;
    if (store_id) {
      try {
        const store = await base44.asServiceRole.entities.Store.get(store_id);
        storeEmail = store?.email || null;
        storePhone = store?.notification_phone || store?.phone || null;
      } catch (e) {
        console.error('Failed to fetch store:', e.message);
      }
    }

    // Fetch FCM tokens for store users
    let fcmTokens = [];
    try {
      const tokens = await base44.asServiceRole.entities.FCMToken.filter({
        store_id: store_id,
      });
      fcmTokens = tokens.map(t => t.token);
    } catch (e) {
      console.error('Failed to fetch FCM tokens:', e.message);
    }

    const subject = `⚠️ ORDER PROBLEM REPORTED — ${order_number}`;
    const body = `
      <h2 style="color: #d97706;">Order Problem Reported</h2>
      <p><strong>Order:</strong> ${order_number}</p>
      <p><strong>Store:</strong> ${store_name || 'N/A'}</p>
      <p><strong>Driver:</strong> ${driver_name || 'N/A'}</p>
      <p><strong>Problem:</strong> ${problem}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        The driver has reported a problem with this order and has NOT picked it up.
        The order remains at the retailer. Please resolve the issue before the driver confirms pickup.
      </p>
    `;

    // Use Gmail to send — store/manager emails may not be registered app users
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Notify retailer
    if (storeEmail) {
      try {
        const raw = buildRawEmail(storeEmail, subject, body, 'Alcohol Delivered');
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
      } catch (e) {
        console.error('Failed to send retailer email:', e.message);
      }
    }

    // Notify administrator
    const adminEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    if (adminEmail) {
      try {
        const raw = buildRawEmail(adminEmail, `[ADMIN] ${subject}`, body, 'Alcohol Delivered');
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
      } catch (e) {
        console.error('Failed to send admin email:', e.message);
      }
    }

    // Send FCM push to store devices
    for (const token of fcmTokens) {
      try {
        await base44.functions.invoke('sendFCMPush', {
          token,
          title: `⚠️ Order Problem: ${order_number}`,
          body: `Driver reported: ${problem}`,
          data: { order_id, type: 'order_problem' },
        });
      } catch (e) {
        console.error('Failed to send FCM push:', e.message);
      }
    }

    // Log compliance incident
    try {
      await base44.asServiceRole.entities.ComplianceIncident.create({
        incident_type: 'other_refusal',
        order_id,
        order_number,
        store_id: store_id || '',
        store_name: store_name || '',
        driver_id: user.id,
        driver_name: driver_name || user.full_name || user.email,
        driver_email: user.email,
        reason: `Pickup problem: ${problem}`,
        incident_date: new Date().toISOString(),
        is_resolved: false,
        notification_sent: true,
      });
    } catch (e) {
      console.error('Failed to log compliance incident:', e.message);
    }

    return Response.json({
      success: true,
      notified_retailer: !!storeEmail,
      notified_admin: !!adminEmail,
      fcm_sent: fcmTokens.length,
    });
  } catch (error) {
    console.error('notifyOrderProblem error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});