import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendSms, normalizePhone } from '../../shared/twilioSms.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { to, body } = await req.json();
    if (!to) return Response.json({ error: 'Recipient phone number is required' }, { status: 400 });
    if (!body || !body.trim()) return Response.json({ error: 'Message body is required' }, { status: 400 });

    const normalized = normalizePhone(to);
    if (!normalized) return Response.json({ error: `Invalid phone number: ${to}` }, { status: 400 });

    const result = await sendSms(normalized, body.trim());
    return Response.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('sendSMS error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}