/**
 * autoPushOrderToClover
 * Service-role entry (no admin auth). Creates an OPEN Clover order (no payment)
 * with complete line items for a given app Order, on the store's configured
 * merchant, then saves the Clover order id on the Order. Does NOT charge.
 *
 * Invoked by the "Fulfill Order After Payment" workflow after Stripe confirms
 * payment. The shared logic (base44/shared/cloverOrderCreate.ts) enforces
 * idempotency, the paid-status guard, and the merchant-scoped token check.
 *
 * POST body: { order_id: string, force?: boolean }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCloverOrderForOrder } from '../../shared/cloverOrderCreate.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { order_id, force } = body;
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const result = await createCloverOrderForOrder(base44, order_id, { force });
    const status = result.httpStatus || (result.success ? 200 : (result.skipped ? 200 : 500));
    const { httpStatus, ...rest } = result;
    return Response.json(rest, { status });
  } catch (error) {
    console.error('[autoPushOrderToClover] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}