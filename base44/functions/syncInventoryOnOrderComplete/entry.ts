import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const order = payload.data;

    // Only process delivered orders
    if (!order || order.status !== 'delivered') {
        return Response.json({ skipped: true, reason: 'Order is not delivered' });
    }

    if (!order.items || order.items.length === 0) {
        return Response.json({ skipped: true, reason: 'Order has no items' });
    }

    const results = [];

    for (const item of order.items) {
        const productId = item.product_id;
        if (!productId) continue;

        // Fetch the current product record
        const product = await base44.asServiceRole.entities.Product.get(productId);
        if (!product) {
            results.push({ product_id: productId, skipped: true, reason: 'Product not found' });
            continue;
        }

        // Decrement stock_quantity if tracked, otherwise mark out_of_stock if quantity hits 0
        const currentQty = product.stock_quantity ?? null;

        if (currentQty !== null) {
            const newQty = Math.max(0, currentQty - (item.quantity || 1));
            await base44.asServiceRole.entities.Product.update(productId, {
                stock_quantity: newQty,
                in_stock: newQty > 0,
            });
            results.push({ product_id: productId, name: product.name, prev_qty: currentQty, new_qty: newQty });
        } else {
            // No quantity tracking — just ensure in_stock remains true (already sold, stock unknown)
            results.push({ product_id: productId, name: product.name, skipped: true, reason: 'No stock_quantity field tracked' });
        }
    }

    return Response.json({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        items_processed: results.length,
        results,
    });
});