export function retailerProductChanges(payload, creating) {
  const update = {};
  for (const [key, limit] of [['name', 200], ['brand', 200], ['volume', 100], ['description', 2000]]) {
    if (payload[key] === undefined) continue;
    if (typeof payload[key] !== 'string' || payload[key].length > limit) return { error: `Enter a valid ${key} (up to ${limit} characters).` };
    update[key] = payload[key].trim();
  }
  if ((creating || payload.name !== undefined) && !update.name) return { error: 'Product name is required.' };
  if (creating || payload.category !== undefined) {
    if (!['beer', 'wine', 'spirits', 'mixers', 'accessories'].includes(payload.category)) return { error: 'Select a valid product category.' };
    update.category = payload.category;
  }
  if (creating || payload.price !== undefined) {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0.01 || price > 10000) return { error: 'Enter a price between $0.01 and $10,000.' };
    update.price = Number(price.toFixed(2));
    update.inventory_source = 'manual';
    update.last_synced_at = new Date().toISOString();
  }
  if (payload.stock_quantity !== undefined) {
    const qty = payload.stock_quantity === null ? null : Number(payload.stock_quantity);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0 || qty > 100000)) return { error: 'Enter a stock quantity between 0 and 100,000.' };
    update.stock_quantity = qty === null ? null : Math.floor(qty);
  } else if (creating) update.stock_quantity = null;
  if (payload.in_stock !== undefined) {
    if (typeof payload.in_stock !== 'boolean') return { error: 'Availability must be true or false.' };
    update.in_stock = payload.in_stock;
  } else if (creating) update.in_stock = true;
  if (payload.reason !== undefined && (typeof payload.reason !== 'string' || payload.reason.length > 1000)) return { error: 'Enter a price-change reason of up to 1,000 characters.' };
  if (!Object.keys(update).length) return { error: 'No supported product change supplied.' };
  return { update };
}