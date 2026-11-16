export async function readRichardOrderRelease(base44, order, store) {
  const releases = await base44.asServiceRole.entities.OrderRelease.filter({ order_id: order.id });
  const clover = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: store.id });
  const products = await base44.asServiceRole.entities.Product.filter({ store_id: store.id, id: { $in: (order.items || []).map(item => item.product_id).filter(Boolean) } });
  const approved = releases.find(r => r.payment_reconciled === true && r.retailer_sale_confirmed === true && r.final_items_and_total_approved === true);
  const blockers = [];
  if (!store.is_active || store.onboarding_status !== 'live') blockers.push('Complete Beverage King’s verified launch requirements.');
  if (store.stripe_connection_status !== 'connected') blockers.push('Complete Beverage King’s Stripe verification and bank setup.');
  if (order.stripe_payment_status !== 'paid') blockers.push('Confirm payment before accepting this order.');
  if (order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) blockers.push('Resolve the customer ID or legal delivery-zone hold.');
  if (!approved) {
    blockers.push('Admin must reconcile the original $40.63 payment in its original processor/account; do not charge Richard again.');
    blockers.push('Beverage King must confirm the retailer sale, exact items, available stock and final prices.');
    blockers.push('Record Richard’s approval of the exact final items and total before release.');
  }
  if (!clover.some(c => c.status === 'connected' && c.merchant_id === 'YJSBZTD0WJ201')) blockers.push('Reconnect Beverage King’s verified Clover merchant before fulfillment.');
  for (const item of order.items || []) {
    const product = products.find(p => p.id === item.product_id);
    if (!product) blockers.push(`Verify the current product for ${item.product_name}; its saved inventory record is missing.`);
    else {
      if (product.name?.trim().toLowerCase() !== item.product_name?.trim().toLowerCase()) blockers.push(`Correct item identity: the saved ${item.product_name} reference now points to ${product.name}. Do not substitute without Richard’s approval.`);
      if (!approved && Math.round(product.price * 100) !== Math.round(item.price * 100)) blockers.push(`Confirm ${item.product_name} pricing: the order records $${Number(item.price).toFixed(2)}, while inventory lists $${Number(product.price).toFixed(2)}. Record the agreed sale price before release.`);
      if (!product.in_stock || (Number.isFinite(product.stock_quantity) && product.stock_quantity < item.quantity)) blockers.push(`Confirm sufficient stock for ${item.product_name}.`);
    }
  }
  return { release_ready: blockers.length === 0, release_blockers: blockers };
}