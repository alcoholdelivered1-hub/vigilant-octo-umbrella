import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { store_id, formData } = await req.json();

    if (!store_id) {
      return Response.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Fetch the store as service role (bypasses RLS)
    const store = await base44.asServiceRole.entities.Store.get(store_id);
    if (!store) {
      return Response.json({ error: 'Store not found' }, { status: 404 });
    }

    // Update the store with form data and mark contract as signed
    await base44.asServiceRole.entities.Store.update(store_id, {
      name: formData.storeName || store.name,
      license_number: formData.licenseNumber || store.license_number,
      address: formData.address || store.address,
      city: formData.city || store.city,
      state: formData.state || store.state || 'AR',
      zip_code: formData.zipCode || store.zip_code,
      county: formData.county || store.county,
      phone: formData.phone || store.phone,
      email: formData.email || user.email,
      pos_system: formData.posSystem || undefined,
      onboarding_status: 'contract_signed',
    });

    return Response.json({
      success: true,
      store_id,
      store_name: formData.storeName || store.name,
    });
  } catch (error) {
    console.error('signRetailerContract error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});