import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, store_id, driver_id, device_info } = await req.json();
    if (!token) return Response.json({ error: 'token is required' }, { status: 400 });

    // Check if this token is already registered for this user
    const existing = await base44.asServiceRole.entities.FCMToken.filter({ user_email: user.email, token });

    if (existing.length > 0) {
      // Update existing record (refresh updated_date)
      await base44.asServiceRole.entities.FCMToken.update(existing[0].id, {
        store_id: store_id || existing[0].store_id,
        driver_id: driver_id || existing[0].driver_id,
        device_info: device_info || existing[0].device_info,
        user_role: user.role || 'user',
      });
      console.log(`FCM token refreshed for ${user.email}`);
      return Response.json({ success: true, updated: true });
    }

    // Register new token
    await base44.asServiceRole.entities.FCMToken.create({
      user_email: user.email,
      user_role: user.role || 'user',
      token,
      store_id: store_id || '',
      driver_id: driver_id || '',
      device_info: device_info || '',
    });

    console.log(`FCM token registered for ${user.email}`);
    return Response.json({ success: true, created: true });
  } catch (error) {
    console.error('registerFCMToken error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});