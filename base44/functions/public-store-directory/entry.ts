import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isPublicStore, isOrderingStore, publicStore } from '../../shared/publicStore.ts';

export default async function(req) {
  if (req.method !== 'POST') return Response.json({error:'Method not allowed.'},{status:405});
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const query = { $or: [{ is_active: true }, { is_browsable: true }] };
    const rows = await base44.asServiceRole.entities.Store.filter(query, 'name', 500);
    const stores = rows.filter(isPublicStore)
      .filter(store => !body?.store_id || store.id === body.store_id)
      .filter(store => !body?.live_only || isOrderingStore(store))
      .map(publicStore);
    return Response.json({stores});
  } catch (error) {
    console.error('Public store directory unavailable:', error.message);
    return Response.json({error:'Stores could not be loaded. Please try again.'},{status:503});
  }
}
