import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse optional batch params
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;
    const offset = body.offset || 0;

    // Get all products without images
    const products = await base44.asServiceRole.entities.Product.list();
    const noImage = products.filter(p => !p.image_url);

    if (!noImage.length) {
      return Response.json({ message: 'All products already have images', total_remaining: 0 });
    }

    // Deduplicate by name+brand
    const seen = new Set();
    const uniqueProducts = [];
    const nameToIds = {}; // name|brand -> [product ids across stores]

    for (const p of noImage) {
      const key = `${p.name}|${p.brand}`;
      if (!nameToIds[key]) nameToIds[key] = [];
      nameToIds[key].push(p.id);
      if (!seen.has(key)) { seen.add(key); uniqueProducts.push(p); }
    }

    // Take a batch of unique products
    const batch = uniqueProducts.slice(offset, offset + batchSize);
    const remaining = uniqueProducts.length - offset - batch.length;

    let generated = 0;

    for (const product of batch) {
      const key = `${product.name}|${product.brand}`;
      const prompt = `Professional product photography of a ${product.name} bottle by ${product.brand}. Clean white background, studio lighting, sharp focus, retail product shot.`;

      const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
      const imageUrl = result?.url;

      if (imageUrl) {
        // Apply to all products with the same name+brand across all stores
        for (const id of nameToIds[key]) {
          await base44.asServiceRole.entities.Product.update(id, { image_url: imageUrl });
        }
        generated++;
      }
    }

    return Response.json({
      success: true,
      batch_processed: batch.length,
      images_generated: generated,
      remaining_unique_products: remaining,
      next_offset: offset + batchSize,
    });
  } catch (error) {
    console.error('Image generation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});