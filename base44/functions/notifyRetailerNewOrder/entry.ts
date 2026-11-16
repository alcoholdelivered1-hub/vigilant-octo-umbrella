import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import MailComposer from 'npm:nodemailer@6.9.16/lib/mail-composer/index.js';
import { readRichardOrderRelease } from '../../shared/richardOrderRelease.ts';

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const submissionNotice = payload?.action === 'justin_submission';
    const manualResend = payload?.action === 'resend' || submissionNotice;
    if ((submissionNotice || !manualResend) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let submissionMarker = '';
    if (submissionNotice) {
      const justin = await base44.entities.User.get('6a5aaaa4c78d2e79f33db945');
      if (!justin.background_check_submitted || !payload.submission_date || justin.background_check_date !== payload.submission_date) {
        return Response.json({ skipped: true, reason: 'No matching Justin submission' });
      }
      submissionMarker = `[JUSTIN_SUBMISSION_RETAILER_NOTIFIED:${justin.background_check_date}]`;
    }
    let order = payload?.data || null;
    if (manualResend) {
      if (submissionNotice) {
        order = await base44.entities.Order.get('6a6b750af77918da2b8e4c09');
        if (order.store_id !== '6a32d14d09b760f592dbf19e' || order.status !== 'pending' || order.notes?.includes(submissionMarker)) {
          return Response.json({ skipped: true, reason: 'Order no longer pending or already notified for this submission' });
        }
      } else if (payload.order_id) {
        order = await base44.asServiceRole.entities.Order.get(payload.order_id).catch(() => null);
      } else if (payload.order_number) {
        const orders = await base44.asServiceRole.entities.Order.filter({ order_number: payload.order_number }, '-updated_date', 1);
        order = orders?.[0] || null;
      }
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
      const callerEmail = user.email?.trim().toLowerCase();
      const ownsOrder = Boolean(callerEmail) && order.customer_email?.trim().toLowerCase() === callerEmail;
      if (user.role !== 'admin' && !ownsOrder) {
        return Response.json({ error: 'You can only resend notifications for your own order.' }, { status: 403 });
      }
      if (order.stripe_payment_status !== 'paid') {
        return Response.json({ error: 'Retailer reminders are only allowed for paid orders' }, { status: 409 });
      }
    } else if (!order || payload?.event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event or missing order data' });
    } else {
      order = await base44.asServiceRole.entities.Order.get(order.id);
    }

    const priorityStore = ['6a32d14d09b760f592dbf19e', '6abbd1a16dc8d922f3b73caf'].includes(order.store_id);
    if (priorityStore && !submissionNotice && (order.stripe_payment_status !== 'paid' || order.status !== 'pending')) {
      return Response.json({ skipped: true, reason: 'Awaiting a paid order that requires retailer acceptance' });
    }

    if (!order.store_id) {
      return Response.json({ skipped: true, reason: 'No store_id on order' });
    }

    // Fetch the store to get contact info
    const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
    const store = stores[0];

    if (!store || !store.email) {
      console.log(`Store ${order.store_id} has no email configured — skipping retailer notification`);
      return Response.json({ skipped: true, reason: 'Store has no email address' });
    }
    if (manualResend && user.role !== 'admin' && user.email?.toLowerCase() !== store.email.toLowerCase()) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (submissionNotice && payload.dry_run === true) {
      return Response.json({ ready: true, order_number: order.order_number, recipient: store.email, email_sent: false });
    }

    const itemLines = (order.items || [])
      .map(i => `  • ${i.product_name} x${i.quantity} — $${(i.subtotal || i.price * i.quantity || 0).toFixed(2)}`)
      .join('\n');

    const richardReview = order.order_number === 'SS-MS7OHVYB' ? await readRichardOrderRelease(base44, order, store) : null;
    const subject = richardReview && !richardReview.release_ready
      ? `Urgent review: Richard’s order ${order.order_number}`
      : manualResend
      ? `🔔 Paid Order #${order.order_number} — Please Confirm`
      : `🛒 New Order #${order.order_number} — Action Required`;

    const body = `Hello ${store.name} Team,

${richardReview && !richardReview.release_ready
  ? 'Richard’s long-pending order is recorded as paid in the app, but payment reconciliation and item corrections are unresolved. Please review and reply urgently; this notice does not authorize preparation, another charge, or dispatch.'
  : submissionNotice
  ? 'Justin Bess has submitted his background-check consent form. Richard Campbell’s paid order remains pending in your Store Dashboard. Please review the order and confirm availability; do not charge the customer again. Form submission is not background-check clearance or authorization to dispatch a driver.'
  : manualResend
    ? 'This paid order is waiting for your confirmation in your Store Dashboard. Do not charge the customer again.'
    : 'A new order has just been placed and is waiting for your confirmation.'}

─────────────────────────────
ORDER DETAILS
─────────────────────────────
Order #:        ${order.order_number}
Customer:       ${order.customer_name}
Phone:          ${order.customer_phone || 'N/A'}
Delivery To:    ${order.delivery_address}

ITEMS:
${itemLines || '  (No items listed)'}

─────────────────────────────
Subtotal:       $${(order.subtotal || 0).toFixed(2)}
Delivery Fee:   $${(order.delivery_fee || 0).toFixed(2)}
Tax:            $${(order.tax || 0).toFixed(2)}
TOTAL:          $${(order.total || 0).toFixed(2)}
─────────────────────────────

${richardReview && !richardReview.release_ready
  ? `URGENT FULFILLMENT REVIEW, NOT AUTHORIZATION TO PREPARE OR DISPATCH:\n${richardReview.release_blockers.map(blocker => `• ${blocker}`).join('\n')}\n\nPlease reply with the exact available items, shelf prices and a retailer sale reference. Brown Ale’s saved reference now points to Shiner Bock; do not substitute without Richard’s explicit approval. Operations must verify the original payment and Richard must approve any changed items or total. Do not charge again.\n\nReview the order and discuss corrections with Richard: https://alcohol-delivered.biz/retailer-dashboard. Complete store setup at https://alcohol-delivered.biz/onboarding?store_id=${encodeURIComponent(store.id)}.`
  : submissionNotice
  ? 'Review Richard’s pending order at https://alcohol-delivered.biz/store/dashboard. Delivery remains subject to verified driver clearance and retailer launch readiness.'
  : '⚡ PLEASE CONFIRM AND BEGIN PREPARING THIS ORDER AS SOON AS POSSIBLE.\n\nA driver will be dispatched to your location for pickup. Please have the order sealed and ready.'}

