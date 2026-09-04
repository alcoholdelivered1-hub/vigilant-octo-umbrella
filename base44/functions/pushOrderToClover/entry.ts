/**
 * pushOrderToClover
 * Admin-only. Creates an OPEN Clover order (no payment) with complete line items
 * for a given app Order, on the store's configured merchant. Does NOT charge.
 *
 * The order-creation logic lives in base44/shared/cloverOrderCreate.ts and is
 * shared with autoPushOrderToClover (the service-role entry used by the
 * "Fulfill Order After Payment" workflow). This wrapper only adds the admin
 * auth check.
 *
 * POST body: { order_id: string, force?: boolean }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCloverOrderForOrder } from '../../shared/cloverOrderCreate.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { order_id, force } = body;
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const result = await createCloverOrderForOrder(base44, order_id, { force });

    if (result.success) {
      return Response.json({
        success: true,
        order_number: result.order_number,
        store_id: result.store_id,
        clover: result.clover,
        confirm_in_dashboard: `https://www.clover.com/dashboard/orders/${result.clover.order_id}`,
      });
    }

    if (result.skipped) {
      return Response.json({
        success: false,
        skipped: true,
        reason: result.reason,
        clover_order_id: result.clover_order_id ?? null,
        payment_status: result.payment_status ?? null,
        hint: 'Pass force=true to re-push (e.g. after deleting the Clover order).',
      });
    }

    // Error case
    const { httpStatus, ...rest } = result;
    return Response.json(rest, { status: httpStatus || 500 });
  } catch (error) {
    console.error('[pushOrderToClover] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}