import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';
import { verifyDeliveryCompliance } from '../../shared/deliveryCompliance.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const {
      order_number, items, delivery_fee, mileage_surcharge, distance_miles,
      service_fee, tax, tip, tax_rate, alcohol_excise_tax,
      store_id, store_name, total,
      customer_name, customer_email, customer_phone, delivery_address, notes,
      date_of_birth, is_in_legal_zone,
    } = await req.json();

    if (!customer_email) {
      return Response.json({ error: 'Customer email is required' }, { status: 400 });
    }

    // Re-fetch live prices AND categories from the database so the customer is
    // always charged the retailer's current price — never trust client-sent prices.
    let verifiedItems = items;
    let verifiedSubtotal = 0;
    let verifiedAlcoholExciseTax = 0;
    try {
      const productIds = items.map(i => i.product_id).filter(Boolean);
      if (productIds.length > 0) {
        const liveProducts = await base44.asServiceRole.entities.Product.filter(
          { id: { $in: productIds } }, 'name', 200
        );
        const productMap = {};
        liveProducts.forEach(p => { productMap[p.id] = { price: p.price, category: p.category, in_stock: p.in_stock, stock_quantity: p.stock_quantity }; });

        // Verify stock availability — block checkout if any item is out of stock or insufficient quantity
        const stockErrors = [];
        items.forEach(item => {
          const live = productMap[item.product_id];
          if (!live) {
            stockErrors.push(`${item.product_name}: no longer available`);
          } else if (live.in_stock === false) {
            stockErrors.push(`${item.product_name}: out of stock`);
          } else if (live.stock_quantity != null && live.stock_quantity < item.quantity) {
            stockErrors.push(`${item.product_name}: only ${live.stock_quantity} left (requested ${item.quantity})`);
          }
        });
        if (stockErrors.length > 0) {
          return Response.json({ error: stockErrors.join('; ') }, { status: 409 });
        }
        verifiedItems = items.map(item => {
          const live = productMap[item.product_id];
          if (live) {
            return { ...item, price: live.price, category: live.category || item.category, subtotal: live.price * item.quantity };
          }
          return item;
        });
      }
      verifiedSubtotal = verifiedItems.reduce((sum, i) => sum + (i.subtotal || i.price * i.quantity), 0);
      // Recalculate alcohol excise tax server-side from verified categories
      const EXCISE_RATES = { beer: 0.01, wine: 0.03, spirits: 0.03 };
      verifiedAlcoholExciseTax = verifiedItems.reduce((sum, item) => {
        const rate = EXCISE_RATES[item.category] || 0;
        return sum + (item.subtotal || item.price * item.quantity) * rate;
      }, 0);
    } catch (e) {
      console.error('Price verification error:', e);
      // Fall back to client prices if DB lookup fails
      verifiedSubtotal = items.reduce((sum, i) => sum + (i.subtotal || i.price * i.quantity), 0);
      verifiedAlcoholExciseTax = alcohol_excise_tax || 0;
    }

    // --- Server-side delivery compliance verification ---
    // Geocode the delivery address, match against approved zones, verify wet/dry
    // status, legal hours, and retailer compliance — never trust client-submitted
    // zone/fee/tax values.
    const stores = await base44.asServiceRole.entities.Store.filter({ id: store_id }, 'name', 1);
    const storeRecord = stores[0];
    if (!storeRecord) {
      return Response.json({ error: 'Selected store not found' }, { status: 400 });
    }
    if (storeRecord.compliance_status !== 'compliant' || !storeRecord.is_active) {
      return Response.json({ error: 'Selected retailer is not licensed or approved for delivery' }, { status: 403 });
    }

    const zones = await base44.asServiceRole.entities.DeliveryZone.filter({ is_active: true }, 'name', 100);
    const compliance = await verifyDeliveryCompliance({
      deliveryAddress: delivery_address,
      store: storeRecord,
      zones,
    });
    if (!compliance.approved) {
      return Response.json({ error: compliance.rejectionReason || 'Delivery is not available at this address' }, { status: 403 });
    }

    // Recalculate fees from the verified subtotal using server-derived zone values.
    // Round each component to cents before summing so the Stripe line-item total
    // and the stored grand_total reconcile exactly (no penny-off drift).
    const roundCents = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const verifiedSubtotalR = roundCents(verifiedSubtotal);
    const verifiedDeliveryFee = roundCents(compliance.deliveryFee);
    const verifiedMileageSurcharge = roundCents(compliance.mileageSurcharge);
    const verifiedTaxRate = compliance.taxRate;
    const verifiedDistanceMiles = compliance.distanceMiles;
    const verifiedServiceFee = roundCents(verifiedSubtotalR * 0.25);
    const verifiedTax = roundCents(verifiedSubtotalR * verifiedTaxRate);
    const verifiedAlcoholExciseTaxR = roundCents(verifiedAlcoholExciseTax);
    const verifiedTip = roundCents(tip || 0);
    const verifiedTotal = roundCents(
      verifiedSubtotalR + verifiedDeliveryFee + verifiedMileageSurcharge +
      verifiedServiceFee + verifiedTax + verifiedAlcoholExciseTaxR + verifiedTip
    );

    // --- Referral credit: verify the user's actual balance and create a Stripe coupon ---
    let referralCreditCents = 0;
    let couponId = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: customer_email });
      if (users.length > 0 && users[0].referral_credits > 0) {
        // Cap credit at the order total — can't discount below $0
        referralCreditCents = Math.min(users[0].referral_credits, Math.round(verifiedTotal * 100));
        if (referralCreditCents >= 50) { // Stripe minimum coupon amount is $0.50
          const coupon = await stripe.coupons.create({
            amount_off: referralCreditCents,
            currency: 'usd',
            duration: 'once',
            name: 'Referral Credit',
          });
          couponId = coupon.id;
        }
      }
    } catch (e) {
      console.error('Failed to check referral credits:', e.message);
    }

    // Build line items from verified cart items
    const lineItems = verifiedItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.product_name,
          description: `From ${store_name}`,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    if (verifiedDeliveryFee > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'Delivery Fee' }, unit_amount: Math.round(verifiedDeliveryFee * 100) }, quantity: 1 });
    if (verifiedMileageSurcharge > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: `Mileage Surcharge (${verifiedDistanceMiles?.toFixed(1)} mi)` }, unit_amount: Math.round(verifiedMileageSurcharge * 100) }, quantity: 1 });
    if (verifiedServiceFee > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'Service Fee' }, unit_amount: Math.round(verifiedServiceFee * 100) }, quantity: 1 });
    if (verifiedTax > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'Sales Tax' }, unit_amount: Math.round(verifiedTax * 100) }, quantity: 1 });
    if (verifiedAlcoholExciseTaxR > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'AR Alcohol Excise Tax' }, unit_amount: Math.round(verifiedAlcoholExciseTaxR * 100) }, quantity: 1 });
    if (verifiedTip > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'Driver Tip' }, unit_amount: Math.round(verifiedTip * 100) }, quantity: 1 });

    const origin = req.headers.get('origin') || 'https://app.base44.com';

    // Store all order data in metadata so the webhook can create the order after payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      success_url: `${origin}/orders?payment=success&order=${order_number}`,
      cancel_url: `${origin}/checkout?payment=cancelled`,
      customer_email: customer_email,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        order_number,
        customer_email: customer_email,
        customer_name,
        customer_phone,
        delivery_address,
        notes: notes || '',
        store_id,
        store_name,
        store_email: storeRecord.email || '',
        subtotal: String(verifiedSubtotalR),
        delivery_fee: String(verifiedDeliveryFee),
        mileage_surcharge: String(verifiedMileageSurcharge),
        distance_miles: String(verifiedDistanceMiles),
        delivery_latitude: compliance.coords ? String(compliance.coords.lat) : '',
        delivery_longitude: compliance.coords ? String(compliance.coords.lon) : '',
        service_fee: String(verifiedServiceFee),
        tax: String(verifiedTax),
        alcohol_excise_tax: String(verifiedAlcoholExciseTaxR),
        tip: String(verifiedTip),
        grand_total: String(verifiedTotal),
        is_in_legal_zone: String(compliance.approved),
        date_of_birth: date_of_birth || '',
        referral_credit_applied: String(referralCreditCents),
        // Store serialized items (up to Stripe's 500 char limit per value)
        items_json: JSON.stringify(verifiedItems),
      },
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});