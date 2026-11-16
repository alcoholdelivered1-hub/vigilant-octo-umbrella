const text = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
const nameKey = product => [product.name,product.brand,product.volume].map(text).join('|');

export function inventoryUploadPlan(rows, products) {
  const plan = [], errors = [], seen = new Set();
  for (const row of rows) {
    let matches = [];
    if (row.product_id) {
      matches = products.filter(product => product.id === row.product_id);
      if (!matches.length) { errors.push(`Row ${row.row}: product_id does not belong to this store.`); continue; }
    } else {
      for (const key of ['external_id','sku','upc']) {
        if (!row.update[key]) continue;
        const identified = products.filter(product => text(product[key]) === text(row.update[key]));
        matches.push(...identified);
      }
      matches = [...new Map(matches.map(product => [product.id,product])).values()];
      if (!matches.length) matches = products.filter(product => nameKey(product) === nameKey(row.update));
    }
    if (matches.length > 1) { errors.push(`Row ${row.row}: multiple existing products match. Include the correct product_id.`); continue; }
    const existing = matches[0];
    const identity = existing?.id || ['external_id','sku','upc'].map(key => row.update[key] ? `${key}:${text(row.update[key])}` : '').filter(Boolean)[0] || nameKey(row.update);
    const keys = [identity, ...['external_id','sku','upc'].filter(key => row.update[key]).map(key => `${key}:${text(row.update[key])}`), `name:${nameKey(row.update)}`];
    if (keys.some(key => seen.has(key))) { errors.push(`Row ${row.row}: this product occurs more than once in the file.`); continue; }
    keys.forEach(key => seen.add(key));
    if (existing?.inventory_source === 'clover') { errors.push(`Row ${row.row}: ${existing.name} is Clover-managed. Change it in the POS instead.`); continue; }
    plan.push({ ...row, existing, action:existing ? 'update' : 'create' });
  }
  return { plan, errors };
}