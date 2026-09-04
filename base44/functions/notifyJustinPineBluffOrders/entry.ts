/**
 * Notifies Justin Bess when a new order comes in from a Pine Bluff area store.
 * Checks the store's city/county — only alerts for Pine Bluff / Jefferson County.
 *
 * Triggered automatically by the "Alert Justin — Pine Bluff Orders" workflow
 * on every Order creation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';
import { sendSms, normalizePhone } from '../../shared/twilioSms.ts';

const JUSTIN_EMAIL = 'justin.bess1@icloud.com';
const JUSTIN_PHONE = '870-515-1216';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const order = body.data || body.order;
    if (!order) {
      return Response.json({ error: 'No order data provided' }, { status: 400 });
    }

    // Look up the store to check if it's in the Pine Bluff area
    let store = null;
    if (order.store_id) {
      store = await base44.asServiceRole.entities.Store.get(order.store_id).catch(() => null);
    }

    const storeCity = (store?.city || '').toLowerCase().trim();
    const storeCounty = (store?.county || '').toLowerCase().trim();
    const isPineBluff = storeCity === 'pine bluff' || storeCounty === 'jefferson';

    if (!isPineBluff) {
      return Response.json({ skipped: true, reason: 'Order not in Pine Bluff area' });
    }

    const { accessToken, senderEmail } = await getGmailSender(base44);

    const itemsHtml = (order.items || []).map(item =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.product_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">$${(item.subtotal || (item.price * item.quantity) || 0).toFixed(2)}</td>
      </tr>`
    ).join('');

    const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2d4a7a);padding:28px 36px;text-align:center;">
            <p style="margin:0 0 6px;color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">📍 Pine Bluff Area — New Order</p>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">New Sale Just Came In!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;width:140px;">Order #</td><td style="padding:5px 0;font-weight:600;">${order.order_number || order.id}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;">Customer</td><td style="padding:5px 0;">${order.customer_name || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:5px 0;">${order.customer_phone || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;">Store</td><td style="padding:5px 0;">${store?.name || order.store_name || '—'}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;">Location</td><td style="padding:5px 0;">${store?.city || 'Pine Bluff'}, ${store?.county || 'Jefferson'} County, AR</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;font-size:13px;">Delivery Address</td><td style="padding:5px 0;">${order.delivery_address || '—'}</td></tr>
            </table>

            <h3 style="font-size:15px;margin:0 0 10px;color:#1e3a5f;">Order Items</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 12px;text-align:left;color:#475569;">Product</th>
                  <th style="padding:8px 12px;text-align:center;color:#475569;">Qty</th>
                  <th style="padding:8px 12px;text-align:right;color:#475569;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:4px;">
                <span>Subtotal</span><span>$${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:4px;">
                <span>Delivery Fee</span><span>$${(order.delivery_fee || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:8px;">
                <span>Tax</span><span>$${(order.tax || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#1e3a5f;">
                <span>Total</span><span>$${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div style="margin-top:20px;padding:14px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:13px;color:#92400e;">
              ⚡ <strong>Action:</strong> A new Pine Bluff order has been placed. Check the admin dashboard for full details and fulfillment status.
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a5f;padding:16px 36px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = `🍺 New Pine Bluff Order ${order.order_number || ''} — $${(order.total || 0).toFixed(2)} | ${store?.name || order.store_name || ''}`;

    const gmailRes = await sendGmail(accessToken, JUSTIN_EMAIL, senderEmail, subject, htmlBody);

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error('notifyJustinPineBluffOrders: Gmail send failed:', errText);
      return Response.json({ error: 'Email send failed', details: errText.substring(0, 200) }, { status: 500 });
    }

    console.log(`notifyJustinPineBluffOrders: Email alert sent to ${JUSTIN_EMAIL} for order ${order.order_number || order.id}`);

    // --- Instant device ping (SMS) ---
    // FCM push tokens are not yet registered for Justin, so SMS is the reliable
    // "ping on his device" path the moment a Pine Bluff order is confirmed.
    let smsResult = null;
    const justinPhone = normalizePhone(JUSTIN_PHONE);
    if (justinPhone) {
      const smsBody = `🍺 ORDER CONFIRMED #${order.order_number || ''}
$${(order.total || 0).toFixed(2)} — ${store?.name || order.store_name}
Pickup: ${store?.address || ''}, ${store?.city || 'Pine Bluff'}
Deliver to: ${order.delivery_address || ''}
Customer: ${order.customer_name || ''} (${order.customer_phone || ''})
Open the Driver Portal to start pickup now.`;
      smsResult = await sendSms(justinPhone, smsBody);
      if (!smsResult.success) {
        console.error('notifyJustinPineBluffOrders: SMS ping failed:', smsResult.error);
      } else {
        console.log('notifyJustinPineBluffOrders: SMS device ping sent to', justinPhone);
      }
    }

    // --- FCM push notification (fires once Justin registers a device token) ---
    try {
      const justinDriver = await base44.asServiceRole.entities.Driver.filter({ email: JUSTIN_EMAIL });
      const driverId = justinDriver?.[0]?.id;
      const tokens = driverId
        ? await base44.asServiceRole.entities.FCMToken.filter({ driver_id: driverId })
        : [];
      if (tokens.length > 0) {
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens: tokens.map(t => t.token),
          title: '🍺 New Confirmed Order — Start Pickup',
          body: `Order #${order.order_number || ''} · $${(order.total || 0).toFixed(2)} · ${store?.name || order.store_name}`,
          data: { order_id: order.id, order_number: order.order_number || '', type: 'justin_order_confirmed' },
        });
        console.log('notifyJustinPineBluffOrders: FCM push sent to', tokens.length, 'Justin device(s)');
      } else {
        console.log('notifyJustinPineBluffOrders: No FCM tokens for Justin — push skipped (SMS sent instead)');
      }
    } catch (pushErr) {
      console.error('notifyJustinPineBluffOrders: FCM push error:', pushErr.message);
    }

    return Response.json({
      success: true,
      sent_to: JUSTIN_EMAIL,
      sms_sent: smsResult?.success === true,
      store: store?.name || order.store_name,
    });
  } catch (error) {
    console.error('notifyJustinPineBluffOrders error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}