const zone = 'America/Chicago';
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
export function revenueDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function previousRevenueDate() {
  const today = revenueDate(new Date());
  return new Date(new Date(`${today}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}
export async function revenueRecords(entity, filter) {
  const records = [];
  let cursor = null;
  do {
    const page = await entity.filter(filter, { sort: 'id', limit: 100, cursor });
    records.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return records;
}
export function storeRevenueTotals(orders) {
  const sum = key => orders.reduce((total, order) => total + (Number.isFinite(order[key]) ? order[key] : 0), 0);
  return { orders: orders.length, sales: sum('subtotal'), tax: sum('tax'), delivery: sum('delivery_fee') + sum('mileage_surcharge'), tips: sum('tip'), charged: sum('total'), service: sum('service_fee') };
}