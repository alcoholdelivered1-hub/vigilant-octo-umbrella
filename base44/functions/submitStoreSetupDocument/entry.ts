import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { requireUnambiguousRetailer } from '../../shared/retailerSetupAccess.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to submit setup documents.' }, { status: 401 });
    const { store_id, kind, filename, file_uri } = await req.json();
    if (typeof store_id !== 'string' || store_id.length > 100 || !['retail_license', 'signed_agreement', 'inventory_export', 'pos_details'].includes(kind) || typeof filename !== 'string' || filename.length > 200 || !/\.(pdf|png|jpe?g|webp|csv|xlsx)$/i.test(filename) || typeof file_uri !== 'string' || !file_uri || file_uri.length > 2048) {
      return Response.json({ error: 'Choose a supported private setup document.' }, { status: 400 });
    }
    const store = await base44.entities.Store.get(store_id);
    if (!store) return Response.json({ error: 'Store not found.' }, { status: 404 });
    const contacts = [...new Set([store.email, ...(store.contact_emails || [])].filter(Boolean).flatMap(email => [email, email.toLowerCase()]))];
    if (user.role !== 'admin' && !contacts.some(email => email.toLowerCase() === user.email?.toLowerCase())) return Response.json({ error: 'This store is not linked to your account.' }, { status: 403 });
    await requireUnambiguousRetailer(base44,store);
    // The user-scoped signer rejects inaccessible uploads; public URLs are not evidence.
    if (/^https?:/i.test(file_uri)) return Response.json({ error:'Upload evidence privately; public URLs are not accepted.' },{ status:400 });
    await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 });
    const existing = await base44.asServiceRole.entities.StoreSetupDocument.filter({ store_id:store.id,kind,file_uri,submitted_by:user.email },'-created_date',1);
    if (existing.length) return Response.json({ success:true,id:existing[0].id,status:existing[0].status,duplicate:true });
    const doc = await base44.asServiceRole.entities.StoreSetupDocument.create({
      store_id: store.id, store_name: store.name, contact_emails: contacts,
      kind, filename, file_uri, submitted_by: user.email, status: 'pending_review',
    });
    return Response.json({ success: true, id: doc.id, status: doc.status });
  } catch (error) {
    console.error('Store setup document submission failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}