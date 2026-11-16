import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { assertAdmin } from '../../shared/authGuard.ts';
import { findBeverageKingStores } from '../../shared/beverageKingStore.ts';
import MailComposer from 'npm:nodemailer@6.9.16/lib/mail-composer/index.js';

const BK_STORE_EMAIL = 'bevking71603@gmail.com';
const ALERT_MARKER = '[BK_STRIPE_READY_ALERT';

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;

    // 1. Find Beverage King store
    const stores = await findBeverageKingStores(base44);
    const store = stores.length === 1 ? stores[0] : null;
    if (!store) return Response.json({ ready: false, reason: 'Beverage King store not found' });

    const accountId = store.stripe_connect_account_id;
    if (!accountId) return Response.json({ ready: false, reason: 'No Stripe account connected' });

    // 2. Check Stripe account readiness
    const stripeHeaders = {
      Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
      'Stripe-Version': '2025-10-29.clover',
    };
    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, { headers: stripeHeaders });
    const account = await accountRes.json();

    const stripeReady = accountRes.ok &&
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true;

    if (!stripeReady) {
      return Response.json({
        ready: false,
        stripe: {
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        },
      });
    }

    // 3. Find Richard's pending paid order(s) for Beverage King
    const pendingOrders = await base44.entities.Order.filter(
      { store_id: store.id, status: 'pending', stripe_payment_status: 'paid' },
      '-created_date',
      50,
    );

    if (pendingOrders.length === 0) {
      return Response.json({ ready: true, alerted: false, reason: 'No pending paid orders to alert' });
    }

    // 4. Filter out orders that were already alerted
    const unalerted = pendingOrders.filter(o => !(o.notes || '').includes(ALERT_MARKER));

    if (unalerted.length === 0) {
      return Response.json({ ready: true, alerted: false, reason: 'All pending orders already alerted' });
    }

    // 5. Send FCM push to the BK tablet
    const fcmRecords = await base44.entities.FCMToken.filter({ store_id: store.id });
    const tokens = [...new Set(fcmRecords.map(t => t.token).filter(Boolean))];

    let pushResult = null;
    if (tokens.length > 0) {
      try {
        pushResult = await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens,
          title: '🔴 Beverage King is LIVE — Fill Pending Orders',
          body: `${unalerted.length} paid order(s) waiting. Stripe is ready — accept in your dashboard now.`,
          data: {
            store_id: store.id,
            order_id: unalerted[0].id,
            order_number: unalerted[0].order_number,
            type: 'bk_stripe_ready',
          },
        });
      } catch (pushError) {
        pushResult = { error: pushError.message };
      }
    }

    // 6. Send email via Gmail connector (backup channel)
    let emailResult = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const orderLines = unalerted.map(o =>
        `  • #${o.order_number} — ${o.customer_name} — $${(o.total || 0).toFixed(2)}`
      ).join('\n');

      const subject = '🔴 Beverage King is LIVE — Accept Pending Orders';
      const body = `Hello Beverage King Team,

Your Stripe account is now fully verified and ready to accept payments!

You have ${unalerted.length} paid order(s) waiting for acceptance:

${orderLines}

Please log in to your store dashboard (tablet) and accept these orders so they can be prepared and dispatched.

— Alcohol Delivered Operations Team`;

      const message = await new MailComposer({
        from: 'Alcohol Delivered Operations <alcohol.delivered1@gmail.com>',
        to: store.email,
        subject,
        text: body,
      }).compile().build();

      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: toBase64Url(message) }),
      });
      emailResult = { sent: sendRes.ok, status: sendRes.status };
      if (!sendRes.ok) emailResult.error = await sendRes.text();
    } catch (emailError) {
      emailResult = { error: emailError.message };
    }

    // 7. Mark each order as alerted
    const timestamp = new Date().toISOString();
    for (const order of unalerted) {
      await base44.entities.Order.update(order.id, {
        notes: `${order.notes || ''}\n${ALERT_MARKER}:${timestamp}] Stripe readiness detected; tablet push and email sent to ${store.email}.`.trim(),
      });
    }

    console.log(`BK Stripe ready — alerted for ${unalerted.length} order(s); push tokens: ${tokens.length}`);

    return Response.json({
      ready: true,
      alerted: true,
      orders_alerted: unalerted.length,
      order_numbers: unalerted.map(o => o.order_number),
      push_tokens: tokens.length,
      push_result: pushResult,
      email_result: emailResult,
    });
  } catch (error) {
    console.error('alertBeverageKingTablet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}