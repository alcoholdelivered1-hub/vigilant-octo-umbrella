import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import Stripe from 'npm:stripe@14.21.0';
import { secrets } from 'base44:runtime';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';
import { getRetailerStripeAccount, retailerPaymentsReady } from '../../shared/retailerStripe.ts';
import { geocodeDeliveryAddress, verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      order_number, items, tip,
      store_id, customer_name, customer_phone, delivery_address,
      notes, date_of_birth, checkout_verification_id,
    } = await req.json();

    if (!order_number || !store_id || !Array.isArray(items) || items.length === 0 || items.length > 40 || !delivery_address || !customer_name || !customer_phone) {
      return Response.json({ error: 'Invalid checkout request' }, { status: 400 });
    }

    const store = await base44.asServiceRole.entities.Store.get(store_id);
    // Test retailers run the real flow in Stripe test mode: no retailer Connect account is required.
    const isTestStore = store?.is_test_store === true;
    if (!store?.is_active || store.onboarding_status !== 'live' || store.compliance_status !== 'compliant' || (!isTestStore && store.stripe_connection_status !== 'connected')) {
      return Response.json({ error: 'This retailer is not ready to accept payments yet.' }, { status: 409 });
    }
    if (store.id === '6a32d14d09b760f592dbf19e') {
      const approvals = await base44.asServiceRole.entities.StoreLaunchApproval.filter({ store_id: store.id, check_version: 'beverage_king_v1' }, '-approved_at', 1);
      if (!approvals.length) return Response.json({ error: 'Beverage King must pass every go-live check before accepting payments.' }, { status: 409 });
    }
    let retailerAccount = null;
    if (!isTestStore) {
      retailerAccount = await getRetailerStripeAccount(store);
      if (!retailerPaymentsReady(retailerAccount)) return Response.json({ error: 'This retailer must finish Stripe verification and bank setup before accepting orders.' }, { status: 409 });
    }

    // Validate the server-recorded verification by ID and owner, not a browser-supplied image URL.
    if (!checkout_verification_id) {
      return Response.json({ error: 'Verified ID is required before payment.' }, { status: 403 });
    }
    const verification = await base44.asServiceRole.entities.IDVerification.get(checkout_verification_id);
    if (!verification || verification.verification_type !== 'checkout' || verification.is_verified !== true ||
        verification.customer_email?.toLowerCase() !== user.email?.toLowerCase() ||
        verification.date_of_birth !== date_of_birth) {
      return Response.json({ error: 'ID verification could not be validated. Please verify your ID again.' }, { status: 403 });
    }

    // Rebuild cart pricing from authoritative Product records; never trust browser-supplied names/prices/subtotals.
    const validatedItems = [];
    const productIds = new Set();
    for (const requested of items) {
      if (productIds.has(requested.product_id)) return Response.json({ error: 'Combine duplicate cart items before checkout.' }, { status: 400 });
      productIds.add(requested.product_id);
      const quantity = Math.floor(Number(requested.quantity));
      if (!requested.product_id || !Number.isFinite(quantity) || quantity < 1 || quantity > 25) {
        return Response.json({ error: 'Invalid cart quantity.' }, { status: 400 });
      }
      const product = await base44.asServiceRole.entities.Product.get(requested.product_id);
      if (!product || product.store_id !== store_id) {
        return Response.json({ error: 'A cart item does not belong to this retailer.' }, { status: 400 });
      }
      if (!['clover', 'manual', 'csv'].includes(product.inventory_source) || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0 || product.in_stock === false || (product.stock_quantity != null && product.stock_quantity < quantity)) {
        return Response.json({ error: `${product.name} is currently unavailable in the requested quantity.` }, { status: 409 });
      }
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        price: Number(product.price),
        subtotal: Number((Number(product.price) * quantity).toFixed(2)),
      });
    }

    const subtotal = Number(validatedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

    // Radius zones control service availability, never establish legal territory.
    const coordinates = await geocodeDeliveryAddress(delivery_address);
    const deliveryLat = coordinates.latitude;
    const deliveryLon = coordinates.longitude;
    await verifyABCDeliveryArea(store, deliveryLat, deliveryLon);
    const zones = await base44.asServiceRole.entities.DeliveryZone.filter({ is_active: true });
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 3959;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const matchedZones = zones
      .filter((z) => z.center_latitude && z.center_longitude && z.radius_miles)
      .map((z) => ({ zone: z, distance: haversine(deliveryLat, deliveryLon, z.center_latitude, z.center_longitude) }))
      .filter(({ zone, distance }) => distance <= zone.radius_miles)
      .sort((a, b) => a.zone.radius_miles - b.zone.radius_miles);
    if (matchedZones.some(({ zone }) => zone.is_wet === false)) {
      return Response.json({ error: 'Alcohol delivery is not available at this address.' }, { status: 403 });
    }
    const wetZones = matchedZones.filter(({ zone }) => zone.is_wet === true);
    if (wetZones.length === 0) {
      return Response.json({ error: 'This address is outside our current legal delivery zones.' }, { status: 403 });
    }
    const deliveryZone = wetZones[0].zone;
    if (deliveryZone.legal_hours_start && deliveryZone.legal_hours_end) {
      const timeParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const hour = Number(timeParts.find((p) => p.type === 'hour')?.value || 0);
      const minute = Number(timeParts.find((p) => p.type === 'minute')?.value || 0);
      const nowMinutes = hour * 60 + minute;
      const [startH, startM] = deliveryZone.legal_hours_start.split(':').map(Number);
      const [endH, endM] = deliveryZone.legal_hours_end.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const withinHours = startMinutes <= endMinutes
        ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
        : nowMinutes >= startMinutes || nowMinutes <= endMinutes;
      if (!withinHours) return Response.json({ error: `Orders are not available in ${deliveryZone.name} at this time.` }, { status: 403 });
    }
    const minimum = Number(deliveryZone.min_order_amount ?? 20);
    if (subtotal < minimum) return Response.json({ error: `Minimum order is $${minimum.toFixed(2)}.` }, { status: 400 });

    const distanceMiles = (store.latitude && store.longitude) ? haversine(store.latitude, store.longitude, deliveryLat, deliveryLon) : 0;
    const deliveryFee = Number(deliveryZone.delivery_fee ?? 3);
    const mileageSurcharge = Number(Math.max(0, distanceMiles - 7).toFixed(2));
    // The customer pays a 25% service fee on the merchandise subtotal.
    const serviceFee = Number((subtotal * 0.25).toFixed(2));
    const appSupportFee = Number((subtotal * 0.04).toFixed(2));
    const taxRate = Number(store.sales_tax_rate ?? 0.085);
    const tax = Number((subtotal * taxRate).toFixed(2));
    const safeTip = Number(Math.min(100, Math.max(0, Number(tip) || 0)).toFixed(2));
    const grandTotal = Number((subtotal + deliveryFee + mileageSurcharge + serviceFee + appSupportFee + tax + safeTip).toFixed(2));

    // Direct charge: retailer receives merchandise + tax, less Stripe processing fees.
    // The application fee collects customer service/support/delivery fees and driver tip.
    const applicationFeeCents = isTestStore ? 0 : Math.round((serviceFee + appSupportFee + deliveryFee + mileageSurcharge + safeTip) * 100);
    const stripe = new Stripe(secrets.get(isTestStore ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'));
    const lineItems = validatedItems.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.product_name, description: `From ${store.name}` },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const addFee = (name, amount) => {
      if (amount > 0) {
        lineItems.push({
          price_data: { currency: 'usd', product_data: { name }, unit_amount: Math.round(amount * 100) },
          quantity: 1,
        });
      }
    };
    addFee('Delivery Fee', deliveryFee);
    addFee('Mileage Fee', mileageSurcharge);
    addFee('Service Fee', serviceFee);
    addFee('App Support Fee', appSupportFee);
    addFee('Tax', tax);
    addFee('Driver Tip', safeTip);

    const origin = resolveAppOrigin(req);
    const appId = secrets.get('BASE44_APP_ID');
    const metadata = {
      base44_app_id: appId,
      order_number,
      customer_email: user.email,
      customer_name,
      customer_phone,
      delivery_address,
      notes: notes || '',
      store_id,
      store_name: store.name,
      subtotal: String(subtotal),
      delivery_fee: String(deliveryFee),
      mileage_surcharge: String(mileageSurcharge),
      distance_miles: String(Number(distanceMiles.toFixed(2))),
      delivery_latitude: String(deliveryLat),
      delivery_longitude: String(deliveryLon),
      service_fee: String(serviceFee),
      fee_model: 'customer_service_fee_25_v1',
      app_support_fee: String(appSupportFee),
      tax: String(tax),
      sales_tax_rate: String(taxRate),
      tip: String(safeTip),
      grand_total: String(grandTotal),
      stripe_connected_account_id: retailerAccount?.id || '',
      application_fee_cents: String(applicationFeeCents),
      is_in_legal_zone: 'true',
      checkout_verification_id,
      test_store: isTestStore ? 'true' : 'false',
    };
    // Stripe metadata values are limited to 500 characters each.
    const cartJson = JSON.stringify(validatedItems);
    const cartParts = cartJson.match(/[\s\S]{1,500}/g) || [];
    if (cartParts.length > 20) return Response.json({ error: 'Please split this cart into smaller orders.' }, { status: 400 });
    metadata.items_parts = String(cartParts.length);
    cartParts.forEach((part, index) => { metadata[`items_${index}`] = part; });

    const sessionParams = {
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/orders?payment=success&order=${order_number}`,
      cancel_url: `${origin}/checkout?payment=cancelled`,
      customer_email: user.email,
      metadata,
    };
    // Live retailers are charged directly on their own connected account with an application fee.
    // Test retailers are charged on the platform account in Stripe test mode instead.
    if (!isTestStore) {
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFeeCents,
        metadata: { base44_app_id: appId, order_number, store_id, stripe_connected_account_id: retailerAccount.id },
      };
    }
    const session = await stripe.checkout.sessions.create(
      sessionParams,
      isTestStore
        ? { idempotencyKey: `${appId}:test:${order_number}` }
        : { stripeAccount: retailerAccount.id, idempotencyKey: `${appId}:${retailerAccount.id}:${order_number}` },
    );

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}