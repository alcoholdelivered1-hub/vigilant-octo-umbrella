import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

function buildRawEmail(to, subject, htmlBody, senderEmail) {
  const message = [
    `From: Alcohol Delivered — Compliance Alert <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const INCIDENT_LABELS = {
  id_verification_failed: 'ID Verification Failed',
  intoxication_refused: 'Intoxication — Delivery Refused',
  minor_attempt: 'Possible Minor — Delivery Refused',
  other_refusal: 'Delivery Refused',
};

/**
 * Logs a compliance incident and sends immediate email + push notifications.
 *
 * Triggered by:
 *   - Entity automation on Order update (status → "refused")
 *   - Entity automation on IDVerification create (is_verified = false)
 *   - Direct admin call
 *
 * Payload (from automation):
 *   { event: { type, entity_name, entity_id }, data: <order or verification> }
 *
 * Direct payload:
 *   { order_id, incident_type, reason, driver_id, driver_name, driver_email }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const payload = await req.json();

    let incidentType = payload.incident_type;
    let orderId = payload.order_id;
    let reason = payload.reason;
    let driverId = payload.driver_id;
    let driverName = payload.driver_name;
    let driverEmail = payload.driver_email;
    let verificationType = payload.verification_type;
    let idType = payload.id_type;

    // --- Handle automation payloads ---
    // Order update automation: status changed to "refused"
    if (payload.event && payload.event.entity_name === 'Order' && payload.data) {
      const order = payload.data;
      if (order.status !== 'refused') {
        return Response.json({ skipped: true, reason: 'Order not refused' });
      }
      orderId = order.id;
      reason = order.refusal_reason || 'Delivery refused (no reason provided)';

      // Classify the refusal reason
      const r = (reason || '').toLowerCase();
      if (r.includes('intox') || r.includes('drunk') || r.includes('impaired')) {
        incidentType = 'intoxication_refused';
      } else if (r.includes('minor') || r.includes('underage') || r.includes('under 21')) {
        incidentType = 'minor_attempt';
      } else if (r.includes('id') || r.includes('verification') || r.includes('expired') || r.includes('invalid')) {
        incidentType = 'id_verification_failed';
      } else {
        incidentType = 'other_refusal';
      }

      driverId = order.driver_id;
      driverName = order.driver_name;
    }

    // IDVerification create automation: is_verified = false
    if (payload.event && payload.event.entity_name === 'IDVerification' && payload.data) {
      const verification = payload.data;
      if (verification.is_verified !== false) {
        return Response.json({ skipped: true, reason: 'Verification was not a failure' });
      }
      orderId = verification.order_id;
      incidentType = 'id_verification_failed';
      reason = verification.notes || 'ID verification failed at delivery';
      verificationType = verification.verification_type;
      idType = verification.id_type;
      driverEmail = verification.verified_by;
    }

    if (!orderId) {
      return Response.json({ skipped: true, reason: 'No order_id available' });
    }

    // Fetch the full order for details
    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) {
      return Response.json({ skipped: true, reason: 'Order not found' });
    }

    // Check for duplicate — don't log the same incident twice
    const existing = await base44.asServiceRole.entities.ComplianceIncident.filter({
      order_id: orderId,
      incident_type: incidentType,
    });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Incident already logged for this order' });
    }

    // Fetch store name
    let storeName = order.store_name;
    if (order.store_id) {
      const store = await base44.asServiceRole.entities.Store.get(order.store_id);
      if (store) storeName = store.name;
    }

    // Fetch driver name if not already set
    if (driverId && !driverName) {
      const driver = await base44.asServiceRole.entities.Driver.filter({ email: driverEmail || '' });
      if (driver.length > 0) driverName = driver[0].name;
    }

    // Create the compliance record
    const incident = await base44.asServiceRole.entities.ComplianceIncident.create({
      incident_type: incidentType,
      order_id: orderId,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      store_id: order.store_id,
      store_name: storeName,
      driver_id: driverId,
      driver_name: driverName,
      driver_email: driverEmail,
      reason,
      delivery_address: order.delivery_address,
      verification_type: verificationType,
      id_type: idType,
      incident_date: new Date().toISOString(),
      notification_sent: false,
    });

    // --- Send immediate notifications ---
    let notificationSent = false;
    const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    const label = INCIDENT_LABELS[incidentType] || 'Compliance Incident';

    // 1. Email alert via Gmail
    if (managerEmail) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const { emailAddress } = await profileRes.json();

        const subject = `⚠️ ${label} — Order ${order.order_number || order.id}`;
        const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
    <h2 style="color: #991b1b; margin: 0 0 4px;">⚠️ ${label}</h2>
    <p style="color: #b91c1c; margin: 0; font-size: 14px;">A delivery attempt has failed. Review for Arkansas ABC compliance.</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280; width: 40%;">Order #</td><td style="padding: 10px 0; font-weight: 600;">${order.order_number || order.id}</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Customer</td><td style="padding: 10px 0;">${order.customer_name || 'N/A'} (${order.customer_email || 'N/A'})</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Store</td><td style="padding: 10px 0;">${storeName || 'N/A'}</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Driver</td><td style="padding: 10px 0;">${driverName || 'N/A'}</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Incident Type</td><td style="padding: 10px 0; font-weight: 600; color: #991b1b;">${label}</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Reason</td><td style="padding: 10px 0;">${reason}</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 0; color: #6b7280;">Delivery Address</td><td style="padding: 10px 0;">${order.delivery_address || 'N/A'}</td></tr>
    <tr><td style="padding: 10px 0; color: #6b7280;">Time</td><td style="padding: 10px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</td></tr>
  </table>
  <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: #713f12;">
    <strong>Action Required:</strong> Review this incident in the Admin Compliance Log and document any follow-up actions for Arkansas ABC compliance records.
  </div>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Alcohol Delivered · Pine Bluff, AR · Automated Compliance Alert</p>
</div>`.trim();

        const raw = buildRawEmail(managerEmail, subject, htmlBody, emailAddress);
        const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (sendRes.ok) notificationSent = true;
        else console.error('Gmail send failed:', await sendRes.text());
      } catch (e) {
        console.error('Email notification failed:', e.message);
      }
    }

    // 2. FCM push notification to admin
    try {
      const adminTokens = await base44.asServiceRole.entities.FCMToken.filter({ user_role: 'admin' });
      if (adminTokens.length > 0) {
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens: adminTokens.map(t => t.token),
          title: `⚠️ ${label}`,
          body: `Order ${order.order_number || order.id} — ${reason.slice(0, 80)}`,
          data: { incident_id: incident.id, order_id: orderId, type: 'compliance_incident' },
        });
        notificationSent = true;
      }
    } catch (e) {
      console.error('Push notification failed:', e.message);
    }

    // Update the incident record with notification status
    if (notificationSent) {
      await base44.asServiceRole.entities.ComplianceIncident.update(incident.id, { notification_sent: true });
    }

    console.log(`Compliance incident logged: ${label} for order ${order.order_number || order.id}`);
    return Response.json({
      success: true,
      incident_id: incident.id,
      incident_type: incidentType,
      notification_sent: notificationSent,
    });
  } catch (error) {
    console.error('logComplianceIncident error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});