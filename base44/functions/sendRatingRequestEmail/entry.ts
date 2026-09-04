import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { createRatingToken } from '../../shared/ratingToken.ts';

function buildRawEmail(to, subject, body, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Allow automation events or admin callers
    if (!payload.event) {
      const user = await base44.auth.me().catch(() => null);
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const order = payload.data;
    const oldStatus = payload.old_data?.status;

    if (!order || order.status !== 'delivered' || oldStatus === 'delivered') {
      return Response.json({ skipped: true, reason: 'Not a delivery transition' });
    }

    if (!order.customer_email || !order.driver_id) {
      return Response.json({ skipped: true, reason: 'Missing customer email or driver' });
    }

    // HMAC-signed token — prevents forging rating links for arbitrary orders
    const token = await createRatingToken(order.id, order.driver_id);
    const ratingUrl = `https://alcohol-delivered.biz/rate-delivery?token=${token}`;

    const emailBody = `Hi ${order.customer_name || 'there'},

Your order #${order.order_number} from ${order.store_name} was just delivered!

We'd love to know how it went. It only takes 10 seconds:

👉 Rate your delivery: ${ratingUrl}

Your feedback helps us improve and reward great drivers.

Thanks for choosing Alcohol Delivered!
— The Alcohol Delivered Team`;

    // Use Gmail to send — platform SendEmail only reaches registered app users
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(order.customer_email, '⭐ How was your delivery? Rate your driver', emailBody, 'Alcohol Delivered');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }

    console.log(`Rating request sent to ${order.customer_email} for order ${order.order_number}`);
    return Response.json({ success: true, recipient: order.customer_email, order: order.order_number });
  } catch (error) {
    console.error('sendRatingRequestEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});