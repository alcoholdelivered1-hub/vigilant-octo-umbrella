import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { retailerProductChanges } from '../../shared/retailerProductChanges.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json();
    const { action = 'update', product_id, store_id } = payload;
    if (!['create', 'update', 'delete'].includes(action)) return Response.json({ error: 'Unsupported product action.' }, { status: 400 });
    const creating = action === 'create';
    const id = creating ? store_id : product_id;
    if (typeof id !== 'string' || !id || id.length > 100) return Response.json({ error: creating ? 'store_id is required' : 'product_id is required' }, { status: 400 });
    const product = creating ? null : await base44.asServiceRole.entities.Product.get(product_id);
    if (!creating && !product) return Response.json({ error: 'Product not found' }, { status: 404 });
    const store = await base44.asServiceRole.entities.Store.get(creating ? store_id : product.store_id);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    const email = user.email?.trim().toLowerCase();
    const ownsStore = email && [store.email, ...(store.contact_emails || [])].some(contact => typeof contact === 'string' && contact.trim().toLowerCase() === email);
    if (user.role !== 'admin' && !ownsStore) return Response.json({ error: 'You can only manage products for your own store.' }, { status: 403 });
    if (!creating && store_id !== undefined && store_id !== store.id) return Response.json({ error: 'This product does not belong to the selected store.' }, { status: 409 });
    if (action === 'delete') {
      await base44.asServiceRole.entities.Product.delete(product.id);
      return Response.json({ success: true, product_id: product.id, deleted: true });
    }
    const { update, error } = retailerProductChanges(payload, creating);
    if (error) return Response.json({ error }, { status: 400 });
    if (!creating && update.price !== undefined && Number(product.price) !== update.price) {
      await base44.asServiceRole.entities.RetailerPriceAudit.create({
        store_id: store.id, product_id: product.id, product_name: product.name,
        old_price: Number(product.price || 0), new_price: update.price, changed_by_email: user.email,
        change_reason: payload.reason || 'Retailer manual price correction', changed_at: new Date().toISOString(),
      });
    }
    const saved = creating
      ? await base44.asServiceRole.entities.Product.create({ ...update, store_id: store.id })
      : await base44.asServiceRole.entities.Product.update(product.id, update);
    return Response.json({ success: true, product_id: saved.id, ...update });
  } catch (error) {
    console.error('Retailer product update error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}