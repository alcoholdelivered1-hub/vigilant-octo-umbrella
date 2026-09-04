import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { isDriverVetted } from '../../shared/driverVetting.ts';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';
import { sendFCMToTokens } from '../../shared/fcmUtils.ts';
import { isBlockedRecipient, normalizeEmail } from '../../shared/emailGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be an authenticated driver
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch the order
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only claimable if confirmed and unassigned
    if (order.status !== 'confirmed') {
      return Response.json({
        success: false,
        reason: `Order is no longer available (status: ${order.status})`,
      });
    }

    if (order.driver_id) {
      return Response.json({
        success: false,
        reason: 'This order was already claimed by another driver',
        claimed_by: order.driver_name,
      });
    }

    // Look up the driver record for this user
    const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email });
    const driver = drivers[0];

    if (!driver) {
      return Response.json({
        success: false,
        reason: 'No driver profile found for your account. Please complete driver registration.',
      });
    }

    // Security gate: only fully-vetted drivers (active + trained + genuine
    // cleared background check) may claim orders.
    const vetting = isDriverVetted(driver);
    if (!vetting.ok) {
      return Response.json({
        success: false,
        reason: vetting.reason,
      });
    }

    // Atomically assign the driver
    await base44.asServiceRole.entities.Order.update(order_id, {
      driver_id: driver.id,
      driver_name: driver.name,
      status: 'confirmed', // stays confirmed, store will advance to preparing
    });

    // Update driver status
    await base44.asServiceRole.entities.Driver.update(driver.id, {
      status: 'on_delivery',
    });

    console.log(`[claimOrder] Driver ${driver.name} (${user.email}) claimed order ${order.order_number}`);

    // Notify the store manager the moment a driver claims the order so they
    // can start preparing the items. Email + FCM push, fire-and-forget — a
    // notification failure must never fail the claim itself.
    try {
      await notifyStoreDriverClaimed(base44, order, driver);
    } catch (e) {
      console.error(`[claimOrder] Store notification failed for ${order.order_number}:`, e.message);
    }

    return Response.json({
      success: true,
      message: `Order ${order.order_number} claimed! Head to ${order.store_name} for pickup.`,
      order_number: order.order_number,
      store_name: order.store_name,
      delivery_address: order.delivery_address,
      total: order.total,
      tip: order.tip || 0,
    });
  } catch (error) {
    console.error('[claimOrder] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ───────────────────────────────────────────────────────────────────────
// Store-manager notification on driver claim.
// Sends a Gmail email + FCM push to the store owner so they can begin
// preparing the order the instant a driver accepts it.
// ───────────────────────────────────────────────────────────────────────
async function notifyStoreDriverClaimed(base44, order, driver) {
  // Resolve the store's contact email — prefer the denormalized store_email
  // on the order, fall back to fetching the Store record.
  let storeEmail = normalizeEmail(order.store_email || '');
  let storeName = order.store_name || 'the store';

  if (!storeEmail) {
    const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
    const store = stores[0];
    if (!store || !store.email) {
      console.log(`[claimOrder] No store email for order ${order.order_number} — skipping store notification`);
      return { skipped: true };
    }
    storeEmail = normalizeEmail(store.email);
    storeName = store.name || storeName;
  }

  if (isBlockedRecipient(storeEmail)) {
    console.log(`[claimOrder] Store email ${storeEmail} is a blocked recipient — skipping`);
    return { skipped: true };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((n, i) => n + (i.quantity || 1), 0);
  const itemRows = items
    .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eef2f7;">${escapeHtml(String(i.product_name || ''))}</td><td style="padding:6px 0 6px 12px;text-align:center;border-bottom:1px solid #eef2f7;">${i.quantity || 1}</td><td style="padding:6px 0 6px 12px;text-align:right;border-bottom:1px solid #eef2f7;">$${Number(i.subtotal || (i.price || 0) * (i.quantity || 1)).toFixed(2)}</td></tr>`)
    .join('');

  const subject = `🚗 Driver claimed #${order.order_number} — start preparing`;
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#1e3a5f;padding:24px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Alcohol Delivered</h1>
          <p style="margin:4px 0 0;color:#f59e0b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Driver Assigned · Start Preparing</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:18px;">A driver just claimed order #${escapeHtml(order.order_number || '')}</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
            <strong style="color:#1e3a5f;">${escapeHtml(driver.name || 'A driver')}</strong> has accepted this order and is heading to <strong>${escapeHtml(storeName)}</strong> for pickup. Please begin preparing the items now so the order is sealed and ready when the driver arrives.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:14px;color:#1e293b;">
            <tr><td style="padding:4px 0;color:#64748b;">Order #</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(order.order_number || '')}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Customer</td><td style="padding:4px 0;text-align:right;">${escapeHtml(order.customer_name || '')}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Driver</td><td style="padding:4px 0;text-align:right;">${escapeHtml(driver.name || '')}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Delivery to</td><td style="padding:4px 0;text-align:right;">${escapeHtml(order.delivery_address || '')}</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;color:#1e293b;">
            <tr style="background:#f8fafc;"><td style="padding:8px 0 8px 8px;font-weight:600;">Item</td><td style="padding:8px 12px 8px 0;text-align:center;font-weight:600;">Qty</td><td style="padding:8px 8px 8px 12px;text-align:right;font-weight:600;">Subtotal</td></tr>
            ${itemRows || `<tr><td colspan="3" style="padding:8px 0;color:#94a3b8;">No items listed</td></tr>`}
            <tr><td colspan="2" style="padding:10px 0 4px;font-weight:600;">Total</td><td style="padding:10px 0 4px 12px;text-align:right;font-weight:700;color:#1e3a5f;">$${Number(order.total || 0).toFixed(2)}</td></tr>
          </table>
          <p style="margin:18px 0 0;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;color:#92400e;font-size:13px;line-height:1.5;">
            ⚡ Have the order sealed and ready for pickup. You can track the driver's arrival in your Partner Portal.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">Alcohol Delivered Partner Portal · alcoholdelivered.com/store/dashboard · Questions? alcohol.delivered1@gmail.com</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Pine Bluff, AR</p>
    </td></tr>
  </table>
</body></html>`;

  // 1) Email via Gmail connector (store emails may not be registered app users)
  let emailOk = false;
  try {
    const { accessToken, senderEmail } = await getGmailSender(base44);
    const res = await sendGmail(accessToken, storeEmail, senderEmail, subject, htmlBody);
    emailOk = res.ok;
    if (!res.ok) console.error(`[claimOrder] Gmail send failed: ${res.status}`);
  } catch (e) {
    console.error(`[claimOrder] Email to ${storeEmail} failed:`, e.message);
  }

  // 2) FCM push to the store owner's registered devices
  let pushOk = false;
  try {
    let tokens: string[] = [];
    const byEmail = await base44.asServiceRole.entities.FCMToken.filter({ user_email: storeEmail });
    tokens.push(...byEmail.map((t) => t.token));
    if (tokens.length === 0) {
      const byStore = await base44.asServiceRole.entities.FCMToken.filter({ store_id: order.store_id });
      tokens.push(...byStore.map((t) => t.token));
    }
    if (tokens.length > 0) {
      const results = await sendFCMToTokens(
        tokens,
        `🚗 Driver claimed #${order.order_number}`,
        `${driver.name || 'A driver'} is en route — start preparing ${itemCount} item(s) for ${order.customer_name || 'customer'}`,
        { order_id: order.id || '', order_number: order.order_number || '', type: 'driver_claimed' }
      );
      pushOk = results.some((r) => r.success);
    }
  } catch (e) {
    console.error(`[claimOrder] FCM push to ${storeEmail} failed:`, e.message);
  }

  console.log(`[claimOrder] Store notification for ${order.order_number}: email=${emailOk} push=${pushOk} to=${storeEmail}`);
  return { email_sent: emailOk, push_sent: pushOk, recipient: storeEmail };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}