If you have questions, log in to the Alcohol Delivered Partner Portal or reply to this email.

— Alcohol Delivered Operations Team
alcohol-delivered.biz`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const message = await new MailComposer({
      from: 'Alcohol Delivered Orders <alcohol.delivered1@gmail.com>',
      to: store.email,
      subject,
      text: body,
    }).compile().build();
    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(message) }),
    });
    if (!sendResponse.ok) throw new Error(`Gmail notification failed: ${await sendResponse.text()}`);

    // FCM push notification is optional and must not fail a delivered email.
    let pushAttempted = false;
    let pushResult = null;
    try {
      const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ store_id: order.store_id });
      const retailerTokens = fcmTokens.filter(t =>
        t.token && (
          t.user_email?.toLowerCase() === store.email.toLowerCase()
          || t.user_role === 'store'
        )
      );
      const tokens = [...new Set(retailerTokens.map(t => t.token))];
      if (tokens.length > 0) {
        pushAttempted = true;
        pushResult = await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens,
          title: manualResend ? `🔔 Paid Order #${order.order_number}` : `🛒 New Order #${order.order_number}`,
          body: `${order.customer_name} · $${(order.total || 0).toFixed(2)} · ${(order.items || []).length} item(s)`,
          data: { order_id: order.id, order_number: order.order_number, type: manualResend ? 'order_reminder' : 'new_order' },
        });
        console.log('FCM push result:', JSON.stringify(pushResult));
      } else {
        console.log('No retailer FCM tokens for store — push skipped');
      }
    } catch (pushError) {
      pushResult = { error: pushError.message };
      console.warn('Optional retailer push failed after email was sent:', pushError.message);
    }

    if (manualResend) {
      const timestamp = new Date().toISOString();
      await base44.asServiceRole.entities.Order.update(order.id, {
        notes: `${order.notes || ''}\n${submissionMarker || `[RETAILER_NOTIFIED:${timestamp}]`} Paid-order reminder emailed to ${store.email}; tablet push ${pushAttempted ? 'attempted' : 'not available'}.`.trim(),
      });
    }

    console.log(`Retailer notification sent to ${store.email} for order ${order.order_number}`);
    return Response.json({
      success: true,
      store: store.name,
      recipient: store.email,
      email_sent: true,
      push_attempted: pushAttempted,
      push_result: pushResult,
    });

  } catch (error) {
    console.error('Error sending retailer notification:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}