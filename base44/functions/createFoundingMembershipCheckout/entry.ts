import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import Stripe from 'npm:stripe@14.21.0';
import { secrets } from 'base44:runtime';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';

const PRICE_CENTS = 50000;
const MAX_MEMBERS = 20;
const TERMS_VERSION = 'founding-platinum-2026-09-12';

export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: 'Please sign in before purchasing.' }, { status: 401 });
    }

    const existing = await base44.asServiceRole.entities.FoundingMembership.filter({
      customer_email: user.email,
      status: 'active',
    });
    if (existing.length > 0) {
      return Response.json({ error: 'You already have an active Founding Platinum Membership.' }, { status: 409 });
    }

    const active = await base44.asServiceRole.entities.FoundingMembership.filter({ status: 'active' });
    if (active.length >= MAX_MEMBERS) {
      return Response.json({ error: 'Founding Platinum Memberships are sold out.' }, { status: 409 });
    }

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const origin = resolveAppOrigin(req);
    const appId = secrets.get('BASE44_APP_ID');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: PRICE_CENTS,
          product_data: {
            name: 'Alcohol Delivered Founding Platinum Membership',
            description: 'One-time founding membership. Includes service-related benefits; no alcohol is included or given away.',
          },
        },
        quantity: 1,
      }],
      metadata: {
        base44_app_id: appId,
        purchase_type: 'founding_platinum_membership',
        customer_email: user.email,
        customer_name: user.full_name || '',
        terms_version: TERMS_VERSION,
        amount_paid: '500',
        service_discount_amount: '2',
        annual_discount_uses: '12',
      },
      payment_intent_data: {
        metadata: {
          base44_app_id: appId,
          purchase_type: 'founding_platinum_membership',
          customer_email: user.email,
        },
      },
      success_url: `${origin}/membership?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/membership?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    return Response.json({
      url: session.url,
      session_id: session.id,
      remaining_before_purchase: Math.max(0, MAX_MEMBERS - active.length),
    });
  } catch (error) {
    console.error('Founding membership checkout error:', error.message);
    return Response.json({ error: 'Membership checkout is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}