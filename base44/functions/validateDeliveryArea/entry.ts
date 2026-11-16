import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { geocodeDeliveryAddress, verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';
import { evaluateSundayDelivery, isSunday } from '../../shared/sundaySalesRules.ts';

// Read-only public address check; no payment, account changes or caller-selected URLs.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const { store_id, delivery_address } = await req.json();
    if (typeof store_id !== 'string' || !store_id || store_id.length > 100 || typeof delivery_address !== 'string' || delivery_address.length < 8 || delivery_address.length > 400) return Response.json({ error: 'A retailer and full delivery address are required.' }, { status: 400 });
    const base44 = createClientFromRequest(req);
    const store = await base44.entities.Store.get(store_id);
    if (!store?.is_active || store.onboarding_status !== 'live') return Response.json({ error: 'This retailer is not accepting delivery orders.' }, { status: 409 });
    const coordinates = await geocodeDeliveryAddress(delivery_address);
    const evidence = await verifyABCDeliveryArea(store, coordinates.latitude, coordinates.longitude);
    if (isSunday(new Date())) {
      const { items: jurisdictions } = await base44.entities.SundaySalesJurisdiction.list({ limit: 200 });
      const sunday = evaluateSundayDelivery(jurisdictions, { city: coordinates.city, county: evidence.delivery_county }, new Date());
      if (!sunday.allowed) return Response.json({ error: sunday.reason, sunday_sales: sunday }, { status: 403 });
      return Response.json({ success: true, ...coordinates, ...evidence, sunday_sales: { sunday: true, allowed: true } });
    }
    return Response.json({ success: true, ...coordinates, ...evidence });
  } catch (error) {
    console.error('ABC delivery-area check:', error.message);
    return Response.json({ error: error.message }, { status: 403 });
  }
}