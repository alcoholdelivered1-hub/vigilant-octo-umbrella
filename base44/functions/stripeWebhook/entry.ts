import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const m = session.metadata || {};

    if (!m.order_number || !m.customer_email) {
      console.warn('Missing order metadata, skipping order creation');
      return Response.json({ received: true });
    }

    try {
      const base44 = createClientFromRequest(req);

      // Check if order already exists (idempotency guard)
      const existing = await base44.asServiceRole.entities.Order.filter({
        order_number: m.order_number,
      });

      if (existing.length > 0) {
        // Order already exists — just update payment status
        await base44.asServiceRole.entities.Order.update(existing[0].id, {
          stripe_payment_status: 'paid',
          stripe_session_id: session.id,
          status: existing[0].status === 'pending' ? 'confirmed' : existing[0].status,
        });
        console.log(`Order ${m.order_number} payment status updated (already existed)`);
        return Response.json({ received: true });
      }

      // Parse items from metadata
      let items = [];
      try { items = JSON.parse(m.items_json || '[]'); } catch {}

      const subtotal = parseFloat(m.subtotal) || 0;
      const delivery_fee = parseFloat(m.delivery_fee) || 0;
      const mileage_surcharge = parseFloat(m.mileage_surcharge) || 0;
      const distance_miles = parseFloat(m.distance_miles) || 0;
      const service_fee = parseFloat(m.service_fee) || 0;
      const tax = parseFloat(m.tax) || 0;
      const alcohol_excise_tax = parseFloat(m.alcohol_excise_tax) || 0;
      const tip = parseFloat(m.tip) || 0;
      const grand_total = parseFloat(m.grand_total) || 0;

      // Create the order now that payment is confirmed
      const order = await base44.asServiceRole.entities.Order.create({
        order_number: m.order_number,
        customer_email: m.customer_email,
        customer_name: m.customer_name,
        customer_phone: m.customer_phone,
        store_id: m.store_id,
        store_name: m.store_name,
        store_email: m.store_email || '',
        items,
        subtotal,
        delivery_fee,
        mileage_surcharge,
        distance_miles,
        delivery_latitude: parseFloat(m.delivery_latitude) || null,
        delivery_longitude: parseFloat(m.delivery_longitude) || null,
        service_fee,
        tax,
        alcohol_excise_tax,
        tip,
        total: grand_total,
        delivery_address: m.delivery_address,
        notes: m.notes || '',
        status: 'confirmed',
        stripe_payment_status: 'paid',
        stripe_session_id: session.id,
        id_verified_at_checkout: true, // Customer confirmed DOB + age at checkout
        is_in_legal_zone: m.is_in_legal_zone === 'true',
      });

      console.log(`Order ${m.order_number} created after successful payment`);

      // --- Deduct referral credits used for this order ---
      const referralCreditUsed = parseFloat(m.referral_credit_applied) || 0;
      if (referralCreditUsed > 0) {
        try {
          const users = await base44.asServiceRole.entities.User.filter({ email: m.customer_email });
          if (users.length > 0) {
            const newCredits = Math.max(0, (users[0].referral_credits || 0) - referralCreditUsed);
            await base44.asServiceRole.entities.User.update(users[0].id, { referral_credits: newCredits });
            console.log(`Deducted ${referralCreditUsed} cents referral credit from ${m.customer_email}`);
          }
        } catch (e) {
          console.error('Failed to deduct referral credits:', e.message);
        }
      }

      // NOTE: retailer notification is owned by the "Fulfill Order After Payment"
      // workflow (which fires on this same paid transition) to avoid duplicate
      // store emails. We only send the customer-facing confirmation here.

      // Send order confirmation email to customer
      try {
        await base44.asServiceRole.functions.invoke('sendOrderConfirmationEmail', {
          order_id: order.id,
          order_number: m.order_number,
          customer_email: m.customer_email,
          customer_name: m.customer_name,
          store_name: m.store_name,
          items: items,
          total: grand_total,
          delivery_address: m.delivery_address,
        });
      } catch (e) {
        console.error('Failed to send confirmation email:', e.message);
      }

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

  // Handle Stripe Connect account updates (driver + retailer onboarding completion)
  if (event.type === 'account.updated') {
    const account = event.data.object;
    const base44 = createClientFromRequest(req);

    // Mark store as onboarded if charges + payouts are enabled
    if (account.charges_enabled && account.payouts_enabled) {
      try {
        const stores = await base44.asServiceRole.entities.Store.filter({
          stripe_connect_account_id: account.id,
        });
        for (const store of stores) {
          if (!store.stripe_connect_onboarded) {
            await base44.asServiceRole.entities.Store.update(store.id, {
              stripe_connect_onboarded: true,
            });
            console.log(`Store ${store.name} marked as Stripe onboarded`);
          }
        }
      } catch (e) {
        console.error('Failed to update store onboarding status:', e.message);
      }
    }

    // Mark driver as onboarded (stripe_connect_account_id is stored on the user)
    try {
      const users = await base44.asServiceRole.entities.User.filter({
        stripe_connect_account_id: account.id,
      });
      for (const u of users) {
        if (!u.stripe_connect_onboarded) {
          await base44.asServiceRole.entities.User.update(u.id, {
            stripe_connect_onboarded: true,
          });
          console.log(`Driver ${u.email} marked as Stripe onboarded`);
        }
      }
    } catch (e) {
      console.error('Failed to update driver onboarding status:', e.message);
    }
  }

  // Handle refunds — mark order as refunded
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const sessionId = charge.metadata?.order_number;

    try {
      const base44 = createClientFromRequest(req);
      const orders = await base44.asServiceRole.entities.Order.filter({
        order_number: sessionId,
      });

      if (orders.length > 0) {
        const order = orders[0];
        await base44.asServiceRole.entities.Order.update(order.id, {
          status: 'cancelled',
          stripe_payment_status: 'failed',
          refusal_reason: 'Payment refunded via Stripe',
        });

        // Notify customer, retailer, and admin of refund
        try {
          await base44.asServiceRole.functions.invoke('notifyOrderStatusChange', {
            order_id: order.id,
            order_number: order.order_number,
            old_status: order.status,
            new_status: 'refunded',
            customer_email: order.customer_email,
            store_id: order.store_id,
          });
        } catch (e) {
          console.error('Failed to notify refund:', e.message);
        }

        console.log(`Order ${order.order_number} marked as refunded`);
      }
    } catch (e) {
      console.error('Failed to process refund:', e.message);
    }
  }

  // ── Subscription lifecycle events ──────────────────────────────

  if (event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

    try {
      const base44 = createClientFromRequest(req);

      // Find user by stripe_customer_id, fall back to email from Stripe customer
      let users = await base44.asServiceRole.entities.User.filter({
        stripe_customer_id: customerId,
      });

      if (users.length === 0 && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.email) {
          users = await base44.asServiceRole.entities.User.filter({ email: customer.email });
        }
      }

      if (users.length > 0) {
        const user = users[0];
        const status = event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : sub.status;

        await base44.asServiceRole.entities.User.update(user.id, {
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          membership_status: status,
          membership_expires_at: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });

        console.log(`User ${user.email} membership updated: ${status} (sub ${sub.id})`);
      } else {
        console.warn(`No user found for Stripe customer ${customerId}`);
      }
    } catch (e) {
      console.error(`Failed to process ${event.type}:`, e.message);
    }
  }

  // ── Invoice payment events (subscription invoices only) ────────

  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;

    if (invoice.subscription) {
      try {
        const base44 = createClientFromRequest(req);
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        let users = await base44.asServiceRole.entities.User.filter({
          stripe_customer_id: customerId,
        });

        if (users.length === 0 && customerId) {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer.email) {
            users = await base44.asServiceRole.entities.User.filter({ email: customer.email });
          }
        }

        if (users.length > 0) {
          const user = users[0];

          if (event.type === 'invoice.payment_succeeded') {
            await base44.asServiceRole.entities.User.update(user.id, {
              stripe_customer_id: customerId,
              stripe_subscription_id: invoice.subscription,
              membership_status: 'active',
              membership_expires_at: invoice.period_end
                ? new Date(invoice.period_end * 1000).toISOString()
                : null,
            });
            console.log(`User ${user.email} membership activated (invoice ${invoice.id})`);
          } else {
            await base44.asServiceRole.entities.User.update(user.id, {
              membership_status: 'past_due',
            });
            console.log(`User ${user.email} membership past_due (invoice ${invoice.id})`);
          }
        }
      } catch (e) {
        console.error(`Failed to process ${event.type}:`, e.message);
      }
    }
  }

  // ── Payment intent succeeded ───────────────────────────────────
  // Orders are already handled via checkout.session.completed above;
  // subscription payments via invoice.payment_succeeded above.
  // Log for visibility.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    console.log(`Payment intent succeeded: ${pi.id} ($${(pi.amount / 100).toFixed(2)} ${pi.currency})`);
  }

  return Response.json({ received: true });
});