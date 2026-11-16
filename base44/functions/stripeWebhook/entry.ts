import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';
import { secrets, waitUntil } from 'base44:runtime';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';

export default async function(req) {
  try {
  const base44 = createClientFromRequest(req);
  await base44.auth.me().catch(() => null);
  const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  // Two webhook endpoints point here: a Connect webhook (retailer direct-charge
  // events from connected accounts) and an Account webhook (platform payments such
  // as the founding membership). Each has its own signing secret.
  // The test-mode endpoint (used by the end-to-end test retailer) has its own signing secret.
  const webhookSecrets = [secrets.get('STRIPE_WEBHOOK_SECRET'), secrets.get('STRIPE_ACCOUNT_WEBHOOK_SECRET'), secrets.get('STRIPE_TEST_WEBHOOK_SECRET')].filter(Boolean);
  let event;
  let verifyError;
  for (const secret of webhookSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch (err) {
      verifyError = err;
    }
  }
  if (!event) {
    console.error('Webhook signature verification failed:', verifyError?.message);
    return new Response(`Webhook Error: ${verifyError?.message}`, { status: 400 });
  }

  if (event.type.startsWith('checkout.session.') && event.data.object.metadata?.base44_app_id !== secrets.get('BASE44_APP_ID')) {
    return Response.json({ received: true, skipped: 'Different app' });
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return Response.json({ received: true });
    const m = session.metadata || {};

    if (m.purchase_type === 'founding_platinum_membership') {
      if (!m.customer_email) {
        console.warn('Founding membership payment is missing customer email');
        return Response.json({ received: true });
      }

      try {
        const base44 = createClientFromRequest(req);
        const existingMemberships = await base44.asServiceRole.entities.FoundingMembership.filter({
          stripe_session_id: session.id,
        });

        const membershipData = {
          customer_email: m.customer_email,
          customer_name: m.customer_name || session.customer_details?.name || '',
          tier: 'founding_platinum',
          amount_paid: Number(m.amount_paid || 500),
          currency: session.currency || 'usd',
          status: 'active',
          stripe_session_id: session.id,
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : '',
          purchased_at: new Date().toISOString(),
          membership_terms_version: m.terms_version || 'founding-platinum-2026-09-12',
          service_discount_amount: Number(m.service_discount_amount || 2),
          annual_discount_uses: Number(m.annual_discount_uses || 12),
          is_transferable: false,
          notes: 'No alcohol included. Membership purchase only.',
        };

        if (existingMemberships.length > 0) {
          await base44.asServiceRole.entities.FoundingMembership.update(existingMemberships[0].id, membershipData);
        } else {
          await base44.asServiceRole.entities.FoundingMembership.create(membershipData);
        }
        console.log(`Founding Platinum membership activated for ${m.customer_email}`);
        return Response.json({ received: true });
      } catch (err) {
        console.error('Failed to activate founding membership:', err.message);
        return new Response('Membership activation failed', { status: 500 });
      }
    }

    if (!m.order_number || !m.customer_email) {
      console.warn('Missing order metadata, skipping order creation');
      return Response.json({ received: true });
    }

    try {
      const base44 = createClientFromRequest(req);
      const store = await base44.asServiceRole.entities.Store.get(m.store_id).catch(() => null);
      if (!store) {
        console.error(`Paid checkout session ${session.id} references unknown store ${m.store_id}`);
        return new Response('Unknown store', { status: 404 });
      }

      // Test-store sessions run in Stripe test mode on the platform account (no Connect account).
      const isTestStoreOrder = store.is_test_store === true && String(m.test_store) === 'true';
      // Otherwise only a direct charge on the mapped retailer account can create a retailer sale.
      if (!isTestStoreOrder && (!event.account || event.account !== store.stripe_connect_account_id || event.account !== m.stripe_connected_account_id)) {
        console.error('Paid session requires reconciliation: retailer account mismatch', session.id);
        return Response.json({ received: true, reconciliation_required: true });
      }
      if (session.amount_total !== Math.round(Number(m.grand_total) * 100)) {
        throw new Error('Paid checkout total does not match order metadata');
      }

      // Check if order already exists (idempotency guard)
      const existing = await base44.asServiceRole.entities.Order.filter({
        order_number: m.order_number,
      });

      if (existing.length > 0) {
        if (existing[0].store_id !== m.store_id ||
            (existing[0].stripe_session_id && existing[0].stripe_session_id !== session.id)) {
          return new Response('Order already belongs to another payment or retailer', { status: 409 });
        }
        await base44.asServiceRole.entities.Order.update(existing[0].id, {
          stripe_payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_connect_account_id: m.stripe_connected_account_id || '',
          stripe_application_fee_amount: Number(m.application_fee_cents || 0) / 100,
        });
        console.log(`Order ${m.order_number} payment status updated (already existed)`);
        return Response.json({ received: true });
      }

      // Parse items from metadata
      const parts = Number(m.items_parts || 0);
      if (!Number.isInteger(parts) || parts < 0 || parts > 20) throw new Error('Invalid cart metadata');
      const items = JSON.parse(parts ? Array.from({ length: parts }, (_, i) => m[`items_${i}`] || '').join('') : (m.items_json || '[]'));
      if (!Array.isArray(items) || items.length === 0) throw new Error('Paid order is missing cart items');

      const subtotal = parseFloat(m.subtotal) || 0;
      const delivery_fee = parseFloat(m.delivery_fee) || 0;
      const mileage_surcharge = parseFloat(m.mileage_surcharge) || 0;
      const distance_miles = parseFloat(m.distance_miles) || 0;
      const delivery_latitude = parseFloat(m.delivery_latitude) || null;
      const delivery_longitude = parseFloat(m.delivery_longitude) || null;
      const service_fee = parseFloat(m.service_fee) || 0;
      const tax = parseFloat(m.tax) || 0;
      const tip = parseFloat(m.tip) || 0;
      const grand_total = parseFloat(m.grand_total) || 0;

      // Re-check the server-created checkout ID verification referenced by Stripe metadata.
      let checkoutVerification = null;
      if (m.checkout_verification_id) {
        try {
          checkoutVerification = await base44.asServiceRole.entities.IDVerification.get(m.checkout_verification_id);
        } catch {}
      }
      const checkoutIdVerified = Boolean(
        checkoutVerification &&
        checkoutVerification.verification_type === 'checkout' &&
        checkoutVerification.is_verified === true &&
        checkoutVerification.customer_email?.toLowerCase() === m.customer_email?.toLowerCase()
      );
      if (!checkoutIdVerified) {
        console.error(`Paid session ${session.id} has no valid checkout ID verification; order ${m.order_number} requires compliance intervention`);
      }

      // Generate an unguessable receipt token for anonymous receipt lookup.
      // The timestamp-derived order number is display-only and never a credential.
      const receipt_token = crypto.randomUUID();

      // Create the order now that payment is confirmed. New paid orders remain pending
      // until retailer/driver workflow advances them; payment alone does not mean store-confirmed.
      const order = await base44.asServiceRole.entities.Order.create({
        order_number: m.order_number,
        receipt_token,
        customer_email: m.customer_email,
        customer_name: m.customer_name,
        customer_phone: m.customer_phone,
        store_id: m.store_id,
        store_name: m.store_name,
        items,
        subtotal,
        delivery_fee,
        mileage_surcharge,
        distance_miles,
        delivery_latitude,
        delivery_longitude,
        service_fee,
        tax,
        tip,
        total: grand_total,
        delivery_address: m.delivery_address,
        notes: `${isTestStoreOrder ? '[TEST STORE ORDER] ' : ''}${checkoutIdVerified ? (m.notes || '') : `${m.notes || ''}\n[COMPLIANCE_HOLD] Paid order is missing a valid server-side checkout ID verification.`}`.trim(),
        status: 'pending',
        stripe_payment_status: 'paid',
        stripe_session_id: session.id,
        stripe_connect_account_id: m.stripe_connected_account_id || '',
        stripe_application_fee_amount: Number(m.application_fee_cents || 0) / 100,
        id_verified_at_checkout: checkoutIdVerified,
        is_in_legal_zone: m.is_in_legal_zone === 'true',
      });

      console.log(`Order ${m.order_number} created after successful payment`);

      // Link the already-created server-side checkout verification to this paid order.
      if (checkoutVerification) {
        await base44.asServiceRole.entities.IDVerification.update(checkoutVerification.id, {
          customer_name: m.customer_name || checkoutVerification.customer_name || '',
          order_id: order.id,
        });
      }

      // Send receipt email to the customer (transactional, non-blocking).
      waitUntil((async () => {
        try {
          const firstName = (m.customer_name || '').split(' ')[0] || 'there';
          const itemsSummary = items.map(i => `${i.product_name} x${i.quantity} — $${Number(i.subtotal || 0).toFixed(2)}`).join('\n');
          const origin = resolveAppOrigin(req);
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: m.customer_email,
            template_name: 'OrderReceipt',
            category: 'transactional',
            variables: {
              first_name: firstName,
              order_id: m.order_number,
              order_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              store_name: m.store_name || '',
              delivery_address: m.delivery_address || '',
              items_summary: itemsSummary,
              subtotal: `$${Number(subtotal).toFixed(2)}`,
              delivery_fee: `$${Number(delivery_fee).toFixed(2)}`,
              service_fee: `$${Number(service_fee).toFixed(2)}`,
              tax: `$${Number(tax).toFixed(2)}`,
              tip: `$${Number(tip).toFixed(2)}`,
              total: `$${Number(grand_total).toFixed(2)}`,
              cta_url: `${origin}/receipt/${m.order_number}?token=${receipt_token}`,
            },
          });
          console.log(`Receipt email sent for order ${m.order_number}`);
        } catch (emailErr) {
          console.error(`Failed to send receipt email for order ${m.order_number}:`, emailErr.message);
        }
      })());

    } catch (err) {
      console.error('Failed to create order after payment:', err.message);
      // Return 500 so Stripe retries the webhook
      return new Response('Order creation failed', { status: 500 });
    }
  }

  if (event.type === 'checkout.session.expired') {
    // Session expired without payment — nothing to clean up since order isn't created yet
    console.log(`Checkout session expired: ${event.data.object.metadata?.order_number}`);
  }

  // Notify the admin when a Stripe payout is processed or fails, for cash-flow tracking.
  if (event.type === 'payout.paid' || event.type === 'payout.failed') {
    const payout = event.data.object;
    waitUntil((async () => {
      try {
        const base44 = createClientFromRequest(req);
        const amount = (payout.amount || 0) / 100;
        const currency = (payout.currency || 'usd').toUpperCase();
        const status = event.type === 'payout.paid' ? 'paid' : 'failed';
        const arrivalDate = payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
          : 'N/A';
        const destination = payout.destination?.id || payout.method || 'N/A';
        const subject = event.type === 'payout.paid'
          ? `Stripe payout of ${currency} ${amount.toFixed(2)} processed`
          : `Stripe payout of ${currency} ${amount.toFixed(2)} FAILED`;
        const body = `A Stripe payout has been ${status}.\n\n`
          + `Amount: ${currency} ${amount.toFixed(2)}\n`
          + `Status: ${status}\n`
          + `Expected arrival: ${arrivalDate}\n`
          + `Destination: ${destination}\n`
          + `Payout ID: ${payout.id}\n`
          + `Statement descriptor: ${payout.statement_descriptor || 'N/A'}\n`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: secrets.get('STORE_MANAGER_EMAIL'),
          subject,
          body,
          category: 'transactional',
        });
        console.log(`Payout ${status} notification sent for ${payout.id}: ${currency} ${amount.toFixed(2)}`);
      } catch (err) {
        console.error(`Failed to send payout notification for ${payout.id}:`, err.message);
      }
    })());
  }

  // Refresh retailer payment readiness without bypassing go-live compliance checks.
  if (event.type === 'account.updated') {
    const account = event.data.object;
    {
      try {
        const base44 = createClientFromRequest(req);
        const stores = await base44.asServiceRole.entities.Store.filter({
          stripe_connect_account_id: account.id,
        });
        for (const store of stores) {
          const ready = account.charges_enabled && account.payouts_enabled && account.details_submitted;
          const status = ready ? 'connected' : 'pending';
          if (store.stripe_connection_status !== status) {
            await base44.asServiceRole.entities.Store.update(store.id, {
              stripe_connection_status: status,
              ...(ready ? { stripe_connected_at: new Date().toISOString() } : {}),
            });
          }
          // Stripe approval alone does not approve a license, agreement or catalog.
        }
      } catch (err) {
        console.error(`Failed to auto-activate store for account ${account.id}:`, err.message);
      }
    }
  }

  return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error.message);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}