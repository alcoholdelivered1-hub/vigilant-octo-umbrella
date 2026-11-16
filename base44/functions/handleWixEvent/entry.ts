import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const data = body.data || {};
    const eventType = data.eventType || data.metadata?.eventType || 'unknown';
    const entity = data.entity || {};

    console.log('Wix event received:', eventType);

    // Route based on event type
    if (eventType === 'wix.forms.v4.submission_created') {
      const fields = entity.fields || entity.submission || {};
      console.log('Form submission:', JSON.stringify(fields).slice(0, 500));
      return Response.json({ success: true, event: eventType, fields });
    }

    if (eventType?.startsWith('wix.ecom.v1.')) {
      const orderId = entity.id || entity.number;
      const lineItems = entity.lineItems || [];
      console.log('eCommerce event:', eventType, 'Order:', orderId);
      return Response.json({ success: true, event: eventType, orderId, itemCount: lineItems.length });
    }

    if (eventType?.startsWith('wix.contacts.v4.')) {
      const contactId = entity.id;
      console.log('Contact event:', eventType, 'Contact:', contactId);
      return Response.json({ success: true, event: eventType, contactId });
    }

    if (eventType?.startsWith('wix.data.v2.')) {
      const collectionId = entity.collectionId || data.metadata?.entityId;
      console.log('CMS event:', eventType, 'Collection:', collectionId);
      return Response.json({ success: true, event: eventType, collectionId });
    }

    return Response.json({ success: true, event: eventType, note: 'Unhandled event type' });
  } catch (error) {
    console.error('Wix event handler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}